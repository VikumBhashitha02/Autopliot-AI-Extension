# AutoPilot AI v1.0.0 — Comprehensive Test Cases & Execution Log

**Test Lead**: Senior QA & Automation Test Lead  
**Test Suite**: AutoPilot AI Core Engine, Multi-IDE Automation & VS Code Extension Test Suite  
**Execution Environment**: Windows 11 x64, Node.js v20.17.10, PowerShell 5.1  
**Total Tests**: **83 (83 PASS, 0 FAIL)**  

---

## 1. Automated Test Suite (83 Scenarios)

### Group 1: SafetyGuard & Security Guardrails (Tests 1–10)
- **TC-SEC-001**: Dangerous Terminal Command Flagging -> **PASS**
- **TC-SEC-002**: Permit Safe Diagnostic Commands -> **PASS**
- **TC-SEC-003**: Sensitive Token and Credential Redaction -> **PASS**
- **TC-SEC-004**: Workflow Schema Validation -> **PASS**
- **TC-SEC-005**: Process Allowlisting (Antigravity & Code) -> **PASS**
- **TC-SEC-006**: Path Traversal Rejection -> **PASS**
- **TC-SEC-007**: Shell Parameter Sanitization -> **PASS**
- **TC-SEC-008**: Reject Workflows with Unauthorized Target Apps -> **PASS**
- **TC-SEC-009**: Permanent Negative Action Lockout -> **PASS**
- **TC-SEC-010**: Safe Policy Evaluation -> **PASS**

### Group 2: DocumentStore & Persistence (Tests 11–17)
- **TC-DAT-001**: Settings Initialization and Retrieval -> **PASS**
- **TC-DAT-002**: Workflow Template Seeding -> **PASS**
- **TC-DAT-003**: Execution Run Persistence -> **PASS**
- **TC-DAT-004**: Workflow CRUD Across Restarts -> **PASS**
- **TC-DAT-005**: Settings Persistence Across Restarts -> **PASS**
- **TC-DAT-006**: Run History Clear Operations -> **PASS**
- **TC-DAT-007**: Custom Workflow ID Persistence -> **PASS**

### Group 3: WorkflowEngine & Execution (Tests 18–29)
- **TC-ENG-001**: Harmless Multi-Step Workflow Execution -> **PASS**
- **TC-ENG-002**: Deterministic Step Ordering & Branching -> **PASS**
- **TC-ENG-003**: Failure Propagation and Halting -> **PASS**
- **TC-ENG-004**: Failure Recovery Branching (`onFailureGoto`) -> **PASS**
- **TC-ENG-005**: Step Timeout Enforcement -> **PASS**
- **TC-ENG-006**: Workflow Cancellation -> **PASS**
- **TC-ENG-007**: Emergency Stop Concurrency Race -> **PASS**
- **TC-ENG-008**: Step Retry Limits -> **PASS**
- **TC-ENG-009**: Long-Running Step Abort -> **PASS**
- **TC-ENG-010**: Snapshot and State Recording -> **PASS**
- **TC-ENG-011**: In-Flight Step Termination -> **PASS**
- **TC-ENG-012**: Engine Lock State Verification -> **PASS**

