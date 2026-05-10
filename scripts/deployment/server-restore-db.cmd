@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "DB_NAME=tiles_crm"
set "DB_USER=postgres"
set "SERVICE_NAME=TilesCRMBackend"

echo Enter full backup file path:
set /p "BACKUP_FILE=> "

if not exist "%BACKUP_FILE%" (
  echo Backup file not found.
  exit /b 1
)

echo Stopping backend service...
nssm stop %SERVICE_NAME%

echo Dropping database connections...
psql -U %DB_USER% -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='%DB_NAME%' AND pid <> pg_backend_pid();"
if errorlevel 1 (
  echo Failed to terminate active connections.
)

echo Dropping database %DB_NAME%...
psql -U %DB_USER% -d postgres -c "DROP DATABASE IF EXISTS %DB_NAME%;"
if errorlevel 1 (
  echo Failed to drop database.
  exit /b 1
)

echo Creating database %DB_NAME%...
psql -U %DB_USER% -d postgres -c "CREATE DATABASE %DB_NAME%;"
if errorlevel 1 (
  echo Failed to create database.
  exit /b 1
)

echo Restoring backup...
psql -U %DB_USER% -d %DB_NAME% -f "%BACKUP_FILE%"
if errorlevel 1 (
  echo Restore failed.
  exit /b 1
)

echo Restarting backend service...
nssm start %SERVICE_NAME%

echo Restore completed successfully.
exit /b 0
