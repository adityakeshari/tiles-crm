# Project Structure — Tiles CRM (Phase 1 Audit)

Lightweight directory-level audit. No code modified, no commands run.
Excluded from scan: node_modules, dist/build, graphify-out, logs, uploads, tmp, coverage, .next.

## 1. Stack & package.json

**Backend** (`backend/package.json` — `tiles-crm-backend`)
- Node ESM (`"type": "module"`), entry `src/server.js`
- Deps: express, pg, jsonwebtoken, bcryptjs, cors, dotenv, pdfkit
- Scripts: `dev`, `start`, `create-admin` (`scripts/create-admin.js`), `seed-demo` (`scripts/seed-demo-data.js`)
- Note: `scripts/` referenced in package.json but not found in the folder — likely missing or untracked.

**Frontend** (`frontend/package.json` — `tiles-crm-frontend`)
- React 18 + Vite 5, single-page app
- Deps: react, react-dom; devDeps: @vitejs/plugin-react, vite
- Scripts: `dev`, `build` (vite build + copy-webconfig script), `preview`, `local`

**Other top-level**: `migrations/` (15 SQL files, sequential), Dockerfiles for both frontend/backend, `.dockerignore`, `graphify-out/` (excluded).

## 2. Backend structure (`backend/src`)

```
src/
├── app.js                  — Express app setup, route mounting, CORS, error handler
├── server.js               — entry point
├── db.js                   — Postgres pool (pg)
├── middleware/
│   ├── auth.js             — JWT auth (requireAuth, requireRole)
│   └── internal-auth.js    — internal API key auth (owner-summary endpoint)
├── routes/                 — 19 route modules (see API routes below)
└── utils/
    ├── validation.js
    ├── ttlCache.js
    ├── invoicePdf.js
    └── quotationPdf.js
```

## 3. Frontend structure (`frontend/src`)

```
src/
├── main.jsx
├── App.jsx                 — large single-file app shell (routing/state/views)
├── api.js                  — API client wrapper
├── styles.css
├── components/
│   ├── AppHeader.jsx
│   ├── Sidebar.jsx
│   ├── PageHeader.jsx
│   └── WorkspaceTabs.jsx
└── sections/
    ├── BillingSection.jsx
    ├── LeadWorkspaceSection.jsx
    ├── ProjectsSection.jsx
    ├── RegisteredMasonsSection.jsx
    ├── AdhesiveTokensSection.jsx
    └── PurchaseCostingSection.jsx
```

## 4. API routes (mounted in `app.js`)

All prefixed `/api/...`, all gated by `requireAuth` except `/api/auth` (public) and `/api/owner-summary` (internal API key only):

| Mount | Module | Notes |
|---|---|---|
| `/api/auth` | auth.js | login, seed-admin (public) |
| `/api/billing` | billing.js | invoices/payments |
| `/api/complaints` | complaints.js | incl. create-operations-task |
| `/api/dashboard` | dashboard.js | summary |
| `/api/owner-summary` | owner-summary.js | internal-key protected |
| `/api/leads` | leads.js | largest module: dashboard stats/followups/operations, followups, payments, quotations (PDF), operations-tasks |
| `/api/dealers` | dealers.js | CRUD |
| `/api/expenses` | expenses.js | CRUD |
| `/api/exports` | exports.js | CSV exports (leads, payments, projects, billing, ledger) |
| `/api/inventory` | inventory.js | CRUD + options + debug |
| `/api/notifications` | notifications.js | list, mark-read |
| `/api/plumbing` | plumbing.js | plumbers, jobs, materials |
| `/api/purchase-costing` | purchase-costing.js | |
| `/api/projects` | projects.js | CRUD, dispatches, invoice PDF |
| `/api/purchases` | purchases.js | CRUD |
| `/api/reports` | reports.js | daily, sales, collection, customer-pending, token, mason-token-summary |
| `/api/schemes` | schemes.js | masons, claims (verify/approval/reopen/payment) |
| `/api/suppliers` | suppliers.js | CRUD |
| `/api/users` | users.js | CRUD, role-gated (admin/manager/operations/accounts) |
| `/api/health` | inline in app.js | health check |

Unmatched `/api/*` → JSON 404. SPA fallback serves `frontend/dist` if present.

## 5. Authentication files

- `middleware/auth.js` — JWT verify via `jsonwebtoken`; exports `requireAuth` (validates Bearer token or `?token=` query param) and `requireRole(...roles)` (role-based access, admin always passes)
- `middleware/internal-auth.js` — separate internal API-key gate (`x-internal-api-key` header) for `/api/owner-summary` only; key from `CRM_OWNER_SUMMARY_API_KEY`
- `routes/auth.js` — `/login` (phone + bcrypt password check, issues 7-day JWT), `/seed-admin`
- JWT secret falls back to `"change-me"` if `JWT_SECRET` env var is unset (worth flagging for the security pass)

## 6. Database connection files

- `src/db.js` — single Postgres connection point using `pg.Pool`, configured via env vars (`DATABASE_URL`, `PG_POOL_MAX/MIN`, timeouts, `maxUses`); exports `pool` and a `query()` helper
- `migrations/` — 15 sequential SQL migration files (001–015), covering schema hardening, module expansions (inventory, plumbing, schemes, complaints, notifications, owner finance, mason tokens, etc.)

## 7. "Daily Task" module

No dedicated "Daily Task" module exists. What's present instead:

- **Daily Report** — `GET /api/reports/daily` (backend) + `dailyReport` state/UI in `App.jsx` (frontend): a daily snapshot of sales, collections, expenses, purchases, tokens, cash in/out, follow-ups for a given date.
- **Operations Tasks** — task-like sub-feature under leads: `GET/POST /api/leads/:id/operations-tasks`, `PUT /api/leads/:leadId/operations-tasks/:taskId`, plus `complaints.js` has `POST /:id/create-operations-task`. Migration `006_operations_tasks.sql` defines the schema.
- `daily_up_limit_percent` / `daily_down_limit_percent` — unrelated config fields on inventory products (price band limits), also matching "daily" in search.

If a "Daily Task" module is expected per spec, it does not currently exist as a standalone feature — closest equivalents are the Daily Report and Operations Tasks above.
