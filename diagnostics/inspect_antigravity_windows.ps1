$code = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class WinInspector {
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

    public class FoundWin {
        public long Hwnd;
        public uint Pid;
        public string ProcName;
        public string Title;
        public string ClassName;
        public bool Visible;
    }

    public static List<FoundWin> Windows = new List<FoundWin>();

    private static bool EnumProc(IntPtr hWnd, IntPtr lParam) {
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        string pName = "";
        try {
            Process p = Process.GetProcessById((int)pid);
            pName = p.ProcessName;
        } catch { }

        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString();

        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hWnd, sbCls, 256);
        string cls = sbCls.ToString();

        bool vis = IsWindowVisible(hWnd);

        // Filter for Antigravity, electron, or interesting windows
        if (pName.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
            pName.IndexOf("electron", StringComparison.OrdinalIgnoreCase) >= 0 ||
            cls.IndexOf("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase) >= 0 ||
            title.IndexOf("campus", StringComparison.OrdinalIgnoreCase) >= 0) {
            
            FoundWin fw = new FoundWin();
            fw.Hwnd = hWnd.ToInt64();
            fw.Pid = pid;
            fw.ProcName = pName;
            fw.Title = title;
            fw.ClassName = cls;
            fw.Visible = vis;
            Windows.Add(fw);
        }
        return true;
    }

    public static void Inspect() {
        Windows.Clear();
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        SetThreadDesktop(hDesk);
        EnumDesktopWindows(hDesk, EnumProc, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code

$t = New-Object System.Threading.Thread([System.Threading.ThreadStart]{
    [WinInspector]::Inspect()
})
$t.SetApartmentState([System.Threading.ApartmentState]::STA)
$t.Start()
$t.Join()

Write-Output "Found $([WinInspector]::Windows.Count) matching windows:"
foreach ($w in [WinInspector]::Windows) {
    Write-Output "HWND: $($w.Hwnd) | PID: $($w.Pid) | Proc: $($w.ProcName) | Vis: $($w.Visible) | Class: $($w.ClassName) | Title: '$($w.Title)'"
}
