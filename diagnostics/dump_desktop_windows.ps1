Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

public class WinDumper {
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

    public class WindowRecord {
        public long Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
        public bool Visible;
        public bool Iconic;
    }

    public static List<WindowRecord> List = new List<WindowRecord>();

    private static bool EnumProc(IntPtr hWnd, IntPtr lParam) {
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString();

        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hWnd, sbCls, 256);
        string cls = sbCls.ToString();

        bool vis = IsWindowVisible(hWnd);
        bool iconic = IsIconic(hWnd);
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        if (!string.IsNullOrEmpty(title) || cls.Contains("Chrome_WidgetWin")) {
            WindowRecord wr = new WindowRecord();
            wr.Hwnd = hWnd.ToInt64();
            wr.Pid = pid;
            wr.Title = title;
            wr.ClassName = cls;
            wr.Visible = vis;
            wr.Iconic = iconic;
            List.Add(wr);
        }
        return true;
    }

    public static void Run() {
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) {
            Console.WriteLine("OpenDesktop failed: " + Marshal.GetLastWin32Error());
            return;
        }
        if (!SetThreadDesktop(hDesk)) {
            Console.WriteLine("SetThreadDesktop failed: " + Marshal.GetLastWin32Error());
            CloseDesktop(hDesk);
            return;
        }

        List.Clear();
        EnumDesktopWindows(hDesk, EnumProc, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
"@

$thread = New-Object System.Threading.Thread([System.Threading.ThreadStart]{
    [WinDumper]::Run()
})
$thread.SetApartmentState([System.Threading.ApartmentState]::STA)
$thread.Start()
$thread.Join()

foreach ($w in [WinDumper]::List) {
    if ($w.Title -ne "" -or $w.ClassName -like "*Chrome*") {
        Write-Output "HWND: $($w.Hwnd) | PID: $($w.Pid) | Vis: $($w.Visible) | Min: $($w.Iconic) | Class: $($w.ClassName) | Title: '$($w.Title)'"
    }
}
