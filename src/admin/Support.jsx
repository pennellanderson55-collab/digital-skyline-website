import { useMemo, useState } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { SUPPORT_STATUSES, SUPPORT_STATUS_STYLES, SUPPORT_TYPES, fmtDateTime } from './ops.js'
import { SearchBar, Th, Td, Empty } from './Clients.jsx'

/**
 * Support tab (Section 7). Lists support requests submitted from /support,
 * with filtering by status / type and free-text search. Status is editable.
 */
export default function Support({ rows, onStatus, onOpen }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [type, setType] = useState('All')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'All' && r.status !== status) return false
      if (type !== 'All' && r.support_type !== type) return false
      if (!term) return true
      return [r.client_name, r.email, r.project_reference, r.message, r.company]
        .filter(Boolean).some((v) => v.toLowerCase().includes(term))
    })
  }, [rows, q, status, type])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search support requests…" />
        <Filter label="Status" value={status} onChange={setStatus} options={['All', ...SUPPORT_STATUSES]} />
        <Filter label="Type" value={type} onChange={setType} options={['All', ...SUPPORT_TYPES]} />
      </div>

      {rows.length === 0 ? (
        <Empty label="No support requests yet. They'll appear here when a client submits the /support form." />
      ) : (
        <div className="mt-4 card-surface overflow-x-auto p-2 shadow-card">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
                <Th>Date</Th><Th>Reference</Th><Th>Client</Th><Th>Email</Th>
                <Th>Type</Th><Th>Message</Th><Th>Status</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.06] text-gray-300">
                  <Td className="whitespace-nowrap font-mono text-xs text-gray-500">{fmtDateTime(r.created_at)}</Td>
                  <Td className="font-mono text-xs text-gold-200">{r.project_reference || '—'}</Td>
                  <Td className="font-medium text-gray-100">{r.client_name || '—'}</Td>
                  <Td>{r.email}</Td>
                  <Td>{r.support_type || '—'}</Td>
                  <Td className="max-w-[280px] truncate text-gray-400" title={r.message}>{r.message}</Td>
                  <Td>
                    <StatusSelect value={r.status} onChange={(s) => onStatus(r.id, { status: s })} />
                  </Td>
                  <Td>
                    <button onClick={() => onOpen(r)} className="btn-ghost px-3 py-1.5 text-xs">View</button>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No requests match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Filter({ label, value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 pr-9 text-sm text-gray-200 focus:border-gold-400/60 focus:outline-none">
        {options.map((o) => <option key={o} value={o} className="bg-ink-900 text-gray-100">{o === 'All' ? `${label}: All` : o}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gold-300">
        <Arrow className="h-3.5 w-3.5 rotate-90" />
      </span>
    </div>
  )
}

function StatusSelect({ value, onChange }) {
  return (
    <div className="relative inline-block">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-lg border px-3 py-1.5 pr-7 text-xs font-medium focus:outline-none ${SUPPORT_STATUS_STYLES[value] || 'border-white/10 text-gray-200'}`}>
        {SUPPORT_STATUSES.map((s) => <option key={s} value={s} className="bg-ink-900 text-gray-100">{s}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70">
        <Arrow className="h-3 w-3 rotate-90" />
      </span>
    </div>
  )
}

/* Detail modal for a single support request. */
export function SupportModal({ row, onClose, onStatus, onSaveNotes }) {
  const [notes, setNotes] = useState(row.admin_notes || '')
  const [saved, setSaved] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4" onClick={onClose}>
      <div className="card-surface relative my-8 w-full max-w-xl p-7 shadow-card" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-5 top-5 text-gray-500 transition-colors hover:text-gray-200" aria-label="Close">✕</button>

        <span className="font-mono text-[11px] uppercase tracking-wider text-gold-300">{row.support_type || 'Support Request'}</span>
        <h3 className="mt-1 font-display text-2xl font-bold text-gray-50">{row.client_name || row.email}</h3>
        <p className="mt-1 text-sm text-gray-400">
          {row.email}{row.company ? ` · ${row.company}` : ''}
        </p>
        <p className="mt-1 font-mono text-xs text-gray-500">
          {row.project_reference ? `${row.project_reference} · ` : ''}{fmtDateTime(row.created_at)}
        </p>

        <div className="mt-5">
          <span className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gray-500">Status</span>
          <StatusSelect value={row.status} onChange={onStatus} />
        </div>

        <div className="mt-6 border-t border-white/[0.08] pt-6">
          <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Message</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-200">{row.message}</p>
        </div>

        <div className="mt-6 border-t border-white/[0.08] pt-6">
          <label className="mb-2 block font-display text-sm text-gray-300">Internal notes</label>
          <textarea rows={4} value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
            placeholder="Private notes about this ticket…"
            className="w-full resize-y rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
          <button onClick={() => { onSaveNotes(notes); setSaved(true) }} className="btn-gold mt-3 text-sm">
            {saved ? 'Saved' : 'Save notes'}
          </button>
        </div>
      </div>
    </div>
  )
}
