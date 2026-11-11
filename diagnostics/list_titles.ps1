$code = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinLister {
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

    public static List<string> Items = new List<string>();

    private static bool EnumProc(IntPtr hWnd, IntPtr lParam) {
        StringBuilder sbTitle = new StringBuilder(512);
        GetWindowText(hWnd, sbTitle, 512);
        string title = sbTitle.ToString();

        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hWnd, sbCls, 256);
        string cls = sbCls.ToString();

        bool vis = IsWindowVisible(hWnd);
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        if (!string.IsNullOrEmpty(title)) {
            Items.Add(string.Format("HWND: {0} | PID: {1} | Vis: {2} | Class: {3} | Title: '{4}'", hWnd.ToInt64(), pid, vis, cls, title));
        }
        return true;
    }

    public static void Run() {
        Items.Clear();
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
    [WinLister]::Run()
})
$t.SetApartmentState([System.Threading.ApartmentState]::STA)
$t.Start()
$t.Join()

[WinLister]::Items | Out-File -FilePath "e:\Click Application\diagnostics\all_windows.txt" -Encoding utf8
Write-Output "Written $([WinLister]::Items.Count) windows to all_windows.txt"
