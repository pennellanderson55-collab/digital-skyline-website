// ============================================================================
// Shared Supabase REST helper for serverless functions (service role).
//
// Server-only. Uses the SERVICE ROLE key, which bypasses RLS — never import
// this into browser code. Mirrors the small `sb()` pattern already used by
// api/book.js and api/stripe-webhook.js, centralized so the Communications
// routes don't each re-implement it.
// ============================================================================

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const sbConfigured = () => !!(SUPABASE_URL && SERVICE_KEY)

// Low-level REST fetch against PostgREST. `path` is everything after /rest/v1/.
export function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

// Insert a row and return the created record (Prefer: return=representation).
export async function sbInsert(table, row) {
  const r = await sb(table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  const data = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`Supabase insert ${table} ${r.status}: ${JSON.stringify(data)}`)
  return Array.isArray(data) ? data[0] : data
}

// Select rows. `query` is a PostgREST query string (e.g. "folder=eq.sent&order=created_at.desc").
export async function sbSelect(table, query = '') {
  const r = await sb(`${table}?${query}`)
  const data = await r.json().catch(() => [])
  if (!r.ok) throw new Error(`Supabase select ${table} ${r.status}: ${JSON.stringify(data)}`)
  return Array.isArray(data) ? data : []
}
