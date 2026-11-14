import * as os from 'os';

export interface AntigravityEnvironmentInfo {
  isAntigravityHost: boolean;
  appName: string;
  appHost: string;
  uiKind: string;
  platform: string;
  supportsNativeProcessSpawning: boolean;
  supportsVsixPackaging: boolean;
  supportsWebviewApi: boolean;
  capabilitiesSummary: string;
}

function getVsCode(): any {
  try {
    return require('vscode');
  } catch {
    return null;
  }
}

export class AntigravityEnvironment {
  /**
   * Performs verified detection of the host environment.
   * Can run safely both inside the VS Code / Antigravity Extension Host
   * and in test harnesses / CI environments.
   */
  public static detect(): AntigravityEnvironmentInfo {
    const vscode = getVsCode();
    const appName = vscode?.env?.appName || process.env.VSCODE_APP_NAME || 'Visual Studio Code';
    const appHost = vscode?.env?.appHost || process.env.VSCODE_APP_HOST || 'desktop';
    const uiKind = vscode?.env?.uiKind === 2 ? 'Web' : 'Desktop';
    const platform = os.platform();

    const isAntigravity =
      appName.toLowerCase().includes('antigravity') ||
      appHost.toLowerCase().includes('antigravity') ||
      Boolean(process.env.ANTIGRAVITY_APP) ||
      Boolean(process.env.GOOGLE_ANTIGRAVITY);

    const isDesktop = uiKind === 'Desktop';
    const supportsNativeProcessSpawning = isDesktop && (platform === 'win32' || platform === 'darwin' || platform === 'linux');

    return {
      isAntigravityHost: isAntigravity,
      appName,
      appHost,
      uiKind,
      platform,
      supportsNativeProcessSpawning,
      supportsVsixPackaging: true,
      supportsWebviewApi: true,
      capabilitiesSummary: isAntigravity
        ? `Running natively inside Google Antigravity IDE (${uiKind} host, platform: ${platform})`
        : `Running inside ${appName} with Google Antigravity external automation support enabled`,
    };
  }

  public static isAntigravity(): boolean {
    return this.detect().isAntigravityHost;
  }
}
