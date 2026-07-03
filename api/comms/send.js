// ============================================================================
// POST /api/comms/send — provider-agnostic outbound send / schedule / draft.
//
// Body: {
//   action?: 'send' | 'schedule' | 'draft',   (default 'send')
//   to, cc?, bcc?, subject, body,
//   replyTo?, attachments?: [{label,kind,size,url,secure,content?}],
//   scheduledFor?: ISO string,                 (required for 'schedule')
//   crm?: { prospect_id?, client_id?, project_id?, contact_email? }
// }
// → { ok, id, provider, folder, sandbox, to }
//
// Uses whichever outbound provider the registry hands back (Resend primary).
// Every message is logged to comms_messages (best-effort, service role) so
// Sent / Scheduled / Drafts persist regardless of provider. SANDBOX: when
// EMAIL_SANDBOX_MODE is truthy, sends reroute to the test inbox.
// ============================================================================
import { getOutboundProvider } from '../_mail/registry.js'
import { sbInsert, sbConfigured } from '../_sb.js'

export const config = { maxDuration: 30 }

const isSandbox = () => /^(1|true|yes|on)$/i.test(String(process.env.EMAIL_SANDBOX_MODE || ''))
const SANDBOX_INBOX = process.env.EMAIL_SANDBOX_TO || 'pernellanderson55@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const {
    action = 'send', to, cc, bcc, subject, body: text,
    replyTo, attachments = [], scheduledFor, crm = {},
  } = body || {}

  const recipient = String(to || crm.contact_email || '').trim()
  const log = (extra) => logMessage({ to: recipient, cc, bcc, subject, body: text, attachments, crm, ...extra })

  // ── Draft: persist only, no send ─────────────────────────────────────────
  if (action === 'draft') {
    const row = await log({ folder: 'draft', status: 'draft', direction: 'outbound' })
    return res.status(200).json({ ok: true, folder: 'draft', id: row?.id || null })
  }

  // ── Validation for send/schedule ─────────────────────────────────────────
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
    return res.status(400).json({ ok: false, error: 'A valid recipient email is required.' })
  if (!subject?.trim()) return res.status(400).json({ ok: false, error: 'Subject is required.' })
  if (!text?.trim()) return res.status(400).json({ ok: false, error: 'Message body is empty.' })

  // ── Schedule: persist for later, no send now ─────────────────────────────
  if (action === 'schedule') {
    if (!scheduledFor) return res.status(400).json({ ok: false, error: 'scheduledFor is required to schedule.' })
    const row = await log({ folder: 'scheduled', status: 'scheduled', direction: 'outbound', scheduled_for: scheduledFor })
    return res.status(200).json({ ok: true, folder: 'scheduled', id: row?.id || null, scheduledFor })
  }

  // ── Send now via the outbound provider ───────────────────────────────────
  const provider = getOutboundProvider()
  if (!provider) {
    return res.status(502).json({ ok: false, error: 'No outbound email provider configured. Set RESEND_API_KEY (or Gmail OAuth) in Vercel.' })
  }

  const sandbox = isSandbox()
  const dest = sandbox ? SANDBOX_INBOX : recipient
  const finalSubject = sandbox ? `[TEST] ${subject}` : subject

  try {
    const result = await provider.send({ to: dest, cc, bcc, replyTo, subject: finalSubject, body: text, attachments })
    const row = await log({
      folder: 'sent', status: 'sent', direction: 'outbound',
      provider: provider.id, provider_message_id: result.id, sent_at: new Date().toISOString(),
    })
    return res.status(200).json({ ok: true, id: row?.id || null, providerMessageId: result.id, provider: provider.id, folder: 'sent', sandbox, to: dest })
  } catch (e) {
    await log({ folder: 'sent', status: 'failed', direction: 'outbound', provider: provider.id, error: String(e?.message || e) })
    console.error('[comms/send] failed:', e)
    return res.status(502).json({ ok: false, error: String(e?.message || e) })
  }
}

// Best-effort persistence — never blocks or fails the send if the table/keys
// aren't there yet (run supabase/comms.sql to enable Sent/Drafts/Scheduled).
async function logMessage({ to, cc, bcc, subject, body, attachments, crm, folder, status, direction, provider, provider_message_id, sent_at, scheduled_for, error }) {
  if (!sbConfigured()) return null
  try {
    return await sbInsert('comms_messages', {
      direction: direction || 'outbound',
      provider: provider || null,
      provider_message_id: provider_message_id || null,
      folder,
      status,
      from_email: process.env.EMAIL_FROM || 'hello@digitalskylineco.com',
      to_email: to || null,
      cc: cc || null,
      bcc: bcc || null,
      subject: subject || null,
      body: body || null,
      attachments: attachments || [],
      prospect_id: crm.prospect_id || null,
      client_id: crm.client_id || null,
      project_id: crm.project_id || null,
      contact_email: crm.contact_email || to || null,
      scheduled_for: scheduled_for || null,
      sent_at: sent_at || null,
      error: error || null,
    })
  } catch (e) {
    console.error('[comms/send] log skipped:', e.message)
    return null
  }
}
