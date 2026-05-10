@echo off
setlocal EnableExtensions

set "PROJECT_DIR=C:\Users\Administrator\Documents\tiles-crm"
set "FRONTEND_DIR=C:\inetpub\wwwroot"
set "SERVICE_NAME=TilesCRMBackend"
set "DB_NAME=tiles_crm"
set "DB_USER=postgres"
set "APPCMD=%windir%\System32\inetsrv\appcmd.exe"

echo ==============================
echo Tiles CRM Server Health Check
echo ==============================
echo.

echo [1/8] Node version
node -v
echo.

echo [2/8] NPM version
npm -v
echo.

echo [3/8] PostgreSQL client version
psql --version
echo.

echo [4/8] NSSM version
nssm version
echo.

echo [5/8] Backend service status
sc query %SERVICE_NAME%
echo.

echo [6/8] IIS site status
if exist "%APPCMD%" (
  "%APPCMD%" list site "TilesCRM"
) else (
  echo appcmd not found at %APPCMD%
)
echo.

echo [7/8] PostgreSQL connection test
psql -U %DB_USER% -d %DB_NAME% -c "SELECT current_database(), now();"
echo.

echo [8/8] Frontend and env file checks
if exist "%FRONTEND_DIR%\index.html" (
  echo Frontend index.html found
) else (
  echo Frontend index.html missing
)

if exist "%FRONTEND_DIR%\assets" (
  echo Frontend assets folder found
) else (
  echo Frontend assets folder missing
)

if exist "%PROJECT_DIR%\backend\.env" (
  echo Backend .env found
) else (
  echo Backend .env missing
)

echo.
echo Health check finished.
exit /b 0
