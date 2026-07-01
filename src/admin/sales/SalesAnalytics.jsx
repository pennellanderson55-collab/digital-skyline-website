import { useMemo } from 'react'
import { PROSPECT_STATUSES, prospectStatusStyle } from './prospects.js'

/**
 * Sales Analytics — distribution of the prospect base by status, industry,
 * source and website-score band. Pure client-side tallies over the already-
 * loaded prospects (no extra Supabase queries).
 */
export default function SalesAnalytics({ prospects }) {
  const { byStatus, byIndustry, bySource, byScore, funnel } = useMemo(() => {
    const tally = (keyFn) => {
      const m = {}
      prospects.forEach((p) => {
        const k = keyFn(p)
        if (k == null || k === '') return
        m[k] = (m[k] || 0) + 1
      })
      return Object.entries(m).sort((a, b) => b[1] - a[1])
    }

    const byStatus = PROSPECT_STATUSES
      .map((s) => [s, prospects.filter((p) => p.status === s).length])
      .filter(([, v]) => v > 0)

    const scoreBucket = (p) => {
      if (p.website_score == null) return null
      if (p.website_score < 40) return 'Opportunity (<40)'
      if (p.website_score < 70) return 'Mid (40–69)'
      return 'High (70+)'
    }

    // Simple funnel: how far prospects have progressed (closed-lost excluded).
    const order = [
      'New Lead', 'Website Audited', 'Outreach Started', 'Contacted', 'Follow-up Scheduled',
      'Consultation Booked', 'Proposal Sent', 'Negotiating', 'Won',
    ]
    const funnel = order.map((s) => [s, prospects.filter((p) => p.status === s).length])

    return {
      byStatus,
      byIndustry: tally((p) => p.industry).slice(0, 10),
      bySource: tally((p) => p.source),
      byScore: tally(scoreBucket),
      funnel,
    }
  }, [prospects])

  if (prospects.length === 0) {
    return <div className="card-surface p-10 text-center text-gray-500 shadow-card">No prospect data yet. Add prospects to see analytics.</div>
  }

  const total = prospects.length

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="By Status">
        <div className="space-y-3">
          {byStatus.map(([label, value]) => (
            <Bar key={label} label={<span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${prospectStatusStyle(label)}`}>{label}</span>} value={value} max={total} total={total} />
          ))}
        </div>
      </Card>

      <Card title="Pipeline Funnel" note="Count currently sitting at each stage.">
        <div className="space-y-3">
          {funnel.map(([label, value]) => (
            <Bar key={label} label={label} value={value} max={Math.max(1, funnel[0][1])} total={total} />
          ))}
        </div>
      </Card>

      <Card title="By Industry">
        <div className="space-y-3">
          {byIndustry.length === 0 ? <Empty /> : byIndustry.map(([label, value]) => (
            <Bar key={label} label={label} value={value} max={byIndustry[0][1]} total={total} />
          ))}
        </div>
      </Card>

      <Card title="By Source">
        <div className="space-y-3">
          {bySource.length === 0 ? <Empty /> : bySource.map(([label, value]) => (
            <Bar key={label} label={label} value={value} max={bySource[0][1]} total={total} />
          ))}
        </div>
      </Card>

      <Card title="Website Score Bands" note="Lower scores = bigger opportunity.">
        <div className="space-y-3">
          {byScore.length === 0 ? <Empty /> : byScore.map(([label, value]) => (
            <Bar key={label} label={label} value={value} max={Math.max(...byScore.map(([, v]) => v))} total={total} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function Card({ title, note, children }) {
  return (
    <div className="card-surface p-6 shadow-card">
      <h3 className="font-display text-lg font-semibold text-gray-50">{title}</h3>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
      <div className="mt-5">{children}</div>
    </div>
  )
}

function Bar({ label, value, max, total }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="font-mono text-gray-500">{value}{total ? ` · ${Math.round((value / total) * 100)}%` : ''}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
        <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const Empty = () => <p className="text-sm text-gray-500">No data yet.</p>
