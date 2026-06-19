import { useMemo, useState } from 'react'
import { stageStyle, balanceDue, fmtMoney, fmtDate } from './ops.js'

/**
 * Clients tab (Section 2). One row per project, joined to its client record.
 * Search matches Company Name, Contact Name, Email and Project Reference.
 */
export default function Clients({ projects, onOpen }) {
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return projects
    return projects.filter((p) => {
      const c = p.client || {}
      return [c.company_name, c.contact_name, c.email, p.project_reference]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term))
    })
  }, [projects, q])

  return (
    <div>
      <SearchBar value={q} onChange={setQ} placeholder="Search by company, contact, email, or DS-reference…" />

      {projects.length === 0 ? (
        <Empty label="No clients yet. Convert a consultation to create your first client." />
      ) : (
        <div className="mt-4 card-surface overflow-x-auto p-2 shadow-card">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
                <Th>Reference</Th><Th>Company</Th><Th>Contact</Th><Th>Email</Th><Th>Phone</Th>
                <Th>Package</Th><Th>Type</Th><Th>Status</Th><Th>Paid</Th><Th>Balance</Th><Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const c = p.client || {}
                return (
                  <tr
                    key={p.id}
                    onClick={() => onOpen(p)}
                    className="cursor-pointer border-t border-white/[0.06] text-gray-300 transition-colors hover:bg-gold-400/[0.04]"
                  >
                    <Td className="font-mono text-xs text-gold-200">{p.project_reference}</Td>
                    <Td className="font-medium text-gray-100">{c.company_name || '—'}</Td>
                    <Td>{c.contact_name || '—'}</Td>
                    <Td>{c.email || '—'}</Td>
                    <Td>{c.phone || '—'}</Td>
                    <Td>{p.package || '—'}</Td>
                    <Td>{p.project_type || '—'}</Td>
                    <Td>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${stageStyle(p.stage)}`}>
                        {p.stage}
                      </span>
                    </Td>
                    <Td className="text-emerald-200">{fmtMoney(p.amount_paid)}</Td>
                    <Td className={balanceDue(p) > 0 ? 'text-amber-200' : 'text-gray-500'}>{fmtMoney(balanceDue(p))}</Td>
                    <Td className="font-mono text-xs text-gray-500">{fmtDate(p.created_at)}</Td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-500">No clients match “{q}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none sm:max-w-md"
    />
  )
}

export const Th = ({ children }) => <th className="px-3 py-3">{children}</th>
export const Td = ({ children, className = '' }) => <td className={`px-3 py-3 align-middle ${className}`}>{children}</td>
export const Empty = ({ label }) => (
  <div className="mt-4 card-surface p-10 text-center text-gray-500 shadow-card">{label}</div>
)
