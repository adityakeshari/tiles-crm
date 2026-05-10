@echo off
setlocal EnableExtensions

set "PROJECT_DIR=C:\Users\Administrator\Documents\tiles-crm"
set "FRONTEND_DIR=C:\inetpub\wwwroot"
set "SERVICE_NAME=TilesCRMBackend"
set "DB_NAME=tiles_crm"
set "DB_USER=postgres"
set "APPCMD=%windir%\System32\inetsrv\appcmd.exe"

echo =========================================
echo Tiles CRM Deployment Health Check
echo =========================================
echo.

echo [1/10] Node version
node -v
echo.

echo [2/10] npm version
npm -v
echo.

echo [3/10] psql version
psql --version
echo.

echo [4/10] NSSM version
nssm version
echo.

echo [5/10] PostgreSQL connection
psql -U %DB_USER% -d %DB_NAME% -c "SELECT current_database(), now();"
echo.

echo [6/10] TilesCRMBackend service status
sc query %SERVICE_NAME%
echo.

echo [7/10] IIS status
if exist "%APPCMD%" (
  "%APPCMD%" list site
) else (
  echo appcmd.exe not found at %APPCMD%
)
echo.

echo [8/10] Frontend index.html
if exist "%FRONTEND_DIR%\index.html" (
  echo OK: %FRONTEND_DIR%\index.html exists
) else (
  echo ERROR: %FRONTEND_DIR%\index.html missing
)
echo.

echo [9/10] Frontend assets folder
if exist "%FRONTEND_DIR%\assets" (
  echo OK: %FRONTEND_DIR%\assets exists
) else (
  echo ERROR: %FRONTEND_DIR%\assets missing
)
echo.

echo [10/10] Backend env files
if exist "%PROJECT_DIR%\backend\.env" (
  echo OK: %PROJECT_DIR%\backend\.env exists
) else (
  echo ERROR: %PROJECT_DIR%\backend\.env missing
)

if exist "%PROJECT_DIR%\backend\.env.production" (
  echo OK: %PROJECT_DIR%\backend\.env.production exists
) else (
  echo ERROR: %PROJECT_DIR%\backend\.env.production missing
)

echo.
echo Health check completed.
exit /b 0
