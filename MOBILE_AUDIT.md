# Tiles CRM — Phase 2: Mobile Responsiveness Audit

Scope: frontend only (`frontend/src`). No code was changed. This is a read-only review of `App.jsx`, `styles.css`, the shared components (`Sidebar`, `AppHeader`, `PageHeader`, `WorkspaceTabs`), and the six section files (Billing, Lead Workspace, Projects, Registered Masons, Adhesive Tokens, Purchase Costing), evaluated against four target widths: **360px, 390px, 412px (phones)** and **768px (small tablet)**.

Baseline: `frontend/index.html` already has a correct viewport tag (`width=device-width, initial-scale=1.0`), so the foundation for responsive rendering is in place — the issues below are CSS/layout-level, not viewport-level.

---

## 1. Critical issue: two competing mobile-sidebar systems collide

**Files:** `frontend/src/App.jsx` (lines ~6533–6566), `frontend/src/components/Sidebar.jsx`, `frontend/src/styles.css` (rules at line 2277 and line 3478)

**Priority: High**

`styles.css` contains two separate, never-reconciled attempts at a mobile sidebar:

- An older rule block (`@media (max-width: 1080px)` at line 2277) turns `.app-layout` into a single column, sets `.sidebar { position: static }`, and forces `.sidebar-nav { flex-direction: row; flex-wrap: wrap }` — i.e. the nav becomes a wrapped horizontal row sitting above the page content.
- A newer rule block (`@media (max-width: 1080px)` at line 3478) defines a proper slide-out drawer: `.sidebar.sidebar-drawer { position: fixed; transform: translateX(-104%); width: min(280px, calc(100vw - 2rem)) }`, plus `.mobile-sidebar-bar { display: flex }` and an overlay (`.sidebar-overlay`).

