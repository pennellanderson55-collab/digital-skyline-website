// ============================================================================
// /api/preview — single entry point for the branded preview system.
//
// Consolidated into ONE Serverless Function (Hobby-plan function budget):
//   GET  ?token=…                     → metadata + record a view
//   GET  ?token=…&a=<i>               → stream asset #i (image/video, ranged)
//   GET  ?token=…&file=proposal       → stream the proposal/contract
//   POST { op:'create', … }           → mint a preview, return branded URL
//   POST { op:'respond', action, … }  → Ready-to-Launch (pipeline + notify)
//   POST { op:'beacon', viewId, ms }  → time-on-page beacon
//
// Assets stream through here (service role) so the Supabase location is never
// exposed to the browser. Helpers live in ./_preview.js (underscore = not a
// route, so it doesn't count against the function budget).
// ============================================================================
import { Readable } from 'node:stream'
import { sb, sbInsert, sbConfigured } from './_sb.js'
import { getPreview, internalAssetUrl, genToken, previewUrl, parseUA, geoFrom, readBody, SITE } from './_preview.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (!sbConfigured()) return res.status(502).json({ ok: false, error: 'Previews not configured.' })
  if (req.method === 'POST') return handlePost(req, res)
  if (req.method === 'GET' || req.method === 'HEAD') {
    const isAsset = req.query?.a != null || req.query?.file != null
    return isAsset ? streamAsset(req, res) : metaAndView(req, res)
  }
  res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' })
}

/* ── POST router ──────────────────────────────────────────────────────────── */
async function handlePost(req, res) {
  const body = readBody(req)
  if (body.op === 'create') return create(body, res)
  if (body.op === 'respond') return respond(body, res)
  if (body.op === 'beacon') {
    if (body.viewId && Number.isFinite(Number(body.ms)))
      await sb(`preview_views?id=eq.${body.viewId}`, { method: 'PATCH', body: JSON.stringify({ duration_ms: Math.max(0, Math.round(Number(body.ms))) }) }).catch(() => {})
    return res.status(200).json({ ok: true })
  }
  return res.status(400).json({ ok: false, error: 'Unknown op.' })
}

