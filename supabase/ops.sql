-- ============================================================================
-- Digital Skyline Co. — Phase 2 Internal Operations System
-- Run this ONCE after schema.sql + admin.sql:
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds: clients, projects, support_requests, project_stage_history.
-- The Project Reference (DS-YYYY-NNN) is the master identifier that connects
-- a client to their project, payments, support tickets, notes and timeline.
-- Existing consultation / lead / analytics tables are untouched.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CLIENTS — company / contact record (created on "Convert To Client")
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete set null,
  company_name    text,
  contact_name    text,
  email           text,
  phone           text,
  website_url     text,
  industry        text,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. PROJECTS — one project per engagement, keyed by the Project Reference.
--    Carries stage, payments, team assignments and Stripe fields.
--    (clients 1 ── * projects, so a client can have multiple projects later.)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id                      uuid primary key default gen_random_uuid(),
  project_reference       text unique not null,
  client_id               uuid references public.clients(id) on delete cascade,

  -- Project info
  package                 text,
  project_type            text,
  stage                   text not null default 'Lead',
  launch_date             date,

  -- Team scalability (no permissions system yet — just the fields)
  assigned_designer       text,
  assigned_developer      text,
  assigned_project_manager text,
  status_owner            text,

  -- Payments
  total_price             numeric(12,2) not null default 0,
  deposit_required        numeric(12,2) not null default 0,
  amount_paid             numeric(12,2) not null default 0,
  deposit_paid            boolean not null default false,
  final_invoice_sent      boolean not null default false,
  final_invoice_paid      boolean not null default false,
  paid_in_full            boolean not null default false,

  -- Stripe (manually entered for now)
  stripe_invoice_link     text,
  stripe_payment_link     text,
  stripe_customer_id      text,

  -- Notes
  internal_notes          text,
  client_notes            text,

  created_at              timestamptz not null default now(),

  constraint projects_stage_check check (
    stage in (
      'Lead','Discovery Call Booked','Proposal Sent','Contract Sent',
      'Deposit Paid','Content Collection','Strategy','Design','Development',
      'Review','Launch','Maintenance','Completed'
    )
  )
);

create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists projects_stage_idx on public.projects(stage);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. PROJECT STAGE HISTORY — timeline of pipeline movement.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.project_stage_history (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects(id) on delete cascade,
  project_reference text,
  stage             text not null,
  note              text,
  changed_by        text,
  changed_at        timestamptz not null default now()
);

create index if not exists psh_project_id_idx on public.project_stage_history(project_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. SUPPORT REQUESTS — submitted from /support (anon) + managed in admin.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.support_requests (
  id                uuid primary key default gen_random_uuid(),
  project_reference text,
  client_name       text,
  company           text,
  email             text not null,
  support_type      text,
  message           text not null,
  status            text not null default 'New',
  admin_notes       text,
  created_at        timestamptz not null default now(),
  constraint support_status_check check (
    status in ('New','In Progress','Waiting On Client','Resolved','Closed')
  )
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. CONSULTATION CONVERSION LINK — track which leads became clients.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.consultations add column if not exists converted boolean not null default false;
alter table public.consultations add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.consultations add column if not exists project_reference text;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. PROJECT REFERENCE GENERATOR — DS-YYYY-NNN, auto-incrementing per year.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.next_project_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr  text := to_char(now(), 'YYYY');
  n   int;
begin
  select coalesce(
           max((regexp_match(project_reference, '^DS-' || yr || '-(\d+)$'))[1]::int),
           0
         ) + 1
    into n
  from public.projects
  where project_reference like 'DS-' || yr || '-%';

  return 'DS-' || yr || '-' || lpad(n::text, 3, '0');
end;
$$;

grant execute on function public.next_project_reference() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
--    • authenticated admins: full access to all ops tables.
--    • anonymous visitors: may only INSERT a support request from /support.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.clients               enable row level security;
alter table public.projects              enable row level security;
alter table public.project_stage_history enable row level security;
alter table public.support_requests      enable row level security;

-- Helper: (re)create an "authenticated full access" policy for a table.
do $$
declare t text;
begin
  foreach t in array array['clients','projects','project_stage_history','support_requests']
  loop
    execute format('drop policy if exists "auth full access" on public.%I', t);
    execute format(
      'create policy "auth full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Anonymous visitors can submit a support request (status locked to default).
drop policy if exists "anon can insert support" on public.support_requests;
create policy "anon can insert support"
  on public.support_requests
  for insert
  to anon
  with check (status = 'New');
