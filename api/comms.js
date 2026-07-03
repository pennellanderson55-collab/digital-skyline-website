// ============================================================================
// /api/comms — single entry point for the Communications hub.
//
// Consolidated into ONE Serverless Function (Hobby-plan function budget):
//   GET  ?op=providers            → capability/provider status
//   GET  ?op=threads&folder=…     → provider-agnostic thread list
//   POST { op:'send', … }         → send / schedule / draft (provider-agnostic)
//   POST { op:'assistant', … }    → live LLM assistant (offline-fallback client)
//
// Provider registry + adapters live in ./_mail/*, the assistant in
// ./_comms-assistant.js (underscore = helpers, not routes).
// ============================================================================
import { getOutboundProvider, getInboxProvider, providerStatus } from './_mail/registry.js'
import { runCommsAssistant } from './_comms-assistant.js'
import { sbInsert, sbSelect, sbConfigured } from './_sb.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const op = String(req.query?.op || '')
    if (op === 'providers') { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ ok: true, ...providerStatus() }) }
    if (op === 'threads') return threads(req, res)
    return res.status(400).json({ ok: false, error: 'Unknown op.' })
  }
  if (req.method === 'POST') {
    const body = parse(req.body)
    if (body.op === 'assistant') return assistant(body, res)
    return send(body, res) // default POST op is 'send'
  }
  res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' })
}

const parse = (b) => { if (typeof b === 'string') { try { return JSON.parse(b) } catch { return {} } } return b || {} }

/* ── threads ──────────────────────────────────────────────────────────────── */
const FOLDER_MAP = { drafts: 'draft', sent: 'sent', scheduled: 'scheduled', archive: 'archive', inbox: 'inbox' }
async function threads(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const folder = String(req.query?.folder || 'inbox')
  try {
    if (folder === 'inbox' || (folder === 'archive' && getInboxProvider())) {
      const provider = getInboxProvider()
      if (!provider) return res.status(200).json({ ok: true, folder, source: 'none', configured: false, threads: [] })
      const list = await provider.listThreads(folder, { limit: 25 })
      return res.status(200).json({ ok: true, folder, source: provider.id, configured: true, threads: list })
    }
    if (!sbConfigured()) return res.status(200).json({ ok: true, folder, source: 'none', configured: false, threads: [] })
    const rows = await sbSelect('comms_messages', `folder=eq.${FOLDER_MAP[folder] || 'sent'}&order=created_at.desc&limit=50`)
    const list = rows.map((r) => ({
      id: r.id,
      from: r.direction === 'inbound' ? (r.from_email || 'Contact') : 'You',
      email: r.to_email || r.contact_email || r.from_email || '',
      business: r.to_email || r.contact_email || '',
      subject: r.subject || '(no subject)',
      preview: (r.body || '').split('\n').find(Boolean) || '',
      body: r.body || '',
      at: r.sent_at || r.created_at,
      sendAt: r.scheduled_for ? new Date(r.scheduled_for).toLocaleString() : undefined,
      opened: !!r.opened_at, clicked: false, provider: r.provider,
    }))
    return res.status(200).json({ ok: true, folder, source: 'supabase', configured: true, threads: list })
  } catch (e) {
    console.error('[comms.threads] failed:', e)
    return res.status(200).json({ ok: true, folder, source: 'error', configured: false, threads: [], error: String(e?.message || e) })
  }
}

/* ── send / schedule / draft ──────────────────────────────────────────────── */
const isSandbox = () => /^(1|true|yes|on)$/i.test(String(process.env.EMAIL_SANDBOX_MODE || ''))
const SANDBOX_INBOX = process.env.EMAIL_SANDBOX_TO || 'pernellanderson55@gmail.com'

async function send(body, res) {
  const { action = 'send', to, cc, bcc, subject, body: text, replyTo, attachments = [], scheduledFor, crm = {} } = body
  const recipient = String(to || crm.contact_email || '').trim()
  const log = (extra) => logMessage({ to: recipient, cc, bcc, subject, body: text, attachments, crm, ...extra })

  if (action === 'draft') {
    const row = await log({ folder: 'draft', status: 'draft', direction: 'outbound' })
    return res.status(200).json({ ok: true, folder: 'draft', id: row?.id || null })
  }
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return res.status(400).json({ ok: false, error: 'A valid recipient email is required.' })
  if (!subject?.trim()) return res.status(400).json({ ok: false, error: 'Subject is required.' })
  if (!text?.trim()) return res.status(400).json({ ok: false, error: 'Message body is empty.' })

  if (action === 'schedule') {
    if (!scheduledFor) return res.status(400).json({ ok: false, error: 'scheduledFor is required to schedule.' })
    const row = await log({ folder: 'scheduled', status: 'scheduled', direction: 'outbound', scheduled_for: scheduledFor })
    return res.status(200).json({ ok: true, folder: 'scheduled', id: row?.id || null, scheduledFor })
  }

  const provider = getOutboundProvider()
  if (!provider) return res.status(502).json({ ok: false, error: 'No outbound email provider configured. Set RESEND_API_KEY (or Gmail OAuth) in Vercel.' })

  const sandbox = isSandbox()
  const dest = sandbox ? SANDBOX_INBOX : recipient
  const finalSubject = sandbox ? `[TEST] ${subject}` : subject
  try {
    const result = await provider.send({ to: dest, cc, bcc, replyTo, subject: finalSubject, body: text, attachments })
    const row = await log({ folder: 'sent', status: 'sent', direction: 'outbound', provider: provider.id, provider_message_id: result.id, sent_at: new Date().toISOString() })
    return res.status(200).json({ ok: true, id: row?.id || null, providerMessageId: result.id, provider: provider.id, folder: 'sent', sandbox, to: dest })
  } catch (e) {
    await log({ folder: 'sent', status: 'failed', direction: 'outbound', provider: provider.id, error: String(e?.message || e) })
    console.error('[comms.send] failed:', e)
    return res.status(502).json({ ok: false, error: String(e?.message || e) })
  }
}

async function logMessage({ to, cc, bcc, subject, body, attachments, crm, folder, status, direction, provider, provider_message_id, sent_at, scheduled_for, error }) {
  if (!sbConfigured()) return null
  try {
    return await sbInsert('comms_messages', {
      direction: direction || 'outbound', provider: provider || null, provider_message_id: provider_message_id || null,
      folder, status, from_email: process.env.EMAIL_FROM || 'hello@digitalskylineco.com',
      to_email: to || null, cc: cc || null, bcc: bcc || null, subject: subject || null, body: body || null, attachments: attachments || [],
      prospect_id: crm.prospect_id || null, client_id: crm.client_id || null, project_id: crm.project_id || null,
      contact_email: crm.contact_email || to || null, scheduled_for: scheduled_for || null, sent_at: sent_at || null, error: error || null,
    })
  } catch (e) { console.error('[comms.send] log skipped:', e.message); return null }
}

/* ── assistant ────────────────────────────────────────────────────────────── */
async function assistant({ instruction, email, contact, context }, res) {
  try {
    const result = await runCommsAssistant({ instruction, email: email || {}, contact: contact || {}, context: context || {} })
    if (result.error) return res.status(502).json({ ok: false, error: result.error })
    return res.status(200).json({ ok: true, ...result })
  } catch (e) {
    console.error('[comms.assistant] failed:', e)
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
