$definition = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class ThreadWinInspector2 {
    [DllImport("user32.dll")]
    public static extern bool EnumThreadWindows(uint dwThreadId, EnumThreadDelegate lpfn, IntPtr lParam);
    public delegate bool EnumThreadDelegate(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    public class WinItem {
        public long Hwnd;
        public uint ThreadId;
        public string Title;
        public string ClassName;
        public bool Visible;
        public bool Iconic;
    }

    public static List<WinItem> Found = new List<WinItem>();

    public static bool Callback(IntPtr hWnd, IntPtr lParam) {
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString().Trim();

        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hWnd, sbCls, 256);
        string cls = sbCls.ToString();

        WinItem wi = new WinItem();
        wi.Hwnd = hWnd.ToInt64();
        wi.Title = title;
        wi.ClassName = cls;
        wi.Visible = IsWindowVisible(hWnd);
        wi.Iconic = IsIconic(hWnd);
        Found.Add(wi);
        return true;
    }

    public static void ScanProcessThreads(int pid) {
        Found.Clear();
        Process p = Process.GetProcessById(pid);
        foreach (ProcessThread t in p.Threads) {
            EnumThreadWindows((uint)t.Id, Callback, IntPtr.Zero);
        }
    }
}
'@

Add-Type -TypeDefinition $definition -ReferencedAssemblies "System.dll"

[ThreadWinInspector2]::ScanProcessThreads(30992)
Write-Output "Total thread windows found for PID 30992: $([ThreadWinInspector2]::Found.Count)"
foreach ($w in [ThreadWinInspector2]::Found) {
    if ($w.Title -ne "" -or $w.ClassName -like "*Chrome*") {
        Write-Output "HWND: $($w.Hwnd) | Vis: $($w.Visible) | Min: $($w.Iconic) | Class: $($w.ClassName) | Title: '$($w.Title)'"
    }
}
