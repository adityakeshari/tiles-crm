# Staff Checklist Mockup — Microsoft To Do Style (v2)

No code changes yet. This is a visual description for review before I touch `DailyTasksSection.jsx` / `styles.css` again.

## What's wrong with v1
The current build still reads as a **card**: rounded container, border, padding box, internal "section" feel, and visible action buttons (Hold / Remark) sitting in the row. That's CRM-card DNA carried over. Microsoft To Do has none of that — it's a **flat list of plain rows separated by hairline dividers**, no card chrome at all.

## Target look — Microsoft To Do anatomy

```
┌──────────────────────────────────────────────┐
│  ○   Call vendor about tile delivery          │
│      Due 2:00 PM  ·  ●High                    │
├──────────────────────────────────────────────┤
│  ○   Update stock count for showroom A        │
│      Due 5:00 PM  ·  ●Normal                  │
├──────────────────────────────────────────────┤
│  ◉   Send invoice to Mehta Constructions   ✓  │  ← completed: dimmed, strikethrough
│      Completed 11:40 AM                       │
├──────────────────────────────────────────────┤
│  ○   Restock floor samples                    │
│      Overdue  ·  ●Critical                    │
└──────────────────────────────────────────────┘
```

Row anatomy, left to right:
1. **Circle checkbox** — large (44px tap target on mobile), the dominant visual element, sits on its own with generous whitespace. This IS the primary action. Tapping it = complete. Nothing else competes with it for attention.
2. **Title** — single line, normal weight, truncates with ellipsis. Becomes dimmed + strikethrough once checked.
3. **Subtext line** — small, muted, one line: due time, separated by a thin middle-dot from a small priority dot/word (not a loud colored chip).
4. **Status flags** (Overdue / On hold) fold into that same subtext line as plain colored words — not boxed badges.

No card border. No rounded container per task. No background fill per row (maybe a faint hover/press tint only). Just a **1px hairline divider** between rows, full-bleed left to right.

## Mobile (primary target)

- **No Hold / Remark buttons visible in the row.** Per your note — no edit/delete-style controls on mobile.
- Tapping anywhere on the row body (not the checkbox) opens a **detail sheet/drawer** — that's where Hold, Remark, description, and all metadata (Task ID, source, dates, verification) live.
- Checkbox stays the one-tap primary action directly in the list.
- This matches To Do's pattern: list = glanceable + checkable; tapping a task opens the detail pane for everything else.

## Desktop

- Same flat-row list, just wider — title gets more room, subtext can sit inline to the right instead of wrapping.
- On hover, Hold / Remark can appear as quiet text-links at the row's right edge (revealed on hover only, not permanently visible) — or also deferred to the detail panel, your call.
- Detail panel can open as a side panel instead of a bottom sheet.

## Hidden everywhere by default (unchanged from your original spec)
Task ID, source, created/updated dates, verification info — all tucked inside the detail view, never in the row.

## Open questions before I build this
1. **Hold / Remark on desktop** — quiet hover-links in the row, or also pushed into the detail panel like mobile?
2. **Detail view mechanism** — bottom sheet/drawer on mobile + side panel on desktop, or reuse the existing `<details>` expand-in-place (which is closer to what v1 did, but less "To Do"-like)?
3. **Priority indicator** — a small colored dot + word ("●High"), or a colored vertical accent on the row, or a star icon (To Do uses a star for "Important")?

Tell me your preference on these three and I'll build it to match exactly.
