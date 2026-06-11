# Deployment Checklist - Safe

Project:
- AIBA Tiles CRM

Server:
- Windows Server 2016
- Node/Express CRM
- PostgreSQL
- PM2
- Tailscale access enabled

Current runtime assumptions:
- backend port: `5000`
- Express bind: `0.0.0.0`
- LAN access should remain private
- Tailscale access is already working

Goal:
- deploy latest CRM safely
- preserve rollback path
- verify local, LAN, and Tailscale reachability

---

## 0. Pre-deploy notes

Before touching production:
- confirm current active CRM folder path
- confirm new code folder path
- confirm PostgreSQL database name
- confirm PM2 process name
- confirm server has enough free disk space for:
  - app backup
  - database dump
  - PM2 logs

Recommended naming:
- current live folder:
  - `C:\Users\Administrator\Documents\tiles-crm`
- incoming release folder:
  - `C:\Users\Administrator\Documents\tiles-crm-fresh`
- backup root:
  - `C:\Users\Administrator\Documents\crm-backups`

---

## 1. Backup current CRM folder

Create timestamped backup folder first:

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "C:\Users\Administrator\Documents\crm-backups"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
Copy-Item "C:\Users\Administrator\Documents\tiles-crm" "$backupRoot\tiles-crm-$ts" -Recurse
```

Verify:
- backup folder exists
- key files are present:
  - `backend\src\server.js`
  - `frontend\dist`
  - `backend\migrations`
  - `.env` or deployment env files if stored inside repo

Important:
- if secrets/env files live outside repo, back them up separately too

---

## 2. Backup PostgreSQL database

Use `pg_dump` with custom format if available:

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "C:\Users\Administrator\Documents\crm-backups"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d tiles_crm -F c -f "$backupRoot\tiles_crm-$ts.backup"
```

If PostgreSQL path differs, adjust path accordingly.

Alternative plain SQL dump:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d tiles_crm -f "$backupRoot\tiles_crm-$ts.sql"
```

Verify:
- backup file exists
- file size is non-trivial

Recommended:
- keep both:
  - one recent `.backup`
  - one recent `.sql`

---

## 3. Stop current Node process safely

Preferred if running under PM2:

```powershell
pm2 list
pm2 stop tiles-crm
```

If process name differs:

```powershell
pm2 stop <actual-process-name>
```

If not under PM2 and a manual Node process is still running:

```powershell
Get-Process node
Stop-Process -Name node -Force
```

Use force only if normal PM2 stop is not applicable.

Verify:
- `pm2 list` shows process stopped
- or `Get-Process node` no longer shows the old backend instance

---

## 4. Deploy latest `tiles-crm-fresh` code

Recommended safe flow:

### Option A: Replace live folder after backup

```powershell
Rename-Item "C:\Users\Administrator\Documents\tiles-crm" "tiles-crm-old"
Rename-Item "C:\Users\Administrator\Documents\tiles-crm-fresh" "tiles-crm"
```

### Option B: Copy fresh release into live path

```powershell
Copy-Item "C:\Users\Administrator\Documents\tiles-crm-fresh\*" "C:\Users\Administrator\Documents\tiles-crm" -Recurse -Force
```

Safer recommendation:
- prefer **Option A**
- easier rollback

After code placement:
- confirm `.env` / config files are present
- restore any environment files if they are not in the fresh package

---

## 5. Start with PM2

From the live project root:

```powershell
cd C:\Users\Administrator\Documents\tiles-crm
pm2 start backend\src\server.js --name tiles-crm
```

If PM2 ecosystem file exists and is the standard deployment method, use that instead.

Recommended verification:

```powershell
pm2 list
pm2 logs tiles-crm --lines 50
```

Look for:
- server started
- no migration/config crash
- no missing env var failure
- no database connection failure

---

## 6. Save PM2 process

After successful start:

```powershell
pm2 save
```

If PM2 startup was not already configured on the server, also verify startup registration:

```powershell
pm2 startup
```

Note:
- run startup only if not already configured
- `pm2 save` is required so reboot restores the current process list

---

## 7. Verify localhost, LAN IP, and Tailscale IP

### Localhost check

```powershell
Invoke-WebRequest http://127.0.0.1:5000/api/health
```

Expected:
- HTTP 200
- JSON like:
  - `{"ok":true}`

### LAN IP check

Replace with actual server LAN IP:

```powershell
Invoke-WebRequest http://10.235.202.48:5000/api/health
```

Expected:
- HTTP 200
- JSON health response

### Tailscale IP check

Replace with actual Tailscale IP:

```powershell
Invoke-WebRequest http://<tailscale-ip>:5000/api/health
```

Expected:
- HTTP 200

### Frontend/browser verification

Verify these manually if frontend is served from same app/reverse proxy:
- login page loads
- login works
- overview loads
- billing opens
- stock opens
- purchase center opens

### PM2 health verification

```powershell
pm2 list
pm2 logs tiles-crm --lines 100
```

Check:
- no restart loop
- memory stable
- no repeated 500 errors

---

## 8. Post-deploy monitoring

Minimum first 15-30 minute watch:
- PM2 restart count stays stable
- backend logs do not show repeated exceptions
- `/api/health` remains responsive
- one login test
- one billing open test
- one inventory open test
- one purchase center open test

Recommended quick live data checks:
- dashboard visible
- billing ledger loads
- stock ledger loads
- purchase ledger loads
- no immediate 500 errors in browser network tab

---

## 9. Rollback steps

If deployment fails:

### Step 1: Stop failed PM2 process

```powershell
pm2 stop tiles-crm
```

### Step 2: Restore previous app folder

If using folder rename strategy:

```powershell
Rename-Item "C:\Users\Administrator\Documents\tiles-crm" "tiles-crm-bad"
Rename-Item "C:\Users\Administrator\Documents\tiles-crm-old" "tiles-crm"
```

Or restore from backup copy:

```powershell
Copy-Item "C:\Users\Administrator\Documents\crm-backups\tiles-crm-<timestamp>\*" "C:\Users\Administrator\Documents\tiles-crm" -Recurse -Force
```

### Step 3: Restore database only if migration/data damage occurred

Custom-format restore example:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -U postgres -d tiles_crm --clean --if-exists "C:\Users\Administrator\Documents\crm-backups\tiles_crm-<timestamp>.backup"
```

Only do DB restore if:
- a bad migration ran
- schema/data changed incorrectly

If no DB change happened, app-folder rollback alone is safer and faster.

### Step 4: Restart old version

```powershell
cd C:\Users\Administrator\Documents\tiles-crm
pm2 start backend\src\server.js --name tiles-crm
pm2 save
```

### Step 5: Re-verify health

```powershell
Invoke-WebRequest http://127.0.0.1:5000/api/health
```

---

## 10. Safe deployment checklist summary

Before deploy:
- app backup completed
- DB backup completed
- PM2 process name confirmed
- `.env` / secrets confirmed

During deploy:
- old process stopped cleanly
- fresh code placed
- PM2 process started
- PM2 saved

After deploy:
- localhost health OK
- LAN health OK
- Tailscale health OK
- login OK
- overview OK
- billing OK
- stock OK
- purchase center OK

Rollback ready:
- old app folder retained
- DB dump available
- PM2 restart command known

