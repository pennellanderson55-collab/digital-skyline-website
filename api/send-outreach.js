// ============================================================================
// Vercel Serverless Function — send ONE outreach email via Resend (Sprint 5).
//
// POST { draft: { id, subject, body, recipient_email }, prospect }
//   → { ok, messageId, sandbox, to, from }
//
// Server-side only: RESEND_API_KEY never reaches the browser. Sends through
// Resend's REST API (no SDK dependency). The caller (Sending Queue) persists
// the result to Supabase and advances the CRM — this route only sends.
//
// SANDBOX: when EMAIL_SANDBOX_MODE is truthy, every email is rerouted to the
// test inbox and the subject is prefixed with [TEST] — nothing reaches a real
// prospect. SAFETY: refuses to send without a recipient, subject or body.
// ============================================================================
import { buildOutreachEmail } from './_email-template.js'

export const config = { maxDuration: 30 }

const FROM_NAME = 'Digital Skyline'
const FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL || 'hello@digitalskylineco.com'
const REPLY_TO = process.env.OUTREACH_REPLY_TO || 'hello@digitalskylineco.com'
const SANDBOX_INBOX = process.env.EMAIL_SANDBOX_TO || 'pernellanderson55@gmail.com'
const SITE = (process.env.SITE_URL || 'https://digitalskylineco.com').replace(/\/$/, '')

export const isSandbox = () => /^(1|true|yes|on)$/i.test(String(process.env.EMAIL_SANDBOX_MODE || ''))

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { draft = {}, prospect = {} } = body || {}

  // ── Safety guards: never send empty / recipient-less mail ──────────────────
  const recipient = (draft.recipient_email || prospect.email || '').trim()
  const subject = (draft.subject || '').trim()
  const text = (draft.body || '').trim()
  if (!recipient) return res.status(400).json({ ok: false, error: 'No recipient email — add one before sending.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return res.status(400).json({ ok: false, error: 'Recipient email is not valid.' })
  if (!subject) return res.status(400).json({ ok: false, error: 'Draft has no subject.' })
  if (!text) return res.status(400).json({ ok: false, error: 'Draft is empty.' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(502).json({ ok: false, error: 'RESEND_API_KEY not set — configure it in Vercel to send.' })

  const sandbox = isSandbox()
  const to = sandbox ? SANDBOX_INBOX : recipient
  const finalSubject = sandbox ? `[TEST] ${subject}` : subject

  const html = buildOutreachEmail({
    subject: finalSubject,
    body: text,
    prospect,
    links: {
      // CTA destinations are pinned to the exact public pages the button text
      // promises (www host). "Schedule" points to the consultation page rather
      // than the prospect-specific /api/book link.
      book: 'https://www.digitalskylineco.com/consultation',
      portfolio: 'https://www.digitalskylineco.com/#portfolio',
      packages: 'https://www.digitalskylineco.com/#pricing',
      site: 'https://www.digitalskylineco.com',
    },
  })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        reply_to: REPLY_TO,
        subject: finalSubject,
        html,
        ...(sandbox ? {} : {}),
      }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      console.error('[send-outreach] resend error:', data)
      return res.status(502).json({ ok: false, error: data?.message || `Resend failed (${r.status}).` })
    }
    console.log(`[send-outreach] sent id=${data?.id} sandbox=${sandbox} to=${to}`)
    return res.status(200).json({
      ok: true,
      messageId: data?.id || null,
      sandbox,
      to,
      from: FROM_EMAIL,
      sentAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[send-outreach] failed:', e)
    return res.status(500).json({ ok: false, error: `Send failed: ${String(e?.message || e)}` })
  }
}
