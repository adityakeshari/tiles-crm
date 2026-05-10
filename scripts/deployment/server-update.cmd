@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=C:\Users\Administrator\Documents\tiles-crm"
set "FRONTEND_DEPLOY_DIR=C:\inetpub\wwwroot"
set "SERVICE_NAME=TilesCRMBackend"
set "DB_NAME=tiles_crm"
set "DB_USER=postgres"
set "BACKUP_DIR=C:\Users\Administrator\Documents\crm-backups"

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo Project directory not found: %PROJECT_DIR%
  exit /b 1
)

echo =========================================
echo Tiles CRM Server Update
echo Project Dir: %PROJECT_DIR%
echo =========================================
echo.

if not exist "%BACKUP_DIR%" (
  mkdir "%BACKUP_DIR%"
)

call "%PROJECT_DIR%\scripts\deployment\server-db-backup.cmd"
if errorlevel 1 (
  echo Database backup failed. Update stopped.
  exit /b 1
)

echo.
echo Running pending migrations if present...
if exist "%PROJECT_DIR%\backend\migrations\015_multi_role_users.sql" (
  echo Applying 015_multi_role_users.sql
  psql -U %DB_USER% -d %DB_NAME% -f "%PROJECT_DIR%\backend\migrations\015_multi_role_users.sql"
  if errorlevel 1 (
    echo Migration 015_multi_role_users.sql failed.
    exit /b 1
  )
)

if exist "%PROJECT_DIR%\backend\migrations\016_token_claim_user_tracking.sql" (
  echo Applying 016_token_claim_user_tracking.sql
  psql -U %DB_USER% -d %DB_NAME% -f "%PROJECT_DIR%\backend\migrations\016_token_claim_user_tracking.sql"
  if errorlevel 1 (
    echo Migration 016_token_claim_user_tracking.sql failed.
    exit /b 1
  )
)

echo.
echo Building production assets...
call "%PROJECT_DIR%\scripts\build-production.cmd"
if errorlevel 1 (
  echo Production build failed.
  exit /b 1
)

echo.
echo Copying frontend dist to IIS root...
xcopy "%PROJECT_DIR%\frontend\dist\*" "%FRONTEND_DEPLOY_DIR%\" /E /Y /I
if errorlevel 1 (
  echo Frontend copy failed.
  exit /b 1
)

echo.
echo Removing IIS web.config as requested...
if exist "%FRONTEND_DEPLOY_DIR%\web.config" (
  del /F /Q "%FRONTEND_DEPLOY_DIR%\web.config"
)

echo.
echo Copying backend production env...
if not exist "%PROJECT_DIR%\backend\.env.production" (
  echo Missing backend\.env.production
  exit /b 1
)
copy "%PROJECT_DIR%\backend\.env.production" "%PROJECT_DIR%\backend\.env" /Y
if errorlevel 1 (
  echo Backend env copy failed.
  exit /b 1
)

echo.
echo Restarting IIS...
iisreset
if errorlevel 1 (
  echo IIS restart failed.
  exit /b 1
)

echo.
echo Restarting backend service...
nssm restart %SERVICE_NAME%
if errorlevel 1 (
  echo Backend service restart failed.
  exit /b 1
)

echo.
echo Final service status:
sc query %SERVICE_NAME%

echo.
echo Final URL:
echo http://localhost/index.html
exit /b 0
