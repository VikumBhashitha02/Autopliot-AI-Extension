"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseIdeAdapter = void 0;
class BaseIdeAdapter {
    matchesWindow(win) {
        if (!win)
            return false;
        const pName = (win.processName || '').toLowerCase();
        const title = (win.title || '').toLowerCase();
        return this.processNames.some((proc) => pName.includes(proc.toLowerCase()) ||
            title.includes(proc.toLowerCase()) ||
            (this.ideId === 'antigravity' && (title.includes('antigravity') || pName.includes('antigravity'))) ||
            (this.ideId === 'vscode_copilot' && (title.includes('visual studio code') || title.includes('code') || pName === 'code')));
    }
}
exports.BaseIdeAdapter = BaseIdeAdapter;
//# sourceMappingURL=baseIdeAdapter.js.map