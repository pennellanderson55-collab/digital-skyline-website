-- ============================================================================
-- Digital Skyline OS — Sprint 4.1: Sales Pipeline foundation
-- Run ONCE after sprint1_prospects.sql (order vs sprint2/3 doesn't matter):
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- EXTENDS the existing prospects table — does NOT recreate it and keeps ALL
-- existing data. Adds pipeline fields and moves the `status` column to a
-- 10-stage sales pipeline vocabulary (migrating existing values in place).
-- Idempotent and additive. Website Intelligence, Outreach AI, drafts and
-- annotations are untouched.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. New pipeline columns (next_follow_up already exists from Sprint 1).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.prospects add column if not exists deal_value         numeric(12,2);
alter table public.prospects add column if not exists probability        integer;
alter table public.prospects add column if not exists next_follow_up     date;          -- no-op if present
alter table public.prospects add column if not exists last_contacted_at  timestamptz;
alter table public.prospects add column if not exists proposal_sent_at   timestamptz;
alter table public.prospects add column if not exists closed_at          timestamptz;
alter table public.prospects add column if not exists lost_reason        text;

-- Value validation.
alter table public.prospects drop constraint if exists prospects_probability_check;
alter table public.prospects add  constraint prospects_probability_check
  check (probability is null or (probability >= 0 and probability <= 100));

alter table public.prospects drop constraint if exists prospects_deal_value_check;
alter table public.prospects add  constraint prospects_deal_value_check
  check (deal_value is null or deal_value >= 0);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Status → 10-stage pipeline vocabulary.
--    IMPORTANT ORDER: drop the old CHECK first, THEN rewrite values, THEN add
--    the new CHECK — otherwise the UPDATE to new names would violate the old
--    constraint mid-migration.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.prospects drop constraint if exists prospects_status_check;

-- Migrate existing values in place (Contacted and Lost keep their names).
update public.prospects set status = case status
  when 'New'          then 'New Lead'
  when 'Follow-up'    then 'Follow-up Scheduled'
  when 'Consultation' then 'Consultation Booked'
  when 'Proposal'     then 'Proposal Sent'
  when 'Client'       then 'Won'
  else status
end
where status in ('New','Follow-up','Consultation','Proposal','Client');

alter table public.prospects add constraint prospects_status_check check (
  status in (
    'New Lead','Website Audited','Outreach Started','Contacted','Follow-up Scheduled',
    'Consultation Booked','Proposal Sent','Negotiating','Won','Lost'
  )
);

alter table public.prospects alter column status set default 'New Lead';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Best-effort backfill of new timestamps from existing data (non-destructive).
-- ─────────────────────────────────────────────────────────────────────────
update public.prospects set last_contacted_at = last_contacted
  where last_contacted_at is null and last_contacted is not null;

update public.prospects set closed_at = updated_at
  where closed_at is null and status in ('Won','Lost');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Index to keep pipeline value sorting/reporting fast.
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists prospects_deal_value_idx on public.prospects(deal_value);
