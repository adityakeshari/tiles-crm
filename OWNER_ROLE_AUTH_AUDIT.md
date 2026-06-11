# Owner Role Auth Audit

Audit date: 2026-06-07

Scope:
- role definitions
- backend route authorization
- owner dashboard Phase 4A API access fit
- recommendation only

Rules followed:
- no code changes
- no permission changes
- no database changes

---

## Executive Summary

The CRM is currently built around **`admin` as the real superuser/business-owner role**.

The string `owner` appears in some frontend and business-policy checks, but it is **not a first-class authenticated user role today**:

- it is **not** in frontend `availableUserRoles`
- it is **not** in backend `userRoles` validation
- it is **not** granted broad route access in `requireRole(...)`

That means the app currently treats:
- `admin` = actual full-access owner/operator of the whole CRM
- `owner` = partial conceptual privilege used in some pricing UI/business logic, but not a complete login/authorization role

So, as of this audit, the safest statement is:

> **The CRM currently standardizes on `admin`, not `owner`, for the primary business owner account.**

---

## 1. All defined user roles

### Frontend defined roles
Source:
- [C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx)

`availableUserRoles` contains:
- `admin`
- `manager`
- `sales`
- `operations`
- `accounts`
- `inventory`
- `token`
- `reports`

Important:
- `owner` is **not** present in the UI role picker
- `operator` is also not in `availableUserRoles`, even though backend supports it

### Backend validated roles
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\utils\validation.js](C:\Users\hp\Documents\tiles-crm\backend\src\utils\validation.js)

`userRoles` contains:
- `admin`
- `manager`
- `sales`
- `operations`
- `accounts`
- `operator`
- `inventory`
- `token`
- `reports`

Important:
- `owner` is **not** a valid backend user role

### Auth behavior
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\middleware\auth.js](C:\Users\hp\Documents\tiles-crm\backend\src\middleware\auth.js)

`requireRole(...)` has a hard superuser shortcut:
- if user has `admin`, access is granted immediately

There is no similar special handling for `owner`.

---

## 2. Which routes allow admin

### Important fact
Because of `requireRole(...)`, `admin` is effectively allowed on **all authenticated routes using `requireRole`**, even when `admin` is not explicitly listed.

Examples where `admin` is explicitly present:
- `users.js`
- `projects.js`
- `purchases.js`
- `purchase-costing.js`
- `billing.js`
- `inventory.js`
- `expenses.js`
- `reports.js`
- `schemes.js`
- `suppliers.js`
- `exports.js`

### Conclusion
`admin` currently acts as:
- owner-equivalent
- full operational superuser
- staff management role
- dashboard-safe role

---

## 3. Which routes allow owner

### Result
No audited backend route file was found with explicit:
- `requireRole("owner", ...)`
- or any equivalent owner authorization branch

### Key point
There is **no route-level auth model today that treats `owner` as a first-class backend role**.

### Owner-related references that do exist
These are business/policy references, not broad access control:

- frontend pricing lock UI checks
- owner discount cap fields
- owner discount approval language in billing
- owner note fields in projects
- `/api/owner-summary` route exists, but it uses **internal API key auth**, not user role auth

So:
- `owner` exists as a concept in business rules
- `owner` does **not** exist as a complete CRM access role

---

## 4. Which routes allow both admin and owner

### Result
No standard authenticated route was found that explicitly allows both:
- `admin`
- `owner`

The only owner-specific backend surface is:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\owner-summary.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\owner-summary.js)

But that route is protected by:
- `requireInternalApiKey`

So it is not a normal user-role route and does not count as `admin + owner` user-role access.

---

## 5. Which dashboard APIs currently block owner

This section focuses on Phase 4A owner dashboard APIs.

### APIs reused by Phase 4A
- `GET /api/dashboard/summary`
- `GET /api/leads/dashboard/stats`
- `GET /api/complaints`
- `GET /api/reports/daily`
- `GET /api/projects`
- `GET /api/purchases`
- `GET /api/plumbing`
- `GET /api/schemes`
- `GET /api/expenses`

### Likely owner-access result by current auth design

#### 1. `GET /api/dashboard/summary`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\dashboard.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\dashboard.js)

Observed behavior:
- no `requireRole(...)` at route level in this file

Audit result:
- does **not** obviously block `owner`
- but that does not solve the rest of the dashboard dependencies

#### 2. `GET /api/leads/dashboard/stats`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\leads.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\leads.js)

Observed behavior:
- this route family is used broadly in the app
- no owner-specific access model exists

Audit result:
- not the primary blocker found in Phase 4A review

#### 3. `GET /api/complaints`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\complaints.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\complaints.js)

Observed behavior:
- route is readable today without an explicit `requireRole` gate on `GET /`

Audit result:
- not the main owner blocker

#### 4. `GET /api/reports/daily`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js)

Current auth:
- `router.use(requireRole("admin", "manager", "accounts", "reports", "operations"))`

Owner result:
- **blocks pure `owner`**

#### 5. `GET /api/projects`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js)

