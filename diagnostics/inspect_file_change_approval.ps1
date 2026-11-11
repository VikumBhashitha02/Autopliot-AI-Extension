param(
    [int]$DelaySeconds = 0,
    [long]$TargetHwnd = 0,
    [int]$TargetPid = 0
)

if ($DelaySeconds -gt 0) {
    Write-Output "Waiting $DelaySeconds seconds before inspecting Antigravity file-change approval controls..."
    Start-Sleep -Seconds $DelaySeconds
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase

$code = @'
using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Automation;

public class FileChangeApprovalInspector {
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

    public class CandidateButtonInfo {
        public string Name { get; set; }
        public string AutomationId { get; set; }
        public string ControlType { get; set; }
        public string ClassName { get; set; }
        public string BoundingRectangle { get; set; }
        public bool IsEnabled { get; set; }
        public bool SupportsInvoke { get; set; }

        public CandidateButtonInfo() {
            Name = "";
            AutomationId = "";
            ControlType = "";
            ClassName = "";
            BoundingRectangle = "";
        }
    }

    public class ContainerInfo {
        public string Name { get; set; }
        public string AutomationId { get; set; }
        public string ClassName { get; set; }
        public string ControlType { get; set; }
        public string BoundingRectangle { get; set; }

        public ContainerInfo() {
            Name = "";
            AutomationId = "";
            ClassName = "";
            ControlType = "";
            BoundingRectangle = "";
        }
    }

    public class FileChangeInspectionResult {
        public string Timestamp { get; set; }
        public long TargetHwnd { get; set; }
        public uint ProcessId { get; set; }
        public string WindowTitle { get; set; }
        public string WindowClass { get; set; }
        public bool FileChangeApprovalFound { get; set; }
        public bool IsAmbiguous { get; set; }
        public string Confidence { get; set; } // NONE, LOW, MEDIUM, HIGH
        public CandidateButtonInfo ButtonFound { get; set; }
        public ContainerInfo Container { get; set; }
        public List<string> ModifiedFiles { get; set; }
        public List<string> SiblingActions { get; set; }
        public List<string> Warnings { get; set; }
        public List<string> DetectionEvidence { get; set; }

        public FileChangeInspectionResult() {
            Timestamp = DateTime.UtcNow.ToString("o");
            Confidence = "NONE";
            ModifiedFiles = new List<string>();
            SiblingActions = new List<string>();
            Warnings = new List<string>();
            DetectionEvidence = new List<string>();
        }
    }

    public class InspectorConfig {
        public long TargetHwnd;
        public int TargetPid;
    }

    public class WindowCandidate {
        public IntPtr Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
    }

    private static List<WindowCandidate> DiscoveredWindows = new List<WindowCandidate>();
    private static FileChangeInspectionResult SharedResult = null;

    private static bool WindowSearchCallback(IntPtr hWnd, IntPtr lParam) {
        if (!IsWindowVisible(hWnd)) return true;
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString().Trim();
        if (string.IsNullOrEmpty(title)) return true;

        StringBuilder sbClass = new StringBuilder(256);
        GetClassName(hWnd, sbClass, 256);
        string cls = sbClass.ToString();

        uint pid = 0;
        GetWindowThreadProcessId(hWnd, out pid);

        string tLower = title.ToLowerInvariant();
        string cLower = cls.ToLowerInvariant();

        if (tLower.Contains("antigravity") || cLower.Contains("chrome_widgetwin_1") || tLower.Contains("visual studio code") || tLower.Contains("code")) {
            DiscoveredWindows.Add(new WindowCandidate {
                Hwnd = hWnd,
                Pid = pid,
                Title = title,
                ClassName = cls
            });
        }
        return true;
    }

    private static string GetElementFullText(AutomationElement el) {
        if (el == null) return "";
        try {
            string name = el.Current.Name;
            if (!string.IsNullOrEmpty(name)) return name.Trim();
            object valPatternObj;
            if (el.TryGetCurrentPattern(ValuePattern.Pattern, out valPatternObj)) {
                ValuePattern val = (ValuePattern)valPatternObj;
                if (!string.IsNullOrEmpty(val.Current.Value)) return val.Current.Value.Trim();
            }
        } catch { }
        return "";
    }

    private static bool IsAcceptAllText(string text) {
        if (string.IsNullOrEmpty(text)) return false;
        string clean = text.Trim().ToLowerInvariant();
        // Exact and leading variations
        if (clean == "accept all" || clean == "accept all changes" || clean == "accept all files") return true;
        if (clean == "accept all..." || clean == "accept all edits") return true;
        if (clean.StartsWith("accept all")) return true;
        return false;
    }

    private static bool IsNegativeActionText(string text) {
        if (string.IsNullOrEmpty(text)) return false;
        string clean = text.Trim().ToLowerInvariant();
        return clean.Contains("discard") || clean.Contains("reject") || clean.Contains("revert") ||
               clean == "cancel" || clean == "no" || clean.Contains("don't save");
    }

    private static void InspectorWorker(object cfgObj) {
        InspectorConfig cfg = (InspectorConfig)cfgObj;
        FileChangeInspectionResult result = new FileChangeInspectionResult();
        SharedResult = result;

        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) {
            result.Warnings.Add("OpenDesktop('Default') failed. Error: " + Marshal.GetLastWin32Error());
            return;
        }

        bool switched = SetThreadDesktop(hDesk);
        if (!switched) {
            result.Warnings.Add("SetThreadDesktop failed. Error: " + Marshal.GetLastWin32Error());
            CloseDesktop(hDesk);
            return;
        }

        try {
            DiscoveredWindows.Clear();

            if (cfg.TargetHwnd > 0) {
                IntPtr h = new IntPtr(cfg.TargetHwnd);
                StringBuilder sbTitle = new StringBuilder(512);
                GetWindowText(h, sbTitle, 512);
                StringBuilder sbClass = new StringBuilder(256);
                GetClassName(h, sbClass, 256);
                uint p = 0;
                GetWindowThreadProcessId(h, out p);
                DiscoveredWindows.Add(new WindowCandidate {
                    Hwnd = h,
                    Pid = p,
                    Title = sbTitle.ToString(),
                    ClassName = sbClass.ToString()
                });
            } else {
                EnumDesktopWindows(hDesk, WindowSearchCallback, IntPtr.Zero);
            }

            if (DiscoveredWindows.Count == 0) {
                result.Warnings.Add("No matching Antigravity IDE windows discovered on interactive desktop.");
                return;
            }

            // Inspect each candidate window
            foreach (var win in DiscoveredWindows) {
                if (cfg.TargetPid > 0 && win.Pid != cfg.TargetPid) continue;

                AutomationElement root = null;
                try {
                    root = AutomationElement.FromHandle(win.Hwnd);
                } catch { continue; }
                if (root == null) continue;

                System.Windows.Rect rootBounds;
                try {
                    rootBounds = root.Current.BoundingRectangle;
                    if (rootBounds.IsEmpty) continue;
                } catch { continue; }

                // Search for candidate buttons and actionable elements
                Condition btnCond = new OrCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Custom),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Hyperlink)
                );

                AutomationElementCollection candidateButtons = root.FindAll(TreeScope.Descendants, btnCond);

                for (int b = 0; b < candidateButtons.Count; b++) {
                    try {
                        AutomationElement btnElem = candidateButtons[b];
                        string btnText = GetElementFullText(btnElem);
                        if (string.IsNullOrEmpty(btnText)) continue;

                        if (!IsAcceptAllText(btnText)) continue;

                        // Found an element with "Accept all" text!
                        // Now verify that it is NOT inside an editor body, terminal buffer, or document content
                        System.Windows.Rect btnRect = btnElem.Current.BoundingRectangle;
                        if (btnRect.IsEmpty) continue;

                        string autoId = (btnElem.Current.AutomationId ?? "").ToLowerInvariant();
                        string cls = (btnElem.Current.ClassName ?? "").ToLowerInvariant();

                        // Exclude editor text lines or document tokens
                        if (cls.Contains("view-line") || cls.Contains("monaco-token") || cls.Contains("editor-instance") || cls.Contains("terminal-wrapper")) {
                            result.Warnings.Add("Rejected text in editor line/terminal: " + btnText);
                            continue;
                        }

                        // Inspect parent and ancestor chain to locate container
                        TreeWalker walker = TreeWalker.ControlViewWalker;
                        AutomationElement current = btnElem;
                        AutomationElement containerElem = null;
                        int levelsUp = 0;

                        while (levelsUp < 6) {
                            AutomationElement parent = walker.GetParent(current);
                            if (parent == null || parent == root) break;

                            string pCls = (parent.Current.ClassName ?? "").ToLowerInvariant();
                            string pAutoId = (parent.Current.AutomationId ?? "").ToLowerInvariant();
                            string pName = (parent.Current.Name ?? "").ToLowerInvariant();
                            System.Windows.Rect pRect = parent.Current.BoundingRectangle;

                            // Typical containers for file change review/acceptance
                            bool isLikelyContainer = (
                                pCls.Contains("composite") ||
                                pCls.Contains("banner") ||
                                pCls.Contains("review") ||
                                pCls.Contains("diff") ||
                                pCls.Contains("notification") ||
                                pCls.Contains("action-bar") ||
                                pCls.Contains("widget") ||
                                pCls.Contains("card") ||
                                pAutoId.Contains("review") ||
                                pAutoId.Contains("diff") ||
                                pAutoId.Contains("change") ||
                                (pRect.Height > 25 && pRect.Height < 600 && pRect.Width > 150)
                            );

                            if (isLikelyContainer && containerElem == null) {
                                containerElem = parent;
                            }

                            current = parent;
                            levelsUp++;
                        }

                        if (containerElem == null) {
                            containerElem = walker.GetParent(btnElem);
                        }

                        // Inspect container subtree for file-change evidence & modified file names
                        List<string> foundFiles = new List<string>();
                        List<string> siblingActions = new List<string>();
                        bool hasReviewEvidence = false;

                        if (containerElem != null) {
                            Condition allDescCond = new PropertyCondition(AutomationElement.IsControlElementProperty, true);
                            AutomationElementCollection containerDescendants = containerElem.FindAll(TreeScope.Descendants, allDescCond);

                            for (int d = 0; d < containerDescendants.Count; d++) {
                                try {
                                    AutomationElement desc = containerDescendants[d];
                                    string descText = GetElementFullText(desc);
                                    if (string.IsNullOrEmpty(descText)) continue;

                                    // Check for sibling actions (Discard, Review, Reject, Diff)
                                    string descLower = descText.ToLowerInvariant();
                                    if (descLower.Contains("discard") || descLower.Contains("reject") || descLower.Contains("revert") ||
                                        descLower.Contains("keep") || descLower.Contains("diff") || descLower == "accept") {
                                        if (!siblingActions.Contains(descText)) {
                                            siblingActions.Add(descText);
                                            hasReviewEvidence = true;
                                        }
                                    }

                                    // Check for file names or paths
                                    // Match extensions like .ts, .tsx, .js, .py, .json, .css, .html, .md, .rs, .go, .c, .cpp, .cs
                                    if (Regex.IsMatch(descText, @"[\w\-\./\\]+\.(ts|tsx|js|jsx|py|json|css|html|md|rs|go|c|cpp|cs|java|yaml|yml|sql|txt|xml)\b", RegexOptions.IgnoreCase)) {
                                        Match m = Regex.Match(descText, @"[\w\-\./\\]+\.(ts|tsx|js|jsx|py|json|css|html|md|rs|go|c|cpp|cs|java|yaml|yml|sql|txt|xml)\b", RegexOptions.IgnoreCase);
                                        string fName = m.Value.Trim();
                                        if (!foundFiles.Contains(fName)) {
                                            foundFiles.Add(fName);
                                            hasReviewEvidence = true;
                                        }
                                    }

                                    // Check for change indicator text (e.g. "X files changed", "pending changes", "review changes")
                                    if (descLower.Contains("changed") || descLower.Contains("files") || descLower.Contains("review") || descLower.Contains("edits")) {
                                        hasReviewEvidence = true;
                                    }
                                } catch { }
                            }
                        }

                        // Check pattern support
                        object invPattern;
                        bool supportsInvoke = btnElem.TryGetCurrentPattern(InvokePattern.Pattern, out invPattern);

                        // Populate positive detection result
                        result.TargetHwnd = win.Hwnd.ToInt64();
                        result.ProcessId = win.Pid;
                        result.WindowTitle = win.Title;
                        result.WindowClass = win.ClassName;
                        result.FileChangeApprovalFound = true;
                        result.ModifiedFiles = foundFiles;
                        result.SiblingActions = siblingActions;

                        result.ButtonFound = new CandidateButtonInfo {
                            Name = btnText,
                            AutomationId = btnElem.Current.AutomationId ?? "",
                            ControlType = btnElem.Current.ControlType.ProgrammaticName.Replace("ControlType.", ""),
                            ClassName = btnElem.Current.ClassName ?? "",
                            BoundingRectangle = string.Format("{0},{1},{2},{3}", (int)btnRect.X, (int)btnRect.Y, (int)btnRect.Width, (int)btnRect.Height),
                            IsEnabled = btnElem.Current.IsEnabled,
                            SupportsInvoke = supportsInvoke
                        };

                        if (containerElem != null) {
                            System.Windows.Rect cr = containerElem.Current.BoundingRectangle;
                            result.Container = new ContainerInfo {
                                Name = containerElem.Current.Name ?? "",
                                AutomationId = containerElem.Current.AutomationId ?? "",
                                ClassName = containerElem.Current.ClassName ?? "",
                                ControlType = containerElem.Current.ControlType.ProgrammaticName.Replace("ControlType.", ""),
                                BoundingRectangle = string.Format("{0},{1},{2},{3}", (int)cr.X, (int)cr.Y, (int)cr.Width, (int)cr.Height)
                            };
                        }

                        // Determine confidence and ambiguity
                        if (supportsInvoke && hasReviewEvidence && (foundFiles.Count > 0 || siblingActions.Count > 0)) {
                            result.Confidence = "HIGH";
                            result.IsAmbiguous = false;
                            result.DetectionEvidence.Add("Verified actionable button inside bounded container with file review context.");
                        } else if (supportsInvoke) {
                            result.Confidence = "MEDIUM";
                            result.IsAmbiguous = false;
                            result.DetectionEvidence.Add("Candidate button found in interactive toolbar but detailed file list was sparse.");
                        } else {
                            result.Confidence = "LOW";
                            result.IsAmbiguous = true;
                            result.DetectionEvidence.Add("Button found but lacks verified InvokePattern or container context.");
                        }

                        // Successfully matched genuine button, stop searching further
                        return;
                    } catch (Exception ex) {
                        result.Warnings.Add("Error inspecting button candidate: " + ex.Message);
                    }
                }
            }
        } catch (Exception ex) {
            result.Warnings.Add("InspectorWorker error: " + ex.Message);
        } finally {
            CloseDesktop(hDesk);
        }
    }

    public static FileChangeInspectionResult RunInspection(long hwnd, int pid) {
        InspectorConfig cfg = new InspectorConfig {
            TargetHwnd = hwnd,
            TargetPid = pid
        };

        Thread staThread = new Thread(new ParameterizedThreadStart(InspectorWorker));
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start(cfg);
        staThread.Join(15000);

        return SharedResult ?? new FileChangeInspectionResult();
    }
}
'@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies "System.Runtime.InteropServices","UIAutomationClient","UIAutomationTypes","WindowsBase","System.Text.RegularExpressions"
} catch {
    # Type might already be added
}

