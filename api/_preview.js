// ============================================================================
// Shared helpers for the branded preview system (server-only).
// Token generation, user-agent parsing, edge-geo extraction, and the internal
// Supabase Storage URL (never sent to the client).
// ============================================================================
import crypto from 'node:crypto'
import { sbSelect } from './_sb.js'

export const SITE = (process.env.SITE_URL || 'https://digitalskylineco.com').replace(/\/$/, '')
export const MEDIA_BUCKET = process.env.COMMS_MEDIA_BUCKET || 'comms-media'
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')

// Unguessable URL token (~32 chars, url-safe). Not a UUID so it isn't confused
// with an id and can't be enumerated.
export const genToken = () => crypto.randomBytes(24).toString('base64url')

export const previewUrl = (token) => `${SITE}/preview/${token}`

// The INTERNAL storage URL — used only server-side to stream bytes. Never
// returned to the browser.
export const internalAssetUrl = (path) =>
  `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${String(path).replace(/^\/+/, '')}`

// Fetch a preview by token (service role). Returns the row or null.
export async function getPreview(token) {
  if (!token) return null
  const rows = await sbSelect('preview_links', `token=eq.${encodeURIComponent(token)}&limit=1`)
  return rows[0] || null
}

// Best-effort device/browser/OS from a user-agent string.
export function parseUA(ua = '') {
  const s = ua.toLowerCase()
  const device = /ipad|tablet/.test(s) ? 'Tablet' : /mobi|iphone|android/.test(s) ? 'Mobile' : 'Desktop'
  const browser =
    /edg\//.test(s) ? 'Edge' :
    /opr\/|opera/.test(s) ? 'Opera' :
    /chrome|crios/.test(s) && !/edg\//.test(s) ? 'Chrome' :
    /firefox|fxios/.test(s) ? 'Firefox' :
    /safari/.test(s) ? 'Safari' : 'Other'
  const os =
    /iphone|ipad|ios/.test(s) ? 'iOS' :
    /android/.test(s) ? 'Android' :
    /mac os|macintosh/.test(s) ? 'macOS' :
    /windows/.test(s) ? 'Windows' :
    /linux/.test(s) ? 'Linux' : 'Other'
  return { device, browser, os }
}

// Edge geo headers Vercel injects (best-effort; absent in local dev).
export function geoFrom(req) {
  const h = (name) => req.headers[name] || req.headers[name.toLowerCase()] || ''
  const dec = (v) => { try { return decodeURIComponent(v) } catch { return v } }
  return { country: h('x-vercel-ip-country') || '', city: dec(h('x-vercel-ip-city')) || '' }
}

export function readBody(req) {
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  return body || {}
}
