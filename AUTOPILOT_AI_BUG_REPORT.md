# AutoPilot AI v1.0.0 — Comprehensive Bug Report & Defect Log

**Audit Lead**: Senior QA & Security Test Lead  
**Package Under Test**: `autopilot-ai-1.0.0.vsix`  
**Date**: November 12, 2026 (Updated Post Bug Fixes)  

---

## Defect Summary Dashboard

| Bug ID | Title | Severity | Affected Component | Status | Release Blocker |
|---|---|---|---|---|---|
| **BUG-001** | Webview asset replacement regex fails to match `./assets/` produced by Vite | **HIGH** | `autopilotViewProvider.ts` | **RESOLVED & VERIFIED** | WAS YES -> **CLEARED** |
| **BUG-002** | Sidebar navigation is missing direct links to Library and Agent views | **MEDIUM** | `src/components/Sidebar.tsx` | **RESOLVED & VERIFIED** | NO |
| **BUG-003** | `package.json` configuration properties are not synced with `DocumentStore` | **MEDIUM** | `extension/src/extension.ts` | **RESOLVED & VERIFIED** | NO |
| **BUG-004** | Legacy `tsconfig.electron.json` fails compilation with 28 TypeScript errors | **LOW** | `tsconfig.electron.json` | **DOCUMENTED** (Legacy) | NO |
| **BUG-005** | Residual "Cursor" string checks remain in diagnostic PowerShell scripts | **LOW** | `diagnostics/*.ps1` | **DOCUMENTED** | NO |
| **BUG-006** | Missing `repository` manifest field and `LICENSE` file in VSIX packaging | **LOW** | `package.json`, root | **DOCUMENTED** | NO |
| **BUG-007** | `.gitignore` and mock diagnostic JSON/TXT reports packaged into VSIX | **LOW** | `.vscodeignore` | **RESOLVED & VERIFIED** | NO |
| **BUG-008** | Legacy `onSubscriptionStatusChange` listener remains in `electron/preload.ts` | **INFO** | `electron/preload.ts` | **DOCUMENTED** | NO |

---

## Detailed Bug Reports & Resolution Evidence

### BUG-001: Webview Asset Replacement Regex Fails to Match `./assets/`
- **Bug ID**: `BUG-001`
- **Title**: Webview asset replacement regex fails to match `./assets/` produced by Vite
- **Severity**: **HIGH**
- **Affected Component**: `extension/src/providers/autopilotViewProvider.ts` (lines 235–244)
- **Status**: **RESOLVED & VERIFIED**
- **Resolution**:
  Replaced fragile regular expressions with a unified path normalizer that strips leading `./` and `/`, matches `.js`, `.css`, `.png`, `.jpg`, `.svg`, and checks file existence on disk before rewriting to `webview.asWebviewUri`. Injected standard VS Code Content-Security-Policy meta tag into the `<head>` of the webview.
- **Verification**:
  - `dist/index.html` script and style tags properly transformed into `vscode-webview://` URIs.
  - Verified by Regression Test 80 (`Regression Test BUG-001`).

---

### BUG-002: Sidebar Navigation Missing Direct Links to Library & Agent Views
- **Bug ID**: `BUG-002`
- **Title**: Sidebar navigation is missing direct links to Library and Agent views
- **Severity**: **MEDIUM**
- **Affected Component**: `src/components/Sidebar.tsx`
- **Status**: **RESOLVED & VERIFIED**
- **Resolution**:
  Added navigation entries for `agent` (`Automation Agent` with `Bot` icon) and `library` (`Workflow Library` with `FolderKanban` icon) to `navItems` in `src/components/Sidebar.tsx`. Added `overflow-y-auto` to the navigation container to maintain clean scrollability on compact viewports.
- **Verification**:
  - Clicking `agent` navigates to `AutomationAgentView` (title: *Automation Agent & Session Monitor*).
  - Clicking `library` navigates to `WorkflowLibraryView` (title: *Workflow Library & Templates*).
  - Verified by Regression Test 81 (`Regression Test BUG-002`).

---

### BUG-003: `package.json` Configuration Not Synced with `DocumentStore`
- **Bug ID**: `BUG-003`
- **Title**: `package.json` configuration properties are not synced with `DocumentStore`
- **Severity**: **MEDIUM**
- **Affected Component**: `extension/src/providers/configurationSynchronizer.ts`, `extension/src/extension.ts`, `autopilotViewProvider.ts`
- **Status**: **RESOLVED & VERIFIED**
- **Resolution**:
  Created `ConfigurationSynchronizer` establishing bidirectional synchronization between VS Code workspace settings (`autopilot.*`) and `DocumentStore` (`settings.json`).
  - Converts `autopilot.mode` (`safe_auto`, `full_auto`, `manual_approval`) <-> `approvalPolicy` (`auto_safe_only`, `full_auto`, `always_manual`).
  - Converts `autopilot.responseSpeed` (`instant`, `fast`, `comfortable`, `deliberate`) <-> delay milliseconds (100, 250, 750, 1500ms).
  - Syncs `autoStartMonitoring`, `enableFileChangeApproval`, `monitoringInterval`, and confidence threshold.
  - Registers `vscode.workspace.onDidChangeConfiguration` listener.
  - Uses `isSyncing` flag to prevent circular update loops between Webview and VS Code Settings Editor.
- **Verification**:
  - Initial configuration sync verified.
  - Bidirectional mapping functions verified.
  - Verified by Regression Test 82 (`Regression Test BUG-003`).

---

### BUG-004: Legacy `tsconfig.electron.json` Fails Compilation
- **Bug ID**: `BUG-004`
- **Title**: Legacy `tsconfig.electron.json` fails compilation with 28 TypeScript errors
- **Severity**: **LOW**
- **Affected Component**: `tsconfig.electron.json`
- **Status**: **DOCUMENTED (Legacy Desktop Artifact)**
- **Details**:
  Standalone desktop artifact from Electron era. Does not affect extension compilation (`tsconfig.extension.json` passes with 0 errors) or packaging.

---

### BUG-005: Residual "Cursor" String Checks in Diagnostic PowerShell Scripts
- **Bug ID**: `BUG-005`
- **Title**: Residual "Cursor" string checks remain in diagnostic PowerShell scripts
- **Severity**: **LOW**
- **Affected Component**: `diagnostics/list_target_windows.ps1`
- **Status**: **DOCUMENTED**
- **Details**:
  Harmless residual title-matching substring in diagnostic scripts. Core engine strictly blocks Cursor (`SafetyGuard.isSupportedIde('cursor') === false`).

---

### BUG-006: Missing `repository` and `LICENSE` Warnings During VSIX Packaging
- **Bug ID**: `BUG-006`
- **Title**: Missing `repository` manifest field and `LICENSE` file in VSIX packaging
- **Severity**: **LOW**
- **Affected Component**: `package.json`, root directory
- **Status**: **DOCUMENTED**
- **Details**:
  Non-fatal warnings emitted by `vsce package`.

---

### BUG-007: `.gitignore` and Backup Files Packaged into VSIX
- **Bug ID**: `BUG-007`
- **Title**: `.gitignore` and backup files packaged into VSIX
- **Severity**: **LOW**
- **Affected Component**: `.vscodeignore`
- **Status**: **RESOLVED & VERIFIED**
- **Resolution**:
  Added `*.vsix`, `*.vsix*`, `*.bak`, `*.release_backup`, and `.gitignore` to `.vscodeignore`. Repackaged VSIX size optimized to 471.81 KB with zero backup or git files.
