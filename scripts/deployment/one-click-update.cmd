@echo off
setlocal EnableExtensions

set "PROJECT_DIR=C:\Users\Administrator\Documents\tiles-crm"

title Tiles CRM One-Click Update
cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo ERROR: Project directory not found:
  echo %PROJECT_DIR%
  echo.
  pause
  exit /b 1
)

echo =========================================
echo Tiles CRM One-Click Update
echo =========================================
echo.
echo This will run the safe deployment flow:
echo - backup database and frontend
echo - run migrations if present
echo - build production files
echo - deploy frontend to IIS
echo - restart IIS and backend service
echo.

call "%PROJECT_DIR%\scripts\deployment\safe-deploy.cmd"
if errorlevel 1 (
  echo.
  echo =========================================
  echo UPDATE FAILED
  echo Check the error above before retrying.
  echo =========================================
  echo.
  pause
  exit /b 1
)

echo.
echo =========================================
echo UPDATE COMPLETED SUCCESSFULLY
echo Open:
echo http://localhost/index.html
echo =========================================
echo.
pause
exit /b 0
