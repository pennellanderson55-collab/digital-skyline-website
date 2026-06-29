// ============================================================================
// Vercel Serverless Function — extra consultation questions (Sprint 3b).
//
// POST { prospect, audit, count?, existing? } → { ok, questions: string[] }
//
// Generates additional consultation discovery questions on demand (only when
// the user clicks "Generate 5 more"). Structured findings only — never HTML.
// The frontend persists them into website_audits.annotations (RLS session).
// ============================================================================
import { generateMoreQuestions } from './_outreach.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { prospect, audit, count, existing } = body || {}

  if (!prospect || !prospect.business_name) {
    return res.status(400).json({ ok: false, error: 'Missing prospect context.' })
  }

  try {
    const result = await generateMoreQuestions({
      prospect, audit: audit || {}, count: Math.min(8, Math.max(1, count || 5)), existing: existing || [],
    })
    if (result.error) return res.status(502).json({ ok: false, error: result.error })
    return res.status(200).json({ ok: true, questions: result.questions, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[generate-questions] failed:', e)
    return res.status(500).json({ ok: false, error: `Question generation failed: ${String(e?.message || e)}` })
  }
}
