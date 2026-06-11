# Tiles CRM — Security Audit Report

Scope: full-stack review of `tiles-crm` (`backend/` Express/Postgres API and `frontend/` React/Vite app), source code and configuration only — no live penetration testing was performed. Severity tags: **CRITICAL** (exploitable now, fix immediately), **WARNING** (real weakness, fix before/at next deploy), **PASS** (checked, no issue found).

---

## 1. Password Hashing

| Status | Finding | Location |
|---|---|---|
| PASS | Passwords are hashed with `bcryptjs` (cost factor 10) before storage; plaintext is never persisted. | `backend/src/routes/auth.js:95`, `backend/src/routes/users.js:54,94`, `backend/scripts/create-admin.js:26,35`, `backend/scripts/seed-demo-data.js:9` |
| PASS | Login compares with `bcrypt.compare`, not a manual string comparison. | `backend/src/routes/auth.js:42` |
| WARNING | Minimum password length is only **6 characters** with no complexity rules (no requirement for numbers/symbols/case mix). This allows weak passwords such as `"123456"`. | `backend/src/utils/validation.js:1594-1599` |
| WARNING | Demo/seed accounts ship with predictable passwords (`Admin@123`, `Sales@123`, `Ops@12345`, `Accounts@123`) and `.env.example` documents `ADMIN_PASSWORD=Admin@123`. If `npm run seed-demo-data` or the example values are ever used in a real deployment, these become guessable production credentials. | `backend/scripts/seed-demo-data.js:47,53,59,65`; `backend/.env.example:18` |

**Recommendation:** raise the minimum to ~10 characters with a complexity check, document that seed/demo accounts must never be used in production, and force a password reset on first login for any seeded account.

---

## 2. JWT / Session Security

| Status | Finding | Location |
|---|---|---|
| PASS | JWT is signed server-side with `jsonwebtoken`, using a secret loaded from environment (`JWT_SECRET`), and the app refuses to start if it's missing. | `backend/src/routes/auth.js:49-53`, `backend/src/config/env.js:7-21` |
| PASS | Tokens carry a bounded expiry (`expiresIn: "7d"`) rather than being permanent. | `backend/src/routes/auth.js:52` |
| WARNING | The local `.env` in the working tree has `JWT_SECRET=tiles-crm-local-secret` — a short, guessable, non-random value. Anyone who obtains this secret (or who knows it was reused) can forge valid admin tokens. | `backend/.env:3` |
| CRITICAL | `docker-compose.yml` (tracked in git) hardcodes `JWT_SECRET: change-me` for the backend container. This file is committed to the repository, so the signing secret is effectively public to anyone with repo access — tokens can be forged for any user/role, including admin. | `docker-compose.yml:25` |
| WARNING | `requireAuth` accepts the JWT from a `?token=` query-string parameter as a fallback to the `Authorization` header (used for PDF/CSV/export download links). Query strings are written to server access logs, browser history, and `Referer` headers, so tokens leak through these channels. The request-logging middleware in `app.js` logs `req.originalUrl` (which includes the `?token=...` query string) for **every** request, writing live JWTs into the console/log files. | `backend/src/middleware/auth.js:17,19,23`; `backend/src/app.js:46-55`; `frontend/src/api.js:109-126` |
| WARNING | `jwt.verify` does not pin an explicit `algorithms` allow-list (e.g. `['HS256']`). The current `jsonwebtoken` version defaults safely and rejects `alg: none`, so this is not exploitable today, but explicitly pinning the algorithm is a defense-in-depth best practice and protects against future library/config changes. | `backend/src/middleware/auth.js:26` |
| WARNING | The JWT payload embeds the user's phone number (`{ id, name, phone, role, roles }`). JWTs are base64-encoded, not encrypted — this PII is readable by anyone who can see the token (e.g. via the query-string leakage above). | `backend/src/routes/auth.js:50` |
| PASS | The frontend stores the token in `localStorage` under `tiles-crm-token` and attaches it via `Authorization: Bearer …` for normal API calls — a conventional SPA pattern; no session cookies are used (see CSRF section). | `frontend/src/api.js:11-14`, `frontend/src/App.jsx:1839` |
| WARNING | Because the token lives in `localStorage`, any successful XSS (see §8) would allow full session theft with no `HttpOnly` protection. This is the standard SPA trade-off, but is worth flagging given the token's 7‑day lifetime and broad role claims. | `frontend/src/api.js:11` |

