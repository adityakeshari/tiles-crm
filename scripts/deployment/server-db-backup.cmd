@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=C:\Users\Administrator\Documents\tiles-crm"
set "BACKUP_DIR=C:\Users\Administrator\Documents\crm-backups"
set "DB_NAME=tiles_crm"
set "DB_USER=postgres"

if not exist "%BACKUP_DIR%" (
  mkdir "%BACKUP_DIR%"
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format ''yyyy-MM-dd_HH-mm-ss''"') do set "STAMP=%%i"
set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_%STAMP%.sql"

echo Creating PostgreSQL backup...
echo Backup file: %BACKUP_FILE%

pg_dump -U %DB_USER% -d %DB_NAME% -f "%BACKUP_FILE%"
if errorlevel 1 (
  echo Backup failed.
  exit /b 1
)

echo Backup completed successfully.
echo %BACKUP_FILE%
exit /b 0
