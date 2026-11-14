$definition = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class ThreadWinInspector {
    [DllImport("user32.dll")]
    public static extern bool EnumThreadWindows(uint dwThreadId, EnumThreadDelegate lpfn, IntPtr lParam);
    public delegate bool EnumThreadDelegate(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public class WinItem {
        public long Hwnd;
        public uint ThreadId;
        public string Title;
        public string ClassName;
        public bool Visible;
    }

    public static List<WinItem> Found = new List<WinItem>();

    public static bool ThreadWinProc(IntPtr hWnd, IntPtr lParam) {
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
        Found.Add(wi);
        return true;
    }
}
'@

Add-Type -TypeDefinition $definition -ReferencedAssemblies "System.dll"

$p = Get-Process -Id 30992
foreach ($t in $p.Threads) {
    [ThreadWinInspector]::EnumThreadWindows([uint32]$t.Id, [ThreadWinInspector]::ThreadWinProc, [IntPtr]::Zero) | Out-Null
}

Write-Output "Total thread windows found for PID 30992: $([ThreadWinInspector]::Found.Count)"
foreach ($w in [ThreadWinInspector]::Found) {
    if ($w.Title -ne "" -or $w.ClassName -like "*Chrome*") {
        Write-Output "HWND: $($w.Hwnd) | Vis: $($w.Visible) | Class: $($w.ClassName) | Title: '$($w.Title)'"
    }
}
