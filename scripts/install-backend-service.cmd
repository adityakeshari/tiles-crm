@echo off
setlocal

set "ROOT_DIR=C:\Users\hp\Documents\tiles-crm"
set "SERVICE_NAME=TilesCRMBackend"
set "NSSM_EXE=nssm"
if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if exist "C:\Program Files\nssm\win64\nssm.exe" set "NSSM_EXE=C:\Program Files\nssm\win64\nssm.exe"
if exist "C:\Program Files (x86)\nssm\win64\nssm.exe" set "NSSM_EXE=C:\Program Files (x86)\nssm\win64\nssm.exe"

echo Installing backend Windows service: %SERVICE_NAME%
echo Using NSSM: %NSSM_EXE%

where "%NSSM_EXE%" >nul 2>nul
if errorlevel 1 (
  if not exist "%NSSM_EXE%" (
    echo ERROR: NSSM was not found. Install NSSM first and update NSSM_EXE in this script if needed.
    exit /b 1
  )
)

pushd "%ROOT_DIR%"

sc query "%SERVICE_NAME%" >nul 2>nul
if not errorlevel 1 (
  echo Existing service found. Stopping and removing old service...
  "%NSSM_EXE%" stop "%SERVICE_NAME%" >nul 2>nul
  "%NSSM_EXE%" remove "%SERVICE_NAME%" confirm
)

"%NSSM_EXE%" install "%SERVICE_NAME%" "C:\Program Files\nodejs\npm.cmd" "run start"
"%NSSM_EXE%" set "%SERVICE_NAME%" AppDirectory "%ROOT_DIR%"
"%NSSM_EXE%" set "%SERVICE_NAME%" AppStdout "%ROOT_DIR%\backend\service-out.log"
"%NSSM_EXE%" set "%SERVICE_NAME%" AppStderr "%ROOT_DIR%\backend\service-error.log"
"%NSSM_EXE%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START
"%NSSM_EXE%" set "%SERVICE_NAME%" AppStopMethodSkip 0
"%NSSM_EXE%" set "%SERVICE_NAME%" AppThrottle 1500
"%NSSM_EXE%" set "%SERVICE_NAME%" AppRestartDelay 5000

sc failure "%SERVICE_NAME%" reset= 86400 actions= restart/5000/restart/5000/restart/5000
sc config "%SERVICE_NAME%" start= auto

echo Restarting backend service...
net stop "%SERVICE_NAME%" >nul 2>nul
net start "%SERVICE_NAME%"

echo.
echo Service install complete.
echo Check status with:
echo   sc query "%SERVICE_NAME%"
echo Restart manually with:
echo   net stop "%SERVICE_NAME%" ^&^& net start "%SERVICE_NAME%"
echo Or:
echo   "%NSSM_EXE%" restart "%SERVICE_NAME%"

popd
endlocal
