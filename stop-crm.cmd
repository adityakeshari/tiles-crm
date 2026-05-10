@echo off
echo Stopping Tiles CRM...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$patterns = @('C:\\Users\\hp\\Documents\\tiles-crm\\backend\\src\\server.js','C:\\Users\\hp\\Documents\\tiles-crm\\frontend\\serve-static.mjs','C:\\Users\\hp\\Documents\\tiles-crm\\run-crm.mjs');" ^
  "$processes = @(Get-CimInstance Win32_Process | Where-Object { $cmd = $_.CommandLine; $cmd -and ($patterns | Where-Object { $cmd -like ('*' + $_ + '*') }) });" ^
  "$portPids = @(Get-NetTCPConnection -LocalPort 5000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique);" ^
  "$allPids = @($processes.ProcessId + $portPids | Where-Object { $_ } | Select-Object -Unique);" ^
  "if (-not $allPids.Count) { Write-Host 'No running CRM processes found.'; exit 0 };" ^
  "$allPids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped PID ' + $_) }"
echo Done.
if /I not "%~1"=="nopause" pause
