import { useMemo } from 'react'
import { balanceDue, fmtMoney, fmtDateTime } from '../ops.js'
import {
  prospectStatusStyle, isFollowUpDue, sameDay, fmtDate,
} from './prospects.js'

/**
 * Executive Sales dashboard. Reads prospects (Sales data) plus the already-
 * loaded consultations / clients / projects (no extra Supabase queries) and
 * renders live KPI cards + four activity feeds.
 */
export default function SalesDashboard({ prospects, consultations, clients, projects, onGoToProspects }) {
  const { cards, addedThisWeek, recentActivity, upcomingFollowUps, newestProspects, recentConsultations } = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 864e5)

    const total = prospects.length
    const addedThisWeek = prospects.filter((p) => new Date(p.created_at) >= weekAgo).length
    const contactedToday = prospects.filter((p) => sameDay(p.last_contacted, now)).length
    const followUpsDue = prospects.filter((p) => isFollowUpDue(p, now)).length
    const consultationsBooked = consultations.length
    const activeClients = clients.length
    const revenue = projects.reduce((s, p) => s + Number(p.amount_paid || 0), 0)

    const cards = [
      { label: 'Total Prospects', value: total, sub: addedThisWeek ? `+${addedThisWeek} this week` : null },
      { label: 'Contacted Today', value: contactedToday },
      { label: 'Follow-Ups Due', value: followUpsDue, alert: followUpsDue > 0 },
      { label: 'Consultations Booked', value: consultationsBooked },
      { label: 'Active Clients', value: activeClients },
      { label: 'Revenue Closed', value: fmtMoney(revenue) },
    ]

    // Recent activity — merge prospect + consultation events, newest first.
    const events = []
    prospects.forEach((p) => events.push({ at: p.created_at, kind: 'Prospect', label: `Added ${p.business_name}` }))
    prospects.forEach((p) => { if (p.last_contacted) events.push({ at: p.last_contacted, kind: 'Outreach', label: `Contacted ${p.business_name}` }) })
    consultations.forEach((c) => events.push({ at: c.created_at, kind: 'Consultation', label: `Consultation — ${c.name}` }))
    const recentActivity = events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8)

    const upcomingFollowUps = prospects
      .filter((p) => p.next_follow_up && p.status !== 'Client' && p.status !== 'Lost')
      .sort((a, b) => new Date(a.next_follow_up) - new Date(b.next_follow_up))
      .slice(0, 6)

    const newestProspects = [...prospects]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)

    const recentConsultations = [...consultations]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)

    return { cards, addedThisWeek, recentActivity, upcomingFollowUps, newestProspects, recentConsultations }
  }, [prospects, consultations, clients, projects])

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-5 shadow-card transition-colors hover:border-gold-400/30">
            <div className={`font-display text-3xl font-bold ${c.alert ? 'text-rose-300' : 'text-gold-gradient'}`}>{c.value}</div>
            <div className="mt-1.5 text-sm text-gray-400">{c.label}</div>
            {c.sub && <div className="mt-1 font-mono text-[11px] text-emerald-300/80">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* feeds */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent Activity">
          {recentActivity.length === 0 ? <EmptyLine text="No activity yet." /> : (
            <ul className="divide-y divide-white/[0.06]">
              {recentActivity.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <KindTag kind={e.kind} />
                    <span className="text-sm text-gray-200">{e.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-gray-500">{fmtDateTime(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming Follow-Ups" action={onGoToProspects && { label: 'View all', onClick: onGoToProspects }}>
          {upcomingFollowUps.length === 0 ? <EmptyLine text="Nothing scheduled." /> : (
            <ul className="divide-y divide-white/[0.06]">
              {upcomingFollowUps.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-100">{p.business_name}</span>
                    <span className="text-xs text-gray-500">{p.industry || '—'}</span>
                  </span>
                  <span className={`shrink-0 font-mono text-[11px] ${isFollowUpDue(p) ? 'text-rose-300' : 'text-gold-200'}`}>{fmtDate(p.next_follow_up)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Newest Prospects" action={onGoToProspects && { label: 'View all', onClick: onGoToProspects }}>
          {newestProspects.length === 0 ? <EmptyLine text="No prospects yet." /> : (
            <ul className="divide-y divide-white/[0.06]">
              {newestProspects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-100">{p.business_name}</span>
                    <span className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(', ') || '—'}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${prospectStatusStyle(p.status)}`}>{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent Consultations">
          {recentConsultations.length === 0 ? <EmptyLine text="No consultations yet." /> : (
            <ul className="divide-y divide-white/[0.06]">
              {recentConsultations.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-100">{c.name}</span>
                    <span className="text-xs text-gray-500">{c.business || '—'}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-gray-500">{fmtDate(c.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, action, children }) {
  return (
    <div className="card-surface p-6 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-gray-50">{title}</h3>
        {action && <button onClick={action.onClick} className="font-mono text-[11px] uppercase tracking-wider text-gold-300 hover:text-gold-200">{action.label}</button>}
      </div>
      {children}
    </div>
  )
}

const KIND_STYLES = {
  Prospect: 'text-sky-200',
  Outreach: 'text-violet-200',
  Consultation: 'text-emerald-200',
}
const KindTag = ({ kind }) => (
  <span className={`font-mono text-[10px] uppercase tracking-wider ${KIND_STYLES[kind] || 'text-gray-400'}`}>{kind}</span>
)
const EmptyLine = ({ text }) => <p className="py-3 text-sm text-gray-500">{text}</p>
