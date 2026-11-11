# AutoPilot AI — Architecture & Technical Design Document

## 1. System Overview

**AutoPilot AI — Workflow Automation** is a Windows desktop application that enables developers to configure, automate, monitor, and safely supervise repetitive AI and development confirmation prompts, workflows, and desktop UI operations.

### High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                                 AutoPilot AI Desktop App                        |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                 Frontend Layer (React 18 + TypeScript + Vite)             |  |
|  |  - Dashboard (Real metrics & status)       - Workflow Builder (Visual)    |  |
|  |  - Automation Agent (Session & Target)     - Prompt Manager (Diagnostics) |  |
|  |  - Execution Monitor (Real-time logs)      - Diagnostics Hub              |  |
|  |  - Workflow Library (Import / Export)      - Settings & Guardrails        |  |
|  +---------------------------------------------------------------------------+  |
|                                      |                                          |
|                          IPC Bridge (contextBridge)                             |
|                                      |                                          |
|  +---------------------------------------------------------------------------+  |
|  |               Electron Main Process (Node.js v20 + TypeScript)            |  |
|  |  +-------------------------+  +----------------------------------------+  |  |
|  |  | Workflow Engine         |  | Storage & Persistence Service          |  |  |
|  |  | - Step runners          |  | - JSON Document Store with atomic write|  |  |
|  |  | - Sequential / Branching |  | - Workflows, Runs, Settings, Logs     |  |  |
|  |  | - Timeouts & Retries    |  +----------------------------------------+  |  |
|  |  | - Cancellation queue    |  +----------------------------------------+  |  |
|  |  +-------------------------+  | PowerShell UIA Adapter                 |  |  |
|  |  +-------------------------+  | - WinSta0\Default session attach       |  |  |
|  |  | Security & Policy Gate  |  | - inspect_prompt_subtree.ps1           |  |  |
|  |  | - Allowlist validator   |  | - select_and_complete_prompt.ps1       |  |  |
|  |  | - Redaction engine      |  | - Process spawn with timeout & cancel  |  |  |
|  |  +-------------------------+  +----------------------------------------+  |  |
|  +---------------------------------------------------------------------------+  |
+--------------------------------------|------------------------------------------+
                                       | Win32 COM / UIAutomationCore
                                       v
                     +-----------------------------------+
                     | Windows Desktop (WinSta0\Default) |
                     | - Antigravity IDE (Electron)      |
                     | - Dialogs, Modals, Options        |
                     +-----------------------------------+
```

---

## 2. Technology Stack Selection & Rationale

| Layer | Selected Technology | Rationale & Alternatives Evaluated |
| :--- | :--- | :--- |
| **Desktop Runtime** | **Electron (v34+)** | Evaluated Tauri v2 vs Electron. Inspection revealed Node.js v20.19.6 and npm 11.6.2 are preinstalled, whereas `rustc`/`cargo` are not installed on this system. Electron provides 100% out-of-the-box native compilation, rock-solid Windows integration, native process spawning, and seamless packaging. |
| **Frontend Framework** | **React 18 + TypeScript** | Component-driven UI, type safety, modular design, fast rendering, state management for complex workflow DAGs and live monitors. |
| **Styling & Design System** | **Tailwind CSS + Custom Modern Design Tokens** | Glassmorphism, tailored dark/light palettes (slate, zinc, emerald, violet), micro-animations, accessible contrast ratios. |
| **Build System** | **Vite** | Instant HMR in development, optimal tree-shaken production bundles. |
| **Windows UI Automation** | **PowerShell + In-Memory C# (.NET Framework UIAutomationClient)** | Reuses tested Phase 0 scripts (`inspect_prompt_subtree.ps1` and `select_and_complete_prompt.ps1`). Executes with thread-desktop attachment (`WinSta0\Default`), avoiding sandboxing pitfalls. |
| **Data Persistence** | **Durable JSON Document Store** | Local filesystem storage (`app_data/`) with transactional writes, atomic replacement, and versioning. No external binary database dependencies. |

---

## 3. Core Modules & Responsibilities

### 3.1. Workflow Engine (`electron/engine/`)
* **Schema Definition**: Typed JSON schema for workflows, step inputs, conditions, timeouts, and retries.
* **Execution Queue**: Serializes executions on target application windows to prevent race conditions or cross-talk.
* **Step Registry**:
  1. `launch_app`: Spawns or focuses an application executable.
  2. `wait_for_condition`: Polls for process existence, window title, or elapsed time.
  3. `detect_prompt`: Invokes UIA inspection adapter to check for active prompts.
  4. `inspect_ui`: Scans UI controls and dumps hierarchy.
  5. `select_radio`: Locates and checks a specific radio button option.
  6. `invoke_button`: Clicks a named button using `InvokePattern`.
  7. `capture_snapshot`: Saves diagnostic report and screenshot metadata.
  8. `write_log`: Outputs structured log message.
  9. `branch_condition`: Evaluates step results to branch to specific step IDs.
  10. `user_approval`: Pauses workflow and notifies user for manual confirmation.
* **Cancellation**: Immediate abort signal propagation terminating child PowerShell processes and disarming next steps.

### 3.2. PowerShell UIA Adapter (`electron/adapters/powershell.ts`)
* Reuses and enhances existing scripts in `diagnostics/`:
  - `inspect_prompt_subtree.ps1`
  - `select_and_complete_prompt.ps1`
* Executes via `child_process.spawn` with argument escaping, streaming stdout/stderr, configurable timeout, and cancellation PID tracking.
* Parses JSON output artifacts and provides structured responses to the frontend.

### 3.3. Persistence & Configuration (`electron/storage/`)
* Workflows stored in `userData/workflows/`.
* Execution runs and history stored in `userData/runs/`.
* Diagnostics stored in `userData/diagnostics/` preserving all existing reports.
* Settings stored in `userData/settings.json`.

### 3.4. Security & Safety Controls (`electron/security/`)
* **Strict Chromium Process Isolation**: The renderer runs with `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`. No Node.js APIs or native primitives are accessible from renderer scripts.
* **IPC Sender Validation**: Every IPC invocation verifies `event.senderFrame === mainWindow.webContents.mainFrame` to prevent unauthorized origins, iframes, or spoofed messages from triggering backend actions.
* **Strict Action Allowlist**: Only predefined step types are allowed.
* **Sanitized Script Invocation**: No raw shell string concatenation (`cmd /c "..."`). Arguments are passed directly to `CreateProcess` via `child_process.spawn`.
* **Process Allowlist**: Automation targets are strictly restricted to authorized applications (`Antigravity.exe`, `Code.exe`).
* **Log Redaction**: Automatic masking of passwords, keys, and tokens.
* **Path Traversal Protection**: Export/import validation preventing directory traversal (`../`).
* **Approval Policy**: Defaults to `Manual Approval` for any destructive or unverified prompt. Even under `full_auto`, essential safety constraints and blocked command rules remain inviolable.
* **Windows Window Station Note**: The PowerShell diagnostics attach the worker thread to `WinSta0\Default` via Win32 `OpenDesktop` and `SetThreadDesktop` purely to inspect the user's interactive desktop accessibility tree. This is an OS window station attachment and has zero impact on Chromium renderer process isolation.
