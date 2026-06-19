-- ============================================================================
-- FIX: anonymous consultation bookings rejected with HTTP 403 (Postgres 42501).
--
-- Root cause is the anon INSERT authorization path on public.consultations —
-- a missing/altered RLS policy, a missing table GRANT, or a dropped status
-- default (so the WITH CHECK on status = 'New' fails). This repairs all three.
-- Idempotent: safe to run multiple times. Does NOT touch any data.
--   Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- ============================================================================

-- 1. RLS must be ON (and not FORCED, which would also block the table owner).
alter table public.consultations enable row level security;
alter table public.consultations no force row level security;

-- 2. The omitted `status` must default to 'New' so the policy's WITH CHECK passes.
alter table public.consultations alter column status set default 'New';

-- 3. RLS evaluates ON TOP of table privileges — anon needs INSERT on the table.
grant insert on table public.consultations to anon;

-- 4. Recreate the anon INSERT policy (locked to brand-new leads only).
drop policy if exists "anon can insert bookings" on public.consultations;
create policy "anon can insert bookings"
  on public.consultations
  for insert
  to anon
  with check (status = 'New');

-- ── Verify (optional) ───────────────────────────────────────────────────────
-- SELECT policyname, cmd, roles, with_check
--   FROM pg_policies WHERE tablename = 'consultations' AND cmd = 'INSERT';
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'consultations' AND grantee = 'anon';
