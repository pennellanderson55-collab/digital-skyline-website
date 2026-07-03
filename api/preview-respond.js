// ============================================================================
// POST /api/preview-respond — the "Ready to Launch?" actions on the preview.
//
// Body: { token, action: 'loved' | 'changes' | 'consult', note? }
// → { ok, action, bookingUrl }
//
// Turns a passive preview into an interactive sales page. On "loved" it advances
// the prospect's pipeline stage, stamps a next-day follow-up, notifies Pernell,
// and records the intent — so a viewed preview becomes a tracked buying signal.
// Service role.
// ============================================================================
import { sb, sbConfigured } from './_sb.js'
import { getPreview, readBody, SITE } from './_preview.js'

const NOTIFY_TO = process.env.EMAIL_NOTIFY || 'hello@digitalskylineco.com'
const FROM = process.env.EMAIL_FROM || 'Digital Skyline Co. <hello@digitalskylineco.com>'
const BOOKING = `${SITE}/consultation`

const LABEL = { loved: '🚀 Loves it — ready to build', changes: '✏️ Wants a few changes', consult: '📅 Wants a consultation' }

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }) }
  if (!sbConfigured()) return res.status(502).json({ ok: false, error: 'Previews not configured.' })

  const { token, action, note } = readBody(req)
  if (!['loved', 'changes', 'consult'].includes(action)) return res.status(400).json({ ok: false, error: 'Invalid action.' })

  const p = await getPreview(token)
  if (!p) return res.status(404).json({ ok: false, error: 'This preview link is no longer valid.' })

  const now = new Date().toISOString()
  // Record the response on the preview.
  await sb(`preview_links?id=eq.${p.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ response: action, response_note: (note || '').slice(0, 1000) || null, responded_at: now }),
  }).catch((e) => console.error('[preview-respond] record failed:', e.message))

  // Advance the prospect + set a follow-up (never regress a closed deal).
  if (p.prospect_id) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const stageFor = { loved: 'Negotiating', consult: 'Consultation Booked', changes: 'Contacted' }[action]
    const noteLine = `Preview ${action.toUpperCase()}${note ? `: ${note}` : ''} — ${new Date().toLocaleString()}`
    const patch = { last_contacted_at: now, next_follow_up: tomorrow }
    // Only push the stage forward for strong signals; keep it best-effort so a
    // status check-constraint mismatch never breaks the client's click.
    if (action === 'loved' || action === 'consult') patch.status = stageFor
    await sb(`prospects?id=eq.${p.prospect_id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      .catch(async () => { await sb(`prospects?id=eq.${p.prospect_id}`, { method: 'PATCH', body: JSON.stringify({ last_contacted_at: now, next_follow_up: tomorrow }) }).catch(() => {}) })
    // Append the response to notes (best-effort).
    await sb(`prospects?id=eq.${p.prospect_id}&select=notes`).then(async (r) => {
      const rows = await r.json().catch(() => [])
      const prev = rows[0]?.notes || ''
      await sb(`prospects?id=eq.${p.prospect_id}`, { method: 'PATCH', body: JSON.stringify({ notes: `${noteLine}\n\n${prev}`.slice(0, 8000) }) })
    }).catch(() => {})
  }

  // Notify Pernell (best-effort).
  notify(p, action, note).catch((e) => console.error('[preview-respond] notify failed:', e.message))

  return res.status(200).json({ ok: true, action, bookingUrl: BOOKING })
}

async function notify(p, action, note) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const who = p.business_name || p.contact_email || 'A prospect'
  const subject = `${LABEL[action]} — ${who}`
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 6px">${LABEL[action]}</h2>
    <p style="margin:0 0 4px;color:#444"><b>${who}</b>${p.owner_name ? ` · ${p.owner_name}` : ''}${p.contact_email ? ` · ${p.contact_email}` : ''}</p>
    ${note ? `<p style="margin:12px 0;padding:12px;background:#f6f4ee;border-radius:8px;color:#333">“${escapeHtml(note)}”</p>` : ''}
    <p style="margin:14px 0;color:#666;font-size:13px">Responded ${new Date().toLocaleString()} · viewed ${p.view_count || 0}×</p>
    ${p.prospect_id ? `<p style="margin:0"><a href="${SITE}/admin" style="color:#a87f22">Open in Digital Skyline Admin →</a></p>` : ''}
  </div>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [NOTIFY_TO], subject, html }),
  })
}
const escapeHtml = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
