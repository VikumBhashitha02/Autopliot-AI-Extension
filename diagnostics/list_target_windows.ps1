$code = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading;

public class TargetWindowFinder {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public class WinInfo {
        public long Hwnd { get; set; }
        public uint Pid { get; set; }
        public string Title { get; set; }
        public string ProcessName { get; set; }
        public string ClassName { get; set; }
        public bool IsVisible { get; set; }
    }

    public static List<WinInfo> FoundList = new List<WinInfo>();

    private static bool EnumProc(IntPtr hWnd, IntPtr lParam) {
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString().Trim();
        if (string.IsNullOrEmpty(title)) return true;

        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hWnd, sbCls, 256);
        string cls = sbCls.ToString();

        bool vis = IsWindowVisible(hWnd);
        if (!vis) return true;

        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        string pName = "";
        try {
            Process p = Process.GetProcessById((int)pid);
            pName = p.ProcessName;
        } catch { }

        bool isMatch = (
            cls.IndexOf("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase) >= 0 &&
            (title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Visual Studio Code", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Code", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Cursor", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Click", StringComparison.OrdinalIgnoreCase) >= 0 ||
             title.IndexOf("Workspace", StringComparison.OrdinalIgnoreCase) >= 0 ||
             pName.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
             pName.IndexOf("Cursor", StringComparison.OrdinalIgnoreCase) >= 0 ||
             pName.IndexOf("Code", StringComparison.OrdinalIgnoreCase) >= 0 ||
             pName.IndexOf("electron", StringComparison.OrdinalIgnoreCase) >= 0)
        ) || (
            title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
            title.IndexOf("Cursor", StringComparison.OrdinalIgnoreCase) >= 0 ||
            title.IndexOf("Visual Studio Code", StringComparison.OrdinalIgnoreCase) >= 0 ||
            pName.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
            pName.IndexOf("Cursor", StringComparison.OrdinalIgnoreCase) >= 0 ||
            pName.IndexOf("Code", StringComparison.OrdinalIgnoreCase) >= 0
        );

        if (isMatch) {
            WinInfo info = new WinInfo();
            info.Hwnd = hWnd.ToInt64();
            info.Pid = pid;
            info.Title = title;
            if (!string.IsNullOrEmpty(pName)) {
                info.ProcessName = pName;
            } else if (title.IndexOf("Cursor", StringComparison.OrdinalIgnoreCase) >= 0) {
                info.ProcessName = "Cursor";
            } else if (title.IndexOf("Visual Studio Code", StringComparison.OrdinalIgnoreCase) >= 0 || title.IndexOf("Code", StringComparison.OrdinalIgnoreCase) >= 0) {
                info.ProcessName = "Code";
            } else {
                info.ProcessName = "Antigravity IDE";
            }
            info.ClassName = cls;
            info.IsVisible = vis;
            FoundList.Add(info);
        }
        return true;
    }

    public static List<WinInfo> Scan() {
        FoundList.Clear();
        Thread t = new Thread(new ThreadStart(Worker));
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join(8000);
        return FoundList;
    }

    private static void Worker() {
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        SetThreadDesktop(hDesk);
        EnumDesktopWindows(hDesk, EnumProc, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@

if (-not ([System.Management.Automation.PSTypeName]'TargetWindowFinder').Type) {
    Add-Type -TypeDefinition $code
}

$list = [TargetWindowFinder]::Scan()
if ($null -eq $list -or $list.Count -eq 0) {
    Write-Output "[]"
} else {
    $json = $list | ConvertTo-Json -Depth 4
    Write-Output $json
}


