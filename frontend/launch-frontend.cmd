@echo off
cd /d C:\Users\hp\Documents\tiles-crm\frontend
"C:\Program Files\nodejs\node.exe" serve-static.mjs
if errorlevel 1 (
  echo.
  echo Frontend stopped with an error.
  pause
)
