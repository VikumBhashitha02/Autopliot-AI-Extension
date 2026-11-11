# AutoPilot AI v1.0.0 — Manual Testing & Field Verification Guide

This guide provides exact, step-by-step instructions for QA Engineers to manually test and verify the **AutoPilot AI Extension** (`autopilot-ai-1.0.0.vsix`) across Visual Studio Code, Google Antigravity IDE, Windows UI Automation, macOS, and Linux.

---

## 1. Visual Studio Code Manual Verification

### Test 1.1: Extension Installation via VSIX
- **Objective**: Verify that VS Code cleanly installs the generated VSIX without dependency errors.
- **Preconditions**: Visual Studio Code 1.85.0+ installed.
- **Commands**:
  ```bash
  # From project root:
  code --install-extension autopilot-ai-1.0.0.vsix
  ```
- **Alternative GUI Steps**:
  1. Open Visual Studio Code.
  2. Press `Ctrl+Shift+X` (macOS: `Cmd+Shift+X`) to open Extensions view.
  3. Click the `...` (Views and More Actions) menu in the top right.
  4. Select **Install from VSIX...**
  5. Select `autopilot-ai-1.0.0.vsix`.
- **Expected Result**: Notification appears: `Completed installing autopilot-ai extension from VSIX.`
- **Verification**: Run `code --list-extensions | grep autopilot-ai`. It should display `autopilot-ai.autopilot-ai`.

---

### Test 1.2: Activity Bar & Sidebar Loading (BUG-001 Verification)
- **Objective**: Verify the AutoPilot AI Activity Bar icon is displayed and the sidebar webview loads all script and CSS assets properly.
- **Steps**:
  1. Open VS Code with the extension installed.
  2. Click the **AutoPilot AI** lightning zap icon (`autopilot.svg`) in the Activity Bar.
  3. The sidebar expands with title **"AutoPilot AI"**.
  4. Press `Help` -> `Toggle Developer Tools` -> `Console`.
- **Expected Result**:
  - The React webview interface loads smoothly with dark slate styling and icons.
  - Zero resource loading errors (`404 Not Found` or `Failed to load resource: net::ERR_FILE_NOT_FOUND`).
  - Script source resolves to `vscode-webview://.../assets/index-*.js`.
  - Content Security Policy header is active and does not block legitimate extension assets.

---

### Test 1.3: Sidebar Navigation Verification (BUG-002 Verification)
- **Objective**: Verify that direct navigation links to "Automation Agent" and "Workflow Library" function correctly.
- **Steps**:
  1. In the AutoPilot AI sidebar, inspect the navigation list.
  2. Verify that **Automation Agent** (`Bot` icon) is present under *Live AutoPilot*.
  3. Click **Automation Agent**:
     - Verify the header title updates to: `Automation Agent & Session Monitor`.
     - Verify the view renders the real-time agent controls and inspection panel.
  4. Verify that **Workflow Library** (`FolderKanban` icon) is present under *Workflow Builder*.
  5. Click **Workflow Library**:
     - Verify the header title updates to: `Workflow Library & Templates`.
     - Verify built-in templates (Continuous Safe Auto-Approval, Multi-File Review, etc.) render.
  6. Test the sidebar collapse button (`<` / `>`):
     - Icons remain accessible; tooltips show view labels.
     - Nav list scrolls cleanly with `overflow-y-auto`.

---

### Test 1.4: Bidirectional Configuration Sync Verification (BUG-003 Verification)
- **Objective**: Verify that changing settings in VS Code Preferences updates AutoPilot AI runtime, and changing settings in AutoPilot UI updates VS Code Preferences.
- **Test 1.4A: VS Code Preferences -> Extension**:
  1. Open VS Code Settings (`Ctrl+,`).
  2. Search for `autopilot.mode`.
  3. Change the dropdown from `Safe Auto-Pilot` to `Full Autonomous` (`full_auto`).
  4. In the AutoPilot AI sidebar, open **Settings** (or look at the status bar).
  5. Verify that the active policy updates immediately to `Full Autonomous` (`full_auto`).
- **Test 1.4B: Extension Webview -> VS Code Preferences**:
  1. In AutoPilot AI sidebar -> **Settings**, select `Safe Auto-Pilot` (`auto_safe_only`) and click **Save & Apply Settings**.
  2. Check VS Code `settings.json` (`Ctrl+Shift+P` -> `Preferences: Open User Settings (JSON)`).
  3. Verify `"autopilot.mode": "safe_auto"` is updated.
- **Test 1.4C: Response Speed Sync**:
  1. In AutoPilot AI sidebar -> **Rules**, select `Instant (100ms)`.
  2. Verify VS Code setting `"autopilot.responseSpeed": "instant"` is updated.

---

### Test 1.5: Status Bar Monitor & Command Execution
- **Objective**: Verify status bar integration and live updates.
- **Steps**:
  1. Look at the bottom status bar in VS Code.
  2. Verify the item `$(zap) AutoPilot AI: Active (Safe Auto-Pilot)` appears.
  3. Click the status bar item -> AutoPilot sidebar opens.
  4. Press `Ctrl+Shift+P`, type `AutoPilot AI: Stop Monitoring`.
  5. Verify status bar changes to `$(zap) AutoPilot AI: Paused`.

---

