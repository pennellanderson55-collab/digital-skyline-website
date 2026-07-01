-- ============================================================================
-- Digital Skyline OS — Sprint 5: Outreach Sending System
-- Run ONCE after sprint3_outreach_drafts.sql (and sprint4_pipeline.sql):
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds the sending pipeline on top of outreach_drafts: queue state, recipient,
-- send tracking (Resend), version history, and consultation bookings. Expands
-- the prospect status vocabulary (additive — keeps ALL existing data). Nothing
-- here sends email; sending is server-side via /api/send-outreach.
-- Idempotent and additive.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. OUTREACH_DRAFTS — sending/queue columns.
--    queue_status drives the Sending Queue:
--      Ready for Review -> Approved -> Queued -> Sent | Failed | Archived
-- ─────────────────────────────────────────────────────────────────────────
alter table public.outreach_drafts add column if not exists queue_status     text not null default 'Ready for Review';
alter table public.outreach_drafts add column if not exists recipient_email   text;
alter table public.outreach_drafts add column if not exists sender_name       text default 'Digital Skyline';
alter table public.outreach_drafts add column if not exists sender_email      text default 'hello@digitalskylineco.com';
alter table public.outreach_drafts add column if not exists approved_at       timestamptz;
alter table public.outreach_drafts add column if not exists queued_at         timestamptz;
alter table public.outreach_drafts add column if not exists sent_at           timestamptz;
alter table public.outreach_drafts add column if not exists last_edited_at    timestamptz;
alter table public.outreach_drafts add column if not exists archived_from     text;        -- queue_status before Archive (for Restore)
-- Resend / delivery tracking (open tracking NOT implemented yet — schema only).
alter table public.outreach_drafts add column if not exists resend_message_id text;
alter table public.outreach_drafts add column if not exists delivery_status   text default 'unknown'; -- unknown|sent|delivered|opened|bounced|complained
alter table public.outreach_drafts add column if not exists opened_at         timestamptz;
alter table public.outreach_drafts add column if not exists replied_at        timestamptz;
alter table public.outreach_drafts add column if not exists bounced_at        timestamptz;
alter table public.outreach_drafts add column if not exists send_error        text;
alter table public.outreach_drafts add column if not exists sandboxed         boolean default false;
alter table public.outreach_drafts add column if not exists version           integer not null default 1;

alter table public.outreach_drafts drop constraint if exists outreach_drafts_queue_status_check;
alter table public.outreach_drafts add  constraint outreach_drafts_queue_status_check check (
  queue_status in ('Ready for Review','Approved','Queued','Sent','Failed','Archived')
);

create index if not exists outreach_drafts_queue_status_idx on public.outreach_drafts(queue_status, created_at desc);

-- Default the recipient to the prospect's email where we have one and it's unset.
update public.outreach_drafts d
   set recipient_email = p.email
  from public.prospects p
 where d.prospect_id = p.id
   and d.recipient_email is null
   and p.email is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. OUTREACH_DRAFT_VERSIONS — immutable snapshots for Version History.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.outreach_draft_versions (
  id          uuid primary key default gen_random_uuid(),
  draft_id    uuid not null references public.outreach_drafts(id) on delete cascade,
  version     integer not null default 1,
  subject     text,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists outreach_draft_versions_draft_idx on public.outreach_draft_versions(draft_id, created_at desc);

alter table public.outreach_draft_versions enable row level security;
drop policy if exists "auth full access" on public.outreach_draft_versions;
create policy "auth full access" on public.outreach_draft_versions
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. OUTREACH_BOOKINGS — consultation bookings from /book?prospect=<id>.
--    Inserted server-side (service role) so an unauthenticated visitor can book
--    while CRM updates stay trusted.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.outreach_bookings (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid references public.prospects(id) on delete set null,
  draft_id      uuid references public.outreach_drafts(id) on delete set null,
  name          text,
  email         text,
  meeting_date  date,
  meeting_time  text,
  notes         text,
  source        text default 'outreach-email',
  created_at    timestamptz not null default now()
);
create index if not exists outreach_bookings_prospect_idx on public.outreach_bookings(prospect_id, created_at desc);

alter table public.outreach_bookings enable row level security;
drop policy if exists "auth read" on public.outreach_bookings;
create policy "auth read" on public.outreach_bookings
  for select to authenticated using (true);
-- Inserts happen server-side with the service role (bypasses RLS); no anon policy.

-- ─────────────────────────────────────────────────────────────────────────
-- 4. PROSPECTS — expand the status vocabulary (ADDITIVE: superset of Sprint 4.1
--    + the automatic sending pipeline). Keeps every existing value valid.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.prospects add column if not exists last_booking_at timestamptz;

alter table public.prospects drop constraint if exists prospects_status_check;
alter table public.prospects add constraint prospects_status_check check (
  status in (
    -- Sprint 4.1 vocabulary (kept for existing data)
    'New Lead','Website Audited','Outreach Started','Contacted','Follow-up Scheduled',
    'Consultation Booked','Proposal Sent','Negotiating','Won','Lost',
    -- Sprint 5 automatic sending pipeline
    'Analyzed','Outreach Generated','Approved','Queued','Email Sent',
    'Consultation Scheduled','Consultation Completed','Client'
  )
);