$result = [FileChangeApprovalInspector]::RunInspection($TargetHwnd, $TargetPid)

# Save JSON report
$diagnosticsDir = $PSScriptRoot
if (-not $diagnosticsDir) { $diagnosticsDir = "diagnostics" }

$jsonReportPath = Join-Path $diagnosticsDir "phase0_1_file_change_report.json"
$summaryPath = Join-Path $diagnosticsDir "phase0_1_file_change_summary.txt"

$jsonText = $result | ConvertTo-Json -Depth 6
Set-Content -Path $jsonReportPath -Value $jsonText -Encoding UTF8

$summarySb = New-Object System.Text.StringBuilder
[void]$summarySb.AppendLine("================================================================================")
[void]$summarySb.AppendLine("AutoPilot AI — File Change Approval Inspector Report")
[void]$summarySb.AppendLine("================================================================================")
[void]$summarySb.AppendLine("Timestamp:       $($result.Timestamp)")
[void]$summarySb.AppendLine("Target Window:   $($result.WindowTitle) (HWND: $($result.TargetHwnd), PID: $($result.ProcessId))")
[void]$summarySb.AppendLine("File Change:     $($result.FileChangeApprovalFound)")
[void]$summarySb.AppendLine("Confidence:      $($result.Confidence) (Ambiguous: $($result.IsAmbiguous))")
if ($result.ButtonFound) {
    [void]$summarySb.AppendLine("Button Found:    $($result.ButtonFound.Name) [$($result.ButtonFound.ControlType)] Bounds: $($result.ButtonFound.BoundingRectangle)")
}
if ($result.Container) {
    [void]$summarySb.AppendLine("Container:       $($result.Container.ClassName) Bounds: $($result.Container.BoundingRectangle)")
}
if ($result.ModifiedFiles -and $result.ModifiedFiles.Count -gt 0) {
    [void]$summarySb.AppendLine("Modified Files:  $($result.ModifiedFiles -join ', ')")
}
if ($result.SiblingActions -and $result.SiblingActions.Count -gt 0) {
    [void]$summarySb.AppendLine("Sibling Actions: $($result.SiblingActions -join ', ')")
}
if ($result.Warnings -and $result.Warnings.Count -gt 0) {
    [void]$summarySb.AppendLine("Warnings:        $($result.Warnings -join '; ')")
}
[void]$summarySb.AppendLine("================================================================================")

Set-Content -Path $summaryPath -Value $summarySb.ToString() -Encoding UTF8

# Write output to stdout
Write-Output $jsonText