### Test 1.6: Emergency Stop Keyboard Shortcut
- **Objective**: Verify global emergency stop aborts in-flight automation.
- **Steps**:
  1. In VS Code, start monitoring (`AutoPilot AI: Start Monitoring`).
  2. Press keyboard shortcut: `Ctrl + Alt + Shift + E` (macOS: `Cmd + Alt + Shift + E`).
- **Expected Result**:
  - Warning notification appears: `⚡ AutoPilot AI: Emergency Stop Triggered! All active workflows and watchers halted.`
  - Status bar updates to `Paused`.
  - All background polling stops.

---

## 2. Google Antigravity IDE Manual Verification

### Test 2.1: Installing VSIX into Google Antigravity
- **Steps**:
  ```bash
  # Command line installation:
  antigravity --install-extension autopilot-ai-1.0.0.vsix
  ```
  Or in Antigravity GUI: Command Palette (`Ctrl+Shift+P`) -> **Extensions: Install from VSIX...** -> select `autopilot-ai-1.0.0.vsix`.
- **Expected Result**: Antigravity accepts the VSIX, registers the Activity Bar icon, and activates `AutoPilotViewProvider`.

---

### Test 2.2: Antigravity Environment Detection
- **Objective**: Verify AutoPilot AI detects that it is running inside Google Antigravity IDE.
- **Steps**:
  1. Open Antigravity with AutoPilot AI activated.
  2. Open Output panel (`Ctrl+Shift+U`) and select **AutoPilot AI** or Developer Tools Console.
  3. Look for activation message:
     `[AutoPilot AI] Activating AutoPilot AI extension on Google Antigravity IDE (Platform: win32)`
  4. In the AutoPilot Live sidebar, check the **Target IDE** indicator.
- **Expected Result**: Displays `Google Antigravity IDE` with green connected status pill.

---

### Test 2.3: Antigravity Prompt Auto-Selection & Submission
- **Objective**: Intercept a real Antigravity confirmation dialog and auto-select `(Recommended)`.
- **Steps**:
  1. In AutoPilot AI Settings, ensure policy is set to **Safe Auto-Pilot** (`auto_safe_only`) and delay is set to **Fast** (250ms).
  2. In Google Antigravity, trigger an agent prompt that displays interactive choices.
  3. Ensure the prompt dialog contains an option marked `(Recommended)`.
- **Expected Result**:
  - AutoPilot AI detects the dialog within its monitoring cycle (1–2 seconds).
  - The status bar flashes: `Executing Action... -> Selecting (Recommended)`.
  - The radio button marked `(Recommended)` is selected.
  - The `Submit` / `Continue` button is clicked automatically.

---

### Test 2.4: Antigravity Multi-File "Accept All" Approval
- **Objective**: Verify auto-approval of pending file change diff reviews.
- **Steps**:
  1. In Google Antigravity, run an agent task that generates multi-file edits.
  2. Wait until Antigravity displays the code review diff banner with the `Accept all` button.
  3. Ensure AutoPilot AI has `Enable File Change Approval: ON`.
- **Expected Result**:
  - AutoPilot AI detects the `Accept all` button.
  - Automatically clicks `Accept all`.
  - Fingerprint debouncing prevents duplicate clicks.

---

## 3. Windows Native UI Automation Field Test

### Test 3.1: Live WinForms Test Dialog Interception
- **Steps**:
  1. Open PowerShell and run the simulated Antigravity confirmation dialog:
     ```powershell
     powershell.exe -NoProfile -ExecutionPolicy Bypass -File diagnostics/show_test_prompt.ps1 -AutoCloseSeconds 45
     ```
  2. A native dialog titled **"Antigravity IDE - Action Confirmation"** will appear on the desktop with radio buttons:
     - `(Recommended) Apply approved workflow changes`
     - `Inspect diff and pause execution`
     - `Skip this step and proceed to next task`
     - `Submit` button.
  3. In a second PowerShell window, run the AutoPilot UIA completion engine:
     ```powershell
     powershell.exe -NoProfile -ExecutionPolicy Bypass -File diagnostics/select_and_complete_prompt.ps1 -TargetOptionSubstring "(Recommended)" -ApprovalPolicy "auto_safe_only"
     ```
- **Expected Result**:
  - The UIA completer connects to the dialog.
  - Finds the `(Recommended)` radio button via `AutomationElement` tree.
  - Invokes `SelectionItemPattern.Select()`.
  - Finds the `Submit` button and invokes `InvokePattern.Invoke()`.
  - Outputs a JSON summary report showing `PromptFound: true`, `SubmitButtonFound: true`, `FinalStatus: Success`.
  - The dialog closes with DialogResult OK.

---

## 4. macOS & Linux Manual Verification

### Test 4.1: Graceful Limitation Verification
- **Objective**: Ensure the extension runs safely on macOS and Linux without crashing on unsupported Windows APIs.
- **Steps**:
  1. Install `autopilot-ai-1.0.0.vsix` on macOS or Linux.
  2. Launch VS Code and open the AutoPilot AI sidebar.
  3. Run command: `AutoPilot AI: Start Monitoring`.
- **Expected Result**:
  - Extension activates cleanly; webview renders properly with all navigation links.
  - Status bar displays: `AutoPilot AI active (Platform: darwin/linux)`.
  - Windows UIA actions report platform limitation:
    `"Windows UIAutomation is not supported on macOS/Linux. Native VS Code Extension API commands and workspace automation remain fully operational."`
  - Emergency Stop (`Cmd+Alt+Shift+E`), workflow builder, and template library function normally.
  - Zero unhandled exceptions or crashes.
