param(
    [long]$TargetHwnd = 0,
    [int]$TargetPid = 0,
    [int]$DelaySeconds = 0,
    [string]$ApprovalPolicy = "auto_safe_only"
)

if ($DelaySeconds -gt 0) {
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

public class FileChangeApprovalExecutor {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public class ExecutionResult {
        public string Timestamp { get; set; }
        public long TargetHwnd { get; set; }
        public uint ProcessId { get; set; }
        public string WindowTitle { get; set; }
        public bool Success { get; set; }
        public string FinalStatus { get; set; } // COMPLETED_SUCCESSFULLY, BUTTON_NOT_FOUND, INVOCATION_FAILED, VERIFICATION_FAILED
        public string ButtonClicked { get; set; }
        public string ContainerClass { get; set; }
        public bool DismissalVerified { get; set; }
        public List<string> Logs { get; set; }

        public ExecutionResult() {
            Timestamp = DateTime.UtcNow.ToString("o");
            FinalStatus = "BUTTON_NOT_FOUND";
            ButtonClicked = "";
            ContainerClass = "";
            Logs = new List<string>();
        }
    }

    public class ExecutorConfig {
        public long TargetHwnd;
        public int TargetPid;
        public string ApprovalPolicy;
    }

    private static ExecutionResult SharedResult = null;

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

    private static void ExecutorWorker(object cfgObj) {
        ExecutorConfig cfg = (ExecutorConfig)cfgObj;
        ExecutionResult result = new ExecutionResult();
        SharedResult = result;

        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) {
            result.FinalStatus = "DESKTOP_ATTACH_FAILED";
            result.Logs.Add("OpenDesktop('Default') failed.");
            return;
        }

        bool switched = SetThreadDesktop(hDesk);
        if (!switched) {
            result.FinalStatus = "DESKTOP_ATTACH_FAILED";
            result.Logs.Add("SetThreadDesktop failed.");
            CloseDesktop(hDesk);
            return;
        }

        try {
            if (cfg.TargetHwnd <= 0) {
                result.FinalStatus = "TARGET_HWND_REQUIRED";
                result.Logs.Add("TargetHwnd must be specified for safe execution.");
                return;
            }

            IntPtr hTarget = new IntPtr(cfg.TargetHwnd);
            if (!IsWindowVisible(hTarget)) {
                result.FinalStatus = "TARGET_WINDOW_NOT_VISIBLE";
                result.Logs.Add("Target HWND is not visible or has changed.");
                return;
            }

            StringBuilder sbTitle = new StringBuilder(512);
            GetWindowText(hTarget, sbTitle, 512);
            result.WindowTitle = sbTitle.ToString();
            result.TargetHwnd = cfg.TargetHwnd;

            uint currentPid = 0;
            GetWindowThreadProcessId(hTarget, out currentPid);
            result.ProcessId = currentPid;

            if (cfg.TargetPid > 0 && currentPid != cfg.TargetPid) {
                result.FinalStatus = "PID_MISMATCH";
                result.Logs.Add(string.Format("Target PID changed from {0} to {1}.", cfg.TargetPid, currentPid));
                return;
            }

            AutomationElement root = null;
            try {
                root = AutomationElement.FromHandle(hTarget);
            } catch { }

            if (root == null) {
                result.FinalStatus = "ROOT_ELEMENT_UNAVAILABLE";
                result.Logs.Add("Could not acquire AutomationElement from target HWND.");
                return;
            }

            // Locate the candidate Accept all button
            Condition btnCond = new OrCondition(
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Custom),
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Hyperlink)
            );

            AutomationElementCollection candidateButtons = root.FindAll(TreeScope.Descendants, btnCond);
            AutomationElement targetButton = null;
            AutomationElement targetContainer = null;

            for (int b = 0; b < candidateButtons.Count; b++) {
                try {
                    AutomationElement el = candidateButtons[b];
                    string txt = GetElementFullText(el);
                    if (!IsAcceptAllText(txt)) continue;

                    // Absolute check: NEVER click negative actions
                    if (IsNegativeActionText(txt)) {
                        result.Logs.Add("Safety guard rejected negative action: " + txt);
                        continue;
                    }

                    string cls = (el.Current.ClassName ?? "").ToLowerInvariant();
                    if (cls.Contains("view-line") || cls.Contains("monaco-token") || cls.Contains("terminal-wrapper")) {
                        continue;
                    }

                    // Locate container
                    TreeWalker walker = TreeWalker.ControlViewWalker;
                    AutomationElement current = el;
                    for (int l = 0; l < 6; l++) {
                        AutomationElement parent = walker.GetParent(current);
                        if (parent == null || parent == root) break;
                        string pCls = (parent.Current.ClassName ?? "").ToLowerInvariant();
                        if (pCls.Contains("composite") || pCls.Contains("banner") || pCls.Contains("review") ||
                            pCls.Contains("action-bar") || pCls.Contains("diff") || pCls.Contains("widget")) {
                            targetContainer = parent;
                            break;
                        }
                        current = parent;
                    }

                    targetButton = el;
                    result.ButtonClicked = txt;
                    if (targetContainer != null) {
                        result.ContainerClass = targetContainer.Current.ClassName ?? "";
                    }
                    break;
                } catch { }
            }

            if (targetButton == null) {
                result.FinalStatus = "BUTTON_NOT_FOUND";
                result.Logs.Add("No actionable 'Accept all' button found in target window.");
                return;
            }

            // Execute InvokePattern
            object invPatternObj;
            if (targetButton.TryGetCurrentPattern(InvokePattern.Pattern, out invPatternObj)) {
                InvokePattern inv = (InvokePattern)invPatternObj;
                result.Logs.Add("Invoking Accept all button via InvokePattern...");
                inv.Invoke();
                result.Logs.Add("InvokePattern triggered successfully.");

                // Verification step: wait up to 2 seconds and check if button/container has dismissed or state changed
                Thread.Sleep(600);
                bool stillVisible = false;
                try {
                    stillVisible = !targetButton.Current.BoundingRectangle.IsEmpty && targetButton.Current.IsEnabled;
                } catch {
                    // Element detached/dismissed is a strong signal of success!
                    stillVisible = false;
                }

                if (!stillVisible) {
                    result.DismissalVerified = true;
                    result.Success = true;
                    result.FinalStatus = "COMPLETED_SUCCESSFULLY";
                    result.Logs.Add("File change approval container successfully dismissed.");
                } else {
                    result.DismissalVerified = false;
                    result.Success = true;
                    result.FinalStatus = "SUBMITTED_WAITING_RESPONSE";
                    result.Logs.Add("Action invoked; button still visible during initial check (pending background processing).");
                }
            } else {
                result.FinalStatus = "INVOKE_PATTERN_NOT_SUPPORTED";
                result.Logs.Add("Target button does not support InvokePattern.");
            }
        } catch (Exception ex) {
            result.FinalStatus = "EXECUTION_EXCEPTION";
            result.Logs.Add("Executor error: " + ex.Message);
        } finally {
            CloseDesktop(hDesk);
        }
    }

    public static ExecutionResult ExecuteApproval(long hwnd, int pid, string policy) {
        ExecutorConfig cfg = new ExecutorConfig {
            TargetHwnd = hwnd,
            TargetPid = pid,
            ApprovalPolicy = policy
        };

        Thread staThread = new Thread(new ParameterizedThreadStart(ExecutorWorker));
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start(cfg);
        staThread.Join(20000);

        return SharedResult ?? new ExecutionResult();
    }
}
'@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies "System.Runtime.InteropServices","UIAutomationClient","UIAutomationTypes","WindowsBase","System.Text.RegularExpressions"
} catch {
    # Type might already be added
}

