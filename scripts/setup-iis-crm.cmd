@echo off
setlocal

set "SITE_NAME=TilesCRM"
set "SITE_PATH=C:\Users\hp\Documents\tiles-crm\frontend\dist"
set "PORT=80"
set "APPCMD=%windir%\System32\inetsrv\appcmd.exe"

if not exist "%APPCMD%" (
  echo ERROR: appcmd.exe not found. Install IIS first.
  exit /b 1
)

if not exist "%SITE_PATH%" (
  echo ERROR: Frontend build folder not found: %SITE_PATH%
  echo Run scripts\build-production.cmd first.
  exit /b 1
)

echo Creating or updating IIS site %SITE_NAME%...

"%APPCMD%" list site "%SITE_NAME%" >nul 2>nul
if errorlevel 1 (
  "%APPCMD%" add site /name:"%SITE_NAME%" /physicalPath:"%SITE_PATH%" /bindings:"http/*:%PORT%:"
) else (
  "%APPCMD%" set site "%SITE_NAME%" /[path='/'].physicalPath:"%SITE_PATH%"
)

echo Setting site to start automatically...
"%APPCMD%" set site "%SITE_NAME%" /serverAutoStart:true
"%APPCMD%" start site "%SITE_NAME%"

echo Enabling firewall rule for TCP port %PORT%...
netsh advfirewall firewall add rule name="TilesCRM HTTP 80" dir=in action=allow protocol=TCP localport=%PORT%

echo Attempting to enable ARR reverse proxy...
"%APPCMD%" set config /section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /reverseRewriteHostInResponseHeaders:"False"
if errorlevel 1 (
  echo WARNING: ARR proxy section not available.
  echo Install URL Rewrite and ARR Application Request Routing, then rerun this script.
)

echo.
echo IIS site setup complete.
echo Verify site with:
echo   "%APPCMD%" list site "%SITE_NAME%"
echo Test locally with:
echo   http://localhost

endlocal
