@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=C:\Users\Administrator\Documents\tiles-crm"
set "FRONTEND_DIR=C:\inetpub\wwwroot"
set "SERVICE_NAME=TilesCRMBackend"
set "DB_NAME=tiles_crm"
set "DB_USER=postgres"

echo =========================================
echo Tiles CRM Safe Deploy
echo =========================================

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo ERROR: Project directory not found.
  exit /b 1
)

echo.
echo [1/8] Running backup before deploy...
call "%PROJECT_DIR%\scripts\deployment\backup-before-deploy.cmd"
if errorlevel 1 (
  echo ERROR: Backup failed. Deployment stopped.
  exit /b 1
)

echo.
echo [2/8] Stopping backend service...
nssm stop %SERVICE_NAME%
if errorlevel 1 (
  echo ERROR: Failed to stop backend service.
  exit /b 1
)

echo.
echo [3/8] Running pending migrations if present...
if exist "%PROJECT_DIR%\backend\migrations\015_multi_role_users.sql" (
  echo Applying 015_multi_role_users.sql
  psql -U %DB_USER% -d %DB_NAME% -f "%PROJECT_DIR%\backend\migrations\015_multi_role_users.sql"
  if errorlevel 1 (
    echo ERROR: Migration 015_multi_role_users.sql failed.
    exit /b 1
  )
)

if exist "%PROJECT_DIR%\backend\migrations\016_token_claim_user_tracking.sql" (
  echo Applying 016_token_claim_user_tracking.sql
  psql -U %DB_USER% -d %DB_NAME% -f "%PROJECT_DIR%\backend\migrations\016_token_claim_user_tracking.sql"
  if errorlevel 1 (
    echo ERROR: Migration 016_token_claim_user_tracking.sql failed.
    exit /b 1
  )
)

if exist "%PROJECT_DIR%\backend\migrations\017_complete_mason_token_repair.sql" (
  echo Applying 017_complete_mason_token_repair.sql
  psql -U %DB_USER% -d %DB_NAME% -f "%PROJECT_DIR%\backend\migrations\017_complete_mason_token_repair.sql"
  if errorlevel 1 (
    echo ERROR: Migration 017_complete_mason_token_repair.sql failed.
    exit /b 1
  )
)

if exist "%PROJECT_DIR%\backend\migrations\018_registered_mason_working_profile.sql" (
  echo Applying 018_registered_mason_working_profile.sql
  psql -U %DB_USER% -d %DB_NAME% -f "%PROJECT_DIR%\backend\migrations\018_registered_mason_working_profile.sql"
  if errorlevel 1 (
    echo ERROR: Migration 018_registered_mason_working_profile.sql failed.
    exit /b 1
  )
)

if exist "%PROJECT_DIR%\backend\migrations\019_dashboard_scaling_indexes.sql" (
  echo Applying 019_dashboard_scaling_indexes.sql
  psql -U %DB_USER% -d %DB_NAME% -f "%PROJECT_DIR%\backend\migrations\019_dashboard_scaling_indexes.sql"
  if errorlevel 1 (
    echo ERROR: Migration 019_dashboard_scaling_indexes.sql failed.
    exit /b 1
  )
)

echo.
echo [4/8] Building production assets...
call "%PROJECT_DIR%\scripts\build-production.cmd"
if errorlevel 1 (
  echo ERROR: Production build failed.
  exit /b 1
)

echo.
echo [5/8] Copying frontend dist to IIS root...
xcopy "%PROJECT_DIR%\frontend\dist\*" "%FRONTEND_DIR%\" /E /Y /I
if errorlevel 1 (
  echo ERROR: Frontend copy failed.
  exit /b 1
)

echo.
echo [6/8] Removing IIS web.config...
if exist "%FRONTEND_DIR%\web.config" (
  del /F /Q "%FRONTEND_DIR%\web.config"
  if errorlevel 1 (
    echo ERROR: Failed to delete IIS web.config.
    exit /b 1
  )
)

echo.
echo [7/8] Copying backend production env...
if not exist "%PROJECT_DIR%\backend\.env.production" (
  echo ERROR: backend\.env.production is missing.
  exit /b 1
)
copy "%PROJECT_DIR%\backend\.env.production" "%PROJECT_DIR%\backend\.env" /Y
if errorlevel 1 (
  echo ERROR: Failed to copy backend production env.
  exit /b 1
)

echo.
echo [8/8] Restarting IIS and backend service...
iisreset
if errorlevel 1 (
  echo ERROR: IIS restart failed.
  exit /b 1
)

nssm restart %SERVICE_NAME%
if errorlevel 1 (
  echo ERROR: Backend service restart failed.
  exit /b 1
)

echo.
echo Final backend service status:
sc query %SERVICE_NAME%

echo.
echo Deployment completed successfully.
echo Final URL:
echo http://localhost/index.html
exit /b 0
