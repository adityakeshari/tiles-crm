# Tiles CRM Auto Deployment

This deployment helper is for:

- Development machine project path:
  `C:\Users\hp\Documents\tiles-crm`
- Windows Server 2016 production project path:
  `C:\Users\Administrator\Documents\tiles-crm`
- IIS frontend path:
  `C:\inetpub\wwwroot`
- Backend NSSM service:
  `TilesCRMBackend`

## Workflow

### Laptop
1. Make code changes in:
   `C:\Users\hp\Documents\tiles-crm`
2. Run:
   ```cmd
   npm run build
   ```
3. Copy the full updated project folder to the server:
   `C:\Users\Administrator\Documents\tiles-crm`
   or use `git pull` on the server if Git is configured there.

### Server
1. Open `Command Prompt` as `Administrator`
2. Go to:
   ```cmd
   cd /d C:\Users\Administrator\Documents\tiles-crm
   ```
3. Run the one-click update:
   ```cmd
   scripts\deployment\server-update.cmd
   ```

## What server-update.cmd does
1. Changes to the server project directory
2. Creates `C:\Users\Administrator\Documents\crm-backups` if missing
3. Backs up PostgreSQL database `tiles_crm`
4. Runs pending migrations if those files exist:
   - `backend\migrations\015_multi_role_users.sql`
   - `backend\migrations\016_token_claim_user_tracking.sql`
5. Runs:
   ```cmd
   scripts\build-production.cmd
   ```
6. Copies `frontend\dist` to:
   `C:\inetpub\wwwroot`
7. Deletes IIS `web.config` from:
   `C:\inetpub\wwwroot`
8. Copies:
   `backend\.env.production` -> `backend\.env`
9. Restarts IIS
10. Restarts backend service `TilesCRMBackend`
11. Prints backend service status
12. Prints final local URL:
   `http://localhost/index.html`

## Backup only
Run:
```cmd
scripts\deployment\server-db-backup.cmd
```

## Restore database
Run:
```cmd
scripts\deployment\server-restore-db.cmd
```

It will:
- ask for backup file path
- stop `TilesCRMBackend`
- drop and recreate `tiles_crm`
- restore the selected SQL backup
- restart `TilesCRMBackend`

## Health check
Run:
```cmd
scripts\deployment\server-health-check.cmd
```

This checks:
- Node version
- npm version
- psql version
- NSSM version
- `TilesCRMBackend` service status
- IIS site status
- PostgreSQL connection
- frontend files in `C:\inetpub\wwwroot`
- backend `.env` file

## Safety notes
- Database backup runs before update
- These scripts do not change database password or env secrets
- These scripts do not delete user data intentionally
- These scripts are designed for offline-safe Windows Server 2016 CMD usage
- Run all scripts as `Administrator`