**Recommendation:** rotate `JWT_SECRET` to a long random value (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) generated per environment and never commit it; remove the hardcoded secret from `docker-compose.yml` and source it from an env file/secret store; stop logging full request URLs (strip query strings, or redact `token`); consider moving download authorization to short-lived signed URLs instead of the long-lived session JWT; pin `algorithms: ['HS256']` on verify.

---

## 3. Role-Based Permissions (RBAC)

| Status | Finding | Location |
|---|---|---|
| PASS | A central `requireAuth` middleware validates the JWT and normalizes `role`/`roles` onto `req.user` for every protected route group; `requireRole(...)` enforces an allow-list and always grants `admin` full access. | `backend/src/middleware/auth.js:15-52` |
| PASS | Sensitive write operations in most modules are gated correctly, e.g. user management restricted to `admin` (`users.js:38,71`), dealer/inventory/purchase/plumbing/scheme deletes restricted to `admin` (`dealers.js:123`, `inventory.js:461`, `purchases.js:899`, `plumbing.js:181`, `schemes.js:1135`), and project/billing flows scoped to `admin/manager/operations/accounts`. | `backend/src/routes/projects.js:136-424`, `backend/src/routes/billing.js:1408` |
| PASS | Daily Tasks enforces a layered model: a router-wide allow-list of roles, plus finer checks (`canManageAllTasks`, `canVerifyTasks`, `canDeleteTasks`) for create/verify/delete actions. | `backend/src/routes/daily-tasks.js:13-62` |
| WARNING | `complaints.js` has **no role restriction at all** on `POST /` (create), `PUT /:id` (update/reassign/resolve), or `POST /:id/create-operations-task` — any authenticated user, regardless of role (including the lowest-privilege roles such as `operator`/`token`), can update or reassign **any** complaint record system-wide. There is also no ownership check (e.g. "only the assignee or a manager may edit"). | `backend/src/routes/complaints.js:87,144,221` (router has no `router.use(requireRole(...))`) |
| WARNING | `suppliers.js` `POST /` and `PUT /:id` have no `requireRole` guard — any authenticated user can create or edit supplier records. | `backend/src/routes/suppliers.js:115,160` |
| WARNING | `purchase-costing.js` `POST /` and the `PUT` routes (lines 919, 1015, 1161, 1211) have no `requireRole` guard — any authenticated user can create/modify purchase-costing records, which directly affect financial reporting. | `backend/src/routes/purchase-costing.js:919,1015,1161,1211` |
| WARNING | `dealers.js GET /` and `plumbing.js GET /`, `GET /lead/:leadId`, and `schemes.js GET /`, `GET /masons`, `GET /claims/:id` have no role restriction — any authenticated user (any role) can read this business data. This may be intentional, but it should be a deliberate decision rather than an omission, since other read endpoints (e.g. `projects.js GET /`) are explicitly scoped. | `backend/src/routes/dealers.js:20`, `backend/src/routes/plumbing.js:46,95`, `backend/src/routes/schemes.js:181,365,737` |

**Recommendation:** add an explicit `router.use(requireRole(...))` (or per-route checks) to `complaints.js`, `suppliers.js`, and `purchase-costing.js` matching the access model used elsewhere; add an ownership/assignment check to `complaints.js PUT /:id` so staff can only edit complaints assigned to them unless they hold a management role; review the unguarded `GET` routes and decide explicitly whether broad read access is intended.

---

## 4. API Authorization Gaps

