@echo off
setlocal

set "ROOT_DIR=C:\Users\hp\Documents\tiles-crm"
set "MIGRATIONS_DIR=%ROOT_DIR%\backend\migrations"
set "DB_NAME=tiles_crm"
set "PGHOST=localhost"
set "PGPORT=5432"
set "PGUSER=postgres"

echo PostgreSQL migration runner for %DB_NAME%
echo.
echo Default PostgreSQL username is currently: %PGUSER%
set /p PGUSER=Enter PostgreSQL username ^(press Enter to keep current^): 
if "%PGUSER%"=="" set "PGUSER=postgres"

echo.
echo Running migrations against:
echo   Host: %PGHOST%
echo   Port: %PGPORT%
echo   Database: %DB_NAME%
echo   User: %PGUSER%
echo.

set PGPASSWORD=
set /p PGPASSWORD=Enter PostgreSQL password for %PGUSER%: 
if "%PGPASSWORD%"=="" (
  echo ERROR: Password is required.
  exit /b 1
)

set "PSQL=psql"
where psql >nul 2>nul
if errorlevel 1 (
  echo ERROR: psql was not found in PATH. Install PostgreSQL client tools first.
  exit /b 1
)

set "PGPASSWORD=%PGPASSWORD%"

call :run "001_harden_existing_schema.sql"
call :run "002_expand_tiles_crm_modules.sql"
call :run "003_inventory_module.sql"
call :run "004_inventory_quote_link.sql"
call :run "005_sales_operations_plumbing.sql"
call :run "006_operations_tasks.sql"
call :run "007_token_scheme_management.sql"
call :run "008_complaints_management.sql"
call :run "009_complaint_operations_link.sql"
call :run "010_app_notifications.sql"
call :run "011_plumbing_services.sql"
call :run "012_owner_projects_finance.sql"
call :run "013_adhesive_token_redemption.sql"
call :run "014_adhesive_token_claims.sql"
call :run "015_multi_role_users.sql"
call :run "016_token_claim_user_tracking.sql"
call :run "017_complete_mason_token_repair.sql"
call :run "018_registered_mason_working_profile.sql"
call :run "019_dashboard_scaling_indexes.sql"
call :run "020_purchase_entries.sql"
call :run "021_user_role_expand.sql"
call :run "022_mason_alt_mobile.sql"
call :run "023_expense_paid_by.sql"
call :run "024_token_claim_duplicate_guard.sql"
call :run "025_purchases_and_dashboard_indexes.sql"
call :run "026_billing_module.sql"
call :run "027_purchase_costing_module.sql"
call :run "028_product_master_stabilization.sql"
call :run "029_purchase_costing_real_cost.sql"
call :run "030_suppliers_master.sql"
call :run "030_monthly_overhead_allocation.sql"
call :run "031_purchase_invoice_multi_item_compat.sql"
call :run "032_purchase_truck_linking.sql"
call :run "033_product_daily_rate_engine.sql"
call :run "034_product_batch_tracking.sql"
call :run "035_purchase_item_batch_table.sql"

if errorlevel 1 exit /b 1

echo.
echo All migrations completed successfully.
endlocal
exit /b 0

:run
echo Running migration: %~1
psql -h "%PGHOST%" -p "%PGPORT%" -U "%PGUSER%" -d "%DB_NAME%" -v ON_ERROR_STOP=1 -f "%MIGRATIONS_DIR%\%~1"
if errorlevel 1 (
  echo ERROR: Migration failed: %~1
  exit /b 1
)
exit /b 0
