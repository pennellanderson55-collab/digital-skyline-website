import { useState } from 'react'
import { PROSPECT_STATUSES, prospectStatusStyle, scoreBand, fmtDate, isFollowUpDue } from './prospects.js'

/**
 * Sales Pipeline — a Kanban board of prospects by status. Drag a card to a new
 * column to advance it (persists via onUpdate). Click a card to open its panel.
 * Mirrors the existing consultations Pipeline interaction for consistency.
 */
export default function SalesPipeline({ prospects, onUpdate, onOpen }) {
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)

  const drop = (status) => {
    if (dragId) {
      const p = prospects.find((x) => x.id === dragId)
      if (p && p.status !== status) onUpdate(dragId, { status })
    }
    setDragId(null); setOver(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PROSPECT_STATUSES.map((status) => {
        const cards = prospects.filter((p) => p.status === status)
        return (
          <div
            key={status}
            onDragOver={(e) => { e.preventDefault(); setOver(status) }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={() => drop(status)}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition-colors ${
              over === status ? 'border-gold-400/60 bg-gold-400/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${prospectStatusStyle(status)}`}>{status}</span>
              <span className="font-mono text-xs text-gray-500">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((p) => {
                const band = scoreBand(p.website_score)
                const due = isFollowUpDue(p)
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => { setDragId(null); setOver(null) }}
                    onClick={() => onOpen(p)}
                    className="cursor-grab rounded-xl border border-white/10 bg-ink-950/60 p-3 transition-colors hover:border-gold-400/40 active:cursor-grabbing"
                  >
                    <div className="font-display text-sm font-semibold text-gray-100">{p.business_name}</div>
                    <div className="truncate text-xs text-gray-400">{p.industry || '—'}{p.city ? ` · ${p.city}` : ''}</div>
                    <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
                      <span className={band.cls}>{p.website_score == null ? '—' : `score ${p.website_score}`}</span>
                      <span className={due ? 'text-rose-300' : 'text-gray-500'}>{p.next_follow_up ? fmtDate(p.next_follow_up) : ''}</span>
                    </div>
                  </div>
                )
              })}
              {cards.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-gray-600">Drop here</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
