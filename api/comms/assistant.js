// ============================================================================
// POST /api/comms/assistant — live LLM assistant for the Communications hub.
//
// Body: { instruction, email:{subject,body}, contact:{...}, context:{...} }
//   → { ok, action, reply, subject, body, chips, model }
//
// Thin wrapper over runCommsAssistant. The client falls back to its offline
// deterministic engine on any non-200, so this route degrades gracefully when
// ANTHROPIC_API_KEY isn't set.
// ============================================================================
import { runCommsAssistant } from '../_comms-assistant.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { instruction, email, contact, context } = body || {}

  try {
    const result = await runCommsAssistant({ instruction, email: email || {}, contact: contact || {}, context: context || {} })
    if (result.error) return res.status(502).json({ ok: false, error: result.error })
    return res.status(200).json({ ok: true, ...result })
  } catch (e) {
    console.error('[comms/assistant] failed:', e)
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
