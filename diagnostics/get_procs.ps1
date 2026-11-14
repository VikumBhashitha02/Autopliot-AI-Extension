Get-Process | Where-Object { $_.ProcessName -match "antigravity|code|electron" } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | Format-Table -AutoSize
