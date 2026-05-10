# Windows Server 2016 Deployment

This guide is the **final production deployment path** for this CRM on **Windows Server 2016** using:

- **IIS** for frontend hosting
- **NSSM** for backend auto-start
- **PostgreSQL** for database

It intentionally covers **only this deployment style**.

## Deployment Summary

### Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- PDF generation: PDFKit

### Production runtime layout

- IIS serves the built frontend from `frontend/dist`
- IIS reverse proxies `/api/*` to `http://localhost:5000/api/*`
- NSSM runs the backend as a Windows service
- PostgreSQL runs locally on port `5432`

## 1. Runtime Versions

### Required

- Node.js: **20 LTS recommended**
- PostgreSQL: **16+ recommended**

### Not required

- Python
- PHP

## 2. Database

### Database type

- PostgreSQL

### Database name

- `tiles_crm`

### Connection format

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tiles_crm
```

## 3. Ports

- Frontend via IIS: `80`
- Backend API: `5000`
- PostgreSQL: `5432`

## 4. Frontend Production Configuration

### Production API base

The frontend is configured for production API proxying through IIS:

```env
VITE_API_URL=/api
```

Files:

- [frontend/.env.production](C:\Users\hp\Documents\tiles-crm\frontend\.env.production)
- [frontend/.env.production.example](C:\Users\hp\Documents\tiles-crm\frontend\.env.production.example)

### Frontend build command

From project root:

```powershell
npm run build
```

This now:

1. builds Vite frontend
2. copies `frontend/web.config` into `frontend/dist/web.config`

### IIS deployment folder

Frontend production output folder:

- [frontend/dist](C:\Users\hp\Documents\tiles-crm\frontend\dist)

This is the folder IIS should serve.

## 5. Backend Production Configuration

### Backend start command

From project root:

```powershell
npm run start
```

Equivalent:

```powershell
npm --prefix backend run start
```

### Backend port

Backend must run on:

```env
PORT=5000
```

### Allowed origins

Production CORS should include:

```env
ALLOWED_ORIGINS=http://localhost,http://SERVER_IP,http://SERVER_IP:80
```

### Production backend env example

Use:

- [backend/.env.production.example](C:\Users\hp\Documents\tiles-crm\backend\.env.production.example)

Example:

```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tiles_crm
JWT_SECRET=strong-random-secret
ALLOWED_ORIGINS=http://localhost,http://SERVER_IP,http://SERVER_IP:80
COMPANY_NAME=Tiles CRM Showroom
COMPANY_PHONE=9999999999
COMPANY_ADDRESS=Your Showroom Address
ADMIN_NAME=Launch Admin
ADMIN_PHONE=9999999999
ADMIN_PASSWORD=StrongAdminPassword123
```

## 6. Database Initialization and Migration Order

### Fresh install

Create database:

```sql
CREATE DATABASE tiles_crm;
```

Load schema:

```powershell
psql -U postgres -d tiles_crm -f database.sql
```

### Existing database migration order

Run these in order:

```sql
\i migrations/001_harden_existing_schema.sql
\i migrations/002_expand_tiles_crm_modules.sql
\i migrations/003_inventory_module.sql
\i migrations/004_inventory_quote_link.sql
\i migrations/005_sales_operations_plumbing.sql
\i migrations/006_operations_tasks.sql
\i migrations/007_token_scheme_management.sql
\i migrations/008_complaints_management.sql
\i migrations/009_complaint_operations_link.sql
\i migrations/010_app_notifications.sql
\i migrations/011_plumbing_services.sql
\i migrations/012_owner_projects_finance.sql
\i migrations/013_adhesive_token_redemption.sql
\i migrations/014_adhesive_token_claims.sql
```

### Exact Windows PowerShell sequence

```powershell
cd C:\Users\hp\Documents\tiles-crm
psql -U postgres -c "CREATE DATABASE tiles_crm;"
psql -U postgres -d tiles_crm -f database.sql
```

### Exact Windows CMD sequence

```cmd
cd /d C:\Users\hp\Documents\tiles-crm
psql -U postgres -c "CREATE DATABASE tiles_crm;"
psql -U postgres -d tiles_crm -f database.sql
```

### Migration sequence for existing database in PowerShell

```powershell
cd C:\Users\hp\Documents\tiles-crm
psql -U postgres -d tiles_crm -f migrations/001_harden_existing_schema.sql
psql -U postgres -d tiles_crm -f migrations/002_expand_tiles_crm_modules.sql
psql -U postgres -d tiles_crm -f migrations/003_inventory_module.sql
psql -U postgres -d tiles_crm -f migrations/004_inventory_quote_link.sql
psql -U postgres -d tiles_crm -f migrations/005_sales_operations_plumbing.sql
psql -U postgres -d tiles_crm -f migrations/006_operations_tasks.sql
psql -U postgres -d tiles_crm -f migrations/007_token_scheme_management.sql
psql -U postgres -d tiles_crm -f migrations/008_complaints_management.sql
psql -U postgres -d tiles_crm -f migrations/009_complaint_operations_link.sql
psql -U postgres -d tiles_crm -f migrations/010_app_notifications.sql
psql -U postgres -d tiles_crm -f migrations/011_plumbing_services.sql
psql -U postgres -d tiles_crm -f migrations/012_owner_projects_finance.sql
psql -U postgres -d tiles_crm -f migrations/013_adhesive_token_redemption.sql
psql -U postgres -d tiles_crm -f migrations/014_adhesive_token_claims.sql
```

## 7. IIS Frontend + Reverse Proxy Setup

## Required IIS modules

Install:

- IIS
- **URL Rewrite**
- **ARR (Application Request Routing)**

After ARR install:

1. Open **IIS Manager**
2. Click the server node
3. Open **Application Request Routing Cache**
4. Click **Server Proxy Settings**
5. Enable **Proxy**
6. Apply

## IIS site setup

1. Build frontend:

```powershell
cd C:\Users\hp\Documents\tiles-crm
npm run build
```

2. In IIS Manager, create or configure a site:

- Physical path:

```text
C:\Users\hp\Documents\tiles-crm\frontend\dist
```

- Binding:
  - HTTP
  - Port `80`
  - Your server IP or `All Unassigned`

3. Ensure `frontend/dist/web.config` exists after build.

## web.config behavior

The following file is included in source:

- [frontend/web.config](C:\Users\hp\Documents\tiles-crm\frontend\web.config)

The build copies it into:

- `frontend/dist/web.config`

It provides:

- `/api/*` reverse proxy to `http://localhost:5000/api/*`
- React SPA fallback to `index.html`

### Current reverse proxy target

```text
/api/*  ->  http://localhost:5000/api/*
```

## 8. NSSM Backend Service

Install backend as Windows service using NSSM.

### Service name

- `TilesCRMBackend`

### Working directory

```text
C:\Users\hp\Documents\tiles-crm
```

### Exact install command

```powershell
nssm install TilesCRMBackend "C:\Program Files\nodejs\npm.cmd" "run start"
```

### Set working directory

```powershell
nssm set TilesCRMBackend AppDirectory "C:\Users\hp\Documents\tiles-crm"
```

### Set auto-start on reboot

```powershell
nssm set TilesCRMBackend Start SERVICE_AUTO_START
```

### Optional stdout/stderr logs

```powershell
nssm set TilesCRMBackend AppStdout "C:\Users\hp\Documents\tiles-crm\backend-service.log"
nssm set TilesCRMBackend AppStderr "C:\Users\hp\Documents\tiles-crm\backend-service-error.log"
```

### Start service

```powershell
nssm start TilesCRMBackend
```

### Stop service

```powershell
nssm stop TilesCRMBackend
```

### Restart service

```powershell
nssm restart TilesCRMBackend
```

## 9. Exact Windows Server 2016 Deployment Steps

## Step 1: Install software

Install:

- Node.js 20 LTS
- PostgreSQL 16+
- IIS role
- URL Rewrite
- ARR
- NSSM

## Step 2: Copy project

Copy project to:

```text
C:\Users\hp\Documents\tiles-crm
```

## Step 3: Install Node dependencies

```powershell
cd C:\Users\hp\Documents\tiles-crm
npm run install:all
```

## Step 4: Create backend production env

Create:

```text
C:\Users\hp\Documents\tiles-crm\backend\.env
```

Recommended production contents:

```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tiles_crm
JWT_SECRET=strong-random-secret
ALLOWED_ORIGINS=http://localhost,http://SERVER_IP,http://SERVER_IP:80
COMPANY_NAME=Tiles CRM Showroom
COMPANY_PHONE=9999999999
COMPANY_ADDRESS=Your Showroom Address
ADMIN_NAME=Launch Admin
ADMIN_PHONE=9999999999
ADMIN_PASSWORD=StrongAdminPassword123
```

## Step 5: Confirm frontend production env

`frontend/.env.production` should contain:

```env
VITE_API_URL=/api
```

## Step 6: Create database

```powershell
psql -U postgres -c "CREATE DATABASE tiles_crm;"
```

## Step 7: Load schema

Fresh install:

```powershell
cd C:\Users\hp\Documents\tiles-crm
psql -U postgres -d tiles_crm -f database.sql
```

Existing deployment:

Run the ordered migration sequence above through `014_adhesive_token_claims.sql`.

## Step 8: Build frontend

```powershell
cd C:\Users\hp\Documents\tiles-crm
npm run build
```

Confirm output exists:

- `C:\Users\hp\Documents\tiles-crm\frontend\dist`
- `C:\Users\hp\Documents\tiles-crm\frontend\dist\web.config`

## Step 9: Configure IIS site

Set physical path to:

```text
C:\Users\hp\Documents\tiles-crm\frontend\dist
```

Set binding to port `80`.

## Step 10: Enable ARR proxy

In IIS Manager:

- open server node
- open `Application Request Routing Cache`
- open `Server Proxy Settings`
- check `Enable Proxy`
- apply

## Step 11: Install backend service

```powershell
nssm install TilesCRMBackend "C:\Program Files\nodejs\npm.cmd" "run start"
nssm set TilesCRMBackend AppDirectory "C:\Users\hp\Documents\tiles-crm"
nssm set TilesCRMBackend Start SERVICE_AUTO_START
nssm set TilesCRMBackend AppStdout "C:\Users\hp\Documents\tiles-crm\backend-service.log"
nssm set TilesCRMBackend AppStderr "C:\Users\hp\Documents\tiles-crm\backend-service-error.log"
nssm start TilesCRMBackend
```

## Step 12: Create first admin

```powershell
cd C:\Users\hp\Documents\tiles-crm
npm run create:admin -- --name=Owner --phone=9999999999 --password=StrongPass123
```

## Step 13: Open firewall if needed

Allow:

- `80` for frontend
- `5000` only if you plan direct backend access outside IIS
- `5432` only if remote PostgreSQL access is required

## Step 14: Test deployment

### From server

- Frontend:

```text
http://localhost/
```

- Backend health:

```text
http://localhost:5000/api/health
```

### From LAN

- Frontend:

```text
http://SERVER_IP/
```

## 10. Production Validation

### Confirm frontend

- `frontend/dist/index.html` exists
- `frontend/dist/web.config` exists
- IIS serves site on port `80`

### Confirm backend

- `npm run start` starts backend on `5000`
- service `TilesCRMBackend` is running
- `http://localhost:5000/api/health` returns `{ "ok": true }`

### Confirm database

- PostgreSQL service is running
- database `tiles_crm` exists
- schema imported or migrated through `014_adhesive_token_claims.sql`

## Files Used In This Deployment

- [backend/.env.example](C:\Users\hp\Documents\tiles-crm\backend\.env.example)
- [backend/.env.production.example](C:\Users\hp\Documents\tiles-crm\backend\.env.production.example)
- [frontend/.env.production](C:\Users\hp\Documents\tiles-crm\frontend\.env.production)
- [frontend/.env.production.example](C:\Users\hp\Documents\tiles-crm\frontend\.env.production.example)
- [frontend/web.config](C:\Users\hp\Documents\tiles-crm\frontend\web.config)
- [frontend/package.json](C:\Users\hp\Documents\tiles-crm\frontend\package.json)
- [database.sql](C:\Users\hp\Documents\tiles-crm\database.sql)
- [migrations](C:\Users\hp\Documents\tiles-crm\migrations)
