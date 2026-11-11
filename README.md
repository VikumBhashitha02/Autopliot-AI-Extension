# AutoPilot AI — VS Code & Google Antigravity Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/autopilot-ai/autopilot-ai-extension)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-blue)](https://code.visualstudio.com/)
[![Google Antigravity](https://img.shields.io/badge/Google%20Antigravity-Supported-brightgreen)](https://antigravity.google)

**AutoPilot AI** is an autonomous AI workflow automation, prompt inspection, and file change approval extension built specifically for **Visual Studio Code** and the **Google Antigravity IDE**.

AutoPilot AI supervises interactive dialogs, inspects confirmation prompts, automatically detects and selects recommended options, executes terminal command approvals, and handles multi-file **"Accept all"** code review diffs directly inside your development environment.

---

## 🚀 Key Features

- **Direct IDE Integration**: Native Activity Bar icon, responsive sidebar Webview, and real-time Status Bar monitor.
- **Dual IDE Support**: Seamless operation in both **Visual Studio Code** and **Google Antigravity IDE** with automated host environment detection.
- **100% Free & Account-Free**: No user accounts, registration, email verification, or subscription paywalls. Launches immediately upon IDE start.
- **3 Automation Policies**:
  - `Safe Auto-Pilot`: Automatically approves safe prompts and non-destructive operations.
  - `Full Autonomous`: Automatically approves all non-blocked operations.
  - `Manual Approval`: Detects prompts and notifies developer before taking action.
- **Configurable Response Speeds**:
  - **Instant** (100ms)
  - **Fast** (250ms — Recommended)
  - **Comfortable** (750ms)
  - **Deliberate** (1500ms)
  - Custom delays from 50ms to 5000ms.
- **Prompt Inspection & Recommended Selection**: Automatically detects and highlights target prompt options (e.g. `(Recommended)`, positive buttons) and submits confirmations.
- **File-Change "Accept All" Approval**: Automatically detects pending code change review banners and submits `Accept all` / `Apply changes`.
- **Enterprise Safety & Guardrails**:
  - `SafetyGuard` destructive command filtering (`rm -rf /`, `format`, `del /s /q`).
  - Permanent negative action lockout (`Reject`, `Cancel`, `Discard`, `Don't save` are NEVER clicked automatically).
  - Shell parameter sanitization preventing command injection.
  - Sensitive token/credential redaction in all logs (`api_key`, `Bearer`, `password`).
  - Global **Emergency Stop** (`Ctrl+Alt+Shift+E` / `Cmd+Alt+Shift+E`).
- **Visual Workflow Builder**: Create, test, and save multi-step automated sequences (app launch, prompt wait, file approval, terminal commands).

---

## 📦 Installation

### Option 1: Install from VSIX in VS Code or Google Antigravity
1. Open Visual Studio Code or Google Antigravity IDE.
2. Open the Command Palette (`Ctrl+Shift+P` on Windows/Linux, `Cmd+Shift+P` on macOS).
3. Type and select **Extensions: Install from VSIX...**
4. Browse to and select `autopilot-ai-1.0.0.vsix`.
5. AutoPilot AI will appear in your Activity Bar on the left.

### Option 2: Command Line Installation
```bash
# For Visual Studio Code
code --install-extension autopilot-ai-1.0.0.vsix

# For Google Antigravity IDE
antigravity --install-extension autopilot-ai-1.0.0.vsix
```

---

## 🖥️ Navigation & Sidebar Views

Click the **AutoPilot AI** icon in the Activity Bar to open the main sidebar:

1. **AutoPilot Live**: Real-time status, IDE connection state, active automation mode, and quick start/pause/stop controls.
2. **Automation Rules**: Configure active approval policy, response delays, and inspection toggles.
3. **Prompt Inspector**: Deep inspection of detected prompt text, positive/negative candidate buttons, and confidence scores.
4. **Dashboard**: Metrics overview including completed actions, failed actions, and workflow runs.
5. **Execution Monitor**: Step-by-step trace of running workflows and live logs.
6. **Workflow Builder**: Visual node-based workflow creator with conditional branching and failure recovery.
7. **Workflow Library**: Built-in template workflows (e.g., Continuous Safe Approval, Multi-File Review).
8. **Logs & Diagnostics**: Detailed audit trails and PowerShell diagnostic summaries.
9. **Settings**: Extension configuration, thresholds, and storage management.

---

## ⌨️ Command Palette Commands

All AutoPilot AI commands are available in the Command Palette (`Ctrl+Shift+P`):

| Command | Title | Description |
| :--- | :--- | :--- |
| `autopilot-ai.openDashboard` | `AutoPilot AI: Open Dashboard` | Opens the AutoPilot AI sidebar dashboard |
| `autopilot-ai.startMonitoring` | `AutoPilot AI: Start Monitoring` | Begins background IDE prompt monitoring |
| `autopilot-ai.pauseMonitoring` | `AutoPilot AI: Pause Monitoring` | Pauses automated action execution |
| `autopilot-ai.stopMonitoring` | `AutoPilot AI: Stop Monitoring` | Stops background monitoring loop |
| `autopilot-ai.inspectPrompt` | `AutoPilot AI: Inspect Current Prompt` | Triggers immediate prompt inspection |
| `autopilot-ai.inspectFileChanges` | `AutoPilot AI: Inspect Pending File Changes` | Scans for file diff review banners |
| `autopilot-ai.runWorkflow` | `AutoPilot AI: Run Workflow` | Select and execute a saved workflow |
| `autopilot-ai.emergencyStop` | `AutoPilot AI: EMERGENCY STOP` | Instantly halts all active automation |
| `autopilot-ai.openSettings` | `AutoPilot AI: Open Settings` | Opens AutoPilot configuration settings |

---

## ⚙️ Extension Settings

Configure AutoPilot AI via `Preferences: Open Settings` (`autopilot.*`):

- `autopilot.mode`: Choose between `safe_auto`, `full_auto`, or `manual_approval`.
- `autopilot.responseSpeed`: Choose between `instant`, `fast`, `comfortable`, or `deliberate`.
- `autopilot.monitoringInterval`: Inspection interval in milliseconds (default: `1000ms`).
- `autopilot.autoStartMonitoring`: Auto-start monitoring when IDE launches (default: `false`).
- `autopilot.enableFileChangeApproval`: Enable auto-approval of file diffs (default: `true`).
- `autopilot.enableTerminalApproval`: Enable terminal command inspection (default: `true`).
- `autopilot.promptInspectionConfidenceThreshold`: Minimum confidence required (default: `0.6`).

---

## 🔒 Safety & Privacy

- **No Remote Telemetry**: AutoPilot AI does not send telemetry, code, or prompts to any external server.
- **Local Storage**: All settings, workflows, and execution logs are stored locally in your IDE's global storage directory.
- **Fail-Safe**: Destructive and rejection actions are permanently locked out and can never be triggered automatically.
- **Emergency Stop**: Press `Ctrl+Alt+Shift+E` anytime to kill running workflows and pause monitoring immediately.

---

## 🛠️ Platform Compatibility

- **Windows**: Full support for native Windows UI Automation (UIA) via PowerShell 5.1 / .NET `UIAutomationClient`.
- **macOS & Linux**: Core extension features, workflow execution, settings, and status monitoring run natively. Desktop UIA features report graceful platform limitations.

---

## 📄 License

MIT License. Copyright (c) 2026 AutoPilot AI (V.B)
