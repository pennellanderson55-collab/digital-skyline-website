import { useMemo } from 'react'
import { Sparkle } from '../../components/Icons.jsx'
import { ratingStars } from './prospects.js'
import { buildNoWebsiteOpportunity } from './noWebsite.js'

/**
 * No Website Opportunity — shown instead of Website Intelligence when a prospect
 * has no website. Fully deterministic (no AI, no network): recomputes instantly
 * from the prospect's fields, so it's ready the moment a website-less lead is
 * added (incl. future Lead Finder leads). Outreach AI uses the same analysis.
 */
export default function NoWebsiteOpportunity({ prospect }) {
  const opp = useMemo(() => buildNoWebsiteOpportunity(prospect), [prospect])
  const rating = Number(prospect.google_rating) || 0
  const reviews = Number(prospect.google_reviews) || 0

  return (
    <div className="space-y-5">
      {/* Status + opportunity score */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
        <ScoreRing value={opp.score} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Website Status</div>
          <div className="mt-1 inline-flex rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-3 py-1 text-sm font-medium text-amber-200">
            {opp.website_status}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-300">
            {prospect.industry && <span>{prospect.industry}</span>}
            {(prospect.city || prospect.state) && <span>{[prospect.city, prospect.state].filter(Boolean).join(', ')}</span>}
            {rating > 0 && <span className="text-amber-200">{ratingStars(rating)} <span className="text-gray-400">{rating}{reviews ? ` · ${reviews} reviews` : ''}</span></span>}
          </div>
        </div>
      </div>

      <Block title="Why This Is an Opportunity" tone="gold">{opp.why}</Block>

      <div className="rounded-xl border border-gold-400/25 bg-gold-400/[0.05] p-4">
        <div className="font-mono text-[11px] uppercase tracking-wider text-gold-300">Recommended Package</div>
        <div className="mt-1 font-display text-lg font-semibold text-gray-50">{opp.recommended_package}</div>
        <p className="mt-1 text-sm text-gray-300">{opp.recommended_package_reason}</p>
      </div>

      <ListBlock title="Suggested Talking Points" items={opp.talking_points} />
      <ListBlock title="Suggested Consultation Questions" items={opp.consultation_questions} />

      <div className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-gray-400">
        <Sparkle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300" />
        <span>The <span className="text-gold-200">Outreach AI</span> tab uses this opportunity analysis instead of a website audit — it generates outreach focused on getting {prospect.business_name || 'them'} online, never on improving a site they don't have.</span>
      </div>
    </div>
  )
}

function ScoreRing({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const r = 34
  const circ = 2 * Math.PI * r
  // Higher opportunity = warmer/gold.
  const ring = v >= 75 ? '#d4af37' : v >= 50 ? '#fbbf24' : '#9ca3af'
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={ring} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (v / 100) * circ} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-gold-100">{v}</span>
        <span className="font-mono text-[9px] text-gray-500">opportunity</span>
      </div>
    </div>
  )
}

function Block({ title, tone, children }) {
  const ring = tone === 'gold' ? 'border-gold-400/25' : 'border-white/[0.08]'
  return (
    <div className={`rounded-xl border ${ring} bg-white/[0.02] p-4`}>
      <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-200">{children}</p>
    </div>
  )
}

function ListBlock({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">{title}</div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-gray-200">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
            <span className="leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
