@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
if not defined BACKUP_ROOT set "BACKUP_ROOT=C:\CRM_BACKUPS"
set "WEEKLY_BACKUP_DIR=%BACKUP_ROOT%\weekly"
set "LOG_DIR=%BACKUP_ROOT%\logs"
set "LOG_FILE=%LOG_DIR%\backup.log"
set "DRY_RUN=0"
if /I "%~1"=="--dry-run" set "DRY_RUN=1"

if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%" >nul 2>&1
if not exist "%WEEKLY_BACKUP_DIR%" mkdir "%WEEKLY_BACKUP_DIR%" >nul 2>&1
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm'"') do set "TIMESTAMP=%%T"
set "ARCHIVE_FILE=%WEEKLY_BACKUP_DIR%\tiles_crm_full_%TIMESTAMP%.zip"
set "STAGING_DIR=%TEMP%\tiles_crm_full_backup_%RANDOM%_%RANDOM%"

call :log "Starting weekly CRM file backup. Project root: %PROJECT_ROOT%"

if "%DRY_RUN%"=="1" (
  echo DRY RUN: staging directory would be "%STAGING_DIR%"
  echo DRY RUN: archive would be "%ARCHIVE_FILE%"
  echo DRY RUN: excluded folders = .git, node_modules, frontend\dist, backend\public
  call :log "DRY RUN: full backup skipped archive creation."
  exit /b 0
)

if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%" >nul 2>&1
mkdir "%STAGING_DIR%" >nul 2>&1

robocopy "%PROJECT_ROOT%" "%STAGING_DIR%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP ^
  /XD ".git" "node_modules" "frontend\\dist" "backend\\public"
set "ROBO_EXIT=%ERRORLEVEL%"

if %ROBO_EXIT% GEQ 8 (
  call :log "ERROR: robocopy staging failed with exit code %ROBO_EXIT%"
  if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%" >nul 2>&1
  echo ERROR: Weekly file backup staging failed. Check %LOG_FILE%
  exit /b %ROBO_EXIT%
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%STAGING_DIR%\\*' -DestinationPath '%ARCHIVE_FILE%' -CompressionLevel Optimal -Force" >nul 2>&1
set "ZIP_EXIT=%ERRORLEVEL%"

if "%ZIP_EXIT%" NEQ "0" (
  call :log "ERROR: archive creation failed with exit code %ZIP_EXIT%"
  if exist "%ARCHIVE_FILE%" del "%ARCHIVE_FILE%" >nul 2>&1
  if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%" >nul 2>&1
  echo ERROR: Weekly ZIP creation failed. Check %LOG_FILE%
  exit /b %ZIP_EXIT%
)

if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%" >nul 2>&1
call :log "SUCCESS: weekly CRM archive created at %ARCHIVE_FILE%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$files = Get-ChildItem -Path '%WEEKLY_BACKUP_DIR%' -Filter 'tiles_crm_full_*.zip' | Sort-Object LastWriteTime -Descending;" ^
  "if ($files.Count -gt 4) { $files | Select-Object -Skip 4 | Remove-Item -Force }" >nul 2>&1

if errorlevel 1 (
  call :log "WARNING: weekly retention cleanup encountered an error. Latest archive kept."
) else (
  call :log "Retention cleanup complete. Kept latest 4 weekly archives."
)

echo SUCCESS: Weekly CRM archive completed: %ARCHIVE_FILE%
exit /b 0

:log
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do set "LOG_TIMESTAMP=%%T"
>>"%LOG_FILE%" echo [%LOG_TIMESTAMP%] %~1
goto :eof