/* ── create ───────────────────────────────────────────────────────────────── */
async function create({ assets, contact = {}, liveSite, proposalPath, contractPath }, res) {
  const clean = (Array.isArray(assets) ? assets : [])
    .filter((a) => a && a.path && (a.kind === 'image' || a.kind === 'video'))
    .map((a) => ({ kind: a.kind, path: String(a.path), label: a.label || null }))
  if (!clean.length && !proposalPath && !contractPath) return res.status(400).json({ ok: false, error: 'A preview needs at least one asset.' })
  const token = genToken()
  try {
    await sbInsert('preview_links', {
      token, prospect_id: contact.prospect_id || null, client_id: contact.client_id || null,
      contact_email: contact.email || null, business_name: contact.business || null, owner_name: contact.owner || null,
      assets: clean, live_site_url: liveSite || null, proposal_path: proposalPath || null, contract_path: contractPath || null,
    })
    return res.status(200).json({ ok: true, token, url: previewUrl(token) })
  } catch (e) {
    console.error('[preview.create] failed:', e)
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

/* ── metadata + view tracking ─────────────────────────────────────────────── */
async function metaAndView(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const p = await getPreview(String(req.query?.token || ''))
  if (!p) return res.status(404).json({ ok: false, error: 'This preview link is no longer valid.' })

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
    await sb(`preview_links?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ view_count: (p.view_count || 0) + 1, last_viewed_at: now, first_viewed_at: p.first_viewed_at || now }) })
  } catch (e) { console.error('[preview.view] tracking skipped:', e.message) }

  return res.status(200).json({
    ok: true,
    business: p.business_name || null,
    owner: p.owner_name || null,
    assets: (p.assets || []).map((a, i) => ({ i, kind: a.kind, label: a.label || null })),
    liveSite: p.live_site_url || null,
    hasProposal: !!p.proposal_path,
    hasContract: !!p.contract_path,
    response: p.response || null,
    viewId,
    contact: { site: 'digitalskylineco.com', email: process.env.EMAIL_SUPPORT || 'hello@digitalskylineco.com', phone: process.env.DSC_PHONE || null },
  })
}

/* ── asset streaming (range proxy, hides storage) ─────────────────────────── */
const PASS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']
async function streamAsset(req, res) {
  const p = await getPreview(String(req.query?.token || ''))
  if (!p) return res.status(404).json({ ok: false, error: 'Not found.' })
  let path = null
  const file = String(req.query?.file || '')
  if (file === 'proposal') path = p.proposal_path
  else if (file === 'contract') path = p.contract_path
  else path = (p.assets || [])[Math.max(0, parseInt(req.query?.a ?? '0', 10) || 0)]?.path
  if (!path) return res.status(404).json({ ok: false, error: 'Asset not found.' })
  try {
    const range = req.headers.range
    const upstream = await fetch(internalAssetUrl(path), { headers: range ? { range } : {}, redirect: 'follow' })
    if (!upstream.ok && upstream.status !== 206) return res.status(502).json({ ok: false, error: 'Could not load the asset.' })
    res.status(upstream.status)
    PASS.forEach((h) => { const v = upstream.headers.get(h); if (v) res.setHeader(h, v) })
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    if (req.method === 'HEAD' || !upstream.body) return res.end()
    Readable.fromWeb(upstream.body).pipe(res)
  } catch (e) {
    console.error('[preview.asset] failed:', e)
    return res.status(500).json({ ok: false, error: 'Stream failed.' })
  }
}

/* ── Ready-to-Launch responses (pipeline + notify) ────────────────────────── */
const NOTIFY_TO = process.env.EMAIL_NOTIFY || 'hello@digitalskylineco.com'
const FROM = process.env.EMAIL_FROM || 'Digital Skyline Co. <hello@digitalskylineco.com>'
const R_LABEL = { loved: '🚀 Loves it — ready to build', changes: '✏️ Wants a few changes', consult: '📅 Wants a consultation' }

async function respond({ token, action, note }, res) {
  if (!['loved', 'changes', 'consult'].includes(action)) return res.status(400).json({ ok: false, error: 'Invalid action.' })
  const p = await getPreview(token)
  if (!p) return res.status(404).json({ ok: false, error: 'This preview link is no longer valid.' })

  const now = new Date().toISOString()
  await sb(`preview_links?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ response: action, response_note: (note || '').slice(0, 1000) || null, responded_at: now }) })
    .catch((e) => console.error('[preview.respond] record failed:', e.message))

  if (p.prospect_id) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const stageFor = { loved: 'Negotiating', consult: 'Consultation Booked', changes: 'Contacted' }[action]
    const patch = { last_contacted_at: now, next_follow_up: tomorrow }
    if (action === 'loved' || action === 'consult') patch.status = stageFor
    await sb(`prospects?id=eq.${p.prospect_id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      .catch(async () => { await sb(`prospects?id=eq.${p.prospect_id}`, { method: 'PATCH', body: JSON.stringify({ last_contacted_at: now, next_follow_up: tomorrow }) }).catch(() => {}) })
    await sb(`prospects?id=eq.${p.prospect_id}&select=notes`).then(async (r) => {
      const rows = await r.json().catch(() => [])
      const noteLine = `Preview ${action.toUpperCase()}${note ? `: ${note}` : ''} — ${new Date().toLocaleString()}`
      await sb(`prospects?id=eq.${p.prospect_id}`, { method: 'PATCH', body: JSON.stringify({ notes: `${noteLine}\n\n${rows[0]?.notes || ''}`.slice(0, 8000) }) })
    }).catch(() => {})
  }

  notify(p, action, note).catch((e) => console.error('[preview.respond] notify failed:', e.message))
  return res.status(200).json({ ok: true, action, bookingUrl: `${SITE}/consultation` })
}

async function notify(p, action, note) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const who = p.business_name || p.contact_email || 'A prospect'
  const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 6px">${R_LABEL[action]}</h2>
    <p style="margin:0 0 4px;color:#444"><b>${esc(who)}</b>${p.owner_name ? ` · ${esc(p.owner_name)}` : ''}${p.contact_email ? ` · ${esc(p.contact_email)}` : ''}</p>
    ${note ? `<p style="margin:12px 0;padding:12px;background:#f6f4ee;border-radius:8px;color:#333">“${esc(note)}”</p>` : ''}
    <p style="margin:14px 0;color:#666;font-size:13px">Responded ${new Date().toLocaleString()} · viewed ${p.view_count || 0}×</p>
    ${p.prospect_id ? `<p style="margin:0"><a href="${SITE}/admin" style="color:#a87f22">Open in Digital Skyline Admin →</a></p>` : ''}
  </div>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [NOTIFY_TO], subject: `${R_LABEL[action]} — ${who}`, html }),
  })
}
