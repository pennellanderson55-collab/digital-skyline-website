-- ============================================================================
-- Branded Website Previews — private, tokenized preview presentations.
--
-- A "preview" is a secure, branded page (digitalskylineco.com/preview/<token>)
-- that shows a client one or more hosted assets (video/photos) plus CTAs. The
-- raw Supabase Storage location is NEVER exposed — the app streams assets
-- through /api/preview-asset and the client only ever sees the branded token.
--
-- preview_links : one row per preview (token, assets, CRM links, response).
-- preview_views : the open timeline (device / browser / country / duration).
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================================

create table if not exists public.preview_links (
  id             uuid primary key default gen_random_uuid(),
  token          text unique not null,                 -- unguessable, in the URL

  -- who it's for (any/all may be null)
  prospect_id    uuid references public.prospects(id) on delete set null,
  client_id      uuid,
  contact_email  text,
  business_name  text,
  owner_name     text,

  -- what it shows: [{ kind:'image'|'video', path:'<storage key>', label }]
  assets         jsonb not null default '[]'::jsonb,

  -- optional extras surfaced on the page
  live_site_url  text,
  proposal_path  text,                                 -- storage key (streamed via proxy)
  contract_path  text,

  -- client response from "Ready to Launch?"  (loved | changes | consult)
  response       text,
  response_note  text,
  responded_at   timestamptz,

  -- rollup tracking (details live in preview_views)
  view_count     integer not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz,

  created_at     timestamptz not null default now(),

  constraint preview_links_response_check check (response is null or response in ('loved','changes','consult'))
);

create index if not exists preview_links_token_idx    on public.preview_links(token);
create index if not exists preview_links_prospect_idx on public.preview_links(prospect_id);
create index if not exists preview_links_created_idx  on public.preview_links(created_at desc);

create table if not exists public.preview_views (
  id           uuid primary key default gen_random_uuid(),
  preview_id   uuid not null references public.preview_links(id) on delete cascade,
  viewed_at    timestamptz not null default now(),
  device       text,     -- Mobile | Tablet | Desktop
  browser      text,     -- Chrome | Safari | Firefox | …
  os           text,
  country      text,     -- from the edge geo header (best-effort)
  city         text,
  duration_ms  integer,  -- filled in on page close (best-effort beacon)
  referer      text
);

create index if not exists preview_views_preview_idx on public.preview_views(preview_id, viewed_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- The public preview page reads/writes ONLY through server functions using the
-- service role (which bypasses RLS), so anon needs no direct table access. The
-- authenticated admin can read everything for the Previews panel.
alter table public.preview_links enable row level security;
alter table public.preview_views enable row level security;

drop policy if exists preview_links_admin on public.preview_links;
create policy preview_links_admin on public.preview_links
  for all to authenticated using (true) with check (true);

drop policy if exists preview_views_admin on public.preview_views;
create policy preview_views_admin on public.preview_views
  for all to authenticated using (true) with check (true);
