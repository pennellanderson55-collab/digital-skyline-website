// ============================================================================
// Vercel Serverless Function — outbound email via the Resend REST API.
//
// Server-only: RESEND_API_KEY never reaches the browser bundle. The frontend
// POSTs { type, data } here; we build the templates and send a client-facing
// confirmation plus an internal notification. Best-effort by contract — if the
// key isn't configured yet it returns ok:false so callers don't surface errors.
// ============================================================================
import { buildEmail } from './_templates.js'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Not configured yet — graceful no-op so booking/support flows still succeed.
    return res.status(200).json({ ok: false, skipped: 'RESEND_API_KEY not set' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { type, data } = body || {}

  let messages
  try {
    messages = buildEmail(type, data || {})
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  try {
    const results = await Promise.allSettled(
      messages.map((m) =>
        fetch(RESEND_ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(m),
        }).then(async (r) => { if (!r.ok) throw new Error(await r.text()) })
      )
    )
    const failed = results.filter((r) => r.status === 'rejected').map((f) => String(f.reason))
    if (failed.length) return res.status(502).json({ ok: false, sent: messages.length - failed.length, errors: failed })
    return res.status(200).json({ ok: true, sent: messages.length })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