### Group 4: File Change "Accept All" Scenarios (Tests 30–50)
- **TC-FILE-001**: Genuine "Accept All" Button Detection -> **PASS**
- **TC-FILE-002**: Case-Insensitive Variations (`accept all`, `ACCEPT ALL`) -> **PASS**
- **TC-FILE-003**: Phrasing Variations (`Accept all changes`, `Accept all files`) -> **PASS**
- **TC-FILE-004**: Editor Content False-Positive Rejection -> **PASS**
- **TC-FILE-005**: Outside Container Button Rejection -> **PASS**
- **TC-FILE-006**: Permanent Rejection of Discard/Reject/Cancel -> **PASS**
- **TC-FILE-007**: Multi-Window Antigravity Support -> **PASS**
- **TC-FILE-008**: Policy Enforcement (`auto_safe_only`) -> **PASS**
- **TC-FILE-009**: Policy Enforcement (`full_auto`) -> **PASS**
- **TC-FILE-010**: Policy Enforcement (`always_manual`) -> **PASS**
- **TC-FILE-011**: Disabled Setting (`autoAcceptAllFileChanges = false`) -> **PASS**
- **TC-FILE-012**: Fingerprint Debouncing (Duplicate Click Prevention) -> **PASS**
- **TC-FILE-013**: History Creation Verification -> **PASS**
- **TC-FILE-014**: UI Automation Exception Safety -> **PASS**
- **TC-FILE-015**: Target HWND Invalidation Handling -> **PASS**
- **TC-FILE-016**: Emergency Stop During Pending File Review -> **PASS**
- **TC-FILE-017**: Ambiguous UI Structure Protection -> **PASS**
- **TC-FILE-018**: Simultaneous Dialog Rejection -> **PASS**
- **TC-FILE-019**: Multi-File Edit Banner Parsing -> **PASS**
- **TC-FILE-020**: Modified File Count Extraction -> **PASS**
- **TC-FILE-021**: Confidence Scoring Validation (HIGH, MEDIUM, LOW) -> **PASS**

### Group 5: Multi-IDE Support & IDE Registry (Tests 51–63)
- **TC-IDE-001**: Multi-IDE Registry Initialization -> **PASS**
- **TC-IDE-002**: Window Matching to Target Adapter -> **PASS**
- **TC-IDE-003**: Action Category Classification -> **PASS**
- **TC-IDE-004**: UniversalActionDetector Button Locking -> **PASS**
- **TC-IDE-005**: Antigravity IDE Adapter Prompt & Terminal Detection -> **PASS**
- **TC-IDE-006**: VS Code Copilot Status Detection (`connected`, `interface_unavailable`) -> **PASS**
- **TC-IDE-007**: Multi-IDE Connection Scanning -> **PASS**
- **TC-IDE-008**: Target IDE Filter Overrides -> **PASS**
- **TC-IDE-009**: Safety Policies Preserved Without Cursor -> **PASS**
- **TC-IDE-010**: Cursor ID Exclusion Verification -> **PASS**
- **TC-IDE-011**: Terminal Command Identification -> **PASS**
- **TC-IDE-012**: Prompt Submission Button Identification -> **PASS**
- **TC-IDE-013**: Multi-Window Process Resolving -> **PASS**

### Group 6: VS Code Extension Host Integration (Tests 64–79)
- **TC-EXT-001**: Extension Activation & Status Bar Registration -> **PASS**
- **TC-EXT-002**: Extension Deactivation Cleanup -> **PASS**
- **TC-EXT-003**: Activity Bar Contribution Validation -> **PASS**
- **TC-EXT-004**: Sidebar Webview Provider Loading -> **PASS**
- **TC-EXT-005**: Public Command Registration (9 Commands) -> **PASS**
- **TC-EXT-006**: Settings Persistence Saves and Reloads -> **PASS**
- **TC-EXT-007**: Automation Mode Updates State Machine -> **PASS**
- **TC-EXT-008**: Recommended Option Pattern Recognition -> **PASS**
- **TC-EXT-009**: Positive Button Identification -> **PASS**
- **TC-EXT-010**: Emergency Stop Halts Workflows Immediately -> **PASS**
- **TC-EXT-011**: Antigravity Environment Detection Verification -> **PASS**
- **TC-EXT-012**: Platform Adapter Selection (Windows, macOS, Linux) -> **PASS**
- **TC-EXT-013**: Graceful Error Handling Without Engine Crashes -> **PASS**
- **TC-EXT-014**: Extension Restart Retains Workflows -> **PASS**
- **TC-EXT-015**: Extension Context Subscriptions Registration -> **PASS**
- **TC-EXT-016**: Webview Script Bridge Injection -> **PASS**

---

