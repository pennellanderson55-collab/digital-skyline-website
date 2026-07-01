import { useMemo } from 'react'
import { prospectStatusStyle, fmtDate, toISODate } from './prospects.js'

/**
 * Follow-ups — every prospect with a next_follow_up date, grouped into
 * Overdue · Today · Upcoming. (Sprint 1 = preparation only; automation lands
 * in Sprint 2.) Click a row to open the prospect panel.
 */
export default function FollowUps({ prospects, onOpen }) {
  const groups = useMemo(() => {
    const today = toISODate(new Date())
    const active = prospects.filter(
      (p) => p.next_follow_up && p.status !== 'Won' && p.status !== 'Lost'
    ).sort((a, b) => new Date(a.next_follow_up) - new Date(b.next_follow_up))

    return {
      overdue: active.filter((p) => p.next_follow_up < today),
      today: active.filter((p) => p.next_follow_up === today),
      upcoming: active.filter((p) => p.next_follow_up > today),
    }
  }, [prospects])

  const empty = groups.overdue.length + groups.today.length + groups.upcoming.length === 0

  if (empty) {
    return (
      <div className="card-surface p-10 text-center text-gray-500 shadow-card">
        No follow-ups scheduled. Open a prospect and use “Schedule Follow-up” to set one.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Bucket title="Overdue" tone="rose" rows={groups.overdue} onOpen={onOpen} />
      <Bucket title="Today" tone="gold" rows={groups.today} onOpen={onOpen} />
      <Bucket title="Upcoming" tone="sky" rows={groups.upcoming} onOpen={onOpen} />
    </div>
  )
}

const TONES = {
  rose: 'text-rose-300',
  gold: 'text-gold-200',
  sky: 'text-sky-200',
}

function Bucket({ title, tone, rows, onOpen }) {
  if (rows.length === 0) return null
  return (
    <div className="card-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <h3 className={`font-display text-base font-semibold ${TONES[tone]}`}>{title}</h3>
        <span className="font-mono text-xs text-gray-500">{rows.length}</span>
      </div>
      <ul className="divide-y divide-white/[0.06]">
        {rows.map((p) => (
          <li key={p.id} onClick={() => onOpen(p)}
            className="flex cursor-pointer items-center justify-between gap-4 py-3 transition-colors hover:bg-gold-400/[0.04]">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-100">{p.business_name}</span>
              <span className="text-xs text-gray-500">
                {[p.industry, p.owner_name, p.phone].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${prospectStatusStyle(p.status)}`}>{p.status}</span>
              <span className={`font-mono text-xs ${TONES[tone]}`}>{fmtDate(p.next_follow_up)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
