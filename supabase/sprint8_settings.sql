-- ============================================================================
-- Digital Skyline OS — Sprint 8: Settings control center
-- Run ONCE after the earlier migrations:
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Adds one table per settings domain (business/email/pricing/…) plus the
-- Portfolio CMS and email templates. Each single-domain table is a SINGLETON
-- (one row, id = true) with a flexible `data jsonb` payload, so new fields can
-- be added from the app without another migration. RLS: authenticated admins
-- have full access; anon gets READ-only on the public-facing tables (pricing,
-- website, branding, published portfolio) so the marketing site can consume them.
--
-- Idempotent: safe to run multiple times. Does NOT delete or modify any data.
-- ============================================================================

-- Reusable updated_at trigger fn (created in sprint1; re-created here to be safe).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── Singleton settings tables (one jsonb row each) ──────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','email_settings','pricing_settings','consultation_settings',
    'crm_settings','notification_settings','website_settings','ai_settings',
    'branding_settings','stripe_settings'
  ] loop
    execute format($f$
      create table if not exists public.%1$I (
        id         boolean primary key default true,
        data       jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        constraint %1$I_singleton check (id)
      );
    $f$, t);
    execute format('insert into public.%1$I (id) values (true) on conflict (id) do nothing;', t);
    execute format('alter table public.%1$I enable row level security;', t);
    execute format('drop trigger if exists %1$I_set_updated_at on public.%1$I;', t);
    execute format('create trigger %1$I_set_updated_at before update on public.%1$I for each row execute function public.set_updated_at();', t);
    -- authenticated admins: full access
    execute format('drop policy if exists "auth full access" on public.%1$I;', t);
    execute format('create policy "auth full access" on public.%1$I for all to authenticated using (true) with check (true);', t);
  end loop;

  -- anon READ on the public-facing settings the marketing site consumes
  foreach t in array array['pricing_settings','website_settings','branding_settings'] loop
    execute format('drop policy if exists "anon read" on public.%1$I;', t);
    execute format('create policy "anon read" on public.%1$I for select to anon using (true);', t);
  end loop;
end $$;

-- ── Portfolio CMS (multi-row) ───────────────────────────────────────────────
create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  category      text default 'Website',        -- Website / Dashboard / App / Automation / AI
  media_type    text default 'image',          -- image / video
  media_url     text,                           -- /public path, Storage URL, or external URL
  thumbnail_url text,
  poster_url    text,
  featured      boolean not null default false,
  on_homepage   boolean not null default true,
  published     boolean not null default true,  -- false = draft
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.portfolio_items enable row level security;
drop trigger if exists portfolio_items_set_updated_at on public.portfolio_items;
create trigger portfolio_items_set_updated_at before update on public.portfolio_items for each row execute function public.set_updated_at();
drop policy if exists "auth full access" on public.portfolio_items;
create policy "auth full access" on public.portfolio_items for all to authenticated using (true) with check (true);
-- anon reads only PUBLISHED items (drafts stay private)
drop policy if exists "anon read published" on public.portfolio_items;
create policy "anon read published" on public.portfolio_items for select to anon using (published = true);
create index if not exists portfolio_items_sort_idx on public.portfolio_items(sort_order, created_at desc);

-- ── Email templates (multi-row) ─────────────────────────────────────────────
create table if not exists public.email_templates (
  key         text primary key,                -- e.g. consultation_confirmation
  name        text not null,
  subject     text,
  body        text,
  updated_at  timestamptz not null default now()
);
alter table public.email_templates enable row level security;
drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at before update on public.email_templates for each row execute function public.set_updated_at();
drop policy if exists "auth full access" on public.email_templates;
create policy "auth full access" on public.email_templates for all to authenticated using (true) with check (true);
