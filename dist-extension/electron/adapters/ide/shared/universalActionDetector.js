"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalActionDetector = void 0;
const safetyGuard_1 = require("../../../security/safetyGuard");
class UniversalActionDetector {
    /**
     * Evaluates whether a button element is safe to click and determines its action category.
     */
    static evaluateCandidate(buttonName, containerName = '', containerClass = '', automationId = '') {
        const isDestructive = safetyGuard_1.SafetyGuard.isDestructiveOrRejection(buttonName);
        const category = safetyGuard_1.SafetyGuard.classifyActionCategory(buttonName, {
            isTerminal: containerName.toLowerCase().includes('terminal') || automationId.toLowerCase().includes('terminal'),
            isFileChange: containerName.toLowerCase().includes('file') || containerClass.toLowerCase().includes('review'),
            isPrompt: containerName.toLowerCase().includes('prompt') || containerName.toLowerCase().includes('chat'),
        });
        const isSafe = !isDestructive && category !== 'REJECTION' && category !== 'DESTRUCTIVE';
        let confidence = 'LOW';
        if (isSafe) {
            if (category === 'FILE_CHANGE_APPROVAL' &&
                (buttonName.toLowerCase().startsWith('accept all') || buttonName.toLowerCase() === 'apply')) {
                confidence = 'HIGH';
            }
            else if (category === 'PROMPT_SUBMISSION' &&
                (buttonName.toLowerCase() === 'submit' || buttonName.toLowerCase().includes('submit ↵') || buttonName.toLowerCase() === 'send')) {
                confidence = 'HIGH';
            }
            else if (category === 'PERMISSION_APPROVAL' &&
                (buttonName.toLowerCase().includes('allow this time') || buttonName.toLowerCase() === 'allow' || buttonName.toLowerCase() === 'approve')) {
                confidence = 'HIGH';
            }
            else if (category === 'CONTINUE_APPROVAL' || category === 'CONFIRMATION') {
                confidence = 'MEDIUM';
            }
            else {
                confidence = 'MEDIUM';
            }
        }
        return {
            name: buttonName,
            automationId,
            className: containerClass,
            category,
            isSafe,
            confidence,
            contextDescription: `Detected action '${buttonName}' classified as ${category} in container '${containerName || 'default'}'`,
        };
    }
    /**
     * Filters a list of raw button names to only valid, non-destructive actions.
     */
    static filterSafeActions(buttonNames) {
        return buttonNames
            .map((name) => this.evaluateCandidate(name))
            .filter((candidate) => candidate.isSafe);
    }
}
exports.UniversalActionDetector = UniversalActionDetector;
//# sourceMappingURL=universalActionDetector.js.map