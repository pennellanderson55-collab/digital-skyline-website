# Digital Skyline Co. — Supabase Backend Audit

**Date:** 2026-06-25
**Scope:** Supabase usage (queries, connections, storage, DB size, edge/API routes) for the Vite + React site.
**Rule followed:** No production data deleted. No live-site behavior changed. This is a report + safe, ready-to-run diagnostics.

---

## 0. Important access caveat (read first)

This repo only contains the **anon public key** (`sb_pub…`), which is gated by Row Level Security — it cannot read your tables, storage, or system catalogs. There is **no service-role key, no Supabase CLI, and no MCP connection** available in this environment.

That means I **cannot pull live numbers** (DB size, row counts, storage bytes) from here. To get the actual "before/after" figures, run **`supabase/audit_diagnostics.sql`** (created alongside this report) in the Supabase Dashboard → SQL Editor. It is 100% read-only. I've structured this report so you can paste those numbers straight into the tables below.

What I *can* do with full confidence is audit the **code** — every query, connection pattern, background job, storage call, and API route — and that's where the surprising-good-news lives.

---

## 1. Executive summary

| Area | Verdict |
|------|---------|
| Queries pulling too much data | **Low risk.** `select('*')` exists only in the admin dashboard (single-user). The schema has **no large/blob columns and no unused columns** — admin genuinely uses nearly every field — so column-scoping would add brittleness for ~0 byte savings. Real concern is *pagination as rows grow* (recommendation below). |
| N+1 query patterns | **None found.** Admin already uses a single join (`projects … client:clients(*)`) and loads stage history in one query. |
| Connection usage / background jobs | **Clean.** No realtime subscriptions, no `.channel()`, no polling intervals hitting the DB, no cron, no Supabase Edge Functions. supabase-js is stateless HTTP (PostgREST) — nothing holds a connection open. |
| Supabase Storage | **In use, but only 2 objects.** The Portfolio section loads `Portfolio/Knightsoul2.png` + `Portfolio/KnightSoulCompressed.mp4` via hardcoded public URLs (not the `.storage` API). **Every other object in the `Portfolio` bucket — or any other bucket — is orphaned.** (See §5.) |
| Database size | **Cannot measure from here** — run the diagnostics SQL. Schema is small and well-indexed; growth risk is just leads/support accumulating over time. |
| Edge functions / API routes | One route only: `/api/send-email` (Resend). Fires only on form submit/conversion — **not over-running**. No Supabase functions. |
| **Biggest actual waste found** | **~180 MB of orphaned/duplicate media in `public/`** (Vercel static hosting, *not* Supabase). Concrete list in §5. |

**Bottom line:** Your Supabase backend is already lean and correctly architected for a low-traffic agency site. There is no runaway query, leaked connection, or hidden job draining your project. The cleanup wins are (a) orphaned media files and (b) archiving old/test rows once you confirm them via the diagnostics.

---

## 2. Goal 1 — Queries pulling more data than the UI needs

### Public site (high traffic) — already optimal ✅
| Where | Query | Assessment |
|-------|-------|------------|
| `Consultation.jsx:129` | `rpc('booked_times', { d })` | Returns **only the `time` column** for one date via a `security definer` function — no PII, tiny payload. Ideal. |
| `Consultation.jsx:204` | `insert(row)` | Single write on submit. |
| `Support.jsx:102` | `insert({…})` | Single write on submit. |
| `ClientPortal.jsx` | **none** | The payment page makes **no Supabase calls** — it redirects to a Stripe Payment Link. |
| `Status.jsx`, all other public pages | **none** | No Supabase, no polling. |

### Admin dashboard (single user) — `select('*')`, but low impact
`Admin.jsx` `load()` runs four full-table reads on open/refresh:
```
consultations          select('*')                 order created_at desc
projects               select('*, client:clients(*)') order created_at desc
support_requests       select('*')                 order created_at desc
project_stage_history  select('*')                 order changed_at desc
```
**Why I did *not* rewrite these to column lists:** I inventoried every field the admin components touch (`Clients/Projects/ProjectProfile/Support/DetailModal/Home/Analytics`). They use **nearly every column** of each table, and the schema has **no wide columns** (no JSON blobs, no large text beyond notes). So `select('*')` → explicit columns would shrink payloads by a negligible amount while creating a maintenance trap (add a column → forget to add it to 4 query strings → silent UI breakage). That trade-off fails the "don't break the site" test.

