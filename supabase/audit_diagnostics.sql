-- ============================================================================
-- Digital Skyline Co. — Supabase Audit Diagnostics (READ-ONLY / NON-DESTRUCTIVE)
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste a section → Run.
-- NOTHING here deletes, updates, or alters data. It only MEASURES and REPORTS.
-- Use it to capture the "before" numbers, and again later for "after".
--
-- The app's anon public key cannot read these tables (RLS), so these queries
-- must be run from the SQL Editor (which runs as a privileged role).
-- ============================================================================


-- ── 1. TOTAL DATABASE SIZE ──────────────────────────────────────────────────
select pg_size_pretty(pg_database_size(current_database())) as total_db_size;


-- ── 2. SIZE OF EVERY TABLE (largest first) ──────────────────────────────────
--    total_size = table + indexes + TOAST.  Spot the heavy tables here.
select
  n.nspname                                   as schema,
  c.relname                                   as table,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid))       as table_only,
  pg_size_pretty(pg_indexes_size(c.oid))        as indexes_size,
  c.reltuples::bigint                           as approx_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_total_relation_size(c.oid) desc;


-- ── 3. EXACT ROW COUNTS for the app tables ──────────────────────────────────
select 'consultations'        as tbl, count(*) from public.consultations
union all select 'clients',               count(*) from public.clients
union all select 'projects',              count(*) from public.projects
union all select 'support_requests',      count(*) from public.support_requests
union all select 'project_stage_history', count(*) from public.project_stage_history
order by 1;


-- ── 4. PRODUCTION vs TEST/STALE DATA (review before deciding anything) ───────
-- 4a. Consultations that look like test entries (name/email/business hints).
--     REVIEW the output — do NOT assume. Adjust the pattern to your real tests.
select id, created_at, name, email, business, status, converted
from public.consultations
where email ilike '%test%' or email ilike '%example.com'
   or name  ilike '%test%' or business ilike '%test%'
   or email ilike '%@mailinator%' or email ilike '%+test%'
order by created_at;

-- 4b. Very old, never-converted, dead leads (Closed Lost, untouched > 1 year).
--     These are candidates to ARCHIVE (export) — not auto-delete.
select id, created_at, name, email, status
from public.consultations
where status = 'Closed Lost'
  and created_at < now() - interval '12 months'
order by created_at;

-- 4c. Support requests resolved/closed and older than 6 months (archive candidates).
select id, created_at, email, support_type, status
from public.support_requests
where status in ('Resolved', 'Closed')
  and created_at < now() - interval '6 months'
order by created_at;


-- ── 5. INTEGRITY / ORPHAN CHECKS (data that points at nothing) ───────────────
-- 5a. Clients with no project (e.g. left behind by an aborted conversion).
select c.id, c.created_at, c.company_name, c.email
from public.clients c
left join public.projects p on p.client_id = c.id
where p.id is null
order by c.created_at;

-- 5b. Stage-history rows whose project no longer exists (should cascade-delete,
--     so a non-empty result means leftovers worth cleaning).
select h.id, h.project_reference, h.stage, h.changed_at
from public.project_stage_history h
left join public.projects p on p.id = h.project_id
where p.id is null;

-- 5c. Consultations flagged converted but pointing at a missing client.
select id, created_at, name, email, client_id, project_reference
from public.consultations
where converted = true
  and client_id is not null
  and client_id not in (select id from public.clients);

-- 5d. Duplicate consultation submissions (same email + same slot).
select email, date, time, count(*)
from public.consultations
group by email, date, time
having count(*) > 1;


-- ── 6. INDEX USAGE (find unused indexes you are paying to maintain) ──────────
--    idx_scan = 0 over a long uptime ⇒ candidate to DROP. Primary-key and the
--    unique constraints (project_reference, date+time slot) must stay regardless.
select
  s.relname              as table,
  s.indexrelname         as index,
  s.idx_scan             as times_used,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
from pg_stat_user_indexes s
order by s.idx_scan asc, pg_relation_size(s.indexrelid) desc;


-- ── 7. STORAGE — buckets & objects ───────────────────────────────────────────
--    The app references EXACTLY TWO storage objects (by hardcoded public URL in
--    Portfolio.jsx), both in the `Portfolio` bucket:
--        Portfolio/Knightsoul2.png
--        Portfolio/KnightSoulCompressed.mp4
--    Everything else in storage is ORPHANED relative to the app code.
--    Review in Dashboard → Storage before removing anything. Do not auto-delete.

-- 7a. Buckets overview.
select id, name, public, created_at from storage.buckets order by created_at;

-- 7b. Object count + size per bucket.
select
  bucket_id,
  count(*)                                   as objects,
  pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total_size
from storage.objects
group by bucket_id
order by 3 desc;

-- 7c. ORPHAN CANDIDATES: every object that the app does NOT reference.
--     (Keeps only the two used objects out of the result.) Review, then delete
--     the confirmed-unused ones in Dashboard → Storage.
select
  bucket_id,
  name,
  pg_size_pretty((metadata->>'size')::bigint) as size,
  created_at
from storage.objects
where not (bucket_id = 'Portfolio'
           and name in ('Knightsoul2.png', 'KnightSoulCompressed.mp4'))
order by (metadata->>'size')::bigint desc nulls last;


-- ── 8. AUTH USERS (admin accounts — should be a tiny, known set) ─────────────
select id, email, created_at, last_sign_in_at
from auth.users
order by created_at;