## 2. Regression Test Cases for Bug Fixes (Tests 80–82)

### TC-REG-001: Webview Asset Transformation (BUG-001)
- **Test ID**: `TC-REG-001` (Test 80 in test suite)
- **Objective**: Verify that webview HTML transformation handles `./assets/`, `/assets/`, and local bundled assets, converting them to `vscode-webview://` URIs and enforcing Content Security Policy.
- **Preconditions**: Built webview HTML structure with Vite relative asset paths.
- **Test Steps**:
  1. Pass HTML containing `<script src="./assets/index-sample.js"></script>`, `<link href="./assets/index-sample.css">`, `<img src="/assets/app-icon-sample.png">`, and `<link href="https://fonts.googleapis.com">`.
  2. Apply the path normalization and replacement logic.
  3. Verify Content Security Policy meta tag injection.
- **Expected Result**:
  - Script path rewritten to `src="vscode-webview://mock/assets/index-sample.js"`.
  - Stylesheet rewritten to `href="vscode-webview://mock/assets/index-sample.css"`.
  - Image rewritten to `src="vscode-webview://mock/assets/app-icon-sample.png"`.
  - External link `https://fonts.googleapis.com` preserved as-is.
  - `<meta http-equiv="Content-Security-Policy"` present in `<head>`.
- **Actual Result**: All assertions passed cleanly.
- **Status**: **PASS**
- **Evidence**: `ok 80 - Regression Test BUG-001: Webview asset transformation handles relative ./assets/, /assets/, and bundle files with CSP (1.59ms)`

---

### TC-REG-002: Sidebar Navigation Structure (BUG-002)
- **Test ID**: `TC-REG-002` (Test 81 in test suite)
- **Objective**: Verify that `src/components/Sidebar.tsx` contains direct navigation entries for `library` and `agent`, and `src/App.tsx` routes to the respective views.
- **Preconditions**: `Sidebar.tsx` and `App.tsx` source files.
- **Test Steps**:
  1. Inspect `Sidebar.tsx` navigation definitions.
  2. Verify existence of `{ id: 'agent', label: 'Automation Agent' }`.
  3. Verify existence of `{ id: 'library', label: 'Workflow Library' }`.
  4. Inspect `App.tsx` to verify `case 'agent': return <AutomationAgentView />` and `case 'library': return <WorkflowLibraryView />`.
- **Expected Result**: Navigation entries exist, labels match, and App.tsx routes properly.
- **Actual Result**: All assertions passed cleanly.
- **Status**: **PASS**
- **Evidence**: `ok 81 - Regression Test BUG-002: Sidebar navigation structure contains entries for Workflow Library and Automation Agent (4.06ms)`

---

### TC-REG-003: Configuration Synchronizer Bidirectional Mapping (BUG-003)
- **Test ID**: `TC-REG-003` (Test 82 in test suite)
- **Objective**: Verify bidirectional mapping between VS Code settings (`autopilot.*`) and `DocumentStore` (`settings.json`), ensuring loop-free synchronization and setting persistence.
- **Preconditions**: `ConfigurationSynchronizer` and `DocumentStore` loaded.
- **Test Steps**:
  1. Test `modeToApprovalPolicy` for `safe_auto`, `full_auto`, `manual_approval`, and invalid fallback.
  2. Test `approvalPolicyToMode` for `auto_safe_only`, `full_auto`, `always_manual`.
  3. Test `speedToDelayMs` for `instant`, `fast`, `comfortable`, `deliberate`.
  4. Test `delayMsToSpeed` for 100, 250, 750, 1500ms.
  5. Test saving and reloading synchronized settings via `DocumentStore`.
- **Expected Result**: All mappings are exact and bidirectional. Store persists synchronized configuration fields.
- **Actual Result**: All assertions passed cleanly.
- **Status**: **PASS**
- **Evidence**: `ok 82 - Regression Test BUG-003: ConfigurationSynchronizer bidirectionally maps settings and prevents circular sync loops (49.16ms)`
