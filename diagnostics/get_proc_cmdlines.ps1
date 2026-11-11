$procs = Get-CimInstance Win32_Process | Where-Object { $PSItem.Name -match "Antigravity|code" }
foreach ($p in $procs) {
    [PSCustomObject]@{
        Id = $p.ProcessId
        Name = $p.Name
        CommandLine = $p.CommandLine
    } | Format-List
}
