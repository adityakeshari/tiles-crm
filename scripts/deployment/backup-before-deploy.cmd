@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=C:\Users\Administrator\Documents\tiles-crm"
set "FRONTEND_DIR=C:\inetpub\wwwroot"
set "BACKUP_ROOT=C:\Users\Administrator\Documents\crm-backups"
set "DB_NAME=tiles_crm"
set "DB_USER=postgres"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format ''yyyy-MM-dd_HH-mm-ss''"') do set "STAMP=%%i"
set "BACKUP_DIR=%BACKUP_ROOT%\deploy_%STAMP%"
set "DB_BACKUP_FILE=%BACKUP_DIR%\tiles_crm_%STAMP%.sql"
set "FRONTEND_BACKUP_DIR=%BACKUP_DIR%\wwwroot"
set "PROJECT_META_DIR=%BACKUP_DIR%\project-meta"

echo =========================================
echo Tiles CRM Backup Before Deploy
echo =========================================

if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%FRONTEND_BACKUP_DIR%" mkdir "%FRONTEND_BACKUP_DIR%"
if not exist "%PROJECT_META_DIR%" mkdir "%PROJECT_META_DIR%"

echo.
echo [1/3] Backing up PostgreSQL database...
pg_dump -U %DB_USER% -d %DB_NAME% -f "%DB_BACKUP_FILE%"
if errorlevel 1 (
  echo ERROR: Database backup failed.
  exit /b 1
)

echo.
echo [2/3] Backing up deployed frontend...
if exist "%FRONTEND_DIR%\*" (
  xcopy "%FRONTEND_DIR%\*" "%FRONTEND_BACKUP_DIR%\" /E /Y /I >nul
  if errorlevel 1 (
    echo ERROR: Frontend backup failed.
    exit /b 1
  )
) else (
  echo Frontend directory is empty or missing; skipping frontend backup copy.
)

echo.
echo [3/3] Backing up project metadata...
if exist "%PROJECT_DIR%\backend\.env" copy "%PROJECT_DIR%\backend\.env" "%PROJECT_META_DIR%\backend.env.bak" /Y >nul
if exist "%PROJECT_DIR%\backend\.env.production" copy "%PROJECT_DIR%\backend\.env.production" "%PROJECT_META_DIR%\backend.env.production.bak" /Y >nul
if exist "%PROJECT_DIR%\package.json" copy "%PROJECT_DIR%\package.json" "%PROJECT_META_DIR%\package.json.bak" /Y >nul

echo.
echo Backup completed successfully.
echo Backup folder:
echo %BACKUP_DIR%
echo Database backup:
echo %DB_BACKUP_FILE%
echo Frontend backup:
echo %FRONTEND_BACKUP_DIR%
exit /b 0
