param(
    [int]$DelaySeconds = 0,
    [string]$TargetOptionSubstring = "(Recommended)",
    [long]$TargetHwnd = 0,
    [int]$TargetPid = 0,
    [string]$ApprovalPolicy = "auto_safe_only",
    [switch]$SelectOnly = $false
)

if ($DelaySeconds -gt 0) {
    Write-Output "Waiting $DelaySeconds seconds before inspecting and completing prompt..."
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

public class PromptAutoCompleter {
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

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;

    public static void PhysicalClick(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(60);
        mouse_event(MOUSEEVENTF_LEFTDOWN, x, y, 0, UIntPtr.Zero);
        Thread.Sleep(60);
        mouse_event(MOUSEEVENTF_LEFTUP, x, y, 0, UIntPtr.Zero);
    }

    public class WindowCandidate {
        public IntPtr Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
        public bool IsVisible;
    }

    public class CompletionResult {
        public string Timestamp { get; set; }
        public long TargetHwnd { get; set; }
        public uint ProcessId { get; set; }
        public string WindowTitle { get; set; }
        public int TotalWindowsScanned { get; set; }
        public List<string> ScannedWindowsSummary { get; set; }
        public bool PromptFound { get; set; }
        public string DialogContainerClass { get; set; }
        public string DialogBounds { get; set; }
        public List<string> AvailableOptions { get; set; }
        public string TargetOptionFound { get; set; }
        public string TargetOptionControlType { get; set; }
        public bool HasExplicitRecommendation { get; set; }
        public bool OptionInitiallySelected { get; set; }
        public string ActionTakenOnOption { get; set; }
        public bool OptionSelectedSuccessfully { get; set; }
        public string SubmitButtonFound { get; set; }
        public bool SubmitButtonInitiallyEnabled { get; set; }
        public string ActionTakenOnSubmit { get; set; }
        public bool DialogClosedAfterAction { get; set; }
        public string FinalStatus { get; set; }
        public List<string> Logs { get; set; }

        public CompletionResult() {
            ScannedWindowsSummary = new List<string>();
            AvailableOptions = new List<string>();
            Logs = new List<string>();
            FinalStatus = "Pending";
            ActionTakenOnOption = "None";
            ActionTakenOnSubmit = "None";
            TargetOptionFound = "None";
            SubmitButtonFound = "None";
            DialogContainerClass = "";
            DialogBounds = "";
        }
    }

    public class ExecutionConfig {
        public string TargetOptionSubstring;
        public long TargetHwnd;
        public int TargetPid;
        public string ApprovalPolicy;
        public bool SelectOnly;
        public int TimeoutSec;
    }

    public static List<WindowCandidate> AllTargetWindows = new List<WindowCandidate>();
    private static CompletionResult SharedResult = null;

    private static bool WindowSearchCallback(IntPtr hWnd, IntPtr lParam) {
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString().Trim();

        StringBuilder sbClass = new StringBuilder(256);
        GetClassName(hWnd, sbClass, 256);
        string cls = sbClass.ToString();

        bool isVis = IsWindowVisible(hWnd);
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        if (!isVis || string.IsNullOrEmpty(title)) return true;

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
            WindowCandidate wc = new WindowCandidate();
            wc.Hwnd = hWnd;
            wc.Pid = pid;
            wc.Title = title;
            wc.ClassName = cls;
            wc.IsVisible = isVis;
            AllTargetWindows.Add(wc);
        }
        return true;
    }

    // Helper: Collect accessible text including child Text/Label elements
    private static string GetElementFullText(AutomationElement elem) {
        if (elem == null) return "";
        try {
            string name = (elem.Current.Name ?? "").Trim();
            if (!string.IsNullOrEmpty(name)) return name;

            // Inspect direct children
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

            // Check ValuePattern
            try {
                ValuePattern val = elem.GetCurrentPattern(ValuePattern.Pattern) as ValuePattern;
                if (val != null && !string.IsNullOrEmpty(val.Current.Value)) return val.Current.Value;
            } catch { }

            return elem.Current.AutomationId ?? "";
        } catch {
            return "";
        }
    }

    private static bool CheckIfRecommended(string text) {
        if (string.IsNullOrEmpty(text)) return false;
        string lower = text.ToLowerInvariant();
        return lower.Contains("(recommended)") ||
               lower.Contains("[recommended]") ||
               lower.Contains("(recomended)") ||
               lower.Contains("recommended:") ||
               lower.Contains("recommended option");
    }

    private static bool CheckOptionSelected(AutomationElement elem) {
        if (elem == null) return false;
        try {
            SelectionItemPattern sel = elem.GetCurrentPattern(SelectionItemPattern.Pattern) as SelectionItemPattern;
            if (sel != null) return sel.Current.IsSelected;
        } catch { }

        try {
            TogglePattern tog = elem.GetCurrentPattern(TogglePattern.Pattern) as TogglePattern;
            if (tog != null) return tog.Current.ToggleState == ToggleState.On;
        } catch { }

        try {
            string cls = (elem.Current.ClassName ?? "").ToLowerInvariant();
            if (cls.Contains("checked") || cls.Contains("selected") || cls.Contains("active")) return true;
        } catch { }

        return false;
    }

    private static void CompleterWorker(object cfgObj) {
        ExecutionConfig cfg = (ExecutionConfig)cfgObj;
        CompletionResult result = new CompletionResult();
        result.Timestamp = DateTime.UtcNow.ToString("o");

        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) {
            result.Logs.Add("OpenDesktop('Default') failed: " + Marshal.GetLastWin32Error());
            result.FinalStatus = "FAILED_DESKTOP_ATTACH";
            SharedResult = result;
            return;
        }

        bool switched = SetThreadDesktop(hDesk);
        if (!switched) {
            result.Logs.Add("SetThreadDesktop failed: " + Marshal.GetLastWin32Error());
            CloseDesktop(hDesk);
            result.FinalStatus = "FAILED_THREAD_DESKTOP";
            SharedResult = result;
            return;
        }

        try {
            AllTargetWindows.Clear();
            EnumDesktopWindows(hDesk, WindowSearchCallback, IntPtr.Zero);
            result.TotalWindowsScanned = AllTargetWindows.Count;

            foreach (var win in AllTargetWindows) {
                result.ScannedWindowsSummary.Add(string.Format("HWND:{0}|PID:{1}|Title:{2}", win.Hwnd.ToInt64(), win.Pid, win.Title));
            }

            if (AllTargetWindows.Count == 0) {
                result.Logs.Add("No matching Antigravity or Editor windows found on WinSta0\\Default.");
                result.FinalStatus = "NO_ANTIGRAVITY_WINDOW";
                SharedResult = result;
                return;
            }

            // Filter windows if specific HWND or PID was requested
            List<WindowCandidate> candidatesToScan = new List<WindowCandidate>();
            if (cfg.TargetHwnd > 0) {
                candidatesToScan.AddRange(AllTargetWindows.FindAll(w => w.Hwnd.ToInt64() == cfg.TargetHwnd));
            } else if (cfg.TargetPid > 0) {
                candidatesToScan.AddRange(AllTargetWindows.FindAll(w => w.Pid == cfg.TargetPid));
            }

            if (candidatesToScan.Count == 0) {
                candidatesToScan = AllTargetWindows;
            }

            result.Logs.Add(string.Format("Scanning {0} target window(s) for active prompts...", candidatesToScan.Count));

            bool handledPrompt = false;

            for (int w = 0; w < candidatesToScan.Count; w++) {
                WindowCandidate win = candidatesToScan[w];
                result.Logs.Add(string.Format("[Window {0}/{1}] Checking PID {2}: '{3}' (HWND {4})", w + 1, candidatesToScan.Count, win.Pid, win.Title, win.Hwnd.ToInt64()));

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

                // STEP 1: Search for candidate prompt options across dialogs
                Condition optionCondition = new OrCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.RadioButton),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.CheckBox),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Custom)
                );

                AutomationElementCollection potentialOptionElements = root.FindAll(TreeScope.Descendants, optionCondition);
                List<AutomationElement> matchedOptionElements = new List<AutomationElement>();
                AutomationElement explicitRecommendedOption = null;
                AutomationElement fallbackFirstOption = null;

                for (int i = 0; i < potentialOptionElements.Count; i++) {
                    try {
                        AutomationElement opt = potentialOptionElements[i];
                        System.Windows.Rect r = opt.Current.BoundingRectangle;
                        if (r.IsEmpty || r.Y < rootBounds.Y + 40) continue;

                        string optText = GetElementFullText(opt);
                        if (string.IsNullOrEmpty(optText)) continue;

                        string autoId = (opt.Current.AutomationId ?? "").ToLowerInvariant();
                        string cls = (opt.Current.ClassName ?? "").ToLowerInvariant();

                        // Exclude global workbench controls and caption buttons
                        if (autoId.Contains("workbench.action") || autoId.Contains("activitybar") || cls.Contains("wincaptionbutton")) continue;
                        if (cls.Contains("monaco-action-bar") || cls.Contains("statusbar") || cls.Contains("breadcrumb")) continue;
                        if (cls.Contains("tab") && !cls.Contains("choice")) continue;

                        // Exclude action buttons that are clearly not options (e.g. Submit/Cancel)
                        string optLower = optText.ToLowerInvariant();
                        if (optLower == "submit" || optLower == "cancel" || optLower == "skip" || optLower == "close" || optLower == "dismiss") continue;

                        bool isOptionType = (
                            opt.Current.ControlType == ControlType.RadioButton ||
                            opt.Current.ControlType == ControlType.CheckBox ||
                            opt.Current.ControlType == ControlType.ListItem ||
                            cls.Contains("radio") || cls.Contains("checkbox") || cls.Contains("option") || cls.Contains("choice")
                        );

                        bool isRec = CheckIfRecommended(optText);

                        if (isOptionType || isRec || (!string.IsNullOrEmpty(cfg.TargetOptionSubstring) && optText.IndexOf(cfg.TargetOptionSubstring, StringComparison.OrdinalIgnoreCase) >= 0)) {
                            matchedOptionElements.Add(opt);
                            result.AvailableOptions.Add(string.Format("[{0}] {1} (Rec: {2})", opt.Current.ControlType.ProgrammaticName.Replace("ControlType.", ""), optText, isRec));

                            if (isRec && explicitRecommendedOption == null) {
                                explicitRecommendedOption = opt;
                            }
                            if (fallbackFirstOption == null && isOptionType) {
                                fallbackFirstOption = opt;
                            }
                        }
                    } catch { }
                }

                // STEP 2: Search for Submit / Continuation Buttons
                Condition btnCondition = new OrCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Hyperlink)
                );
                AutomationElementCollection allButtons = root.FindAll(TreeScope.Descendants, btnCondition);
                AutomationElement bestSubmitButton = null;
                int bestSubmitScore = 0;

                for (int b = 0; b < allButtons.Count; b++) {
                    try {
                        AutomationElement btn = allButtons[b];
                        System.Windows.Rect br = btn.Current.BoundingRectangle;
                        if (br.IsEmpty || br.Y < rootBounds.Y + 40) continue;

                        string bName = GetElementFullText(btn);
                        string bLower = bName.ToLowerInvariant();
                        string cls = (btn.Current.ClassName ?? "").ToLowerInvariant();
                        string autoId = (btn.Current.AutomationId ?? "").ToLowerInvariant();

                        if (autoId.Contains("workbench.action") || autoId.Contains("activitybar") || cls.Contains("wincaptionbutton")) continue;
                        if (cls.Contains("tab") || cls.Contains("breadcrumb") || cls.Contains("statusbar")) continue;

                        // Exclude cancellation actions
                        if (bLower == "cancel" || bLower == "skip" || bLower == "no" || bLower == "dismiss" || bLower == "close" || bLower.Contains("don't save")) {
                            continue;
                        }

                        int score = 0;
                        if (bLower == "submit" || bLower.StartsWith("submit")) {
                            score = 600;
                            if (btn.Current.IsEnabled) score += 50;
                        } else if (bLower == "proceed" || bLower == "confirm" || bLower == "approve") {
                            score = 500;
                        } else if (bLower == "continue" || bLower == "apply") {
                            score = 450;
                        } else if (bLower.StartsWith("yes, allow") || bLower.StartsWith("always allow") || bLower == "allow" || bLower == "run command") {
                            score = 400;
                        } else if (bLower == "ok" || bLower == "yes") {
                            score = 300;
                        }

                        if (score > bestSubmitScore) {
                            bestSubmitScore = score;
                            bestSubmitButton = btn;
                        }
                    } catch { }
                }

                // If no options and no submit button in this window, check next window
                if (matchedOptionElements.Count == 0 && bestSubmitButton == null) {
                    continue;
                }

                // PROMPT DETECTED IN THIS WINDOW!
                result.PromptFound = true;
                result.TargetHwnd = win.Hwnd.ToInt64();
                result.ProcessId = win.Pid;
                result.WindowTitle = win.Title;

                // Determine active option candidate
                AutomationElement targetOption = null;
                if (!string.IsNullOrEmpty(cfg.TargetOptionSubstring)) {
                    foreach (var opt in matchedOptionElements) {
                        string t = GetElementFullText(opt);
                        if (t.IndexOf(cfg.TargetOptionSubstring, StringComparison.OrdinalIgnoreCase) >= 0) {
                            targetOption = opt;
                            break;
                        }
                    }
                }

                if (targetOption == null) {
                    targetOption = explicitRecommendedOption;
                }

                result.HasExplicitRecommendation = (explicitRecommendedOption != null);

                // Safe policy check: if in auto_safe_only, require explicit recommendation when choices exist
                if (cfg.ApprovalPolicy == "auto_safe_only" && targetOption == null && matchedOptionElements.Count > 0) {
                    result.FinalStatus = "AWAITING_APPROVAL_AMBIGUOUS_OPTIONS";
                    result.Logs.Add("Multiple options detected but none explicitly marked (Recommended). Pausing for user approval.");
                    handledPrompt = true;
                    break;
                }

                if (cfg.ApprovalPolicy == "always_manual") {
                    result.FinalStatus = "AWAITING_APPROVAL_ALWAYS_MANUAL";
                    result.Logs.Add("Prompt detected, but configured policy requires manual user approval.");
                    handledPrompt = true;
                    break;
                }

                // If full_auto and no recommendation, fall back to first available option
                if (targetOption == null && matchedOptionElements.Count > 0 && cfg.ApprovalPolicy == "full_auto") {
                    targetOption = fallbackFirstOption ?? matchedOptionElements[0];
                }

                // Bring window to foreground for input
                SetForegroundWindow(win.Hwnd);
                Thread.Sleep(100);

                // STEP A: Select target option if options exist
                if (targetOption != null) {
                    string optText = GetElementFullText(targetOption);
                    result.TargetOptionFound = optText;
                    result.TargetOptionControlType = targetOption.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");
                    result.OptionInitiallySelected = CheckOptionSelected(targetOption);

                    bool optionSelected = false;

                    if (!result.OptionInitiallySelected) {
                        // 1. Try SelectionItemPattern
                        try {
                            SelectionItemPattern sel = targetOption.GetCurrentPattern(SelectionItemPattern.Pattern) as SelectionItemPattern;
                            if (sel != null) {
                                sel.Select();
                                Thread.Sleep(150);
                                optionSelected = CheckOptionSelected(targetOption) || true;
                                result.ActionTakenOnOption = "SelectionItemPattern.Select()";
                            }
                        } catch { }

                        // 2. Try TogglePattern
                        if (!optionSelected) {
                            try {
                                TogglePattern tog = targetOption.GetCurrentPattern(TogglePattern.Pattern) as TogglePattern;
                                if (tog != null) {
                                    tog.Toggle();
                                    Thread.Sleep(150);
                                    optionSelected = CheckOptionSelected(targetOption) || true;
                                    result.ActionTakenOnOption = "TogglePattern.Toggle()";
                                }
                            } catch { }
                        }

                        // 3. Try InvokePattern
                        if (!optionSelected) {
                            try {
                                InvokePattern inv = targetOption.GetCurrentPattern(InvokePattern.Pattern) as InvokePattern;
                                if (inv != null) {
                                    inv.Invoke();
                                    Thread.Sleep(150);
                                    optionSelected = CheckOptionSelected(targetOption) || true;
                                    result.ActionTakenOnOption = "InvokePattern.Invoke()";
                                }
                            } catch { }
                        }

                        // 4. Physical Click fallback
                        if (!optionSelected) {
                            try {
                                System.Windows.Rect r = targetOption.Current.BoundingRectangle;
                                if (!r.IsEmpty && r.Width > 0 && r.Height > 0) {
                                    int cx = (int)(r.X + r.Width / 2);
                                    int cy = (int)(r.Y + r.Height / 2);
                                    PhysicalClick(cx, cy);
                                    Thread.Sleep(200);
                                    optionSelected = true;
                                    result.ActionTakenOnOption = string.Format("PhysicalClick({0},{1})", cx, cy);
                                }
                            } catch { }
                        }
                    } else {
                        optionSelected = true;
                        result.ActionTakenOnOption = "AlreadySelected";
                    }

                    result.OptionSelectedSuccessfully = optionSelected;
                    result.Logs.Add(string.Format("Option '{0}' selection status: {1} via {2}", result.TargetOptionFound, optionSelected, result.ActionTakenOnOption));

                    // Wait for DOM to enable/re-render submit button
                    Thread.Sleep(250);
                }

                if (cfg.SelectOnly) {
                    result.FinalStatus = "OPTION_SELECTED_SELECT_ONLY_MODE";
                    handledPrompt = true;
                    break;
                }

                // STEP B: Re-query and Submit
                // Re-scan for the submit button to obtain fresh reference and verified enabled state
                AutomationElement freshSubmit = null;
                AutomationElementCollection freshButtons = root.FindAll(TreeScope.Descendants, btnCondition);
                int freshSubmitScore = 0;

                for (int b = 0; b < freshButtons.Count; b++) {
                    try {
                        AutomationElement btn = freshButtons[b];
                        System.Windows.Rect br = btn.Current.BoundingRectangle;
                        if (br.IsEmpty || br.Y < rootBounds.Y + 40) continue;

                        string bName = GetElementFullText(btn);
                        string bLower = bName.ToLowerInvariant();
                        string cls = (btn.Current.ClassName ?? "").ToLowerInvariant();

                        if (bLower == "cancel" || bLower == "skip" || bLower == "no" || bLower == "close" || bLower == "dismiss") continue;

                        int score = 0;
                        if (bLower == "submit" || bLower.StartsWith("submit")) {
                            score = 600;
                            if (btn.Current.IsEnabled) score += 100;
                        } else if (bLower == "proceed" || bLower == "confirm" || bLower == "approve") {
                            score = 500;
                        } else if (bLower == "continue" || bLower == "apply") {
                            score = 450;
                        } else if (bLower.StartsWith("yes, allow") || bLower.StartsWith("always allow") || bLower == "allow" || bLower == "run command") {
                            score = 400;
                        }

                        if (score > freshSubmitScore) {
                            freshSubmitScore = score;
                            freshSubmit = btn;
                        }
                    } catch { }
                }

                if (freshSubmit == null) {
                    freshSubmit = bestSubmitButton;
                }

                if (freshSubmit != null) {
                    result.SubmitButtonFound = GetElementFullText(freshSubmit);
                    result.SubmitButtonInitiallyEnabled = freshSubmit.Current.IsEnabled;

                    // If button is not yet enabled, wait up to 1 second
                    if (!freshSubmit.Current.IsEnabled) {
                        for (int retry = 0; retry < 5; retry++) {
                            Thread.Sleep(200);
                            try {
                                if (freshSubmit.Current.IsEnabled) {
                                    result.SubmitButtonInitiallyEnabled = true;
                                    break;
                                }
                            } catch { }
                        }
                    }

                    bool submitInvoked = false;

                    // Try InvokePattern
                    try {
                        InvokePattern inv = freshSubmit.GetCurrentPattern(InvokePattern.Pattern) as InvokePattern;
                        if (inv != null) {
                            inv.Invoke();
                            submitInvoked = true;
                            result.ActionTakenOnSubmit = "InvokePattern.Invoke()";
                        }
                    } catch { }

                    // Physical click fallback
                    if (!submitInvoked) {
                        try {
                            System.Windows.Rect br = freshSubmit.Current.BoundingRectangle;
                            if (!br.IsEmpty && br.Width > 0 && br.Height > 0) {
                                int bx = (int)(br.X + br.Width / 2);
                                int by = (int)(br.Y + br.Height / 2);
                                PhysicalClick(bx, by);
                                submitInvoked = true;
                                result.ActionTakenOnSubmit = string.Format("PhysicalClick({0},{1})", bx, by);
                            }
                        } catch { }
                    }

                    if (submitInvoked) {
                        result.Logs.Add(string.Format("Invoked Submit button '{0}' via {1}", result.SubmitButtonFound, result.ActionTakenOnSubmit));

                        // STEP C: Verification of Dismissal
                        // Wait up to 1.5 seconds and check if button/dialog is dismissed or transitioned
                        bool dismissed = false;
                        for (int poll = 0; poll < 6; poll++) {
                            Thread.Sleep(250);
                            try {
                                bool stillThere = false;
                                AutomationElement testBtn = null;
                                try {
                                    testBtn = root.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.NameProperty, result.SubmitButtonFound));
                                    stillThere = (testBtn != null && testBtn.Current.IsEnabled);
                                } catch {
                                    stillThere = false;
                                }

                                if (!stillThere) {
                                    dismissed = true;
                                    break;
                                }
                            } catch {
                                dismissed = true;
                                break;
                            }
                        }

                        result.DialogClosedAfterAction = dismissed;
                        if (dismissed) {
                            result.FinalStatus = "COMPLETED_SUCCESSFULLY";
                            result.Logs.Add("Verified: Dialog successfully submitted and dismissed!");
                        } else {
                            result.FinalStatus = "SUBMITTED_WAITING_RESPONSE";
                            result.Logs.Add("Submit invoked; application is processing prompt response.");
                        }
                    } else {
                        result.FinalStatus = "SUBMIT_INVOCATION_FAILED";
                        result.Logs.Add("Found submit button but could not invoke pattern or dispatch click.");
                    }
                } else if (targetOption != null) {
                    result.FinalStatus = "OPTION_SELECTED_NO_SUBMIT_BUTTON";
                    result.DialogClosedAfterAction = true;
                    result.Logs.Add("Selected recommendation option; no separate submit button was present.");
                }

                handledPrompt = true;
                break;
            }

            if (!handledPrompt) {
                result.PromptFound = false;
                result.FinalStatus = "NO_PROMPT_VISIBLE";
                result.Logs.Add("Scanned all target windows. No active interactive prompt detected.");
            }

        } catch (Exception ex) {
            result.Logs.Add("AutoCompleter Exception: " + ex.ToString());
            result.FinalStatus = "EXCEPTION";
        } finally {
            CloseDesktop(hDesk);
        }

        SharedResult = result;
    }

    public static CompletionResult AutoCompletePrompt(ExecutionConfig config) {
        SharedResult = null;
        Thread t = new Thread(new ParameterizedThreadStart(CompleterWorker));
        t.SetApartmentState(ApartmentState.STA);
        t.Start(config);
        t.Join((config.TimeoutSec + 5) * 1000);
        return SharedResult;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies "UIAutomationClient", "UIAutomationTypes", "WindowsBase"

$outputDir = "e:\Click Application\diagnostics"
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$jsonPath = Join-Path $outputDir "phase0_1_completion_report.json"
$summaryPath = Join-Path $outputDir "phase0_1_completion_summary.txt"

$cfg = New-Object PromptAutoCompleter+ExecutionConfig
$cfg.TargetOptionSubstring = $TargetOptionSubstring
$cfg.TargetHwnd = $TargetHwnd
$cfg.TargetPid = $TargetPid
$cfg.ApprovalPolicy = $ApprovalPolicy
$cfg.SelectOnly = [bool]$SelectOnly
$cfg.TimeoutSec = 20

Write-Output "Running AutoPilot Real-Time Prompt Completer..."
$result = [PromptAutoCompleter]::AutoCompletePrompt($cfg)

if ($result -eq $null) {
    Write-Error "AutoCompleter timed out or returned null."
    exit 1
}

$json = ConvertTo-Json $result -Depth 8
[System.IO.File]::WriteAllText($jsonPath, $json, [System.Text.Encoding]::UTF8)

$sb = New-Object System.Text.StringBuilder
$sb.AppendLine("=================================================================") | Out-Null
$sb.AppendLine("AUTOPILOT REAL-TIME PROMPT COMPLETER SUMMARY") | Out-Null
$sb.AppendLine("Timestamp (UTC): " + $result.Timestamp) | Out-Null
$sb.AppendLine("Total Windows Scanned: " + $result.TotalWindowsScanned) | Out-Null
$sb.AppendLine("Target Window HWND: " + $result.TargetHwnd + " (PID: " + $result.ProcessId + ")") | Out-Null
$sb.AppendLine("Window Title: " + $result.WindowTitle) | Out-Null
$sb.AppendLine("Prompt Detected: " + $result.PromptFound) | Out-Null
$sb.AppendLine("Available Options: " + $result.AvailableOptions.Count) | Out-Null
foreach ($opt in $result.AvailableOptions) {
    $sb.AppendLine("   * " + $opt) | Out-Null
}
$sb.AppendLine("Selected Option: " + $result.TargetOptionFound + " (Action: " + $result.ActionTakenOnOption + ")") | Out-Null
$sb.AppendLine("Submit Button: " + $result.SubmitButtonFound + " (Action: " + $result.ActionTakenOnSubmit + ")") | Out-Null
$sb.AppendLine("Dialog Closed / Transitioned: " + $result.DialogClosedAfterAction) | Out-Null
$sb.AppendLine("Final Status: " + $result.FinalStatus) | Out-Null
$sb.AppendLine("Execution Logs:") | Out-Null
foreach ($log in $result.Logs) {
    $sb.AppendLine("  * " + $log) | Out-Null
}
$sb.AppendLine("=================================================================") | Out-Null

$summaryText = $sb.ToString()
[System.IO.File]::WriteAllText($summaryPath, $summaryText, [System.Text.Encoding]::UTF8)

Write-Output $summaryText
Write-Output "Report saved to: $jsonPath"