`App.jsx` actively drives the *drawer* pattern (`isMobileSidebar`, `isSidebarMobileOpen`, the "Menu" launch button, `Sidebar.jsx`'s `sidebar-drawer` / `sidebar-drawer-open` classes), so the drawer wins on positioning. **But there is no override for `.sidebar-drawer .sidebar-nav`**, so inside the fixed 280px-wide drawer the nav still inherits `flex-direction: row; flex-wrap: wrap` from the older rule. Result: on a 360–412px phone, opening the menu shows nav items wrapping awkwardly into a cramped horizontal grid inside a narrow panel instead of a clean vertical list — the drawer looks broken/unfinished.

**Fix direction:** add a scoped override, e.g. `.sidebar.sidebar-drawer .sidebar-nav { flex-direction: column; flex-wrap: nowrap; }`, and ideally delete the now-unused `.sidebar-nav { flex-direction: row... }` rule from the line-2277 block (it's dead weight that only causes confusion/conflicts going forward).

---

## 2. App shell layout (`App.jsx` / `.app-layout`)

**Priority: Medium**

- `App.jsx` conditionally adds an `app-layout-mobile` class (`` `app-layout ${...} ${isMobileSidebar ? "app-layout-mobile" : ""}` ``) — but **`.app-layout-mobile` has no corresponding rule anywhere in `styles.css`**. It's a no-op class; the actual mobile collapse is driven entirely by the `@media (max-width: 1080px)` query on `.app-layout` (which sets `grid-template-columns: 1fr`). This isn't breaking anything today (the media query covers it), but it's dead code that will mislead the next person who tries to "fix mobile by editing `.app-layout-mobile`".
- Below 1080px the breakpoint is shared by tablet (768px) and phones (360–412px) alike — there's no narrower-phone-specific tuning of the shell padding/gaps. At 360px, `.app-shell { width: min(1380px, calc(100% - 2rem)) }` still leaves only 1rem of margin on each side, which is acceptable but tight once compounded with panel padding.

**Fix direction:** either implement `.app-layout-mobile` rules intentionally or remove the class from the JSX template string to avoid confusion. No urgency — purely a cleanliness/maintainability issue.

---

## 3. Sidebar / header behavior

**Files:** `Sidebar.jsx`, `AppHeader.jsx`, `styles.css`

**Priority: High** (sidebar — see #1) / **Medium** (header)

- The drawer mechanics themselves (overlay, fixed positioning, open/close button, `isMobileSidebar = window.innerWidth <= 1080`) are sound and well-built — this is good underlying architecture, the only problem is the nav-direction conflict in #1.
- `AppHeader.jsx` renders a single-row header: greeting text + 3 buttons (Notifications / Dashboard / Logout) inside `.topbar.topbar-compact`. There is no dedicated mobile rule for `.topbar-compact` — only the generic `@media (max-width: 820px) { .topbar { padding: 1rem 1.1rem } }` and `.hero-copy h1 { font-size: 1.25rem }`. At 360px, the greeting string ("Hello {name} | {role} | {workspace}") plus three buttons in a flex row will likely wrap awkwardly or visually crowd the header — there's no `flex-wrap`/stacking rule scoped to `.topbar-compact` for narrow widths.
- `.toolbar button { width: 100% }` does kick in at ≤820px (line ~2047), so the three header buttons do stack to full width — but combined with the long greeting line, the header becomes quite tall on a 360px phone.

**Fix direction:** add a narrow-width rule that stacks `.topbar-compact .hero-copy` above `.toolbar` and shortens/truncates the greeting line (e.g. hide the workspace segment below 480px) so the header stays compact on phones.

---

## 4. Dashboard cards (`stats-grid`, `report-grid`, `StatCard`)

**Files:** `App.jsx` (lines ~6631, ~6642 — `summaryCards` / `dashboardSummary` cards), `styles.css`

**Priority: Low**

This area is already well-tuned for phones:
- `.stats-grid`: `repeat(auto-fit, minmax(168px,1fr))` → 2 columns at 820px → 1 column at 640px.
- `.report-grid` follows the same shared grid rules.
- `StatCard` (`App.jsx` line 11492) is a simple `<article><span/><strong/></article>` with no fixed widths — it reflows cleanly.

No changes recommended here; this module is in good shape for 360–768px.

---

## 5. Tables

**Files:** `App.jsx` (lines ~8096, ~9613, ~9777, ~10128 — at least 4 `data-table` instances: leads/contacts list, stock ledger, product report, a compact table), `BillingSection.jsx`, `LeadWorkspaceSection.jsx`, `ProjectsSection.jsx`, `RegisteredMasonsSection.jsx`, `AdhesiveTokensSection.jsx`, `PurchaseCostingSection.jsx` (each contains 3–7 references to `table-shell`/`data-table`/`form-grid`/`lead-actions`)

**Priority: High**

- Every table is wrapped in `.table-shell { overflow: auto; max-height: 520px }` and relies purely on **horizontal scrolling** — there is no card-view fallback for narrow screens anywhere in the codebase (confirmed: no `data-table-mobile`, `.table-card`, or similar pattern exists).
- `.data-table th { white-space: nowrap; font-size: 0.72rem }` keeps headers on one line, which on a 360px screen means most of the table is hidden off-canvas and the user must scroll horizontally to read each row — a poor experience for data-heavy modules like Stock Ledger, Billing, and Purchase Costing.
- The Purchase Costing item-line table is especially extreme: `.purchase-item-line { grid-template-columns: ...; min-width: 1185px }` — this forces a ~1185px-wide row inside a scroll container regardless of viewport, meaning on a 360px phone the user scrolls through roughly 3.3 screen-widths per row.
- Action buttons inside table cells are undersized for touch (see #7).

**Fix direction (no code changes made — plan only):**
1. For the 3–4 heaviest tables (Stock Ledger, Billing ledger, Purchase Costing item lines, Product report), add a `@media (max-width: 720px)` card-view fallback that re-renders each row as a stacked label/value card (a common pattern: hide `<thead>`, turn `<td>` into block rows with a `data-label` pseudo-element).
2. Where a full card rebuild isn't justified, at minimum pin the first column (`position: sticky; left: 0`) so the user retains context (e.g. product name) while scrolling horizontally.
3. Re-evaluate `.purchase-item-line`'s `min-width: 1185px` — consider collapsing secondary columns (tax/discount/notes) into an expandable row on narrow screens instead of a fixed 10-column grid.

---

## 6. Forms

**Files:** `styles.css` (`.form-grid`, `.purchase-quick-add-panel .quick-add-grid`, module-specific grids), all six section files

**Priority: Medium**

- The shared `.form-grid` collapses correctly: `repeat(2, minmax(0,1fr))` → `1fr` at 820px (and the later "universal workspace restructure" rules force single-column even earlier on non-overview modules). This is solid for 360–412px.
- However several **module-specific** grids only collapse to single column at 820px, with no intermediate phone-specific tuning: `.billing-sale-top-grid`, `.billing-discount-grid`, `.purchase-costing-grid`, `.purchase-costing-item-grid`, `.product-master-row` / `.product-master-row-stock` (collapses to 2-col at 1080px, 1-col only at 720px). On a 360px screen these all do end up single-column (since 360 < 720), so functionally they work — but they pass through an awkward 2-column phase on larger phones/phablets (390–412px is still under 720px so it's fine; 768px tablets sit between 720 and 820, so `.product-master-row` is briefly 2-column there, which is acceptable).
- `.purchase-quick-add-panel .quick-add-grid { grid-template-columns: repeat(auto-fit, minmax(160px,1fr)) }` has no explicit narrow-width override — at 360px, `minmax(160px,1fr)` will still likely produce a single column (360px ÷ 160px ≈ 2.25, so it could render 2 columns of ~170px each, which is workable but tight for inputs with labels).

**Fix direction:** spot-check `.quick-add-grid` at 360–390px and, if it renders 2 cramped columns, add `grid-template-columns: 1fr` under the existing `@media (max-width: 640px)` block.

---

## 7. Buttons / touch targets

**Files:** `styles.css` global button/input rules (lines ~163, ~226, ~1369, ~1377, ~1486, ~1578, ~2789, ~2878, ~3446, ~3835)

**Priority: High**

Apple/Google/W3C guidance recommends a minimum touch target of **44×44px**. Current sizes fall short in most interactive contexts:

| Element | Current `min-height` | Recommended | Where |
|---|---|---|---|
| Global `button` | 36px | 44px | line 163 |
| Global `input/select/textarea` | 38px | 44px | line 226 |
| `.sidebar-toggle` | 32px | 44px | line 2789 |
| `.sidebar.sidebar-collapsed button.sidebar-item` | 38px | 44px | line 2878 |
| `.data-table .lead-actions button` (table action buttons) | 28px | 44px | line 3446 |
| `.purchase-item-line input/select`, `.purchase-inline-btn` | 34px | 44px | line 3835 |
| `.lead-actions button` (older rule) | 30px | 44px | line 1578 |

A few elements already meet the bar (`.purchase-tier-note`, `.checkbox-row` at 44px — lines 1908, 2444), proving the design system supports it; it's just inconsistently applied.

**Fix direction:** raise the global `button` and `input/select/textarea` baselines to 44px (this alone fixes the majority of forms and primary actions), and bump the table-action and inline-purchase-row buttons specifically — those are the densest, most-tapped controls on a phone. Because `.data-table` rows are already tight (compact font sizes), increasing button height there may require slightly more row padding; budget for that as a secondary CSS tweak.

---

## 8. Screen-size-specific findings (360 / 390 / 412 / 768)

**Priority: Medium**

- **No breakpoint exists below 640px.** The narrowest query in the whole stylesheet is `@media (max-width: 640px)`. 360px, 390px, and 412px phones all land inside that single bucket alongside larger phones (e.g. 428px+ devices) — there is no further tuning for the *narrowest* common Android widths (360–390px). In practice this mostly "just works" because most rules already collapse to `1fr`/full-width by 640px, but a few elements (the header greeting line, `.quick-add-grid`, `.purchase-item-line`'s horizontal-scroll minimum width, and table font sizes) would benefit from an explicit `@media (max-width: 400px)` pass.
- **768px (tablet)** sits in an odd middle zone: it's below the 820px breakpoint (so single-column module layouts and stacked filter bars are already active) but above 720px (so `.pipeline-board`, `.purchase-item-line`, and a few grids are still in their "tablet" 2-column/scroll states). This is a reasonable, intentional tablet experience — no changes recommended for 768px specifically beyond what's already noted for tables and touch targets.
- **412px (e.g. Pixel-class devices)** behaves identically to 390/360 under the current rules — same 640px bucket — so the same fixes apply uniformly; no device-specific anomaly found.

---

## Summary table

| # | Area | Priority | Files to change |
|---|---|---|---|
| 1 | Sidebar drawer nav direction conflict | **High** | `frontend/src/styles.css` (add `.sidebar.sidebar-drawer .sidebar-nav` override; remove/scope the line-2277 `.sidebar-nav { flex-direction: row }` rule) |
| 2 | Dead `.app-layout-mobile` class | Medium | `frontend/src/App.jsx` (remove class or implement rule in `styles.css`) |
| 3 | Header wrap/stack on narrow phones | Medium | `frontend/src/styles.css` (`.topbar-compact` narrow-width rules), `frontend/src/components/AppHeader.jsx` (optionally shorten greeting on small screens) |
| 4 | Dashboard cards | Low | none — already responsive |
| 5 | Tables: no card-view fallback, horizontal-scroll only | **High** | `frontend/src/styles.css` (`.data-table`, `.table-shell`, `.purchase-item-line`); affects `App.jsx` + all 6 section files |
| 6 | Module-specific form grids (Billing/Purchase Costing/Product Master) | Medium | `frontend/src/styles.css` (`.billing-sale-top-grid`, `.purchase-costing-grid`, `.product-master-row`, `.quick-add-grid`) |
| 7 | Touch target sizes below 44px | **High** | `frontend/src/styles.css` (global `button`, `input/select/textarea`, `.sidebar-toggle`, `.lead-actions button`, `.data-table .lead-actions button`, `.purchase-item-line input/select`, `.purchase-inline-btn`) |
| 8 | No breakpoint below 640px | Medium | `frontend/src/styles.css` (add `@media (max-width: 400px)` pass for header, quick-add grid, table font sizes) |

---

## Safe implementation plan (suggested order — no code changed yet)

1. **Fix #1 first** (sidebar drawer nav conflict) — it's a single, scoped CSS addition (`.sidebar.sidebar-drawer .sidebar-nav { flex-direction: column; flex-wrap: nowrap; }`) with no risk to desktop/tablet styling, and it resolves the most visibly "broken" mobile experience (the hamburger menu).
2. **Raise touch targets globally** (#7) — change the four global baselines (`button`, `input/select/textarea` to 44px; `.lead-actions button` and `.data-table .lead-actions button` to 40–44px). This is additive (increasing `min-height`) and very low-risk to break desktop layouts; verify table row heights still look right afterward.
3. **Clean up dead code** (#2) — either delete the `app-layout-mobile` class reference in `App.jsx` or add the rule; trivial, zero behavioral risk either way.
4. **Add the sub-640px breakpoint pass** (#8) — bundle the header-stacking fix (#3) and `.quick-add-grid` single-column fix (#6) into one new `@media (max-width: 400px)` block so all narrow-phone tuning lives in one place and is easy to test/revert as a unit.
5. **Tackle tables last** (#5) — this is the largest change (card-view fallback for 3–4 tables) and should be scoped to one module at a time (start with Stock Ledger, since it already has the most mobile-aware CSS scaffolding in place), tested at 360/390/412px, then rolled out to Billing, Purchase Costing, and the Product report table.

Each step above is independently testable and revertible — recommend doing them as separate commits/PRs in the order listed, verifying at 360px, 390px, 412px, and 768px after each one using the browser's responsive device toolbar (no `npm run build` needed for CSS-only changes; Vite's dev server hot-reloads).

---

*No files were modified as part of this audit. All line numbers reference the current state of `frontend/src/styles.css` and `frontend/src/App.jsx` at the time of review.*
