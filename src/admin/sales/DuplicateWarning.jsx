// ============================================================================
// Duplicate-lead warning. Shown BEFORE a new prospect is saved (Add Prospect)
// or before a consultation is moved into Sales, whenever an existing lead
// matches on business name, website, email or phone. It never blocks the save —
// the admin can always choose "Save Anyway" — it just prevents accidental dupes.
// ============================================================================

// Distinct, human-readable list of the fields that matched across all hits.
function matchSummary(matches) {
  const fields = [...new Set(matches.flatMap((m) => m.on))]
  if (fields.length <= 1) return fields[0] || 'the same details'
  return `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`
}

export default function DuplicateWarning({ matches = [], onViewExisting, onSaveAnyway, onCancel, busy = false }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => !busy && onCancel?.()}
    >
      <div className="card-surface w-full max-w-md p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-display text-lg font-semibold text-gray-50">This business may already exist.</h4>
        <p className="mt-2 text-sm text-gray-400">
          {matches.length === 1 ? 'An existing lead matches' : `${matches.length} existing leads match`} on{' '}
          {matchSummary(matches)}. Saving again will create a duplicate.
        </p>

        <ul className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto">
          {matches.map(({ prospect: p, on }) => (
            <li key={p.id} className="rounded-xl border border-white/[0.08] bg-ink-950/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium text-gray-100">{p.business_name || '(no name)'}</span>
                <button
                  onClick={() => onViewExisting?.(p)}
                  className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
                >
                  View Existing Lead
                </button>
              </div>
              <div className="mt-1 truncate font-mono text-[11px] text-gray-500">
                {[p.owner_name, p.email, p.phone].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {on.map((f) => (
                  <span key={f} className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-200">
                    matches {f}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={busy} className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onSaveAnyway} disabled={busy} className="btn-gold px-5 py-2.5 text-sm disabled:opacity-60">
            {busy ? 'Saving…' : 'Save Anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
