-- ============================================================================
-- Communications Center — message log (provider-agnostic).
--
-- One row per message the Communications hub sends, drafts, schedules, or syncs
-- in from an inbox provider. Provider-independent by design: `provider` records
-- which adapter handled it (resend / gmail / …) but the app never branches on it
-- for display. Powers Sent / Drafts / Scheduled / Archive and open/reply
-- tracking. Inbound (synced) messages land here too with direction='inbound'.
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================================

create table if not exists public.comms_messages (
  id                  uuid primary key default gen_random_uuid(),

  direction           text not null default 'outbound',   -- 'outbound' | 'inbound'
  provider            text,                                -- 'resend' | 'gmail' | …
  provider_message_id text,                                -- id returned by the provider
  folder              text not null default 'sent',        -- sent | draft | scheduled | archive | inbox

  -- addressing (plain strings — the UI is provider-agnostic)
  from_email          text,
  to_email            text,
  cc                  text,
  bcc                 text,
  subject             text,
  body                text,
  attachments         jsonb not null default '[]'::jsonb,  -- [{id,label,kind,size,url,secure}]

  -- optional CRM links (any/all may be null)
  prospect_id         uuid references public.prospects(id) on delete set null,
  client_id           uuid,
  project_id          uuid,
  contact_email       text,                                -- denormalized for quick threading

  status              text not null default 'sent',        -- sent | draft | scheduled | failed | received
  error               text,

  scheduled_for       timestamptz,
  sent_at             timestamptz,
  opened_at           timestamptz,
  replied_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint comms_messages_direction_check check (direction in ('outbound','inbound')),
  constraint comms_messages_folder_check check (folder in ('sent','draft','scheduled','archive','inbox')),
  constraint comms_messages_status_check check (status in ('sent','draft','scheduled','failed','received'))
);

create index if not exists comms_messages_folder_idx      on public.comms_messages(folder, created_at desc);
create index if not exists comms_messages_prospect_idx    on public.comms_messages(prospect_id);
create index if not exists comms_messages_contact_idx     on public.comms_messages(contact_email);
create index if not exists comms_messages_scheduled_idx   on public.comms_messages(scheduled_for) where folder = 'scheduled';

-- keep updated_at fresh
create or replace function public.touch_comms_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists comms_messages_touch on public.comms_messages;
create trigger comms_messages_touch before update on public.comms_messages
  for each row execute function public.touch_comms_updated_at();

-- ── RLS: authenticated admin has full access; the service role (server
--    functions) bypasses RLS automatically. Mirrors the app's single-admin model.
alter table public.comms_messages enable row level security;

drop policy if exists comms_messages_all on public.comms_messages;
create policy comms_messages_all on public.comms_messages
  for all to authenticated using (true) with check (true);
