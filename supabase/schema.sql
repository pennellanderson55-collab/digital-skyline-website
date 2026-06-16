-- Digital Skyline Co. — consultation bookings
-- Run this once: Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.

-- 1. Required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- 2. Bookings table
create table if not exists public.consultations (
  id                uuid primary key default gen_random_uuid(),
  date              date not null,
  time              text not null,
  name              text not null,
  email             text not null,
  phone             text,
  business          text not null,
  project_type      text,
  challenge         text not null,
  challenge_other   text,
  success_outcome   text not null,
  current_systems   text[] not null default '{}',
  budget            text not null,
  heard_about       text not null,
  heard_about_other text,
  notes             text,
  status            text not null default 'New',
  created_at        timestamptz not null default now(),
  constraint consultations_unique_slot unique (date, time),
  constraint consultations_status_check check (
    status in (
      'New',
      'Contacted',
      'Consultation Scheduled',
      'Proposal Sent',
      'Closed Won',
      'Closed Lost'
    )
  )
);

-- 3. Enable Row Level Security
alter table public.consultations enable row level security;

-- 4. Allow anonymous visitors to create a booking (status locked to default 'New').
drop policy if exists "anon can insert bookings" on public.consultations;
create policy "anon can insert bookings"
  on public.consultations
  for insert
  to anon
  with check (status = 'New');

-- 5. Availability lookup: returns only the booked times for a date (no PII exposed).
create or replace function public.booked_times(d date)
returns setof text
language sql
security definer
set search_path = public
as $$
  select time from public.consultations where date = d;
$$;

-- 6. Let anonymous visitors run the availability lookup.
grant execute on function public.booked_times(date) to anon;
