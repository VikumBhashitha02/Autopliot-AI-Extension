Add-Type @"
using System;
using System.IO;
using System.Threading;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class DesktopProcessLauncherV2 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool SetEnvironmentVariable(string lpName, string lpValue);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public Int32 cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public Int32 dwX;
        public Int32 dwY;
        public Int32 dwXSize;
        public Int32 dwYSize;
        public Int32 dwXCountChars;
        public Int32 dwYCountChars;
        public Int32 dwFillAttribute;
        public Int32 dwFlags;
        public Int16 wShowWindow;
        public Int16 cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern SafeFileHandle CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    public static int Spawn(string appPath, string cmdLine, string workDir, string logPath) {
        int resultPid = 0;
        Thread t = new Thread(() => {
            SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", null);

            IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) {
                Console.WriteLine("OpenDesktop failed: " + Marshal.GetLastWin32Error());
                return;
            }
            if (!SetThreadDesktop(hDesk)) {
                Console.WriteLine("SetThreadDesktop failed: " + Marshal.GetLastWin32Error());
                return;
            }

            STARTUPINFO si = new STARTUPINFO();
            si.cb = Marshal.SizeOf(si);
            si.lpDesktop = "Default";

            // Open log file for output
            // GENERIC_WRITE = 0x40000000, FILE_SHARE_READ|WRITE = 3, CREATE_ALWAYS = 2
            SafeFileHandle hLog = CreateFile(logPath, 0x40000000, 3, IntPtr.Zero, 2, 0x80, IntPtr.Zero);
            if (!hLog.IsInvalid) {
                si.dwFlags |= 0x00000100; // STARTF_USESTDHANDLES
                si.hStdOutput = hLog.DangerousGetHandle();
                si.hStdError = hLog.DangerousGetHandle();
            }

            PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
            bool ok = CreateProcess(appPath, cmdLine, IntPtr.Zero, IntPtr.Zero, true, 0, IntPtr.Zero, workDir, ref si, out pi);
            if (!ok) {
                int err = Marshal.GetLastWin32Error();
                Console.WriteLine("CreateProcess failed: " + err);
                resultPid = -err;
            } else {
                resultPid = pi.dwProcessId;
            }
        });
        t.Start();
        t.Join();
        return resultPid;
    }
}
"@

$appDir = "E:\Click Application\Autopliot AI"
$electronExe = Join-Path $appDir "node_modules\electron\dist\electron.exe"
$cmd = "`"C:\Windows\System32\cmd.exe`" /c `"set ELECTRON_RUN_AS_NODE=& set ELECTRON_ENABLE_LOGGING=1& `"$electronExe`" `"$appDir`"`""
$logPath = Join-Path $appDir "desktop_launch.log"

Write-Host "Spawning Electron onto interactive desktop 'Default'..."
$launchedPid = [DesktopProcessLauncherV2]::Spawn($null, $cmd, $appDir, $logPath)
Write-Host "Spawn result PID: $launchedPid"
