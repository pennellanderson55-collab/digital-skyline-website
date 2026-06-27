-- ============================================================================
-- Digital Skyline OS — Sprint 2: AI Website Intelligence Engine
-- Run ONCE after sprint1_prospects.sql:
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds: website_audits (full audit history) + 2 prospect columns.
-- Idempotent and additive — never deletes or modifies existing data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. PROSPECT COLUMNS — quick-glance audit state on the prospect row itself.
--    (website_score already exists from Sprint 1 and is reused as the latest
--    overall score.)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.prospects add column if not exists website_audit_status text;   -- null | 'analyzing' | 'complete' | 'error'
alter table public.prospects add column if not exists last_analyzed_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. WEBSITE_AUDITS — one row per completed analysis (history preserved).
--    Raw signals, per-category scores and the AI narrative are stored as JSONB
--    so the schema doesn't churn as the analyzer evolves.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.website_audits (
  id              uuid primary key default gen_random_uuid(),
  prospect_id     uuid references public.prospects(id) on delete cascade,
  url             text not null,
  final_url       text,                       -- after redirects
  overall_score   integer,                    -- 0–100
  category_scores jsonb not null default '{}'::jsonb,  -- {performance, seo, conversion, trust, branding, mobile_ux}
  signals         jsonb not null default '{}'::jsonb,  -- all collected raw signals
  ai              jsonb,                       -- the 8 AI outputs (null if AI not configured)
  ai_model        text,
  status          text not null default 'complete',    -- 'complete' | 'error'
  error           text,
  created_at      timestamptz not null default now(),

  constraint website_audits_score_check check (
    overall_score is null or (overall_score >= 0 and overall_score <= 100)
  )
);

create index if not exists website_audits_prospect_id_idx on public.website_audits(prospect_id);
create index if not exists website_audits_created_at_idx   on public.website_audits(created_at desc);
-- Lookup the freshest audit for a URL (powers the "don't re-fetch" cache).
create index if not exists website_audits_url_idx          on public.website_audits(url, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — internal-only, same pattern as every other OS table.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.website_audits enable row level security;

drop policy if exists "auth full access" on public.website_audits;
create policy "auth full access"
  on public.website_audits
  for all
  to authenticated
  using (true)
  with check (true);
