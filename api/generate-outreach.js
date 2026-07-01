// ============================================================================
// Vercel Serverless Function — Outreach AI draft generator (Sprint 3).
//
// POST { type, prospect: { business_name, industry, city, state },
//        audit: { overall_score, ai, signals } }
//   → { ok, type, subject, body, model }
//
// Generates ONE outreach asset on demand. The frontend persists the result to
// Supabase (RLS, authenticated session) — this route holds no DB credentials
// and does NOT send anything. Draft generation only: no email, no Gmail, no
// bulk. Receives structured audit findings only — never website HTML.
// ============================================================================
import { generateOutreach, OUTREACH_TYPES } from './_outreach.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { type, prospect, audit, noWebsite } = body || {}

  if (!type || !OUTREACH_TYPES.includes(type)) {
    return res.status(400).json({ ok: false, error: `Provide a valid "type" (${OUTREACH_TYPES.join(', ')}).` })
  }
  if (!prospect || !prospect.business_name) {
    return res.status(400).json({ ok: false, error: 'Missing prospect context.' })
  }

  console.log(`[generate-outreach] type=${type} mode=${noWebsite ? 'no-website' : 'website-audit'} for "${prospect.business_name}"`)

  try {
    const result = await generateOutreach({ type, prospect, audit: audit || {}, noWebsite: noWebsite || null })
    if (result.error) {
      return res.status(502).json({ ok: false, error: result.error })
    }
    return res.status(200).json({
      ok: true,
      type: result.type,
      subject: result.subject,
      body: result.body,
      model: result.model,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[generate-outreach] failed:', e)
    return res.status(500).json({ ok: false, error: `Outreach generation failed: ${String(e?.message || e)}` })
  }
}
