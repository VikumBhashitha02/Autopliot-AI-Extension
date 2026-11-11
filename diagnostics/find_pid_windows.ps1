$code = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinPidFinder {
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
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public class WinInfo {
        public long Hwnd;
        public string Title;
        public string ClassName;
        public bool Visible;
        public bool Iconic;
    }

    public static List<WinInfo> Results = new List<WinInfo>();

    private static bool Callback(IntPtr hWnd, IntPtr lParam) {
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);
        if (pid == 30992) {
            StringBuilder sbTitle = new StringBuilder(512);
            GetWindowText(hWnd, sbTitle, 512);

            StringBuilder sbCls = new StringBuilder(256);
            GetClassName(hWnd, sbCls, 256);

            WinInfo wi = new WinInfo();
            wi.Hwnd = hWnd.ToInt64();
            wi.Title = sbTitle.ToString();
            wi.ClassName = sbCls.ToString();
            wi.Visible = IsWindowVisible(hWnd);
            wi.Iconic = IsIconic(hWnd);
            Results.Add(wi);
        }
        return true;
    }

    public static void Run() {
        Results.Clear();
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        SetThreadDesktop(hDesk);
        EnumDesktopWindows(hDesk, Callback, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code

$t = New-Object System.Threading.Thread([System.Threading.ThreadStart]{
    [WinPidFinder]::Run()
})
$t.SetApartmentState([System.Threading.ApartmentState]::STA)
$t.Start()
$t.Join()

foreach ($w in [WinPidFinder]::Results) {
    Write-Output "HWND: $($w.Hwnd) | Vis: $($w.Visible) | Min: $($w.Iconic) | Class: $($w.ClassName) | Title: '$($w.Title)'"
}
