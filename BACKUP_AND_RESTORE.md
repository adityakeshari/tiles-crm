# Tiles CRM Backup And Restore

This backup setup is designed for the live Windows Server CRM deployment.

Server path:
- `C:\Users\Administrator\Documents\tiles-crm-fresh`

Backup root:
- `C:\CRM_BACKUPS`
- `C:\CRM_BACKUPS\daily`
- `C:\CRM_BACKUPS\weekly`
- `C:\CRM_BACKUPS\logs`

## What gets backed up

### Daily database backup
Script:
- [backup-postgres.cmd](C:\Users\hp\Documents\tiles-crm\scripts\backup-postgres.cmd)

Output:
- `C:\CRM_BACKUPS\daily\tiles_crm_YYYY-MM-DD_HH-mm.sql`

Retention:
- keeps the latest `14` daily SQL backups

### Weekly full CRM file backup
Script:
- [backup-crm-full.cmd](C:\Users\hp\Documents\tiles-crm\scripts\backup-crm-full.cmd)

Output:
- `C:\CRM_BACKUPS\weekly\tiles_crm_full_YYYY-MM-DD_HH-mm.zip`

Excludes:
- `.git`
- `node_modules`
- `frontend\dist`
- `backend\public`

Retention:
- keeps the latest `4` weekly ZIP archives

## Secret handling

The database backup script tries this order:
1. `backend\.env.production`
2. `backend\.env`

It reads:
- `DATABASE_URL`

Expected format:
```text
postgresql://USER:PASSWORD@localhost:5432/tiles_crm
```

If no password is present in `DATABASE_URL`, set `PGPASSWORD` in the Windows environment before running the backup.

Do not hardcode real passwords into the script.

## Manual backup commands

### Run database backup now
```cmd
C:\Users\Administrator\Documents\tiles-crm-fresh\scripts\backup-postgres.cmd
```

### Run weekly full backup now
```cmd
C:\Users\Administrator\Documents\tiles-crm-fresh\scripts\backup-crm-full.cmd
```

### Dry-run / syntax-safe check
```cmd
C:\Users\Administrator\Documents\tiles-crm-fresh\scripts\backup-postgres.cmd --dry-run
```

```cmd
C:\Users\Administrator\Documents\tiles-crm-fresh\scripts\backup-crm-full.cmd --dry-run
```

## Task Scheduler commands

Run these from an elevated Command Prompt or PowerShell on the server.

### Daily PostgreSQL backup at 11:30 PM
```cmd
schtasks /Create /TN "TilesCRM Daily PostgreSQL Backup" /SC DAILY /ST 23:30 /RL HIGHEST /TR "\"C:\Users\Administrator\Documents\tiles-crm-fresh\scripts\backup-postgres.cmd\"" /F
```

### Weekly full backup every Sunday at 11:45 PM
```cmd
schtasks /Create /TN "TilesCRM Weekly Full Backup" /SC WEEKLY /D SUN /ST 23:45 /RL HIGHEST /TR "\"C:\Users\Administrator\Documents\tiles-crm-fresh\scripts\backup-crm-full.cmd\"" /F
```

### Verify scheduled tasks
```cmd
schtasks /Query /TN "TilesCRM Daily PostgreSQL Backup" /V /FO LIST
```

```cmd
schtasks /Query /TN "TilesCRM Weekly Full Backup" /V /FO LIST
```

## Restore PostgreSQL database

1. Stop CRM writes if possible:
   - stop PM2 app or put team on temporary maintenance pause
2. Identify the SQL backup file to restore.
3. Restore using `psql`.

Example:
```cmd
set PGPASSWORD=YOUR_POSTGRES_PASSWORD
psql -h localhost -p 5432 -U postgres -d tiles_crm -f "C:\CRM_BACKUPS\daily\tiles_crm_2026-06-12_23-30.sql"
```

If the SQL backup contains `--clean --if-exists` output from `pg_dump`, it will recreate objects safely in restore order.

## Restore project files

1. Copy the current live app folder to a temporary safety folder first.
2. Extract the target weekly ZIP backup.
3. Restore files back into:
   - `C:\Users\Administrator\Documents\tiles-crm-fresh`
4. Rebuild frontend if needed:
```cmd
cd /d C:\Users\Administrator\Documents\tiles-crm-fresh\frontend
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -Command "& 'C:\Program Files\nodejs\npm.cmd' run build"
```
5. Restart backend:
```cmd
pm2 restart tiles-crm-backend
pm2 save
```

## Restore verification checklist

After restore, verify:
- `pm2 list` shows `tiles-crm-backend` as `online`
- `http://127.0.0.1:5000/` returns `200`
- login works
- dashboard loads
- stock page loads
- latest business-critical data looks correct

Quick checks:
```cmd
pm2 list
```

```cmd
curl http://127.0.0.1:5000/
```

## Emergency checklist

1. Confirm whether the incident is:
   - app code issue
   - database corruption
   - accidental data deletion
   - server/storage issue
2. Do not overwrite the newest good backup.
3. Take one more copy of the current broken state before restoring.
4. Restore database first if data is affected.
5. Restore project files second if deploy/code is affected.
6. Rebuild and restart services.
7. Verify owner dashboard, stock, billing, leads, and daily tasks before reopening to staff.
8. Record:
   - restore time
   - backup file used
   - person who performed restore
   - verification outcome