Current auth:
- `requireRole("admin", "manager", "operations", "accounts")`

Owner result:
- **blocks pure `owner`**

#### 6. `GET /api/purchases`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchases.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchases.js)

Current auth:
- `requireRole("admin", "manager", "accounts", "operations", "operator", "reports")`

Owner result:
- **blocks pure `owner`**

#### 7. `GET /api/plumbing`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\plumbing.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\plumbing.js)

Observed behavior:
- `GET /` itself does not currently show a `requireRole(...)` line in the audited file

Owner result:
- not the main blocker

#### 8. `GET /api/schemes`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\schemes.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\schemes.js)

Observed behavior:
- dashboard route itself is readable today
- but mutation routes are role-limited

Owner result:
- not the main blocker for Phase 4A read-only dashboard

#### 9. `GET /api/expenses`
Route file:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\expenses.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\expenses.js)

Current auth:
- `router.use(requireRole("admin", "manager", "accounts", "operations", "operator"))`

Owner result:
- **blocks pure `owner`**

---

## 6. Exact route files causing owner access failures

For Phase 4A owner dashboard, the most important blocking route files are:

1. [C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js)
- blocks `owner` on daily report endpoints

2. [C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js)
- blocks `owner` on project summary/dashboard data

3. [C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchases.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchases.js)
- blocks `owner` on purchase summary data

4. [C:\Users\hp\Documents\tiles-crm\backend\src\routes\expenses.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\expenses.js)
- blocks `owner` on expense summary data

Additional systemic blockers:

5. [C:\Users\hp\Documents\tiles-crm\backend\src\utils\validation.js](C:\Users\hp\Documents\tiles-crm\backend\src\utils\validation.js)
- `owner` is not a valid backend user role

6. [C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx)
- `owner` is not available in `availableUserRoles`
- pure owner user-flow is not a normal first-class path

---

## Recommendation Options

## Option A: Standardize on `admin` role

### Meaning
Use `admin` as the official business owner login/account type.

### Security impact
- Lowest risk
- No auth broadening needed
- Preserves current superuser shortcut in `requireRole(...)`
- Avoids creating another full-access role with overlapping privileges

### Development effort
- Lowest
- Mostly documentation, naming, and UI clarity work
- No backend auth matrix expansion required

### Long-term maintainability
- Strong in the short/medium term
- Matches the actual system behavior today
- Prevents confusion between conceptual owner privileges and real backend access

### Drawback
- Business language says “owner,” but implementation uses “admin”
- If stakeholders strongly want a visible `owner` role, this can feel semantically awkward

### Audit recommendation score
- **Best current-state fit**

---

## Option B: Standardize on `owner` role

### Meaning
Make `owner` the primary business owner account and phase out `admin` as the day-to-day owner identity.

### Security impact
- Higher risk
- Would require sweeping permission updates across many route files
- Easy to miss one route and create broken dashboards or partial access

### Development effort
- High
- Requires:
  - backend validation role update
  - frontend role picker update
  - `visibleViews` update
  - route permission updates across many modules
  - testing all owner flows end-to-end

### Long-term maintainability
- Good only if fully completed
- Poor if partially done
- A half-migrated `owner` role will create repeated regressions

### Drawback
- Much larger auth migration than it first appears

### Audit recommendation score
- **Not recommended as the immediate path**

---

## Option C: Allow both `admin` and `owner` for owner-dashboard read-only APIs

### Meaning
Keep `admin` as today’s superuser, but add `owner` to selected read-only summary routes used by owner dashboards.

### Security impact
- Moderate
- Safer than full owner-role migration
- Still expands privileged read access, so route selection must be deliberate

### Development effort
- Medium
- Requires:
  - adding `owner` to backend-valid roles
  - adding `owner` to user-management role lists
  - updating selected read-only routes only
  - testing owner dashboard and overview access

### Long-term maintainability
- Better than Option B for incremental rollout
- Still leaves a dual-role model:
  - `admin` full superuser
  - `owner` read-heavy executive role

### Drawback
- More cognitive overhead than Option A
- Requires clear documentation about the difference between `admin` and `owner`

### Audit recommendation score
- **Best future path if business truly wants a separate owner login**

---

## Final Recommendation

## Recommended now: Option A
**Standardize on `admin` role as the primary business owner account.**

Reason:
- This is what the CRM actually does today
- It is the safest and lowest-effort choice
- It avoids auth drift and partial `owner` failures
- It keeps Owner Dashboard rollout stable immediately

## Recommended later, if needed: Option C
If the business later wants a distinct owner login identity:
- introduce `owner` as a real validated backend role
- add it intentionally to selected read-only executive APIs first
- keep `admin` as the full technical superuser

## Not recommended now: Option B
Do not switch the whole CRM to `owner` as the primary owner account until a full auth migration sprint is planned.

---

## Bottom Line

Today’s CRM is **admin-centric**, not owner-centric.

If you want the business owner dashboard to work safely right now:
- use `admin` as the owner account

If you want a real `owner` role later:
- implement it as a deliberate auth model expansion, not as a naming assumption.
