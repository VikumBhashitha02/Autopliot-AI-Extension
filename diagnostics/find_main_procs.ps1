$procs = Get-CimInstance Win32_Process | Where-Object { $PSItem.Name -eq "Antigravity IDE.exe" }
foreach ($p in $procs) {
    if ($p.CommandLine -notmatch "--type=") {
        [PSCustomObject]@{
            Id = $p.ProcessId
            ParentId = $p.ParentProcessId
            CommandLine = $p.CommandLine
        } | Format-List
    }
}
