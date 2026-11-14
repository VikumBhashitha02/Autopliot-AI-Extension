# AutoPilot AI — Windows UI Automation Diagnostics Guide

This document explains the empirical findings, diagnostic architecture, and script behaviors established during the Phase 0 and Phase 0.1 research sessions.

---

## 1. Background & Empirical Findings

### A. The Windows Desktop Isolation Problem
When running diagnostic commands in sandboxed background terminal sessions (e.g. `WinSta0\exebox-...`), Windows isolates the process on an invisible, non-interactive window station.
- Standard UI Automation calls (`GetRootElement()`) in that context cannot see windows running on the interactive desktop (`WinSta0\Default`).
- **Resolution**:
  The diagnostic scripts switch the execution thread to `WinSta0\Default` via Win32 COM pinvoke:
  ```csharp
  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetThreadDesktop(IntPtr hDesktop);
  ```
  This is executed on a dedicated Single-Threaded Apartment (STA) thread, enabling seamless access to Antigravity's interactive window.

  > **Security Architecture Note**:
  > Attaching the Windows thread to `WinSta0\Default` is strictly standard Win32 OS window station attachment to read UI elements. It does NOT weaken or bypass Chromium renderer process isolation in the Electron desktop app, which strictly enforces `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.

### B. The Monaco Container False-Positive Bug
- In early diagnostics, the script attempted to discover dialog containers by matching elements whose accessible class name or automation ID contained `modal` or `dialog`.
- When an interactive dialog opens in Monaco/VS Code-based applications, the root element (`monaco-workbench`) is assigned the CSS class `modal-dialog-visible`.
- Matching that class caused the diagnostic to misidentify the entire $1920\times1080$ application window as a dialog.
- **Resolution**:
  The detection logic in `inspect_prompt_subtree.ps1` was re-engineered:
  1. Top-down matching of `monaco-workbench` is explicitly prohibited.
  2. Bottom-up resolution is performed: discover candidate radio buttons and action buttons, then traverse parent hierarchies until finding the localized container card.
  3. Bounding box constraints are enforced: $80\text{px} < \text{Height} < 550\text{px}$ and $200\text{px} < \text{Width} < 900\text{px}$.
  4. This accurately isolates the true dialog card (e.g. $341\times283$).

---

## 2. Core Diagnostic Scripts

### 1. `diagnostics/inspect_prompt_subtree.ps1`
**Purpose**: Read-only inspection of Antigravity's accessible UI tree.
- **Parameters**:
  - `-DelaySeconds`: Number of seconds to wait before attaching (useful for manual prompt setup).
  - `-ProcessName`: Target process name (default: `Antigravity`).
- **Outputs**:
  - `diagnostics/phase0_1_prompt_report.json`: Full JSON dump of discovered dialog, radio buttons, candidate submit/cancel buttons, bounds, and UIA pattern support.
  - `diagnostics/phase0_1_prompt_summary.txt`: Human-readable summary table.

### 2. `diagnostics/select_and_complete_prompt.ps1`
**Purpose**: Selects a target option (e.g. `(Recommended)`) and completes the prompt dialog safely.
- **Parameters**:
  - `-TargetSubstring`: Substring or label pattern to select (default: `(Recommended)`).
  - `-ButtonSubstring`: Button name to invoke (default: `Submit`).
  - `-DelaySeconds`: Delay before execution.
- **Mechanism**:
  1. Finds the prompt container and identifies the target radio element.
  2. Obtains `IUIAutomationSelectionItemPattern` and calls `Select()`.
  3. Locates the `Submit` button (if present) and calls `IUIAutomationInvokePattern::Invoke()`.
  4. Polls for up to 3 seconds to verify that the dialog container has disappeared from the accessible hierarchy.
- **Outputs**:
  - `diagnostics/phase0_1_completion_report.json`
  - `diagnostics/phase0_1_completion_summary.txt`

---

## 3. Interpreting Reports

### Report Structure (`phase0_1_prompt_report.json`)
```json
{
  "promptDetected": true,
  "targetProcessName": "Antigravity",
  "targetPid": 22216,
  "targetHwnd": 328482,
  "promptBounds": "341x283",
  "explicitRecommendedMarker": "(Recommended) 2 spaces",
  "radioButtons": [
    {
      "index": 0,
      "name": "1 (Recommended) 2 spaces",
      "isRecommended": true,
      "selected": false,
      "supportsSelectionItem": true
    },
    {
      "index": 1,
      "name": "2 4 spaces",
      "isRecommended": false,
      "selected": false,
      "supportsSelectionItem": true
    }
  ],
  "candidateSubmitButtons": [
    { "name": "Submit", "isEnabled": true, "supportsInvoke": true }
  ],
  "candidateCancelButtons": [
    { "name": "Skip", "isEnabled": true, "supportsInvoke": true }
  ]
}
```

### Verification Signals
- `promptDetected === true`: A valid modal card was found within bounds.
- `explicitRecommendedMarker`: Contains the detected recommendation text.
- `candidateSubmitButtons`: List of buttons supporting `InvokePattern`.