| Status | Finding | Location |
|---|---|---|
| PASS | `notifications.js` correctly scopes both list and update-as-read queries to `WHERE user_id = $1` using `req.user.id`, preventing one user from reading or mutating another user's notifications (no IDOR). | `backend/src/routes/notifications.js:8-15,27-33` |
| WARNING | `complaints.js PUT /:id` (see §3) is also an authorization gap in the IDOR sense: any authenticated user can change `assigned_to`, `status`, and `resolution_note` on any complaint by guessing/iterating its numeric `id` — there is no check that the requester owns or manages that record. | `backend/src/routes/complaints.js:144-219` |
| PASS | The internal/external integrations (`/api/owner-summary`, `/api/daily-tasks/external-create`, `/api/daily-tasks/external-bulk-create`) are intentionally exempted from the user JWT (`requireAuth`) but are protected instead by a separate shared-secret check (`requireInternalApiKey` / `requireTaskApiKey`), which is a reasonable pattern for server-to-server calls. | `backend/src/app.js:78-80`, `backend/src/middleware/internal-auth.js:1-31`, `backend/src/routes/daily-tasks.js:95-114,198,238` |
| WARNING | `requireTaskApiKey` falls back through **three** different env vars (`TASK_API_KEY || INTERNAL_API_KEY || CRM_OWNER_SUMMARY_API_KEY`), meaning the owner-summary key can also authenticate task-creation endpoints. Reusing one secret across unrelated trust boundaries means a leak of the (lower-sensitivity) summary key also compromises the (higher-impact, data-writing) task-creation endpoints. | `backend/src/routes/daily-tasks.js:91-93` |
| PASS | All per-resource SQL lookups use parameterized `$1`/`$2…` placeholders bound to `req.user.id`/`req.params.id` rather than trusting client-supplied scoping, in the modules reviewed (`daily-tasks.js`, `notifications.js`, `users.js`, `leads.js`, `billing.js`). | see §7 |

**Recommendation:** give each integration its own dedicated secret (`TASK_API_KEY` distinct from `CRM_OWNER_SUMMARY_API_KEY`) and drop the fallback chain; add an ownership check to the complaints update endpoint as noted above.

---

## 5. Hardcoded Secrets

| Status | Finding | Location |
|---|---|---|
| CRITICAL | `docker-compose.yml` (tracked in git, visible to anyone with repo access) hardcodes a **weak Postgres password** (`POSTGRES_PASSWORD: postgres`, reused in `DATABASE_URL: postgresql://postgres:postgres@db:5432/tiles_crm`) and a **placeholder JWT secret** (`JWT_SECRET: change-me`). If this compose file is ever used as-is for a real deployment, both the database and all user sessions are trivially compromisable. | `docker-compose.yml:9,24-25` |
| WARNING | The working-tree `backend/.env` (correctly excluded from git via `.gitignore`, confirmed not tracked) nonetheless contains live-looking values — a database password (`8a7b516cb9be4ec3a4d7c15d9f0d57f9`), a weak `JWT_SECRET` (`tiles-crm-local-secret`), and an `CRM_OWNER_SUMMARY_API_KEY` (`aditya-owner-secret-2026`) that resembles a personal/predictable string rather than a generated random key. Because this file lives inside the project folder, any backup, zip, screen-share, or copy of the repo directory (not just `git` operations) will carry these secrets with it. | `backend/.env:2-4` (values intentionally not reproduced here) |
| PASS | `.env` and `frontend/.env` are correctly listed in `.gitignore` and confirmed **not** present in git history (`git log --all` for these paths returns nothing). | `.gitignore:1-2` |
| PASS | `.env.example` / `.env.production.example` use clearly-labelled placeholder values (`replace-with-a-long-random-string`, `USER:PASSWORD`, `strong-random-secret`) and include a comment instructing operators to generate a random `JWT_SECRET` — good practice for a template file. | `backend/.env.example:3-6`, `backend/.env.production.example:4` |
| PASS | No API keys, tokens, or credentials were found hardcoded inside application source files (`routes/`, `middleware/`, `utils/`, frontend `src/`) — all secrets are read from `process.env`. | `backend/src/**/*.js` (grep for `password|secret|api_key|token` literals returned no in-code values) |

