-- ============================================================================
-- Digital Skyline OS — Sprint 3: Outreach AI (draft generation)
-- Run ONCE after sprint2_website_intelligence.sql:
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds: outreach_drafts (AI-generated outreach assets per prospect/audit).
-- Idempotent and additive — never deletes or modifies existing data.
-- This phase is DRAFT GENERATION ONLY — no sending, no Gmail, no bulk.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- OUTREACH_DRAFTS — one row per generated/saved asset.
--   type    : which asset (cold_email, follow_up, call_script, dm,
--             objections, consultation)
--   audit_id: the Website Intelligence audit used as context (nullable so a
--             draft survives if the audit is later deleted)
--   subject : email subject line (null for non-email types)
--   body    : the generated copy
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.outreach_drafts (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.prospects(id) on delete cascade,
  audit_id     uuid references public.website_audits(id) on delete set null,
  type         text not null,
  subject      text,
  body         text not null,
  tone         text default 'professional-conversational',
  status       text not null default 'Draft',
  used_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint outreach_drafts_type_check check (
    type in ('cold_email', 'follow_up', 'call_script', 'dm', 'objections', 'consultation')
  ),
  constraint outreach_drafts_status_check check (
    status in ('Draft', 'Used', 'Archived')
  )
);

create index if not exists outreach_drafts_prospect_id_idx on public.outreach_drafts(prospect_id);
create index if not exists outreach_drafts_audit_id_idx     on public.outreach_drafts(audit_id);
create index if not exists outreach_drafts_created_at_idx    on public.outreach_drafts(created_at desc);
-- Fast lookup of the latest draft of a given type for a prospect (cache reuse).
create index if not exists outreach_drafts_prospect_type_idx on public.outreach_drafts(prospect_id, type, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at trigger — reuses public.set_updated_at() from Sprint 1.
-- ─────────────────────────────────────────────────────────────────────────
drop trigger if exists outreach_drafts_set_updated_at on public.outreach_drafts;
create trigger outreach_drafts_set_updated_at
  before update on public.outreach_drafts
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — internal-only, same pattern as every other OS table.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.outreach_drafts enable row level security;

drop policy if exists "auth full access" on public.outreach_drafts;
create policy "auth full access"
  on public.outreach_drafts
  for all
  to authenticated
  using (true)
  with check (true);
