@echo off
cd /d C:\Users\hp\Documents\tiles-crm\backend
"C:\Program Files\nodejs\node.exe" src\server.js
if errorlevel 1 (
  echo.
  echo Backend stopped with an error.
  pause
)
