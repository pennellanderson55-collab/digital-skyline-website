-- ============================================================================
-- Digital Skyline OS — Sprint 7: Stripe → admin automatic sync
-- Run ONCE after the earlier migrations:
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds:
--   1. Extra payment-status columns on `projects` (live invoice / payment
--      status + last payment time) that the Stripe webhook keeps in sync.
--   2. A `stripe_events` table used by the webhook for idempotency, so a
--      re-delivered Stripe event is never counted twice.
--   3. Enables Supabase Realtime on `projects` so the open admin dashboard
--      reflects payments the moment the webhook writes them (no refresh).
--
-- Idempotent: safe to run multiple times. Does NOT delete or modify any data.
-- ============================================================================

-- ── 1. Live Stripe status columns on projects ──────────────────────────────
alter table public.projects add column if not exists stripe_invoice_status text;   -- draft/open/paid/void/uncollectible
alter table public.projects add column if not exists stripe_payment_status text;    -- succeeded/failed/refunded
alter table public.projects add column if not exists last_payment_at    timestamptz;

-- ── 2. Webhook idempotency ledger ───────────────────────────────────────────
-- One row per processed Stripe event id. The webhook inserts before acting and
-- skips the event if the id already exists (Stripe delivers at-least-once).
create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe event id (evt_…)
  type         text,
  project_id   uuid references public.projects(id) on delete set null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No anon/auth policies → only the service role (webhook) can touch it.

-- ── 3. Realtime on projects (best-effort) ───────────────────────────────────
-- Lets the admin subscribe to payment updates live. Wrapped so re-running or a
-- table already in the publication is not an error.
do $$
begin
  begin
    alter publication supabase_realtime add table public.projects;
  exception
    when duplicate_object then null;   -- already added
    when undefined_object then null;   -- publication missing (older projects)
  end;
end $$;
