$definition = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class ChromeWidgetFinder {
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

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public class WinInfo {
        public long Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
        public bool Visible;
        public int Width;
        public int Height;
    }

    public static List<WinInfo> Found = new List<WinInfo>();

    private static bool EnumProc(IntPtr hWnd, IntPtr lParam) {
        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hWnd, sbCls, 256);
        string cls = sbCls.ToString();

        if (cls == "Chrome_WidgetWin_1" || cls == "Chrome_WidgetWin_0") {
            StringBuilder sbTitle = new StringBuilder(512);
            GetWindowText(hWnd, sbTitle, 512);
            string title = sbTitle.ToString().Trim();

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);

            RECT r;
            GetWindowRect(hWnd, out r);

            WinInfo wi = new WinInfo();
            wi.Hwnd = hWnd.ToInt64();
            wi.Pid = pid;
            wi.Title = title;
            wi.ClassName = cls;
            wi.Visible = IsWindowVisible(hWnd);
            wi.Width = r.Right - r.Left;
            wi.Height = r.Bottom - r.Top;
            Found.Add(wi);
        }
        return true;
    }

    public static void Run() {
        Found.Clear();
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        SetThreadDesktop(hDesk);
        EnumDesktopWindows(hDesk, EnumProc, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $definition -ReferencedAssemblies "System.dll"

$t = New-Object System.Threading.Thread([System.Threading.ThreadStart]{
    [ChromeWidgetFinder]::Run()
})
$t.SetApartmentState([System.Threading.ApartmentState]::STA)
$t.Start()
$t.Join()

Write-Output "Total Chrome_WidgetWin windows: $([ChromeWidgetFinder]::Found.Count)"
foreach ($w in [ChromeWidgetFinder]::Found) {
    Write-Output "HWND: $($w.Hwnd) | PID: $($w.Pid) | Vis: $($w.Visible) | W: $($w.Width) | H: $($w.Height) | Title: '$($w.Title)'"
}