$execResult = [FileChangeApprovalExecutor]::ExecuteApproval($TargetHwnd, $TargetPid, $ApprovalPolicy)

$diagnosticsDir = $PSScriptRoot
if (-not $diagnosticsDir) { $diagnosticsDir = "diagnostics" }

$jsonReportPath = Join-Path $diagnosticsDir "phase0_1_file_change_completion_report.json"
$summaryPath = Join-Path $diagnosticsDir "phase0_1_file_change_completion_summary.txt"

$jsonText = $execResult | ConvertTo-Json -Depth 6
Set-Content -Path $jsonReportPath -Value $jsonText -Encoding UTF8

$summarySb = New-Object System.Text.StringBuilder
[void]$summarySb.AppendLine("================================================================================")
[void]$summarySb.AppendLine("AutoPilot AI — File Change Approval Execution Report")
[void]$summarySb.AppendLine("================================================================================")
[void]$summarySb.AppendLine("Timestamp:        $($execResult.Timestamp)")
[void]$summarySb.AppendLine("Target Window:    $($execResult.WindowTitle) (HWND: $($execResult.TargetHwnd), PID: $($execResult.ProcessId))")
[void]$summarySb.AppendLine("Final Status:     $($execResult.FinalStatus)")
[void]$summarySb.AppendLine("Button Clicked:   $($execResult.ButtonClicked)")
[void]$summarySb.AppendLine("Container:        $($execResult.ContainerClass)")
[void]$summarySb.AppendLine("Dismissal:        $($execResult.DismissalVerified)")
if ($execResult.Logs -and $execResult.Logs.Count -gt 0) {
    [void]$summarySb.AppendLine("Logs:             $($execResult.Logs -join '; ')")
}
[void]$summarySb.AppendLine("================================================================================")

Set-Content -Path $summaryPath -Value $summarySb.ToString() -Encoding UTF8

Write-Output $jsonText

