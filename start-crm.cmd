@echo off
cd /d C:\Users\hp\Documents\tiles-crm
call C:\Users\hp\Documents\tiles-crm\stop-crm.cmd nopause
"C:\Program Files\nodejs\node.exe" C:\Users\hp\Documents\tiles-crm\run-crm.mjs
echo.
echo CRM launcher stopped.
pause
