// ============================================================================
// /api/preview-view — preview metadata + view tracking (public).
//
// GET  ?token=…  → { ok, business, owner, assets:[{i,kind,label}], liveSite,
//                    hasProposal, hasContract, response, viewId }
//                  …and records a view (device / browser / country / repeat).
// POST { token, viewId, ms } → updates that view's duration (close beacon).
//
// Returns NO storage paths/URLs — assets are referenced by index only and
// streamed through /api/preview-asset. Service role.
// ============================================================================
import { sb, sbInsert, sbConfigured } from './_sb.js'
import { getPreview, parseUA, geoFrom, readBody } from './_preview.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!sbConfigured()) return res.status(502).json({ ok: false, error: 'Previews not configured.' })

  // ── duration beacon ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { viewId, ms } = readBody(req)
    if (viewId && Number.isFinite(Number(ms))) {
      await sb(`preview_views?id=eq.${viewId}`, { method: 'PATCH', body: JSON.stringify({ duration_ms: Math.max(0, Math.round(Number(ms))) }) }).catch(() => {})
    }
    return res.status(200).json({ ok: true })
  }
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }) }

  const token = String(req.query?.token || '')
  const p = await getPreview(token)
  if (!p) return res.status(404).json({ ok: false, error: 'This preview link is no longer valid.' })

  // Record the view (best-effort — never blocks the response payload).
  let viewId = null
  try {
    const { device, browser, os } = parseUA(req.headers['user-agent'] || '')
    const { country, city } = geoFrom(req)
    const row = await sbInsert('preview_views', {
      preview_id: p.id, device, browser, os, country: country || null, city: city || null,
      referer: (req.headers['referer'] || req.headers['referrer'] || '').slice(0, 300) || null,
    })
    viewId = row?.id || null
    const now = new Date().toISOString()
    await sb(`preview_links?id=eq.${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ view_count: (p.view_count || 0) + 1, last_viewed_at: now, first_viewed_at: p.first_viewed_at || now }),
    })
  } catch (e) {
    console.error('[preview-view] tracking skipped:', e.message)
  }

  const assets = (p.assets || []).map((a, i) => ({ i, kind: a.kind, label: a.label || null }))
  return res.status(200).json({
    ok: true,
    business: p.business_name || null,
    owner: p.owner_name || null,
    assets,
    liveSite: p.live_site_url || null,
    hasProposal: !!p.proposal_path,
    hasContract: !!p.contract_path,
    response: p.response || null,
    viewId,
    contact: {
      site: 'digitalskylineco.com',
      email: process.env.EMAIL_SUPPORT || 'hello@digitalskylineco.com',
      phone: process.env.DSC_PHONE || null, // shown only when set
    },
  })
}
