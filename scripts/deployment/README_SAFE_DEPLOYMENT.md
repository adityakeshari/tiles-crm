# Tiles CRM Safe Deployment

This deployment helper is for the Windows Server 2016 production setup:

- Project path:
  `C:\Users\Administrator\Documents\tiles-crm`
- IIS frontend path:
  `C:\inetpub\wwwroot`
- Backend service:
  `TilesCRMBackend`
- PostgreSQL database:
  `tiles_crm`

## Normal update

### On laptop
1. Make code changes in:
   `C:\Users\hp\Documents\tiles-crm`
2. Copy the updated CRM project to the server:
   `C:\Users\Administrator\Documents\tiles-crm`

### On server
Open `Command Prompt` as `Administrator` and run:

```cmd
cd /d C:\Users\Administrator\Documents\tiles-crm
scripts\deployment\safe-deploy.cmd
```

### Single-click update on server

For a double-click update flow, use:

```cmd
C:\Users\Administrator\Documents\tiles-crm\scripts\deployment\one-click-update.cmd
```

or the wrapper file:

```cmd
C:\Users\Administrator\Documents\tiles-crm\SERVER_ONE_CLICK_UPDATE.cmd
```

This runs the same safe deployment flow and pauses at the end with a clear success or failure message.

## Before risky update

If you want a manual backup first, run:

```cmd
cd /d C:\Users\Administrator\Documents\tiles-crm
scripts\deployment\backup-before-deploy.cmd
```

This creates:
- PostgreSQL backup
- frontend IIS backup
- basic project metadata backup

Backups are stored in:

`C:\Users\Administrator\Documents\crm-backups`

## If update fails

Run:

```cmd
cd /d C:\Users\Administrator\Documents\tiles-crm
scripts\deployment\rollback-last.cmd
```

It will:
- ask for SQL backup file path
- stop backend service
- drop and recreate `tiles_crm`
- restore the selected SQL backup
- optionally restore frontend backup
- restart IIS
- restart backend service

## Health check

Run:

```cmd
cd /d C:\Users\Administrator\Documents\tiles-crm
scripts\deployment\health-check.cmd
```

It checks:
- Node version
- npm version
- psql version
- NSSM version
- PostgreSQL connection
- `TilesCRMBackend` service status
- IIS status
- `C:\inetpub\wwwroot\index.html`
- `C:\inetpub\wwwroot\assets`
- `backend\.env`
- `backend\.env.production`

## Notes

- These scripts do not change CRM business logic.
- These scripts do not change passwords.
- These scripts do not overwrite `backend\.env.production`.
- Database backup runs before deployment.
- Existing manual deployment remains usable.
- Run all commands as `Administrator`.