**The real growth risk is row count, not columns.** Every admin load pulls *all* consultations + *all* stage history with no `limit`. Today that's fine; at thousands of leads it's wasteful. See recommendations in §8 (pagination) — offered, not imposed, because a naive `limit` could hide leads from you.

---

## 3. Goal 2 — N+1 query patterns

**None.** Specifically checked:
- Clients/Projects are loaded via a **single embedded join** (`projects … client:clients(*)`) — not one query per project.
- Stage history is one query, filtered **client-side** per project (`history.filter(...)`) — not re-fetched per project open.
- The "Convert to Client" flow (`Admin.jsx:233`) runs sequential **writes** (rpc → insert client → insert project → insert history → update consultation). That's a logical transaction, not an N+1 read loop, and runs only on a manual button click. *(Optional hardening: wrap it in a Postgres RPC so a mid-sequence failure can't leave a half-created client. Not a usage issue.)*

---

## 4. Goal 3 — Connections & background jobs

| Checked for | Result |
|-------------|--------|
| Realtime listeners (`.channel`, `.subscribe`, `.on('postgres_changes')`) | **None** |
| Polling intervals hitting Supabase | **None.** The only `setInterval` (`LiveStatus.jsx:21`) is a 1-second UI clock — no DB. All other timers are `requestAnimationFrame` canvas animations. |
| Auth listeners | One: `onAuthStateChange` (`Admin.jsx:66`), and it is **properly cleaned up** (`sub.subscription.unsubscribe()` on unmount). Correct. |
| Cron jobs / scheduled tasks | **None** |
| Supabase Edge Functions | **None** (`supabase/functions/` does not exist) |
| Long-lived connections | **N/A** — supabase-js calls PostgREST over stateless HTTP; there's no client-held DB connection to leak. |

No connection cleanup work is needed. Nothing is keeping connections open.

---

## 5. Goal 4 — Storage audit

### Supabase Storage: used for the Portfolio section — exactly 2 objects
There are no `.storage` API calls (upload/download/getPublicUrl/signed-URL). Instead, `src/components/Portfolio.jsx` references Storage objects by **hardcoded public URL** from the `Portfolio` bucket on project `bjfuopeqaodksjkhrqda`. The **only objects the app uses** are:

| Used object (do NOT delete) | Where |
|---|---|
| `Portfolio/Knightsoul2.png` | Portfolio item 1 (Legacy Quest image) + item 2 poster |
| `Portfolio/KnightSoulCompressed.mp4` | Portfolio item 2 (KnightSoul video) |

➡️ **Action:** Run section **7** of `audit_diagnostics.sql` to list all objects. **Any object in `Portfolio` that is NOT one of the two above — and any object in any other bucket — is orphaned** (the app links to nothing else). These commonly accumulate from re-uploads/old portfolio pieces. Review in Dashboard → Storage and **do not auto-delete** — eyeball first, then remove the confirmed orphans there. (Storage cleanup is done in the Dashboard, not via this app.)

### Where your media actually lives: `public/` (Vercel static) — and it's bloated
All site media is served as Vite/Vercel static assets from `public/` (~**339 MB**). I cross-referenced every file against actual references in `src/` + `index.html`. The following are **orphaned (not referenced anywhere)** — many are case/space-duplicate copies of files that *are* used:

