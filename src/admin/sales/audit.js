// ============================================================================
// Website Intelligence — client orchestration + display constants.
// Talks to /api/analyze-website, persists results to Supabase (under the
// authenticated session / RLS), and caches completed audits so repeated
// analyses of the same URL don't re-fetch unnecessarily.
// ============================================================================
import { normalizeUrl } from './prospects.js'

// Reuse a completed audit if one for the same URL is newer than this.
export const AUDIT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export const CATEGORIES = [
  { key: 'performance', label: 'Performance' },
  { key: 'seo', label: 'SEO' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'trust', label: 'Trust' },
  { key: 'branding', label: 'Branding' },
  { key: 'mobile_ux', label: 'Mobile UX' },
]

// Audit scores: HIGHER = better site. (Distinct from the manually-entered
// prospects.website_score "opportunity" framing in prospects.js.)
export const auditScore = (n) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return { cls: 'text-gray-500', bar: 'bg-white/10', ring: '#6b7280' }
  if (v >= 75) return { cls: 'text-emerald-300', bar: 'bg-emerald-400/70', ring: '#34d399' }
  if (v >= 50) return { cls: 'text-amber-300', bar: 'bg-amber-400/70', ring: '#fbbf24' }
  return { cls: 'text-rose-300', bar: 'bg-rose-400/70', ring: '#fb7185' }
}

// Steps shown in the animated progress indicator while an analysis runs.
export const ANALYZE_STEPS = [
  'Fetching homepage…',
  'Reading on-page signals…',
  'Scoring performance, SEO & conversion…',
  'Generating AI sales brief…',
  'Saving audit…',
]

// Load a prospect's audit history (newest first). Best-effort.
export async function loadAuditHistory(supabase, prospectId) {
  if (!supabase || !prospectId) return []
  const { data, error } = await supabase
    .from('website_audits')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      throw new Error('website_audits table not found — run supabase/sprint2_website_intelligence.sql.')
    }
    throw new Error(error.message)
  }
  return data || []
}

// Find a fresh cached audit for this URL on this prospect, if any.
export function findCachedAudit(history, url) {
  const target = normalizeUrl(url)
  const hit = history.find((a) => a.url === target && a.status === 'complete')
  if (!hit) return null
  const age = Date.now() - new Date(hit.created_at).getTime()
  return age < AUDIT_TTL_MS ? hit : null
}

// Run a full analysis: cache check → API → persist. Returns { audit, cached }.
export async function runAudit(supabase, { prospect, url, force, history = [] }) {
  const target = normalizeUrl(url)
  if (!target) throw new Error('Enter a website URL first.')

  if (!force) {
    const cached = findCachedAudit(history, target)
    if (cached) return { audit: cached, cached: true }
  }

  const res = await fetch('/api/analyze-website', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: target, businessName: prospect?.business_name, industry: prospect?.industry }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Analysis failed (${res.status}).`)
  }

  // Persist (RLS: authenticated full access). Returns the saved row.
  const insert = {
    prospect_id: prospect.id,
    url: data.url,
    final_url: data.finalUrl || null,
    overall_score: data.overallScore,
    category_scores: data.categoryScores,
    signals: data.signals,
    ai: data.ai,
    ai_model: data.aiModel || null,
    status: 'complete',
  }
  const { data: saved, error } = await supabase.from('website_audits').insert(insert).select().single()
  if (error) throw new Error(error.message)

  return { audit: saved, cached: false, aiSkipped: data.aiSkipped, pageSpeedUsed: data.pageSpeedUsed }
}
