param(
    [int]$DelaySeconds = 0,
    [long]$TargetHwnd = 0,
    [int]$TargetPid = 0
)

if ($DelaySeconds -gt 0) {
    Write-Output "Waiting $DelaySeconds seconds before inspecting Antigravity window..."
    Start-Sleep -Seconds $DelaySeconds
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase

$code = @'
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Automation;

public class PromptSubtreeInspector {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public class HierarchyNode {
        public int Depth { get; set; }
        public string Name { get; set; }
        public string ControlType { get; set; }
        public string AutomationId { get; set; }
        public string ClassName { get; set; }
        public bool IsEnabled { get; set; }
        public string BoundingRectangle { get; set; }
        public List<string> SupportedPatterns { get; set; }
        public bool IsRecommendedOption { get; set; }
        public bool IsSubmitCandidate { get; set; }
        public List<HierarchyNode> Children { get; set; }

        public HierarchyNode() {
            SupportedPatterns = new List<string>();
            Children = new List<HierarchyNode>();
        }
    }

    public class PromptInspectionResult {
        public string Timestamp { get; set; }
        public long TargetHwnd { get; set; }
        public uint ProcessId { get; set; }
        public string WindowTitle { get; set; }
        public string WindowClass { get; set; }
        public bool PromptFound { get; set; }
        public string DetectedPromptType { get; set; }
        public string ContainerClassName { get; set; }
        public string ContainerBoundingRect { get; set; }
        public HierarchyNode RootSubtree { get; set; }
        public List<string> OptionsIdentified { get; set; }
        public string ExplicitRecommendedOption { get; set; }
        public List<string> CandidateSubmitButtons { get; set; }
        public List<string> CandidateCancelButtons { get; set; }
        public List<string> Warnings { get; set; }

        public PromptInspectionResult() {
            OptionsIdentified = new List<string>();
            CandidateSubmitButtons = new List<string>();
            CandidateCancelButtons = new List<string>();
            Warnings = new List<string>();
            ExplicitRecommendedOption = "None";
            DetectedPromptType = "None";
        }
    }

    public class InspectorConfig {
        public long TargetHwnd;
        public int TargetPid;
        public int TimeoutSec;
    }

    public static IntPtr FoundHwnd = IntPtr.Zero;
    public static uint FoundPid = 0;
    public static string FoundTitle = "";
    public static string FoundClass = "";
    private static PromptInspectionResult SharedResult = null;

    private static bool WindowSearchCallback(IntPtr hWnd, IntPtr lParam) {
        if (!IsWindowVisible(hWnd)) return true;
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString().Trim();
        if (string.IsNullOrEmpty(title)) return true;

        StringBuilder sbClass = new StringBuilder(256);
        GetClassName(hWnd, sbClass, 256);
        string cls = sbClass.ToString();

        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        bool isTarget = (
            cls.IndexOf("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase) >= 0 &&
            (title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Visual Studio Code", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Cursor", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Click", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Workspace", StringComparison.OrdinalIgnoreCase) >= 0)
        ) || (
            title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0
        );

        if (isTarget) {
            FoundHwnd = hWnd;
            FoundTitle = title;
            FoundClass = cls;
            FoundPid = pid;
            return false; // Found candidate!
        }
        return true;
    }

    private static string GetElementFullText(AutomationElement elem) {
        if (elem == null) return "";
        try {
            string name = (elem.Current.Name ?? "").Trim();
            if (!string.IsNullOrEmpty(name)) return name;

            AutomationElementCollection children = elem.FindAll(TreeScope.Children, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Text));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < children.Count; i++) {
                string cName = (children[i].Current.Name ?? "").Trim();
                if (!string.IsNullOrEmpty(cName)) {
                    if (sb.Length > 0) sb.Append(" ");
                    sb.Append(cName);
                }
            }
            if (sb.Length > 0) return sb.ToString();
            return elem.Current.AutomationId ?? "";
        } catch {
            return "";
        }
    }

    private static void WalkSubtree(AutomationElement elem, HierarchyNode parentNode, int currentDepth, int maxDepth, PromptInspectionResult result) {
        if (currentDepth > maxDepth || elem == null) return;

        try {
            AutomationElementCollection children = elem.FindAll(TreeScope.Children, Condition.TrueCondition);
            for (int i = 0; i < children.Count; i++) {
                AutomationElement child = children[i];
                HierarchyNode node = new HierarchyNode();
                node.Depth = currentDepth;
                node.Name = GetElementFullText(child);
                node.ControlType = child.Current.ControlType != null ? child.Current.ControlType.ProgrammaticName.Replace("ControlType.", "") : "Unknown";
                node.AutomationId = child.Current.AutomationId ?? "";
                node.ClassName = child.Current.ClassName ?? "";
                node.IsEnabled = child.Current.IsEnabled;
                node.BoundingRectangle = child.Current.BoundingRectangle.ToString();

                AutomationPattern[] patterns = child.GetSupportedPatterns();
                if (patterns != null) {
                    foreach (AutomationPattern p in patterns) {
                        node.SupportedPatterns.Add(p.ProgrammaticName.Replace("PatternIdentifiers.Pattern", ""));
                    }
                }

                string lowerName = node.Name.ToLowerInvariant();

                // Check for Recommendation marker
                if (lowerName.Contains("(recommended)") || lowerName.Contains("[recommended]") || lowerName.Contains("recommended:")) {
                    node.IsRecommendedOption = true;
                    result.ExplicitRecommendedOption = node.Name;
                }

                // Check for Option / Choice controls
                if (node.ControlType == "RadioButton" || node.ControlType == "CheckBox" || node.ControlType == "ListItem" || node.ClassName.ToLowerInvariant().Contains("radio")) {
                    result.OptionsIdentified.Add(string.Format("[{0}] {1} (Enabled: {2})", node.ControlType, node.Name, node.IsEnabled));
                }

                // Check for Submit / Action buttons
                if (node.ControlType == "Button" || node.ControlType == "Hyperlink") {
                    string trimmedLower = lowerName.Trim();
                    if (trimmedLower.Contains("submit") || trimmedLower.Contains("continue") || trimmedLower.Contains("proceed") || trimmedLower.Contains("allow") || trimmedLower == "save" || trimmedLower == "yes" || trimmedLower == "ok" || trimmedLower == "run command" || trimmedLower == "confirm") {
                        node.IsSubmitCandidate = true;
                        result.CandidateSubmitButtons.Add(string.Format("'{0}' (Class: {1}, Enabled: {2})", node.Name, node.ClassName, node.IsEnabled));
                    } else if (trimmedLower.Contains("cancel") || trimmedLower.Contains("skip") || trimmedLower.Contains("deny") || trimmedLower.Contains("don't save") || trimmedLower == "no" || trimmedLower == "close") {
                        result.CandidateCancelButtons.Add(string.Format("'{0}' (Class: {1})", node.Name, node.ClassName));
                    }
                }

                parentNode.Children.Add(node);
                WalkSubtree(child, node, currentDepth + 1, maxDepth, result);
            }
        } catch (Exception ex) {
            result.Warnings.Add(string.Format("Tree walk error at depth {0}: {1}", currentDepth, ex.Message));
        }
    }

    private static void InspectorWorker(object cfgObj) {
        InspectorConfig cfg = (InspectorConfig)cfgObj;
        PromptInspectionResult result = new PromptInspectionResult();
        result.Timestamp = DateTime.UtcNow.ToString("o");

        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) {
            result.Warnings.Add("OpenDesktop('Default') failed. Error: " + Marshal.GetLastWin32Error());
            SharedResult = result;
            return;
        }

        bool switched = SetThreadDesktop(hDesk);
        if (!switched) {
            result.Warnings.Add("SetThreadDesktop failed. Error: " + Marshal.GetLastWin32Error());
            CloseDesktop(hDesk);
            SharedResult = result;
            return;
        }

        try {
            FoundHwnd = IntPtr.Zero;

            if (cfg.TargetHwnd > 0) {
                FoundHwnd = new IntPtr(cfg.TargetHwnd);
                StringBuilder sbTitle = new StringBuilder(512);
                GetWindowText(FoundHwnd, sbTitle, 512);
                FoundTitle = sbTitle.ToString();
                StringBuilder sbClass = new StringBuilder(256);
                GetClassName(FoundHwnd, sbClass, 256);
                FoundClass = sbClass.ToString();
                GetWindowThreadProcessId(FoundHwnd, out FoundPid);
            } else {
                EnumDesktopWindows(hDesk, WindowSearchCallback, IntPtr.Zero);
            }

            if (FoundHwnd == IntPtr.Zero) {
                result.Warnings.Add("Antigravity window not found on current desktop.");
                SharedResult = result;
                return;
            }

            result.TargetHwnd = FoundHwnd.ToInt64();
            result.ProcessId = FoundPid;
            result.WindowTitle = FoundTitle;
            result.WindowClass = FoundClass;

            AutomationElement root = AutomationElement.FromHandle(FoundHwnd);
            if (root == null) {
                result.Warnings.Add("AutomationElement.FromHandle returned null.");
                SharedResult = result;
                return;
            }

            System.Windows.Rect rootBounds = root.Current.BoundingRectangle;

            // Search for interactive prompt elements
            Condition candidateCond = new OrCondition(
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.RadioButton),
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.CheckBox),
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem)
            );

            AutomationElementCollection candidateControls = root.FindAll(TreeScope.Descendants, candidateCond);
            List<AutomationElement> promptActionButtons = new List<AutomationElement>();
            AutomationElement recommendedOptionElem = null;

            for (int i = 0; i < candidateControls.Count; i++) {
                try {
                    AutomationElement el = candidateControls[i];
                    string elText = GetElementFullText(el);
                    string elLower = elText.ToLowerInvariant();
                    string elCls = (el.Current.ClassName ?? "").ToLowerInvariant();

                    if (elLower.Contains("(recommended)") || elLower.Contains("[recommended]") || elLower.Contains("recommended:")) {
                        recommendedOptionElem = el;
                    }

                    if ((el.Current.ControlType == ControlType.Button || el.Current.ControlType == ControlType.Hyperlink) && !elCls.Contains("tab") && !elCls.Contains("wincaptionbutton")) {
                        if (elLower == "submit" || elLower == "continue" || elLower == "proceed" ||
                            elLower == "allow" || elLower == "run command" || elLower == "save" ||
                            elLower == "approve" || elLower == "yes" || elLower == "ok" || elLower == "confirm") {
                            promptActionButtons.Add(el);
                        }
                    }
                } catch { }
            }

            AutomationElement dialogElem = null;
            AutomationElement anchorElem = (promptActionButtons.Count > 0) ? promptActionButtons[0] : recommendedOptionElem;

            if (anchorElem != null) {
                TreeWalker walker = TreeWalker.ControlViewWalker;
                AutomationElement curr = anchorElem;

                while (curr != null) {
                    AutomationElement parent = null;
                    try { parent = walker.GetParent(curr); } catch { break; }

                    try {
                        System.Windows.Rect r = curr.Current.BoundingRectangle;
                        if (r.Height > 70 && r.Height < 700 && r.Width > 140 && r.Width < 850) {
                            dialogElem = curr;
                            break;
                        }
                    } catch { }

                    if (parent == null) {
                        dialogElem = curr;
                        break;
                    }
                    curr = parent;
                }
            }

            if (dialogElem != null || promptActionButtons.Count > 0 || recommendedOptionElem != null) {
                result.PromptFound = true;
                AutomationElement targetScope = dialogElem ?? root;
                result.ContainerClassName = targetScope.Current.ClassName ?? "DialogContainer";
                result.ContainerBoundingRect = targetScope.Current.BoundingRectangle.ToString();
                result.DetectedPromptType = (recommendedOptionElem != null) ? "Recommendation Prompt Dialog" : "Interactive Confirmation Dialog";

                HierarchyNode rootNode = new HierarchyNode();
                rootNode.Depth = 0;
                rootNode.Name = targetScope.Current.Name ?? "DialogRoot";
                rootNode.ControlType = targetScope.Current.ControlType != null ? targetScope.Current.ControlType.ProgrammaticName.Replace("ControlType.", "") : "";
                rootNode.ClassName = targetScope.Current.ClassName ?? "";
                rootNode.AutomationId = targetScope.Current.AutomationId ?? "";
                rootNode.IsEnabled = targetScope.Current.IsEnabled;
                rootNode.BoundingRectangle = targetScope.Current.BoundingRectangle.ToString();

                result.RootSubtree = rootNode;
                WalkSubtree(targetScope, rootNode, 1, 8, result);
            } else {
                result.PromptFound = false;
                result.DetectedPromptType = "No Active Modal/Dialog Container Detected";
            }

        } catch (Exception ex) {
            result.Warnings.Add("Inspector exception: " + ex.ToString());
        } finally {
            CloseDesktop(hDesk);
        }

        SharedResult = result;
    }

    public static PromptInspectionResult InspectPrompt(InspectorConfig cfg) {
        SharedResult = null;
        Thread t = new Thread(new ParameterizedThreadStart(InspectorWorker));
        t.SetApartmentState(ApartmentState.STA);
        t.Start(cfg);
        t.Join((cfg.TimeoutSec + 5) * 1000);
        return SharedResult;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies "UIAutomationClient", "UIAutomationTypes", "WindowsBase"

$outputDir = "e:\Click Application\diagnostics"
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$jsonPath = Join-Path $outputDir "phase0_1_prompt_report.json"
$summaryPath = Join-Path $outputDir "phase0_1_prompt_summary.txt"

$cfg = New-Object PromptSubtreeInspector+InspectorConfig
$cfg.TargetHwnd = $TargetHwnd
$cfg.TargetPid = $TargetPid
$cfg.TimeoutSec = 15

Write-Output "Running AutoPilot Subtree Diagnostic Inspector..."
$result = [PromptSubtreeInspector]::InspectPrompt($cfg)

if ($result -eq $null) {
    Write-Error "Inspection returned null or timed out."
    exit 1
}

$json = ConvertTo-Json $result -Depth 10
[System.IO.File]::WriteAllText($jsonPath, $json, [System.Text.Encoding]::UTF8)

$sb = New-Object System.Text.StringBuilder
$sb.AppendLine("=================================================================") | Out-Null
$sb.AppendLine("AUTOPILOT PROMPT SUBTREE INSPECTION SUMMARY") | Out-Null
$sb.AppendLine("Timestamp (UTC): " + $result.Timestamp) | Out-Null
$sb.AppendLine("Target Window HWND: " + $result.TargetHwnd + " (PID: " + $result.ProcessId + ")") | Out-Null
$sb.AppendLine("Window Title: " + $result.WindowTitle) | Out-Null
$sb.AppendLine("Prompt Detected: " + $result.PromptFound) | Out-Null
$sb.AppendLine("Prompt Type: " + $result.DetectedPromptType) | Out-Null
if ($result.PromptFound) {
    $sb.AppendLine("Container Class: " + $result.ContainerClassName) | Out-Null
    $sb.AppendLine("Container BoundingRect: " + $result.ContainerBoundingRect) | Out-Null
    $sb.AppendLine("Explicit Recommended Marker: " + $result.ExplicitRecommendedOption) | Out-Null
    $sb.AppendLine("Options Discovered: " + $result.OptionsIdentified.Count) | Out-Null
    foreach ($opt in $result.OptionsIdentified) {
        $sb.AppendLine("   * " + $opt) | Out-Null
    }
    $sb.AppendLine("Candidate Submit Buttons: " + ($result.CandidateSubmitButtons -join ", ")) | Out-Null
    $sb.AppendLine("Candidate Cancel Buttons: " + ($result.CandidateCancelButtons -join ", ")) | Out-Null
} else {
    $sb.AppendLine("Status: No live prompt modal or confirmation container was visible on screen.") | Out-Null
}
$sb.AppendLine("Warnings Encountered: " + $result.Warnings.Count) | Out-Null
foreach ($w in $result.Warnings) {
    $sb.AppendLine("  Warning: " + $w) | Out-Null
}
$sb.AppendLine("=================================================================") | Out-Null

$summaryText = $sb.ToString()
[System.IO.File]::WriteAllText($summaryPath, $summaryText, [System.Text.Encoding]::UTF8)

Write-Output $summaryText
Write-Output "Report saved to: $jsonPath"