**Recommendation:** replace the credentials in `docker-compose.yml` with environment-variable references (e.g. `${POSTGRES_PASSWORD}`, `${JWT_SECRET}`) sourced from a non-committed `.env`/secret manager, and rotate the database password and `JWT_SECRET`/`CRM_OWNER_SUMMARY_API_KEY` currently in `backend/.env` since they may already have been shared (e.g. via this audit, screenshots, or backups).

---

## 6. Exposed Ports

| Status | Finding | Location |
|---|---|---|
| WARNING | `docker-compose.yml` publishes PostgreSQL directly to the host network: `ports: ["5432:5432"]`. Combined with the weak `postgres`/`postgres` credentials above, this means the database is reachable from outside the container (and potentially the LAN/internet, depending on host firewalling) with default credentials. Database ports normally should not be published at all in a production compose file — only the application should reach the DB over the internal Docker network. | `docker-compose.yml:10-11` |
| PASS | The backend (`5000`) and frontend (`8080`) ports are published, which is expected for an app that needs to be reached — `app.js` also sets `trust proxy` and the deployment checklist documents that LAN/internet exposure should go through Tailscale, keeping the raw port private. | `docker-compose.yml:29-30,41-42`; `DEPLOYMENT_CHECKLIST_SAFE.md:9-15` |
| PASS | CORS is allow-listed via `ALLOWED_ORIGINS` and the server validates the `Origin` header against it; the production example correctly documents setting this. | `backend/src/app.js:39-67`, `backend/.env.example:7` |
| WARNING | The working `.env` does **not** set `ALLOWED_ORIGINS`. When that variable is empty, the CORS middleware's `allowedOrigins.length === 0` branch allows **every** origin (`callback(null, true)` unconditionally). This effectively disables the CORS allow-list in the current configuration. | `backend/src/app.js:39-42,59-61`; `backend/.env` (key absent) |

**Recommendation:** remove the `5432:5432` port mapping from `docker-compose.yml` (let the backend reach Postgres over the internal compose network only); always set `ALLOWED_ORIGINS` explicitly in every environment so the empty-list "allow all" fallback is never relied on in production.

---

## 7. SQL Injection Risks

| Status | Finding | Location |
|---|---|---|
| PASS | All data-layer access goes through a single `query(text, params)` helper wrapping `pg.Pool#query`, and every reviewed route (`auth.js`, `users.js`, `leads.js`, `billing.js`, `daily-tasks.js`, `notifications.js`, `inventory.js`, `purchases.js`, `schemes.js`, `reports.js`, `suppliers.js`, etc.) builds queries with numbered placeholders (`$1, $2…`) and passes user-supplied values through the `params` array — never via string concatenation or interpolation of request data. A repo-wide grep for `${req.` inside query template strings returned **zero matches**. | `backend/src/db.js:18-20`; e.g. `backend/src/routes/leads.js:258-306`, `backend/src/routes/billing.js:460-490` |
| PASS | Dynamic `WHERE` clause assembly (search/filter endpoints in `leads.js`, `billing.js`, `daily-tasks.js`, `purchases.js`, `purchase-costing.js`, `reports.js`, `schemes.js`, `suppliers.js`) builds the clause text from a fixed set of column comparisons and always pushes the *value* into the parameter array, referencing it as `$<index>` — the column/operator strings are static, not user-controlled. | e.g. `backend/src/routes/leads.js:240-261`, `backend/src/routes/billing.js:463-490` |
| WARNING (informational, not exploitable) | `owner-summary.js` builds its analytics query with a JS template literal that interpolates `${TIMEZONE}` directly into the SQL text (e.g. `(q.created_at AT TIME ZONE '${TIMEZONE}')`). `TIMEZONE` is a hardcoded constant (`"Asia/Kolkata"`), **not** request-derived, so this is not currently exploitable — but the pattern of interpolating into SQL text is fragile, and a future refactor that makes timezone configurable/request-driven would reintroduce real injection risk if the same pattern were reused. | `backend/src/routes/owner-summary.js:7,65-159` |

