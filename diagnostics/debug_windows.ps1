Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinFinder {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpfn, IntPtr lParam);
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
        public IntPtr Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
        public bool Visible;
    }

    public static List<WinInfo> Found = new List<WinInfo>();

    public static bool Callback(IntPtr hWnd, IntPtr lParam) {
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString();

        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hWnd, sbCls, 256);
        string cls = sbCls.ToString();

        bool vis = IsWindowVisible(hWnd);
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        if (!string.IsNullOrEmpty(title) || cls.Contains("Chrome_WidgetWin")) {
            Found.Add(new WinInfo {
                Hwnd = hWnd,
                Pid = pid,
                Title = title,
                ClassName = cls,
                Visible = vis
            });
        }
        return true;
    }

    public static List<WinInfo> GetAll() {
        Found.Clear();
        EnumWindows(Callback, IntPtr.Zero);
        return Found;
    }
}
"@

$windows = [WinFinder]::GetAll()
foreach ($w in $windows) {
    if ($w.ClassName -like "*Chrome_WidgetWin*" -or $w.Title -like "*Antigravity*" -or $w.Title -like "*campus*") {
        Write-Output "HWND: $($w.Hwnd) | PID: $($w.Pid) | Vis: $($w.Visible) | Class: $($w.ClassName) | Title: '$($w.Title)'"
    }
}
