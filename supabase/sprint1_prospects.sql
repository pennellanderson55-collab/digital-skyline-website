-- ============================================================================
-- Digital Skyline OS — Sprint 1: Outreach CRM foundation
-- Run ONCE after the existing schema.sql + admin.sql + ops.sql:
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds the `prospects` table (the heart of the Outreach CRM). Existing tables
-- (consultations, clients, projects, support_requests) are untouched.
-- Idempotent: safe to run multiple times. Does NOT delete or modify any data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- PROSPECTS — outbound sales leads (manually added now; enriched in Sprint 2).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.prospects (
  id              uuid primary key default gen_random_uuid(),

  -- Business
  business_name   text not null,
  owner_name      text,
  industry        text,
  source          text,

  -- Contact
  phone           text,
  email           text,
  website         text,

  -- Location
  address         text,
  city            text,
  state           text,

  -- Signals (used to prioritise outreach)
  google_reviews  integer,
  google_rating   numeric(2,1),
  website_score   integer,

  -- Pipeline
  status          text not null default 'New',
  notes           text,
  last_contacted  timestamptz,
  next_follow_up  date,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint prospects_status_check check (
    status in ('New','Contacted','Follow-up','Consultation','Proposal','Client','Lost')
  ),
  constraint prospects_rating_check check (
    google_rating is null or (google_rating >= 0 and google_rating <= 5)
  ),
  constraint prospects_reviews_check check (
    google_reviews is null or google_reviews >= 0
  ),
  constraint prospects_score_check check (
    website_score is null or (website_score >= 0 and website_score <= 100)
  )
);

-- ─────────────────────────────────────────────────────────────────────────
-- Indexes — keep sort / filter / pagination fast as the table grows.
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists prospects_status_idx         on public.prospects(status);
create index if not exists prospects_industry_idx       on public.prospects(industry);
create index if not exists prospects_created_at_idx      on public.prospects(created_at desc);
create index if not exists prospects_next_follow_up_idx  on public.prospects(next_follow_up);
create index if not exists prospects_website_score_idx   on public.prospects(website_score);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at — keep it current on every UPDATE (reusable across OS tables).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prospects_set_updated_at on public.prospects;
create trigger prospects_set_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — matches the rest of the app:
--   authenticated admins get full access; anon gets nothing (outbound CRM
--   data is internal-only, unlike the public consultation/support inserts).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.prospects enable row level security;

drop policy if exists "auth full access" on public.prospects;
create policy "auth full access"
  on public.prospects
  for all
  to authenticated
  using (true)
  with check (true);
