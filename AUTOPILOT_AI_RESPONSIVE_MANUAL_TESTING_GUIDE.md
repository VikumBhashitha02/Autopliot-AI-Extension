# AutoPilot AI — Responsive Manual Testing & QA Verification Guide

**Target Audience:** QA Engineers, Extension Testers, Release Managers  
**Extension Under Test:** `autopilot-ai-1.0.0.vsix`  
**Supported Platforms:** Visual Studio Code & Google Antigravity IDE  

---

## 1. Prerequisites & Setup

### 1.1 Local Webview Development Mode
To test live responsive scaling in Chrome DevTools:
```bash
npm run dev
```
Open `http://localhost:5173` in Google Chrome or Microsoft Edge.

### 1.2 Extension Testing in VS Code / Antigravity
To test the built extension inside VS Code or Google Antigravity:
1. Open the Command Palette (`Ctrl+Shift+P`).
2. Type `Extensions: Install from VSIX...`
3. Select `autopilot-ai-1.0.0.vsix` located in the project root.
4. Open AutoPilot AI from the Activity Bar icon.

---

## 2. Chrome DevTools Device Emulation Testing

Press `F12` or `Ctrl+Shift+I` to open Developer Tools, then press `Ctrl+Shift+M` to activate **Device Toolbar**.

### Test Preset 1: Small Mobile (320px x 568px — iPhone SE)
1. Set Dimension to **Responsive** and enter `320` x `568`.
2. **Verify Header:**
   - TopBar shows hamburger icon (`Menu`).
   - Title is readable and truncated if needed.
   - Emergency Stop button displays as icon + "Stop".
3. **Verify Navigation:**
   - Tap hamburger menu.
   - Slide-over drawer should animate in smoothly over a dark backdrop.
   - Tap "Prompt Manager". Drawer should close automatically and switch view.
4. **Verify Dashboard:**
   - Stat cards are stacked vertically (1 column).
   - Numbers and labels are crisp with no text clipping.
   - No horizontal scrollbar appears on the page.

### Test Preset 2: Mobile (375px x 667px — iPhone 12/13/14)
1. Set Dimension to `375` x `667`.
2. Navigate to **AutoPilot Live**:
   - Check target IDE pills (Auto, Antigravity, Copilot). They wrap cleanly.
   - Stepper displays 2 rows of 3 steps.
   - Action history items wrap title and duration.
3. Navigate to **Automation Rules**:
   - Response speed delay buttons wrap into 2 rows of 2.
   - Safety lock text wraps comfortably.

### Test Preset 3: Tablet (768px x 1024px — iPad Mini / Air)
1. Set Dimension to `768` x `1024`.
2. **Verify Navigation:**
   - Sidebar renders inline in compact mode (`w-20`).
   - Navigation item icons are centered.
   - Hovering displays tooltips with the view name.
3. **Verify Dashboard:**
   - Stat cards render as a 2-column grid.
   - Recent Actions and Execution History render side-by-side or cleanly stacked.

### Test Preset 4: Standard Laptop (1280px x 720px)
1. Set Dimension to `1280` x `720`.
2. **Verify Navigation:**
   - Sidebar is expanded (`w-64`) showing labels, active badges, and target process info.
3. Navigate to **Execution Monitor**:
   - Verification timeline renders all 6 stages horizontally.
   - Workflow Steps and Real-Time Logs split 50/50 side-by-side.
   - Scroll within logs does not move the rest of the page.

### Test Preset 5: Desktop & 4K (1920px x 1080px & 2560px x 1440px)
1. Set Dimension to `1920` x `1080` and `2560` x `1440`.
2. **Verify Container Alignment:**
   - Content is centered with max-width boundaries (`max-w-7xl`).
   - Text density and card spacing remain balanced.
   - No excessive blank gaps or distorted button stretching.

---

## 3. Webview Panel Width Drag Testing (VS Code / Antigravity)

Inside VS Code or Google Antigravity:

1. Click the AutoPilot AI icon in the Activity Bar.
2. Slowly drag the sidebar pane divider to test each specific width:
   - **280px:** Verify hamburger menu appears; no horizontal scrollbar; Emergency Stop button shows "Stop".
   - **320px:** Verify cards fit comfortably; buttons wrap cleanly.
   - **360px:** Verify policy selector cards stack cleanly.
   - **420px:** Verify action history items display full button names.
   - **600px:** Verify stat cards transition from 1-column to 2-column layout.
3. Drag the webview to the bottom panel or editor area (`Ctrl+Shift+P` -> `View: Move View`):
   - Verify layout expands gracefully to wide panel mode without distortion.

---

## 4. Touch & Interaction QA Checklist

- [x] All interactive buttons have a minimum touch target height of 36px.
- [x] Drawer backdrop tap dismisses the menu on mobile.
- [x] Emergency Stop hotkey (`Ctrl+Alt+S`) works on desktop and button works on touch.
- [x] Modals remain within viewport boundaries on low-height screens.
- [x] Long process titles, URLs, and JSON keys truncate or break words cleanly.
- [x] Light and Dark mode contrast verified across all responsive breakpoints.

