@echo off
setlocal

set "ROOT_DIR=C:\Users\hp\Documents\tiles-crm"
set "NODE_PATH=C:\Program Files\nodejs;%PATH%"
set "DIST_WEB_CONFIG=%ROOT_DIR%\frontend\dist\web.config"

set "PATH=%NODE_PATH%"
pushd "%ROOT_DIR%"

echo Installing root dependencies if present...
call npm install
if errorlevel 1 exit /b 1

echo Installing backend dependencies...
call npm --prefix backend install
if errorlevel 1 exit /b 1

echo Installing frontend dependencies...
call npm --prefix frontend install
if errorlevel 1 exit /b 1

echo Building frontend for production...
call npm run build
if errorlevel 1 exit /b 1

if not exist "%DIST_WEB_CONFIG%" (
  echo ERROR: frontend/dist/web.config was not created.
  exit /b 1
)

echo.
echo Production build complete.
echo IIS deploy folder:
echo   %ROOT_DIR%\frontend\dist
echo Confirmed:
echo   %DIST_WEB_CONFIG%

popd
endlocal
