@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
if not defined BACKUP_ROOT set "BACKUP_ROOT=C:\CRM_BACKUPS"
set "DAILY_BACKUP_DIR=%BACKUP_ROOT%\daily"
set "LOG_DIR=%BACKUP_ROOT%\logs"
set "LOG_FILE=%LOG_DIR%\backup.log"
set "ENV_FILE=%PROJECT_ROOT%\backend\.env.production"
if not exist "%ENV_FILE%" set "ENV_FILE=%PROJECT_ROOT%\backend\.env"
set "DRY_RUN=0"
if /I "%~1"=="--dry-run" set "DRY_RUN=1"

if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%" >nul 2>&1
if not exist "%DAILY_BACKUP_DIR%" mkdir "%DAILY_BACKUP_DIR%" >nul 2>&1
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

call :log "Starting PostgreSQL backup. Project root: %PROJECT_ROOT%"

if not exist "%ENV_FILE%" (
  call :log "ERROR: backend env file not found. Checked: %PROJECT_ROOT%\backend\.env.production and .env"
  echo ERROR: backend env file not found. Set DATABASE_URL in backend\.env.production or export PGPASSWORD first.
  exit /b 1
)

set "DATABASE_URL="
for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
  if /I "%%~A"=="DATABASE_URL" set "DATABASE_URL=%%~B"
)

if not defined DATABASE_URL (
  call :log "ERROR: DATABASE_URL missing in %ENV_FILE%"
  echo ERROR: DATABASE_URL missing in %ENV_FILE%
  exit /b 1
)

set "TEMP_PARSE=%TEMP%\tiles_crm_pg_parse_%RANDOM%_%RANDOM%.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$raw = [Environment]::GetEnvironmentVariable('DATABASE_URL','Process');" ^
  "$clean = $raw.Trim();" ^
  "if ($clean.StartsWith('postgresql://')) { $clean = $clean.Replace('postgresql://','postgres://'); }" ^
  "try { $uri = [System.Uri]$clean } catch { Write-Error 'Invalid DATABASE_URL'; exit 1 }" ^
  "$info = ($uri.UserInfo -split ':', 2);" ^
  "$dbHost = if ([string]::IsNullOrWhiteSpace($uri.Host)) { 'localhost' } else { $uri.Host };" ^
  "$port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 };" ^
  "$db = $uri.AbsolutePath.TrimStart('/');" ^
  "$user = if ($info.Length -ge 1) { [uri]::UnescapeDataString($info[0]) } else { '' };" ^
  "$pass = if ($info.Length -ge 2) { [uri]::UnescapeDataString($info[1]) } else { '' };" ^
  "Set-Content -Encoding ASCII '%TEMP_PARSE%' ('set DB_HOST=' + $dbHost);" ^
  "Add-Content -Encoding ASCII '%TEMP_PARSE%' ('set DB_PORT=' + $port);" ^
  "Add-Content -Encoding ASCII '%TEMP_PARSE%' ('set DB_NAME=' + $db);" ^
  "Add-Content -Encoding ASCII '%TEMP_PARSE%' ('set DB_USER=' + $user);" ^
  "Add-Content -Encoding ASCII '%TEMP_PARSE%' ('set DB_PASSWORD=' + $pass)" >nul 2>&1

if errorlevel 1 (
  call :log "ERROR: DATABASE_URL parsing failed."
  echo ERROR: DATABASE_URL parsing failed.
  if exist "%TEMP_PARSE%" del "%TEMP_PARSE%" >nul 2>&1
  exit /b 1
)

call "%TEMP_PARSE%"
if exist "%TEMP_PARSE%" del "%TEMP_PARSE%" >nul 2>&1

if not defined DB_NAME set "DB_NAME=tiles_crm"
if not defined DB_HOST set "DB_HOST=localhost"
if not defined DB_PORT set "DB_PORT=5432"
if not defined DB_USER set "DB_USER=postgres"

set "PG_DUMP_EXE="
for %%P in (pg_dump.exe) do set "PG_DUMP_EXE=%%~$PATH:P"
if not defined PG_DUMP_EXE if exist "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" set "PG_DUMP_EXE=C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
if not defined PG_DUMP_EXE if exist "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" set "PG_DUMP_EXE=C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
if not defined PG_DUMP_EXE if exist "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" set "PG_DUMP_EXE=C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
if not defined PG_DUMP_EXE if exist "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe" set "PG_DUMP_EXE=C:\Program Files\PostgreSQL\13\bin\pg_dump.exe"

if not defined PG_DUMP_EXE (
  call :log "ERROR: pg_dump.exe not found in PATH or standard PostgreSQL install directories."
  echo ERROR: pg_dump.exe not found. Install PostgreSQL client tools or add pg_dump to PATH.
  exit /b 1
)

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm'"') do set "TIMESTAMP=%%T"
set "BACKUP_FILE=%DAILY_BACKUP_DIR%\tiles_crm_%TIMESTAMP%.sql"

if "%DRY_RUN%"=="1" (
  call :log "DRY RUN: would execute pg_dump to %BACKUP_FILE%"
  echo DRY RUN: "%PG_DUMP_EXE%" --clean --if-exists --no-owner --no-privileges -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -f "%BACKUP_FILE%"
  exit /b 0
)

if defined DB_PASSWORD (
  set "PGPASSWORD=%DB_PASSWORD%"
) else (
  call :log "WARNING: DATABASE_URL did not include password. Expecting PGPASSWORD from environment."
)

"%PG_DUMP_EXE%" --clean --if-exists --no-owner --no-privileges -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -f "%BACKUP_FILE%"
set "DUMP_EXIT=%ERRORLEVEL%"

if "%DUMP_EXIT%" NEQ "0" (
  call :log "ERROR: pg_dump failed with exit code %DUMP_EXIT%"
  if exist "%BACKUP_FILE%" del "%BACKUP_FILE%" >nul 2>&1
  echo ERROR: PostgreSQL backup failed. Check %LOG_FILE%
  exit /b %DUMP_EXIT%
)

call :log "SUCCESS: database backup created at %BACKUP_FILE%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$files = Get-ChildItem -Path '%DAILY_BACKUP_DIR%' -Filter 'tiles_crm_*.sql' | Sort-Object LastWriteTime -Descending;" ^
  "if ($files.Count -gt 14) { $files | Select-Object -Skip 14 | Remove-Item -Force }" >nul 2>&1

if errorlevel 1 (
  call :log "WARNING: retention cleanup encountered an error. Latest backup kept."
) else (
  call :log "Retention cleanup complete. Kept latest 14 daily backups."
)

echo SUCCESS: PostgreSQL backup completed: %BACKUP_FILE%
exit /b 0

:log
set "LOG_MESSAGE=%~1"
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do set "LOG_TIMESTAMP=%%T"
>>"%LOG_FILE%" echo [%LOG_TIMESTAMP%] %LOG_MESSAGE%
goto :eof
