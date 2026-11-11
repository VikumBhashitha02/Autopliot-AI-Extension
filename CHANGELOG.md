# Change Log - AutoPilot AI

All notable changes to the "autopilot-ai" extension will be documented in this file.

## [1.0.0] - 2026-11-12

### Initial Extension Release
- **Transformed from Desktop Application to Extension**: Full migration from Electron desktop app to native Visual Studio Code and Google Antigravity IDE extension (`.vsix`).
- **Complete Dual IDE Support**: Dedicated support for Visual Studio Code (^1.85.0) and Google Antigravity IDE with automatic environment detection.
- **Account-Free & Free to Use**: Completely eliminated Firebase Authentication, email verifications, passwords, and user account management. AutoPilot AI starts immediately with zero friction.
- **Removed All Paywalls & Licensing**: Removed all subscription tiers, 90-day trial locks, payment gateways, and hardware fingerprinting. All automation features are 100% free and open.
- **Removed Cursor AI**: Eliminated Cursor-specific adapters, process monitors, and configs to focus exclusively on VS Code and Google Antigravity.
- **Preserved Enterprise Safety**: Retained `SafetyGuard` destructive action prevention, shell parameter sanitization, sensitive token redaction, process allowlisting, and emergency stop (`Ctrl+Alt+Shift+E`).
- **Sidebar & Activity Bar Integration**: Dedicated AutoPilot AI Activity Bar container and responsive sidebar webview hosting AutoPilot Live, Rules, Prompt Inspector, Dashboard, Monitor, Workflow Builder, Library, Diagnostics, and Settings.
- **Status Bar Indicator**: Real-time status bar item showing current automation mode (`Safe Auto`, `Full Auto`, `Manual`), monitoring state, and click-to-toggle monitoring.
- **Multi-Speed Response Engine**: Added configurable execution speed delays: Instant (100ms), Fast (250ms), Comfortable (750ms), and Deliberate (1500ms).
- **Automated "Accept All" & Diff Approval**: Automated inspection and one-click/autonomous approval for pending multi-file code diffs and review banners.
- **Prompt Inspection & Recommendation Auto-Selection**: Read-only inspection of interactive dialogs, automatic selection of recommended options, and positive confirmation submission.
- **Cross-Platform Compatibility**: Native Windows UI Automation engine with graceful capability reporting on macOS and Linux.

