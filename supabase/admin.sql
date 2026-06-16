-- Digital Skyline Co. — admin dashboard access
-- Run this ONCE after schema.sql: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.

-- 1. Internal notes column (private to you — never collected from visitors).
alter table public.consultations add column if not exists admin_notes text;

-- 2. Logged-in admins can read every booking (the public anon key still cannot).
drop policy if exists "authenticated can read bookings" on public.consultations;
create policy "authenticated can read bookings"
  on public.consultations
  for select
  to authenticated
  using (true);

-- 3. Logged-in admins can update bookings (change status, add internal notes).
drop policy if exists "authenticated can update bookings" on public.consultations;
create policy "authenticated can update bookings"
  on public.consultations
  for update
  to authenticated
  using (true)
  with check (true);
