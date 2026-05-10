# Windows Server 2016 Checklist

Use this checklist when deploying `tiles-crm` on Windows Server 2016 with:

- IIS frontend
- NSSM backend
- PostgreSQL

## Software Installed

- [ ] Node.js 20 LTS installed
- [ ] PostgreSQL 16+ installed
- [ ] IIS installed
- [ ] URL Rewrite installed
- [ ] ARR installed
- [ ] NSSM installed

## Project Files

- [ ] Project copied to `C:\Users\hp\Documents\tiles-crm`
- [ ] `npm run install:all` completed successfully

## Backend Env

- [ ] `backend\.env` created
- [ ] `PORT=5000`
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points to `tiles_crm`
- [ ] `JWT_SECRET` changed from default
- [ ] `ALLOWED_ORIGINS=http://localhost,http://SERVER_IP,http://SERVER_IP:80`

## Frontend Env

- [ ] `frontend\.env.production` contains `VITE_API_URL=/api`

## Database

- [ ] PostgreSQL service running
- [ ] Database `tiles_crm` created
- [ ] `database.sql` loaded for fresh install
- [ ] or migrations run through `014_adhesive_token_claims.sql`

## Build

- [ ] `npm run build` completed successfully
- [ ] `frontend\dist` exists
- [ ] `frontend\dist\web.config` exists

## IIS

- [ ] IIS site points to `frontend\dist`
- [ ] Site binding uses port `80`
- [ ] ARR proxy enabled
- [ ] `/api/*` rewrites to `http://localhost:5000/api/*`
- [ ] React SPA fallback working

## NSSM Backend Service

- [ ] Service installed as `TilesCRMBackend`
- [ ] Command uses `npm run start`
- [ ] Working directory is `C:\Users\hp\Documents\tiles-crm`
- [ ] Startup type is automatic
- [ ] Service starts successfully

## Validation

- [ ] `http://localhost:5000/api/health` works on server
- [ ] `http://localhost/` loads frontend on server
- [ ] `http://SERVER_IP/` loads frontend from LAN
- [ ] First admin created

## Security

- [ ] Production DB password is strong
- [ ] Production `JWT_SECRET` is strong
- [ ] `ALLOWED_ORIGINS` is restricted to real addresses
- [ ] Firewall opened only where needed
- [ ] Demo data not used in live production