| Size | Orphaned file | Note |
|------|---------------|------|
| 77 MB | `Fario .mov` | duplicate of used `fario.mov` |
| 26 MB | `color-graded.png` | unreferenced |
| 18 MB | `hf_20260430_001228_…0747dbac….png` | unreferenced |
| 18 MB | `DS City.mp4` | duplicate of used `ds-city.mp4` |
| 17 MB | `DS City1.mp4` | duplicate of used `ds-city-1.mp4` |
| 7.6 MB | `offical1 .png` | unreferenced |
| 5.8 MB | `Fario1.png` | duplicate of used `fario.png` |
| 4.9 MB | `Hayes Properties DashBaord.mov` | duplicate of used `hayes-dashboard.mov` |
| 2.9 MB | `Screenshot 2026-02-23 at 8.44.17 PM.png` | stray screenshot |
| 1.4 MB | `favicon-512.png` | `index.html` uses `/logo.png` for icons |
| 1.4 MB | `ChatGPT Image Apr 28, 2026 at 03_37_32 PM.png` | stray export |
| 1.2 MB | `hf_20260430_001436_…1b737ac9….png` | unreferenced |
| 540 KB | `Hayes Properties DashBaord2.png` | unreferenced |
| 40 KB | `apple-touch-icon.png` | `index.html` uses `/logo.png` |
| 4 KB | `favicon-32.png` | unused |
| 4 KB | `favicon-16.png` | unused |

**≈ 180 MB removable** from the deployed bundle. This shrinks every Vercel deploy and speeds cold loads. It is *not* Supabase, but it's the single largest "unnecessary usage" in the project, so it's worth doing.

> Verify-and-delete command (lists first, deletes nothing until you approve) is in §9.

> Note: `dist/` (342 MB) is the local build output — already gitignored and regenerated by Vercel. Safe to `rm -rf dist` locally anytime; not deployed from the repo.

---

## 6. Goal 5 — Database size audit

**Requires the diagnostics SQL (§2, §6 of that file) — I cannot read sizes with the anon key.** What the schema tells me:

- **Indexes are reasonable, not excessive:** `projects(client_id)`, `projects(stage)`, `project_stage_history(project_id)`, plus PK/unique constraints. Section 6 of the diagnostics flags any with `idx_scan = 0` so you can drop genuinely unused ones. *(Keep all PKs and the `consultations(date,time)` + `projects(project_reference)` unique constraints regardless.)*
- **No obvious duplicate-data design.** Section 5 of the diagnostics surfaces *runtime* duplicates/orphans (duplicate bookings, clients with no project, dangling stage-history, converted-but-clientless consultations).
- **Test/old data** is the likely bloat source over time. Sections 4a–4c list test-looking and stale rows **for your review** — nothing is deleted.
- **Missing index worth considering:** `consultations` is always ordered by `created_at desc` but has no index on it. Negligible now; add `create index on public.consultations(created_at desc);` only if that table grows large.

Fill this in after running the diagnostics:

| Metric | Before | After |
|--------|--------|-------|
| Total DB size | _run §1_ | |
| consultations rows | _run §3_ | |
| support_requests rows | | |
| Largest table | _run §2_ | |
| Unused indexes (idx_scan=0) | _run §6_ | |
| Storage objects / bytes | _run §7_ | |

---

## 7. Goal 6 — Edge functions / API routes

| Route | Trigger frequency | Notes |
|-------|-------------------|-------|
| `api/send-email.js` (Vercel serverless, Resend) | **Only** on consultation submit, support submit, and admin "Convert to Client" | Sends 2 messages per call (client confirmation + internal notify) via `Promise.allSettled`. Best-effort, never blocks forms. Has a hard guard requiring a `digitalskylineco.com` From address. **Not over-running.** |
| Supabase Edge Functions | — | **None exist.** |

The current diagnostic `console.log`/`console.error` lines in `send-email.js` (added per recent commits) log request type and recipients to Vercel logs. Harmless, but once email delivery is confirmed stable you may want to trim the verbose `[send-email] sending:` recipient log to avoid logging addresses long-term. Not urgent.

- **Consultation form:** efficient (1 RPC on date pick + 1 insert).
- **Support form:** efficient (1 insert, best-effort).
- **Admin queries:** §2.
- **Client portal:** no backend calls — pure Stripe redirect.

---

## 8. Recommendations (nothing applied — awaiting your go-ahead)

**Safe, non-breaking, real benefit:**
1. **Delete orphaned `public/` media** (~180 MB). Verify-first command in §9. *(Biggest win.)*
2. **Run `audit_diagnostics.sql`** to capture before-numbers and confirm storage/orphans.
3. **Parallelize the 4 admin `load()` queries** with `Promise.all` — ~4× faster admin open, identical data/usage. Pure latency win, zero risk. *(I can do this on request.)*