**Recommendation:** no urgent action required; as a hardening measure, replace the `${TIMEZONE}` string interpolation in `owner-summary.js` with a bound parameter (`$1`) even though the value is currently constant, to keep the "always parameterize" rule exception-free across the codebase.

---

## 8. XSS (Cross-Site Scripting) Risks

| Status | Finding | Location |
|---|---|---|
| PASS | The frontend is a React/JSX SPA; all dynamic content is rendered through normal JSX expressions (`{value}`), which React escapes by default. A repo-wide search for `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, and `new Function(` in `frontend/src` returned **zero matches**. | `frontend/src/**/*.jsx` |
| PASS | CSV export endpoints escape values that contain commas, quotes, or newlines (`csvEscape`, wraps in quotes and doubles internal quotes), preventing CSV structure-breaking injection. | `backend/src/routes/exports.js:9-15` |
| WARNING | The CSV export `csvEscape` does not neutralize "formula injection" — values beginning with `=`, `+`, `-`, or `@` are written as-is. If a lead/customer name or similar free-text field starts with one of these characters, opening the exported CSV in Excel/Sheets can trigger formula execution (a well-known CSV/"Excel formula injection" risk). | `backend/src/routes/exports.js:9-15` |
| PASS | No server-rendered HTML templating with unescaped user input was found; PDF generation (`invoicePdf.js`, `quotationPdf.js`) uses the programmatic `pdfkit` API (drawing text/values directly), not an HTML/template-injection-prone renderer. | `backend/src/utils/invoicePdf.js`, `backend/src/utils/quotationPdf.js` |

**Recommendation:** prefix exported cell values that start with `=`, `+`, `-`, or `@` with a leading apostrophe (or a single quote inside the quoted value) in `csvEscape` to neutralize spreadsheet formula injection.

---

## 9. CSRF (Cross-Site Request Forgery) Risks

| Status | Finding | Location |
|---|---|---|
| PASS | The application uses **stateless Bearer-token authentication** (JWT in the `Authorization` header, sourced from `localStorage`) rather than cookie-based sessions. No `cookie-parser`, `res.cookie`, or `csurf`/CSRF-token middleware is present anywhere in the backend, and none is needed: a third-party site cannot make the browser automatically attach an `Authorization: Bearer …` header (unlike cookies), so the classic CSRF attack vector does not apply to this API. | `backend/src/middleware/auth.js:15-32`; grep for `cookie`/`csrf` across `backend/src` and `frontend/src` returned no matches |
| WARNING | The one exception is the `?token=` query-string fallback in `requireAuth` (used for download links). Because that token travels in the URL rather than a header, it is technically *possible* to embed such a URL in a third-party page; however, exploiting it would require the attacker to already know a victim's valid token (the same prerequisite as the JWT-leakage issue in §2), so this is best treated as reinforcing the recommendation to remove/limit query-string token usage rather than as a standalone CSRF gap. | `backend/src/middleware/auth.js:17,19,23` |

**Recommendation:** no CSRF middleware is required given the Bearer-token design; just resolve the query-string token exposure noted in §2, which removes this residual edge case too.

---

## 10. Backup and Recovery Readiness

| Status | Finding | Location |
|---|---|---|
| PASS | A documented, step-by-step safe-deployment runbook exists covering pre-deploy checks, full CRM-folder backup, and PostgreSQL `pg_dump` backup (custom format) with restore guidance, rollback path, and post-deploy verification (local/LAN/Tailscale reachability). | `DEPLOYMENT_CHECKLIST_SAFE.md` (full document); `scripts/deployment/README_SAFE_DEPLOYMENT.md` |
| PASS | Dedicated, version-controlled scripts exist for each backup/recovery action: `backup-before-deploy.cmd`, `server-db-backup.cmd`, `server-restore-db.cmd`, plus `rollback-last.cmd`, `health-check.cmd`/`server-health-check.cmd`, and `one-click-update.cmd`/`server-update.cmd`. | `scripts/deployment/*.cmd` |
| PASS | The backup checklist explicitly reminds operators to back up secrets/env files separately if they live outside the repo, and to verify the presence of key paths (`server.js`, `frontend/dist`, `migrations`, `.env`) before proceeding. | `DEPLOYMENT_CHECKLIST_SAFE.md` (Section 1, "Backup current CRM folder") |
| PASS | The schema is managed through 28 incremental, numbered SQL migration files, giving a reproducible path to rebuild the database structure independent of any data backup. | `backend/migrations/001…028*.sql` |
| WARNING | All backup/restore/rollback tooling is implemented as **Windows `.cmd` scripts** tied to specific local paths (e.g. `C:\Users\Administrator\Documents\tiles-crm`) and a specific PostgreSQL version path (`C:\Program Files\PostgreSQL\16\bin\pg_dump.exe`). There is no evidence of (a) an *automated/scheduled* backup job (e.g. Task Scheduler entry, cron, or CI job) — backups appear to be a manual pre-deploy step only — or (b) off-server/off-site copies, meaning a single host failure (disk loss, ransomware, accidental deletion) could destroy both the live data and its backups together. | `scripts/deployment/*.cmd`, `DEPLOYMENT_CHECKLIST_SAFE.md` |
| WARNING | No restore drill or backup-integrity verification step (e.g. periodically restoring a dump to a scratch database to confirm it's valid/restorable) is documented or scripted. | `scripts/deployment/server-restore-db.cmd`, `DEPLOYMENT_CHECKLIST_SAFE.md` |

**Recommendation:** add a scheduled, automated backup job (Windows Task Scheduler running `server-db-backup.cmd` on a daily cadence) that copies the resulting dump to an off-host location (cloud storage, network share, or external drive), and periodically rehearse a full restore onto a scratch database to validate that backups are actually usable.

---

## Summary

| Severity | Count | Highlights |
|---|---|---|
| CRITICAL | 2 | Hardcoded weak `JWT_SECRET: change-me` and DB password `postgres`/`postgres` committed in `docker-compose.yml` (§2, §5) |
| WARNING | 19 | Weak password policy & seeded demo passwords; JWT leakage via `?token=` query strings + request logging; algorithm not pinned; PII in JWT payload; unguarded RBAC on `complaints`, `suppliers`, `purchase-costing`; shared internal API-key fallback chain; `.env` weak/predictable secrets present on disk; exposed Postgres port `5432:5432`; empty `ALLOWED_ORIGINS` disables CORS allow-list; CSV formula-injection gap; manual-only/no-offsite/no-drill backups |
| PASS | 24 | bcrypt hashing throughout; parameterized SQL everywhere (no SQLi found); React JSX escaping + no `dangerouslySetInnerHTML` (no XSS found); stateless Bearer-token design makes CSRF largely moot; notifications correctly scoped by `user_id`; documented backup/restore/rollback runbook with versioned migrations |

### Top 3 priorities (fix first)
1. **Rotate and externalize secrets** — remove `JWT_SECRET: change-me` and the `postgres`/`postgres` DB password from `docker-compose.yml`; generate strong random values for `JWT_SECRET`, `DATABASE_URL` password, and `CRM_OWNER_SUMMARY_API_KEY`; never commit real values (§2, §5).
2. **Stop publishing the database port** — drop `ports: ["5432:5432"]` from `docker-compose.yml` so Postgres is reachable only from the backend container (§6).
3. **Close the RBAC gaps** — add role/ownership checks to `complaints.js`, `suppliers.js`, and `purchase-costing.js` write routes, and stop the `?token=` query string from being written into request logs (§2, §3, §4).
