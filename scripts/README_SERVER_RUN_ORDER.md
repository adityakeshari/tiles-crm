# Windows Server 2016 Run Order

Use these steps in this exact order for `Tiles CRM` on Windows Server 2016.

1. Install `Node.js 20 LTS`
   - Confirm:
   ```cmd
   node -v
   npm -v
   ```

2. Install `PostgreSQL`
   - Create database:
   ```cmd
   createdb -U postgres tiles_crm
   ```
   - Or create it from `psql`:
   ```cmd
   psql -U postgres -c "CREATE DATABASE tiles_crm;"
   ```

3. Install `IIS + URL Rewrite + ARR`
   - Enable IIS role on Windows Server 2016.
   - Install Microsoft `URL Rewrite`.
   - Install Microsoft `Application Request Routing (ARR)`.
   - Confirm `appcmd.exe` exists:
   ```cmd
   dir %windir%\System32\inetsrv\appcmd.exe
   ```

4. Configure backend `.env.production`
   - Copy:
   ```cmd
   copy backend\.env.production.example backend\.env.production
   ```
   - Fill in:
   - `PORT=5000`
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tiles_crm`
   - `JWT_SECRET=strong-random-secret`
   - `ALLOWED_ORIGINS=http://localhost,http://SERVER-IP,http://SERVER-IP:80`

5. Run migrations
   - Use:
   ```cmd
   scripts\run-migrations.cmd
   ```

6. Run build
   - Use:
   ```cmd
   scripts\build-production.cmd
   ```

7. Setup IIS
   - Use:
   ```cmd
   scripts\setup-iis-crm.cmd
   ```

8. Install backend service
   - Install `NSSM`.
   - Use:
   ```cmd
   scripts\install-backend-service.cmd
   ```

9. Test
   - Test on server:
   ```text
   http://localhost
   ```
   - Test on LAN:
   ```text
   http://SERVER-IP
   ```
   - Backend health direct:
   ```text
   http://localhost:5000/api/health
   ```

## Notes

- Frontend IIS path:
  `C:\Users\hp\Documents\tiles-crm\frontend\dist`
- Backend service name:
  `TilesCRMBackend`
- Database name:
  `tiles_crm`
- Migration order ends at:
  `015_registered_masons_token_enforcement.sql`
