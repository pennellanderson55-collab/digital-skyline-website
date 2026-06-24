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
    console.error('[send-email] RESEND_API_KEY is not set — skipping send. Add it in Vercel → Settings → Environment Variables.')
    return res.status(200).json({ ok: false, skipped: 'RESEND_API_KEY not set' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { type, data } = body || {}
  console.log(`[send-email] received request type="${type}" client="${(data && data.email) || 'none'}"`)

  let messages
  try {
    messages = buildEmail(type, data || {})
  } catch (e) {
    console.error(`[send-email] template build failed for type="${type}":`, e.message)
    return res.status(400).json({ error: e.message })
  }

  // INVARIANT: all mail is branded Resend mail FROM a verified business address
  // (never FormSubmit, never a personal inbox). This guard makes that impossible
  // to violate even if a template is edited later, and guarantees clients only
  // ever receive email from the digitalskylineco.com domain.
  const BUSINESS_DOMAIN = 'digitalskylineco.com'
  const allValid = messages.length > 0 && messages.every(
    (m) => typeof m.from === 'string' && m.from.includes(BUSINESS_DOMAIN) && typeof m.to === 'string' && m.to.includes('@')
  )
  if (!allValid) {
    console.error('[send-email] refusing to send — invalid From/To on one or more messages:',
      messages.map((m) => ({ from: m.from, to: m.to, subject: m.subject })))
    return res.status(500).json({ error: 'Refusing to send: every message must have a business From and a valid To.' })
  }

  // Visibility in Vercel logs: exactly who each message is addressed to/from.
  console.log('[send-email] sending:', messages.map((m) => ({ from: m.from, to: m.to, subject: m.subject })))

  try {
    const results = await Promise.allSettled(
      messages.map((m) =>
        fetch(RESEND_ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(m),
        }).then(async (r) => {
          const text = await r.text()
          if (!r.ok) throw new Error(`Resend ${r.status} sending to ${m.to}: ${text}`)
          return text
        })
      )
    )
    const failed = results.filter((r) => r.status === 'rejected').map((f) => String(f.reason))
    if (failed.length) {
      console.error(`[send-email] ${failed.length}/${messages.length} message(s) failed:`, failed)
      return res.status(502).json({ ok: false, sent: messages.length - failed.length, errors: failed })
    }
    console.log(`[send-email] ok — sent ${messages.length} message(s) for type="${type}"`)
    return res.status(200).json({ ok: true, sent: messages.length })
  } catch (e) {
    console.error('[send-email] unexpected error:', e)
    return res.status(500).json({ error: String(e) })
  }
}
