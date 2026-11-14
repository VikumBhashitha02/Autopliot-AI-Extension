# AutoPilot AI — Responsive Test Cases & Verification Matrix

**Date:** November 12, 2026  
**Test Suite:** Responsive Layout, Viewport Scaling & Touch Accessibility  
**Target Environments:** Visual Studio Code (v1.93+) & Google Antigravity IDE (2026)  
**Total Test Cases:** 25  
**Result:** 25 Passed / 0 Failed (100% Pass Rate)

---

## 1. Test Case Matrix Overview

| Test ID | Test Category | Target Viewport / Component | Expected Behavior | Status |
|---|---|---|---|---|
| **TC-RESP-001** | Navigation | Mobile (320px x 568px) | Sidebar collapses into off-canvas drawer; hamburger toggle in TopBar opens drawer. | **PASS** |
| **TC-RESP-002** | Navigation | Mobile Drawer Navigation | Clicking any navigation link closes the drawer and transitions view. | **PASS** |
| **TC-RESP-003** | Navigation | Tablet (768px x 1024px) | Sidebar renders inline in compact mode with icon tooltips; main view fills remaining space. | **PASS** |
| **TC-RESP-004** | Navigation | Desktop (1440px x 900px) | Sidebar renders full width with labels, badges, theme toggle, and expand/collapse button. | **PASS** |
| **TC-RESP-005** | Header | TopBar Narrow (< 640px) | Emergency Stop button compresses to icon + "Stop"; titles truncate with ellipsis. | **PASS** |
| **TC-RESP-006** | Header | TopBar Wide (>= 1024px) | Target process name, PID badge, Desktop station info, and full shortcut keys render. | **PASS** |
| **TC-RESP-007** | Footer | AppFooter Narrow (280px–360px) | Copyright and developer attribution wrap cleanly without clipping or text overlap. | **PASS** |
| **TC-RESP-008** | Modal | ApprovalModal Low Height (568px) | Modal content scrolls vertically with max 90vh; Approve/Reject buttons stack. | **PASS** |
| **TC-RESP-009** | Dashboard | Dashboard Metrics Mobile (320px) | Stat cards render as single vertical column without horizontal scrollbars. | **PASS** |
| **TC-RESP-010** | Dashboard | Dashboard Metrics Tablet (768px) | Stat cards render as 2-column grid; hero banner buttons wrap cleanly. | **PASS** |
| **TC-RESP-011** | Dashboard | Dashboard Desktop (1440px+) | Stat cards render as 4-column grid; action feeds and execution history split 50/50. | **PASS** |
| **TC-RESP-012** | Live View | AutoPilot Live Mode Selector | Target IDE pills (Auto / Antigravity / Copilot) wrap into multi-line rows on small screens. | **PASS** |
| **TC-RESP-013** | Live View | UIA Pipeline Stepper | State steps render as 2x3 grid on mobile and 1x6 row on desktop without clipping. | **PASS** |
| **TC-RESP-014** | Live View | Policy Selector Cards | Policy cards stack vertically on `< 768px` and render 3-wide on `md+`. | **PASS** |
| **TC-RESP-015** | Live View | Live Action Feed | Action rows wrap title, button clicked, selected option, and execution duration. | **PASS** |
| **TC-RESP-016** | Agent | Automation Agent Controls | Start Monitoring and Probe buttons wrap smoothly on narrow viewports. | **PASS** |
| **TC-RESP-017** | Agent | Multi-IDE Environments Grid | Supported environments render 1-column on mobile and 2-column on desktop. | **PASS** |
| **TC-RESP-018** | Agent | Window Instance Dropdown | Target window selector fits within 280px webview width without page overflow. | **PASS** |
| **TC-RESP-019** | Rules | Speed Delay Buttons | 100ms, 250ms, 750ms, 1500ms buttons wrap 1-col on mobile, 2-col on sm, 4-col on lg. | **PASS** |
| **TC-RESP-020** | Rules | Button Matching Rules | Approved buttons grid adapts from 1 column on mobile to 3 columns on tablet/desktop. | **PASS** |
| **TC-RESP-021** | Prompts | Prompt Manager Inspection | Inspection header wraps IDE select dropdown and inspect button on mobile. | **PASS** |
| **TC-RESP-022** | Monitor | Execution Timeline Stages | Real-time lifecycle verification stages adapt without clipping (2-col to 6-col). | **PASS** |
| **TC-RESP-023** | Monitor | Live Logs Monospace Terminal | Long log lines wrap with `break-all`; scroll container operates independently. | **PASS** |
| **TC-RESP-024** | Library | Workflow Library Templates | Workflow cards render 1-col on mobile, 2-col on md, 3-col on xl; tag pills scroll. | **PASS** |
| **TC-RESP-025** | Settings | Settings View Form Controls | Policy cards, range sliders, and cleanup buttons adjust to mobile and desktop widths. | **PASS** |

---

## 2. Detailed Test Specifications

### TC-RESP-001: Mobile Navigation Drawer
- **Objective:** Verify navigation adapts to mobile viewports without blocking or shrinking main content.
- **Preconditions:** Viewport set to 320px x 568px (iPhone SE).
- **Execution Steps:**
  1. Load webview.
  2. Verify sidebar is hidden from main view (`-translate-x-full`).
  3. Verify hamburger menu icon is visible in TopBar.
  4. Click hamburger icon.
  5. Verify slide-over drawer animates in with dark backdrop (`fixed inset-0 bg-black/70`).
- **Pass Criteria:** Drawer renders completely, no horizontal scrollbar on root window.

### TC-RESP-005: TopBar Adaptive Controls
- **Objective:** Verify Emergency Stop and title readability under narrow width constraints.
- **Preconditions:** Viewport width set to 280px.
- **Execution Steps:**
  1. Inspect TopBar.
  2. Check Emergency Stop button text.
  3. Check process and desktop station pills.
- **Pass Criteria:** Process pills are hidden; Emergency Stop button displays icon and "Stop"; title truncates cleanly.

### TC-RESP-008: ApprovalModal Low-Height Scroll Protection
- **Objective:** Prevent approval gates from being cut off on short displays.
- **Preconditions:** Viewport height set to 568px, trigger `requestApproval("Authorize disk operation")`.
- **Execution Steps:**
  1. Trigger approval modal.
  2. Verify dialog renders centered.
  3. Verify modal maximum height is constrained to `90vh`.
  4. Verify both Approve and Reject buttons are visible and clickable.
- **Pass Criteria:** Modal does not exceed window bounds; scrollbar appears if prompt text is long.

### TC-RESP-023: Live Execution Logs Break-Word Verification
- **Objective:** Ensure long terminal output and stack traces do not cause horizontal page widening.
- **Preconditions:** Execution run with long paths and JSON logs.
- **Execution Steps:**
  1. Navigate to Execution Monitor view at 360px viewport width.
  2. Inject 300-character single-line path into logs.
  3. Inspect log container.
- **Pass Criteria:** Text wraps inside container with `break-all`; no horizontal scrollbar on viewport body.

