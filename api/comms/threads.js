// ============================================================================
// GET /api/comms/threads?folder=inbox|sent|drafts|scheduled|archive
//   → { ok, folder, source, configured, threads: [...] }
//
// Provider-agnostic thread list. inbox/archive come from the INBOX provider
// (Gmail, if configured); sent/drafts/scheduled come from the comms_messages
// log (any provider). The UI renders `threads` the same way regardless of
// source, and falls back to its own demo/empty state when configured=false.
// ============================================================================
import { getInboxProvider } from '../_mail/registry.js'
import { sbSelect, sbConfigured } from '../_sb.js'

const FOLDER_MAP = { drafts: 'draft', sent: 'sent', scheduled: 'scheduled', archive: 'archive', inbox: 'inbox' }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const folder = String(req.query?.folder || 'inbox')

  try {
    // Live inbox / archive from the configured inbox provider (Gmail).
    if (folder === 'inbox' || (folder === 'archive' && getInboxProvider())) {
      const provider = getInboxProvider()
      if (!provider) return res.status(200).json({ ok: true, folder, source: 'none', configured: false, threads: [] })
      const threads = await provider.listThreads(folder, { limit: 25 })
      return res.status(200).json({ ok: true, folder, source: provider.id, configured: true, threads })
    }

    // sent / drafts / scheduled / archive from the message log.
    if (!sbConfigured()) return res.status(200).json({ ok: true, folder, source: 'none', configured: false, threads: [] })
    const dbFolder = FOLDER_MAP[folder] || 'sent'
    const rows = await sbSelect('comms_messages', `folder=eq.${dbFolder}&order=created_at.desc&limit=50`)
    const threads = rows.map((r) => ({
      id: r.id,
      from: r.direction === 'inbound' ? (r.from_email || 'Contact') : 'You',
      email: r.to_email || r.contact_email || r.from_email || '',
      business: r.to_email || r.contact_email || '',
      subject: r.subject || '(no subject)',
      preview: (r.body || '').split('\n').find(Boolean) || '',
      body: r.body || '',
      at: r.sent_at || r.created_at,
      sendAt: r.scheduled_for ? new Date(r.scheduled_for).toLocaleString() : undefined,
      opened: !!r.opened_at,
      clicked: false,
      provider: r.provider,
    }))
    return res.status(200).json({ ok: true, folder, source: 'supabase', configured: true, threads })
  } catch (e) {
    console.error('[comms/threads] failed:', e)
    return res.status(200).json({ ok: true, folder, source: 'error', configured: false, threads: [], error: String(e?.message || e) })
  }
}
