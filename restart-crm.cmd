@echo off
cd /d C:\Users\hp\Documents\tiles-crm
call C:\Users\hp\Documents\tiles-crm\stop-crm.cmd nopause
start "Tiles CRM" cmd /k C:\Users\hp\Documents\tiles-crm\start-crm.cmd
