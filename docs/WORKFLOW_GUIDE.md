# AutoPilot AI — Complete Workflow Guide & Manual

This guide describes how to author, configure, execute, and monitor automation workflows in **AutoPilot AI**.

---

## 1. What is an AutoPilot Workflow?

An AutoPilot workflow is a structured, type-safe execution plan composed of sequential or branching steps designed to automate and supervise desktop developer workflows.

Each workflow includes:
- **Metadata**: Unique ID, display name, description, version, target application (`Antigravity IDE`), and tags.
- **Approval Policy**:
  - `always_manual`: Every sensitive action pauses at an approval gate for interactive user confirmation.
  - `auto_safe_only`: Recommended prompt choices are automatically completed if verified safe; other steps require approval.
  - `full_auto`: Autonomous end-to-end execution within configured safety bounds.
- **Steps Sequence**: Array of configured actions with per-step timeouts, retry counters, and failure policies (`stop`, `continue`, `retry`).

---

## 2. Supported Step Types & Parameters

| Step Type | Description | Key Configuration Parameters |
| :--- | :--- | :--- |
| `detect_prompt` | Probes the Antigravity window using Windows UI Automation to discover open modal dialogs. | `processName`: Target process name (default: `Antigravity IDE`)<br>`delaySeconds`: Pause before probing (0–10s)<br>`targetOptionSubstring`: Match text like `(Recommended)` |
| `inspect_ui` | Deep inspection of child elements, accessible controls, and UIA pattern support. | `delaySeconds`: Time before capture<br>`scope`: Subtree or full window |
| `select_radio` | Locates and invokes `IUIAutomationSelectionItemPattern::Select` on a choice option. | `targetSubstring`: Option pattern, e.g. `(Recommended)`<br>`autoCompleteIfSubmitExists`: If `true`, clicks the Submit button immediately upon selection |
| `invoke_button` | Finds a button by name/pattern and triggers `IUIAutomationInvokePattern::Invoke`. | `buttonName`: Name pattern, e.g. `Submit`, `Save`, `Continue`<br>`verifyDismissal`: Verifies the dialog container closes within 3 seconds |
| `wait_for_condition` | Polls until a specified state condition is met or times out. | `conditionType`: `dialog_closed`, `window_visible`, or `process_running`<br>`intervalMs`: Polling frequency in ms |
| `launch_app` | Starts an external command or tool via PowerShell. | `command`: Executable or PowerShell command line<br>`args`: Argument array<br>`cwd`: Working directory |
| `capture_snapshot` | Exports the current UI Automation tree and diagnostic state to a timestamped JSON file. | `label`: Descriptive note for the snapshot file |
| `write_log` | Writes an informational or diagnostic message to the workflow run log. | `message`: Message text<br>`level`: `info`, `warn`, `error`, `debug` |
| `branch_condition` | Conditionally redirects workflow execution based on the output of prior steps. | `conditionType`: Field condition to test<br>`onSuccessGoto`: Target step ID if true<br>`onFailureGoto`: Target step ID if false |
| `user_approval` | Halts execution and presents a modal prompt to the user in AutoPilot AI. | `prompt`: Explanatory message displayed to the user |

---

## 3. Seeded Default Workflows

AutoPilot AI ships with two production-ready default workflows:

### 1. `Antigravity Auto-Approve Recommended Option` (`wf_antigravity_recommended`)
Automates the resolution of harmless interactive questions (such as indentation or tool confirmation) in Antigravity IDE:
1. **Verify Antigravity Window Live**: Detects the open prompt and verifies window bounds.
2. **Inspect Subtree & Option Elements**: Gathers all radio button labels and checks for `(Recommended)` markers.
3. **Select Recommended Radio Option**: Invokes `Select()` on the recommended option and clicks `Submit`.
4. **Verify Dialog Closed**: Confirms the modal container has vanished from the accessible tree.
5. **Log Execution Summary**: Emits a timestamped completion record to audit storage.

### 2. `Safe Diagnostic UI Automation Healthcheck` (`wf_antigravity_healthcheck`)
Read-only diagnostic routine:
1. **Run Subtree Diagnostic Probe**: Scans the target desktop session (`WinSta0\Default`) without clicking or selecting anything.
2. **Snapshot Diagnostic Artifacts**: Writes the discovered elements to `diagnostics/phase0_1_prompt_report.json`.

---

## 4. Authoring a New Workflow

1. Navigate to **Workflow Library** or **Workflow Builder**.
2. Click **New Workflow**.
3. Name your workflow and specify target application parameters.
4. Add desired steps from the step catalog.
5. Click **Configure** on any step to adjust parameters, timeouts, and retry policies.
6. Click **Save** to persist your workflow to the local store.
7. Click **Run Workflow** to test execution in the **Live Execution Monitor**.

---

## 5. Emergency Overrides

- **Global Hotkey**: Press `Ctrl+Alt+S` at any time to immediately abort all running workflows.
- **TopBar Emergency Stop**: Click the red **Emergency Stop** button in the header bar.
- **Live Monitor Cancel**: Use the **Cancel Run** button on the active run card.