**Do only after reviewing diagnostics output:**
4. **Archive then delete** confirmed test consultations / stale Closed-Lost leads / old resolved support tickets — export to CSV first (backup plan in §9).
5. **Clean runtime orphans** flagged by diagnostics §5 (dangling clients/history). Tiny row counts; low priority.
6. **Drop any `idx_scan = 0` index** (excluding PK/unique). Only if diagnostics show one.

**Larger feature work (optional, not usage-critical):**
7. **Pagination** for the admin consultations list + stage history once those tables get large (e.g. `.range()` + "Load more"). Deferred deliberately — a naive `limit` could hide leads from you, so this needs real UI, not a one-liner.
8. **Wrap "Convert to Client" in a Postgres RPC/transaction** so a partial failure can't leave a half-created client.

---

## 9. Backup plan & destructive-change safety (before deleting ANYTHING)

**Database (run before any row deletion):**
- In Dashboard → **Database → Backups**, confirm daily backups are on (or take a manual one / `pg_dump`).
- Export the specific rows you intend to remove to CSV first, e.g.:
  ```sql
  -- Preview EXACTLY what would be deleted (SELECT only — run this first):
  select * from public.consultations
  where status = 'Closed Lost' and created_at < now() - interval '12 months';
  ```
  Use the SQL Editor's "Download CSV" on that result = your archive. **Only then** would a matching `delete` be run, and only with your explicit approval. **No deletes are in this audit.**

**Orphaned media (verify-first; deletes nothing until you confirm):**
```bash
cd "digital-skyline website06:11"
# 1) LIST orphans only (safe, prints names + sizes):
for f in "Fario .mov" "color-graded.png" "hf_20260430_001228_0747dbac-ad43-4391-b2d6-8bbc66c47fb6.png" \
  "DS City.mp4" "DS City1.mp4" "offical1 .png" "Fario1.png" "Hayes Properties DashBaord.mov" \
  "Screenshot 2026-02-23 at 8.44.17 PM.png" "favicon-512.png" "ChatGPT Image Apr 28, 2026 at 03_37_32 PM.png" \
  "hf_20260430_001436_1b737ac9-b0a5-460e-ae16-9fdbd30196f2.png" "Hayes Properties DashBaord2.png" \
  "apple-touch-icon.png" "favicon-32.png" "favicon-16.png"; do
    [ -e "public/$f" ] && du -h "public/$f"
done
# 2) After you confirm, deploy to a preview first, check the site renders,
#    THEN delete and redeploy. (I can do step 2 on your approval.)
```

---

## 10. Post-change test checklist (run after any change)

1. **Public site** loads (`/`), all referenced videos/images still render (esp. `fario.mov`, `ds-city*.mp4`, `hayes-dashboard.*`, `orb-header.png`, `logo.png`).
2. **Consultation form:** pick a date (availability loads), submit a test booking → confirmed page → row appears in admin → delete the test row.
3. **Support form:** submit → appears in admin Support tab.
4. **Admin dashboard:** login, all 7 tabs load, convert a test lead, then revert it.
5. **Email:** test booking triggers client + internal email (check Resend/Vercel logs).
6. **Stripe / client portal:** "Proceed to Secure Payment" redirects (or shows the fallback notice if no link configured).

---

## 11. Before / after summary (fill after applying)

| Metric | Before | After | Source |
|--------|--------|-------|--------|
| Supabase DB size | _diagnostics §1_ | | SQL |
| Largest table | _diagnostics §2_ | | SQL |
| Test/stale rows removed | 0 | | your review |
| Unused indexes dropped | 0 | | diagnostics §6 |
| Supabase Storage objects | _diagnostics §7_ | | SQL |
| `public/` media size | 339 MB | ~160 MB (−180) | filesystem |
| Realtime/cron/leaked connections | 0 | 0 | code audit |
| N+1 patterns | 0 | 0 | code audit |

### Still risky / watch-list
- **Admin loads all rows unbounded** — fine now, add pagination before tables get large (§8.7).
- **Convert-to-Client is multi-step without a transaction** — small risk of partial records on failure (§8.8).
- **Manual storage uploads**, if any exist, are invisible to the app — confirm via diagnostics §7 and manage in the Dashboard.
