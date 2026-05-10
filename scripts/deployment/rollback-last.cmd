@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "FRONTEND_DIR=C:\inetpub\wwwroot"
set "SERVICE_NAME=TilesCRMBackend"
set "DB_NAME=tiles_crm"
set "DB_USER=postgres"

echo =========================================
echo Tiles CRM Rollback
echo =========================================

echo Enter full SQL backup file path:
set /p "SQL_BACKUP_FILE=> "

if not exist "%SQL_BACKUP_FILE%" (
  echo ERROR: SQL backup file not found.
  exit /b 1
)

echo Enter full frontend backup folder path (leave blank to skip frontend restore):
set /p "FRONTEND_BACKUP_DIR=> "

echo.
echo [1/6] Stopping backend service...
nssm stop %SERVICE_NAME%
if errorlevel 1 (
  echo ERROR: Failed to stop backend service.
  exit /b 1
)

echo.
echo [2/6] Dropping active PostgreSQL connections...
psql -U %DB_USER% -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='%DB_NAME%' AND pid <> pg_backend_pid();"

echo.
echo [3/6] Recreating database...
psql -U %DB_USER% -d postgres -c "DROP DATABASE IF EXISTS %DB_NAME%;"
if errorlevel 1 (
  echo ERROR: Failed to drop database.
  exit /b 1
)
psql -U %DB_USER% -d postgres -c "CREATE DATABASE %DB_NAME%;"
if errorlevel 1 (
  echo ERROR: Failed to create database.
  exit /b 1
)

echo.
echo [4/6] Restoring database backup...
psql -U %DB_USER% -d %DB_NAME% -f "%SQL_BACKUP_FILE%"
if errorlevel 1 (
  echo ERROR: Database restore failed.
  exit /b 1
)

echo.
echo [5/6] Restoring frontend backup if provided...
if not "%FRONTEND_BACKUP_DIR%"=="" (
  if not exist "%FRONTEND_BACKUP_DIR%" (
    echo ERROR: Frontend backup folder not found.
    exit /b 1
  )
  xcopy "%FRONTEND_BACKUP_DIR%\*" "%FRONTEND_DIR%\" /E /Y /I
  if errorlevel 1 (
    echo ERROR: Frontend restore failed.
    exit /b 1
  )
  iisreset
  if errorlevel 1 (
    echo ERROR: IIS restart failed after frontend restore.
    exit /b 1
  )
)

echo.
echo [6/6] Restarting backend service...
nssm start %SERVICE_NAME%
if errorlevel 1 (
  echo ERROR: Failed to start backend service.
  exit /b 1
)

echo.
echo Final backend service status:
sc query %SERVICE_NAME%
exit /b 0
