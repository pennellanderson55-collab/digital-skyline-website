// ============================================================================
// Communications — attachment storage (Supabase Storage).
//
// Videos (and any oversized asset) must NOT be sent as raw email attachments —
// providers strip/bounce them and Gmail won't render them. Instead we upload to
// the public `comms-media` bucket (see supabase/comms_storage.sql) and hand back
// a public URL the composer turns into a "View …" button/link. Public read is
// required because email recipients are unauthenticated; keys are unguessable.
//
// Never throws — returns { ok, url, path } or { ok:false, error } so the UI can
// show a clean failure state instead of a broken attachment.
// ============================================================================
import { supabase } from '../supabase.js'

export const BUCKET = 'comms-media'

// Raw email attachments are only safe for small files; anything larger (and all
// video) is hosted. Vercel request bodies also cap ~4.5MB, so keep inline tiny.
export const INLINE_ATTACH_LIMIT = 3 * 1024 * 1024 // 3 MB

export const isVideo = (file) =>
  /^video\//i.test(file?.type || '') || /\.(mp4|mov|m4v|webm|avi|mkv|ogv)$/i.test(file?.name || '')
export const isImage = (file) =>
  /^image\//i.test(file?.type || '') || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file?.name || '')
export const isPdf = (file) =>
  /pdf/i.test(file?.type || '') || /\.pdf$/i.test(file?.name || '')

export const fileKindOf = (file) => (isVideo(file) ? 'video' : isImage(file) ? 'image' : isPdf(file) ? 'pdf' : 'doc')
export const iconForKind = (kind) => ({ image: 'FileImage', video: 'FileVideo', pdf: 'FilePdf', doc: 'FileDoc' })[kind] || 'FileDoc'
export const humanSize = (bytes = 0) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

// A hosted asset should link out (video always; anything over the inline limit).
export const mustHost = (file) => isVideo(file) || (file?.size || 0) > INLINE_ATTACH_LIMIT

const slug = (name = 'file') => name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-60)

/**
 * Upload a File/Blob to Supabase Storage and return a public URL.
 * @returns {Promise<{ok:true,url:string,path:string}|{ok:false,error:string}>}
 */
export async function uploadToStorage(file, { prefix = 'uploads' } = {}) {
  if (!supabase) return { ok: false, error: 'Storage unavailable (Supabase not configured).' }
  try {
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${prefix}/${Date.now()}-${rand}-${slug(file.name || 'file')}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })
    if (error) {
      const msg = /bucket.*not found|does not exist/i.test(error.message)
        ? 'Storage bucket “comms-media” not found — run supabase/comms_storage.sql.'
        : error.message
      return { ok: false, error: msg }
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    if (!data?.publicUrl) return { ok: false, error: 'Uploaded, but no public URL was returned.' }
    return { ok: true, url: data.publicUrl, path }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}
