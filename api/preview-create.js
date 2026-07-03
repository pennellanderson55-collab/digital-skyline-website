// ============================================================================
// POST /api/preview-create — mint a branded preview from uploaded assets.
//
// Body: {
//   assets: [{ kind:'image'|'video', path:'<storage key>', label? }],
//   contact?: { prospect_id?, client_id?, email?, business?, owner? },
//   liveSite?, proposalPath?, contractPath?
// }
// → { ok, token, url }
//
// Called by the composer at send time. Stores the storage keys server-side and
// returns ONLY a branded token URL — the Supabase location never reaches the
// browser or the email. Service role (bypasses RLS).
// ============================================================================
import { sbInsert, sbConfigured } from './_sb.js'
import { genToken, previewUrl, readBody } from './_preview.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }) }
  if (!sbConfigured()) return res.status(502).json({ ok: false, error: 'Preview storage not configured (SUPABASE_SERVICE_ROLE_KEY missing).' })

  const { assets, contact = {}, liveSite, proposalPath, contractPath } = readBody(req)
  const clean = (Array.isArray(assets) ? assets : [])
    .filter((a) => a && a.path && (a.kind === 'image' || a.kind === 'video'))
    .map((a) => ({ kind: a.kind, path: String(a.path), label: a.label || null }))
  if (!clean.length && !proposalPath && !contractPath)
    return res.status(400).json({ ok: false, error: 'A preview needs at least one asset.' })

  const token = genToken()
  try {
    await sbInsert('preview_links', {
      token,
      prospect_id: contact.prospect_id || null,
      client_id: contact.client_id || null,
      contact_email: contact.email || null,
      business_name: contact.business || null,
      owner_name: contact.owner || null,
      assets: clean,
      live_site_url: liveSite || null,
      proposal_path: proposalPath || null,
      contract_path: contractPath || null,
    })
    return res.status(200).json({ ok: true, token, url: previewUrl(token) })
  } catch (e) {
    console.error('[preview-create] failed:', e)
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
