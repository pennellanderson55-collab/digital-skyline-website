import { useMemo, useState } from 'react'
import { PROJECT_STAGES, stageStyle, fmtDate } from './ops.js'
import { SearchBar, Th, Td, Empty } from './Clients.jsx'

const teamMember = (p) =>
  p.assigned_project_manager || p.assigned_designer || p.assigned_developer || p.status_owner || '—'

/**
 * Projects tab (Sections 4 + 5). Toggles between a Table view and a visual
 * Kanban Pipeline (drag-and-drop between the 13 project stages).
 */
export default function Projects({ projects, onOpen, onStageChange }) {
  const [view, setView] = useState('Board')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return projects
    return projects.filter((p) => {
      const c = p.client || {}
      return [p.project_reference, c.company_name, c.contact_name, p.package, p.project_type]
        .filter(Boolean).some((v) => v.toLowerCase().includes(term))
    })
  }, [projects, q])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search projects…" />
        <div className="flex gap-2">
          {['Board', 'Table'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                view === v ? 'border-gold-400/60 bg-gold-400/10 text-gold-100'
                  : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-gold-400/40'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <Empty label="No projects yet. Convert a consultation to create your first project." />
      ) : view === 'Table' ? (
        <Table rows={rows} q={q} onOpen={onOpen} />
      ) : (
        <Board rows={rows} onOpen={onOpen} onStageChange={onStageChange} />
      )}
    </div>
  )
}

function Table({ rows, q, onOpen }) {
  return (
    <div className="mt-4 card-surface overflow-x-auto p-2 shadow-card">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
            <Th>Reference</Th><Th>Client</Th><Th>Package</Th><Th>Type</Th>
            <Th>Stage</Th><Th>Launch Date</Th><Th>Team Member</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const c = p.client || {}
            return (
              <tr key={p.id} onClick={() => onOpen(p)}
                className="cursor-pointer border-t border-white/[0.06] text-gray-300 transition-colors hover:bg-gold-400/[0.04]">
                <Td className="font-mono text-xs text-gold-200">{p.project_reference}</Td>
                <Td className="font-medium text-gray-100">{c.company_name || c.contact_name || '—'}</Td>
                <Td>{p.package || '—'}</Td>
                <Td>{p.project_type || '—'}</Td>
                <Td><span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${stageStyle(p.stage)}`}>{p.stage}</span></Td>
                <Td className="font-mono text-xs">{fmtDate(p.launch_date)}</Td>
                <Td>{teamMember(p)}</Td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">No projects match “{q}”.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Board({ rows, onOpen, onStageChange }) {
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)

  const drop = (stage) => {
    const p = rows.find((r) => r.id === dragId)
    if (p && p.stage !== stage) onStageChange(p, stage)
    setDragId(null)
    setOver(null)
  }

  return (
    <div className="mt-4 flex gap-4 overflow-x-auto pb-4">
      {PROJECT_STAGES.map((stage) => {
        const cards = rows.filter((r) => r.stage === stage)
        return (
          <div
            key={stage}
            onDragOver={(e) => { e.preventDefault(); setOver(stage) }}
            onDragLeave={() => setOver((o) => (o === stage ? null : o))}
            onDrop={() => drop(stage)}
            className={`flex w-64 shrink-0 flex-col rounded-2xl border p-3 transition-colors ${
              over === stage ? 'border-gold-400/60 bg-gold-400/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${stageStyle(stage)}`}>{stage}</span>
              <span className="font-mono text-xs text-gray-500">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((p) => {
                const c = p.client || {}
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => { setDragId(null); setOver(null) }}
                    onClick={() => onOpen(p)}
                    className="cursor-grab rounded-xl border border-white/10 bg-ink-950/60 p-3 transition-colors hover:border-gold-400/40 active:cursor-grabbing"
                  >
                    <div className="font-mono text-[10px] text-gold-300">{p.project_reference}</div>
                    <div className="mt-0.5 truncate font-display text-sm font-semibold text-gray-100">
                      {c.company_name || c.contact_name || 'Client'}
                    </div>
                    <div className="mt-1 truncate text-xs text-gray-400">{p.package || p.project_type || '—'}</div>
                  </div>
                )
              })}
              {cards.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-gray-600">
                  Drop here
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
