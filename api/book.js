// ============================================================================
// Vercel Serverless Function — consultation booking from outreach emails.
//
// GET  /api/book?prospect=<id>  → { ok, prospect: { business_name, owner_name, email } }
// POST /api/book { prospect, name, email, meeting_date, meeting_time, notes }
//      → { ok }  (creates the booking + advances the CRM)
//
// The person booking is UNAUTHENTICATED (they clicked a link in an email), so
// this runs with the Supabase SERVICE ROLE to read the prospect and write the
// booking/CRM update — RLS blocks anon. The prospect id is an unguessable UUID.
// V1 scope: identify prospect → create consultation (outreach_bookings) →
// status "Consultation Scheduled" → save history. No tracking/analytics.
// ============================================================================

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sb(path, init = {}) {
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

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(502).json({ ok: false, error: 'Booking is not configured (SUPABASE_SERVICE_ROLE_KEY missing).' })
  }

  // ── GET: minimal prospect info to personalize the booking page ─────────────
  if (req.method === 'GET') {
    const id = (req.query?.prospect || '').toString()
    if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: 'Invalid booking link.' })
    try {
      const r = await sb(`prospects?id=eq.${id}&select=id,business_name,owner_name,email`)
      const rows = await r.json().catch(() => [])
      if (!r.ok || !rows.length) return res.status(404).json({ ok: false, error: 'This booking link is no longer valid.' })
      const p = rows[0]
      return res.status(200).json({ ok: true, prospect: { business_name: p.business_name, owner_name: p.owner_name, email: p.email } })
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) })
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  // ── POST: create the booking + advance the CRM ─────────────────────────────
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { prospect: prospectId, name, email, meeting_date, meeting_time, notes } = body || {}

  if (!UUID_RE.test((prospectId || '').toString())) return res.status(400).json({ ok: false, error: 'Invalid booking link.' })
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Please enter your name.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return res.status(400).json({ ok: false, error: 'Please enter a valid email.' })
  if (!meeting_date) return res.status(400).json({ ok: false, error: 'Please choose a date.' })
  if (!meeting_time) return res.status(400).json({ ok: false, error: 'Please choose a time.' })

  try {
    // Confirm the prospect exists (and identify them — no manual matching).
    const pr = await sb(`prospects?id=eq.${prospectId}&select=id,business_name`)
    const prospects = await pr.json().catch(() => [])
    if (!pr.ok || !prospects.length) return res.status(404).json({ ok: false, error: 'This booking link is no longer valid.' })

    // 1. Create the consultation / booking history record.
    const insert = await sb('outreach_bookings', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        prospect_id: prospectId,
        name: name.trim(),
        email: email.trim(),
        meeting_date,
        meeting_time,
        notes: (notes || '').trim() || null,
        source: 'outreach-email',
      }),
    })
    if (!insert.ok) {
      const err = await insert.json().catch(() => ({}))
      return res.status(502).json({ ok: false, error: err?.message || 'Could not save the booking.' })
    }

    // 2. Advance the CRM: status -> Consultation Scheduled, stamp contact, clear
    //    the pending follow-up (they booked).
    const nowISO = new Date().toISOString()
    await sb(`prospects?id=eq.${prospectId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'Consultation Scheduled',
        last_booking_at: nowISO,
        last_contacted: nowISO,
        last_contacted_at: nowISO,
        next_follow_up: null,
      }),
    })

    return res.status(200).json({ ok: true, business_name: prospects[0].business_name })
  } catch (e) {
    console.error('[book] failed:', e)
    return res.status(500).json({ ok: false, error: `Booking failed: ${String(e?.message || e)}` })
  }
}
