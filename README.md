# Tiles CRM

`tiles-crm` is a showroom CRM and operations system for Tiles + Plumbing work. It covers lead capture, follow-ups, quotations, payments, projects, dispatch, complaints, adhesive bag token redemption, plumbing jobs, expenses, reporting, and role-based access for sales, operations, accounts, managers, and admins.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- PDFs: PDFKit

## Project Structure

- `backend/` API, scripts, and business logic
- `frontend/` CRM UI
- `database.sql` latest full schema for fresh installs
- `migrations/` upgrade scripts for older databases

## Setup Steps

1. Install dependencies from the project root:

```powershell
npm run install:all
```

2. Copy environment files:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

3. Create a PostgreSQL database:

```sql
CREATE DATABASE tiles_crm;
```

4. Load the latest schema:

```powershell
psql -U postgres -d tiles_crm -f database.sql
```

5. Start the backend:

```powershell
npm run dev:backend
```

6. Start the frontend in a second terminal:

```powershell
npm run dev:frontend
```

7. Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/health`

## Environment Variables

### Backend

Create [backend/.env](C:\Users\hp\Documents\tiles-crm\backend\.env) from [backend/.env.example](C:\Users\hp\Documents\tiles-crm\backend\.env.example).

Required or commonly used values:

- `PORT=5000`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tiles_crm`
- `JWT_SECRET=change-me`
- `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080`
- `NODE_ENV=development`
- `COMPANY_NAME=Tiles CRM Showroom`
- `COMPANY_PHONE=9999999999`
- `COMPANY_ADDRESS=Ujjain, Madhya Pradesh`

Optional script defaults:

- `ADMIN_NAME=Launch Admin`
- `ADMIN_PHONE=9999999999`
- `ADMIN_PASSWORD=Admin@123`

### Frontend

Create [frontend/.env](C:\Users\hp\Documents\tiles-crm\frontend\.env) from [frontend/.env.example](C:\Users\hp\Documents\tiles-crm\frontend\.env.example).

- `VITE_API_URL=http://localhost:5000/api`

In production, the frontend can use `/api` behind a reverse proxy.

## Default Admin Setup

There are two safe ways to create the first admin.

### Option 1: CRM bootstrap screen

Use the login page bootstrap form once when the database has no users.

### Option 2: Script-based admin creation

From the project root:

```powershell
npm run create:admin -- --name=Owner --phone=9999999999 --password=StrongPass123
```

Or from backend env defaults:

```powershell
npm run create:admin
```

The script will create the admin user if it does not exist, or promote/update the matching phone number as an admin if it already exists.

## Seed / Demo Data

For showroom testing and staff training, seed demo data with:

```powershell
npm run seed:demo
```

This adds demo:

- users
- leads
- follow-ups
- quotations
- payments
- operations tasks
- projects
- dispatches
- plumbing jobs and materials
- adhesive bag token entries
- complaints
- expenses

Demo login after seeding:

- Phone: `9999999999`
- Password: `Admin@123`

The seed script skips itself if leads already exist.

## Database Migration Steps

Fresh installs should use [database.sql](C:\Users\hp\Documents\tiles-crm\database.sql).

If you already have an older database, run these migrations in order:

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
```

Notes:

- `001_harden_existing_schema.sql` converts follow-up time handling to timezone-aware storage.
- If older follow-up values were entered in a timezone other than `Asia/Calcutta`, update that timezone inside the migration before running it.
- Always back up the database before applying migrations on live data.

## Launch-Ready Features Included

- demo seed data for testing
- script-based admin creation
- backend validation across routes
- frontend validation on launch-critical forms
- loading banners and save-state buttons
- toast-style error/success feedback
- confirmation dialogs before delete / mark complete / resolve / redeem actions
- print-friendly quotation PDF
- print-friendly project invoice PDF
- CSV export for leads, payments, and projects
- mobile-responsive layout improvements

## Useful Commands

From the project root:

```powershell
npm run install:all
npm run dev:backend
npm run dev:frontend
npm run build
npm run create:admin -- --name=Owner --phone=9999999999 --password=StrongPass123
npm run seed:demo
```

## Backup / Export

The owner dashboard includes CSV export buttons for:

- leads
- payments
- projects

These download through authenticated API endpoints and can be used for backups, Excel review, or migration into another system.

## Deployment Steps

### Local Docker deployment

1. Make sure Docker Desktop is running.
2. From the project root run:

```powershell
docker compose up --build
```

3. Open:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5000`

### Single server / VPS deployment

1. Provision PostgreSQL and create `tiles_crm`.
2. Load [database.sql](C:\Users\hp\Documents\tiles-crm\database.sql) or run migrations on the existing DB.
3. Set production backend env values:
   - real `DATABASE_URL`
   - strong `JWT_SECRET`
   - real `ALLOWED_ORIGINS`
   - correct `COMPANY_NAME`, `COMPANY_PHONE`, `COMPANY_ADDRESS`
4. Build the frontend:

```powershell
npm run build
```

5. Run the backend with:

```powershell
npm run start
```

6. Serve the frontend build through Nginx, Caddy, or another reverse proxy.
7. Proxy `/api` requests to the backend.
8. Enable HTTPS.

## Production Checklist

- change `JWT_SECRET`
- change database credentials
- restrict `ALLOWED_ORIGINS`
- create the first admin with the script or bootstrap flow
- remove any reliance on demo seed accounts
- keep routine PostgreSQL backups
- serve behind HTTPS

## Real Showroom Notes

- Use quick lead entry for every walk-in.
- Use seeded demo data only in testing, never on the live production database.
- Admin delete actions are intentionally protected by confirmation dialogs.
- Quotations and invoices can be opened as PDFs directly from the CRM.
- Plumbing complaints can be linked into operations tasks for service execution.
