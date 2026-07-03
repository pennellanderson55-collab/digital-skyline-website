-- ============================================================================
-- Communications Center — media storage bucket for hosted attachments.
--
-- Videos (and any large asset) are NEVER sent as raw email attachments — they'd
-- bounce or be stripped. Instead the composer uploads them here and drops a
-- public link/button into the email so the recipient can open it from Gmail
-- (including mobile) without signing in.
--
-- Public read is intentional: email recipients are unauthenticated. The object
-- keys are unguessable (timestamp + random), and only authenticated admins can
-- upload/update/delete. Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- Public bucket so hosted links open for any recipient (mobile Gmail included).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comms-media', 'comms-media', true,
  524288000,  -- 500 MB ceiling per object
  null        -- allow any type (video/*, image/*, application/pdf, …)
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit;

-- ── Policies on storage.objects, scoped to this bucket ──────────────────────
-- Public can READ (so emailed links open); authenticated admins manage objects.
drop policy if exists comms_media_public_read on storage.objects;
create policy comms_media_public_read on storage.objects
  for select to public
  using (bucket_id = 'comms-media');

drop policy if exists comms_media_auth_insert on storage.objects;
create policy comms_media_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comms-media');

drop policy if exists comms_media_auth_update on storage.objects;
create policy comms_media_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'comms-media')
  with check (bucket_id = 'comms-media');

drop policy if exists comms_media_auth_delete on storage.objects;
create policy comms_media_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'comms-media');
