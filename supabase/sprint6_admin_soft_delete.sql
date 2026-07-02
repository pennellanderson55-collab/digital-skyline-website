-- ============================================================================
-- Digital Skyline OS — Sprint 6: Admin soft-delete + Operations→Sales bridge
-- Run ONCE after the earlier migrations:
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds:
--   1. A `deleted_at` soft-delete marker to consultations, prospects, projects
--      and clients. A row with deleted_at IS NOT NULL is hidden from the admin
--      lists but is NEVER physically removed — nothing is lost, and a row can be
--      restored later by clearing deleted_at.
--   2. `prospects.source_consultation_id` so a lead created by "Move to Sales"
--      is traceable back to the consultation it came from.
--
-- Idempotent: safe to run multiple times. Does NOT delete or modify any data.
-- ============================================================================

-- ── 1. Soft-delete markers ──────────────────────────────────────────────────
alter table public.consultations add column if not exists deleted_at timestamptz;
alter table public.prospects     add column if not exists deleted_at timestamptz;
alter table public.projects      add column if not exists deleted_at timestamptz;
alter table public.clients       add column if not exists deleted_at timestamptz;

-- Partial indexes — keep "active rows only" queries fast as the tables grow.
create index if not exists consultations_active_idx on public.consultations(created_at desc) where deleted_at is null;
create index if not exists prospects_active_idx      on public.prospects(created_at desc)      where deleted_at is null;
create index if not exists projects_active_idx       on public.projects(created_at desc)       where deleted_at is null;
create index if not exists clients_active_idx        on public.clients(created_at desc)        where deleted_at is null;

-- ── 2. Operations → Sales bridge (Move to Sales) ────────────────────────────
-- Links a prospect back to the consultation it was created from. ON DELETE SET
-- NULL so removing a consultation never breaks the prospect it produced.
alter table public.prospects
  add column if not exists source_consultation_id uuid references public.consultations(id) on delete set null;

create index if not exists prospects_source_consultation_idx on public.prospects(source_consultation_id);
