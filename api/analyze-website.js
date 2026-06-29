// ============================================================================
// Vercel Serverless Function — Website Intelligence analyzer (Sprint 2).
//
// POST { url, businessName?, industry? }
//   → { ok, url, finalUrl, signals, categoryScores, overallScore, ai, aiModel,
//       aiSkipped?, analyzedAt }
//
// Homepage-only (no crawling). Deterministic signal collection + scoring always
// runs; the AI sales brief is added when ANTHROPIC_API_KEY is configured and is
// best-effort (a failure there never fails the audit). The frontend persists
// the result to Supabase under the authenticated user's session (RLS), so this
// route holds no DB credentials.
// ============================================================================
import { collectSignals, scoreCategories, tryPageSpeed, normalizeUrl } from './_website-signals.js'
import { generateAiAnalysis } from './_ai-analysis.js'

// Give the function room for the homepage fetch + optional PageSpeed + the AI turn.
export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { url, businessName, industry } = body || {}

  const target = normalizeUrl(url)
  if (!target || !/^https?:\/\/[^.\s]+\.[^.\s]/.test(target)) {
    return res.status(400).json({ ok: false, error: 'Please provide a valid website URL.' })
  }

  console.log(`[analyze-website] analyzing "${target}" for "${businessName || 'unknown'}"`)

  // 1. Deterministic homepage signal collection (required).
  let collected
  try {
    collected = await collectSignals(target)
  } catch (e) {
    console.error('[analyze-website] fetch/parse failed:', e)
    return res.status(502).json({ ok: false, error: `Could not analyze the site: ${String(e?.message || e)}` })
  }
  if (!collected.ok) {
    return res.status(502).json({ ok: false, error: collected.error, finalUrl: collected.finalUrl })
  }

  // 2. Optional PageSpeed, then category scoring (always runs).
  const pageSpeed = await tryPageSpeed(collected.finalUrl)
  const { category_scores, overall } = scoreCategories(collected.signals, pageSpeed)

  // 3. AI sales brief (best-effort).
  let ai = null
  let aiModel = null
  let aiSkipped
  try {
    const result = await generateAiAnalysis({
      businessName, industry,
      url: collected.finalUrl,
      signals: collected.signals,
      categoryScores: category_scores,
      overallScore: overall,
    })
    ai = result.ai
    aiModel = result.model
    aiSkipped = result.skipped || result.error
    if (aiSkipped) console.warn(`[analyze-website] AI not produced: ${aiSkipped}`)
  } catch (e) {
    console.error('[analyze-website] AI generation failed (audit still returned):', e)
    aiSkipped = `AI generation error: ${String(e?.message || e)}`
  }

  console.log(`[analyze-website] done — score ${overall}/100, ai=${ai ? 'yes' : 'no'}, pagespeed=${pageSpeed != null}`)

  // TEMPORARY runtime debugging — never exposes the key itself, only a boolean.
  // Remove after diagnosing ANTHROPIC_API_KEY availability on Vercel.
  const _debug = {
    anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
  }

  return res.status(200).json({
    ok: true,
    url: target,
    finalUrl: collected.finalUrl,
    signals: collected.signals,
    categoryScores: category_scores,
    overallScore: overall,
    pageSpeedUsed: pageSpeed != null,
    ai,
    aiModel,
    aiSkipped,
    analyzedAt: new Date().toISOString(),
    _debug,
  })
}
