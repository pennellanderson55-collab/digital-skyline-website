import { useMemo, useState } from 'react'
import { Plus, Arrow } from '../../components/Icons.jsx'
import { SearchBar, Th, Td, Empty } from '../Clients.jsx'
import ProspectPanel from './ProspectPanel.jsx'
import ProspectForm from './ProspectForm.jsx'
import {
  PROSPECT_STATUSES, prospectStatusStyle, INDUSTRIES, scoreBand, ratingStars,
  fmtDate, isFollowUpDue, fmtMoney,
} from './prospects.js'

const SORTS = ['Newest', 'Oldest', 'Name A–Z', 'Website Score ↑', 'Rating ↓']
const SCORE_BANDS = ['All scores', 'Opportunity (<40)', 'Mid (40–69)', 'High (70+)']
const PAGE_SIZES = [10, 25, 50]

/**
 * Prospects — the heart of the Outreach CRM.
 * Searchable / sortable / filterable table with client-side pagination
 * (server-side .range() is a drop-in for Sprint 2 once volume grows).
 */
export default function Prospects({ prospects, loading, error, onAdd, onUpdate, onDelete }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [industry, setIndustry] = useState('All')
  const [scoreBandSel, setScoreBandSel] = useState('All scores')
  const [sort, setSort] = useState('Newest')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  // Keep the open panel in sync with the latest data after an edit.
  const selectedLive = selected ? prospects.find((p) => p.id === selected.id) || null : null

  const industries = useMemo(() => {
    const set = new Set(prospects.map((p) => p.industry).filter(Boolean))
    return ['All', ...Array.from(new Set([...INDUSTRIES, ...set]))]
  }, [prospects])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const inBand = (s) => {
      if (scoreBandSel === 'All scores') return true
      if (s == null) return false
      if (scoreBandSel.startsWith('Opportunity')) return s < 40
      if (scoreBandSel.startsWith('Mid')) return s >= 40 && s < 70
      return s >= 70
    }
    let rows = prospects.filter((p) => {
      if (status !== 'All' && p.status !== status) return false
      if (industry !== 'All' && p.industry !== industry) return false
      if (!inBand(p.website_score)) return false
      if (!term) return true
      return [p.business_name, p.owner_name, p.email, p.phone, p.city, p.website, p.industry]
        .filter(Boolean).some((v) => v.toLowerCase().includes(term))
    })
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'Oldest': return new Date(a.created_at) - new Date(b.created_at)
        case 'Name A–Z': return (a.business_name || '').localeCompare(b.business_name || '')
        case 'Website Score ↑': return (a.website_score ?? 999) - (b.website_score ?? 999)
        case 'Rating ↓': return (b.google_rating ?? -1) - (a.google_rating ?? -1)
        default: return new Date(b.created_at) - new Date(a.created_at) // Newest
      }
    })
    return rows
  }, [prospects, q, status, industry, scoreBandSel, sort])

  // Reset to page 0 whenever the filtered result set changes shape.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const resetPage = (fn) => (v) => { fn(v); setPage(0) }

  const add = async (patch) => {
    setBusy(true)
    await onAdd(patch)
    setBusy(false)
    setAdding(false)
    setPage(0)
  }

  return (
    <div className="relative">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={q} onChange={resetPage(setQ)} placeholder="Search business, owner, email, phone, city…" />
        <Select value={status} onChange={resetPage(setStatus)} options={['All', ...PROSPECT_STATUSES]} label="Status" />
        <Select value={industry} onChange={resetPage(setIndustry)} options={industries} label="Industry" />
        <Select value={scoreBandSel} onChange={resetPage(setScoreBandSel)} options={SCORE_BANDS} />
        <Select value={sort} onChange={setSort} options={SORTS} />
      </div>

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="mt-6 text-gray-500">Loading prospects…</p>
      ) : prospects.length === 0 ? (
        <Empty label="No prospects yet. Click the + button to add your first business — or run supabase/sprint1_prospects.sql if you haven't yet." />
      ) : (
        <>
          <div className="mt-4 card-surface overflow-x-auto p-2 shadow-card">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
                  <Th>Business</Th><Th>Industry</Th><Th>Location</Th><Th>Rating</Th>
                  <Th>Score</Th><Th>Deal</Th><Th>Status</Th><Th>Next Follow-up</Th><Th>Added</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => {
                  const band = scoreBand(p.website_score)
                  const due = isFollowUpDue(p)
                  return (
                    <tr key={p.id} onClick={() => setSelected(p)}
                      className="cursor-pointer border-t border-white/[0.06] text-gray-300 transition-colors hover:bg-gold-400/[0.04]">
                      <Td className="font-medium text-gray-100">
                        {p.business_name}
                        {p.owner_name && <span className="block text-xs text-gray-500">{p.owner_name}</span>}
                      </Td>
                      <Td>{p.industry || '—'}</Td>
                      <Td>{[p.city, p.state].filter(Boolean).join(', ') || '—'}</Td>
                      <Td className="text-amber-200">{p.google_rating ? <span title={`${p.google_rating} from ${p.google_reviews ?? '?'} reviews`}>{ratingStars(p.google_rating)}</span> : '—'}</Td>
                      <Td><span className={band.cls}>{p.website_score == null ? '—' : `${p.website_score}`}</span></Td>
                      <Td className="font-mono text-xs text-gray-300">{p.deal_value == null ? '—' : fmtMoney(p.deal_value)}</Td>
                      <Td><span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${prospectStatusStyle(p.status)}`}>{p.status}</span></Td>
                      <Td className={due ? 'font-medium text-rose-300' : 'font-mono text-xs text-gray-500'}>
                        {p.next_follow_up ? fmtDate(p.next_follow_up) : '—'}{due ? ' • due' : ''}
                      </Td>
                      <Td className="font-mono text-xs text-gray-500">{fmtDate(p.created_at)}</Td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No prospects match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">
                {filtered.length === 0 ? '0' : `${safePage * pageSize + 1}–${Math.min(filtered.length, (safePage + 1) * pageSize)}`} of {filtered.length}
              </span>
              <Select value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(0) }} options={PAGE_SIZES.map(String)} compact />
              <span className="text-gray-500">per page</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs transition-colors hover:border-gold-400/40 disabled:opacity-40">
                <Arrow className="h-3.5 w-3.5 rotate-180" />
              </button>
              <span className="font-mono text-xs text-gray-500">Page {safePage + 1} / {pageCount}</span>
              <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs transition-colors hover:border-gold-400/40 disabled:opacity-40">
                <Arrow className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Floating action button */}
      <button onClick={() => setAdding(true)} aria-label="Add prospect"
        className="btn-gold fixed bottom-8 right-8 z-30 h-14 w-14 !rounded-full !px-0 shadow-gold">
        <Plus className="h-6 w-6" />
      </button>

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4" onClick={() => setAdding(false)}>
          <div className="card-surface relative my-8 w-full max-w-2xl p-7 shadow-card" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAdding(false)} aria-label="Close" className="absolute right-5 top-5 text-gray-500 transition-colors hover:text-gray-200">✕</button>
            <div className="eyebrow mb-1">New Prospect</div>
            <h3 className="mb-5 font-display text-2xl font-bold text-gray-50">Add a business</h3>
            <ProspectForm onSubmit={add} onCancel={() => setAdding(false)} submitLabel="Add prospect" busy={busy} />
          </div>
        </div>
      )}

      {/* Detail slide-over */}
      {selectedLive && (
        <ProspectPanel
          prospect={selectedLive}
          onClose={() => setSelected(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function Select({ value, onChange, options, label, compact }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-xl border border-white/10 bg-ink-950/60 text-gray-200 focus:border-gold-400/60 focus:outline-none ${
          compact ? 'px-2.5 py-1.5 pr-7 text-xs' : 'px-4 py-3 pr-9 text-sm'
        }`}>
        {options.map((o) => (
          <option key={o} value={o} className="bg-ink-900 text-gray-100">
            {label && (o === 'All' || o === value) && o === 'All' ? `${label}: All` : o}
          </option>
        ))}
      </select>
      <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gold-300 ${compact ? 'right-2' : 'right-3'}`}>
        <Arrow className="h-3.5 w-3.5 rotate-90" />
      </span>
    </div>
  )
}
