// ============================================================================
// Shared confirmation dialog for one-at-a-time destructive actions in the OS.
// Clean, professional, and explicit: it always shows exactly WHAT is being
// acted on (the `details` rows) so an admin can never delete the wrong record.
// ============================================================================

export default function ConfirmDialog({
  title,
  description,
  details = [],
  note,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmCls =
    tone === 'danger'
      ? 'bg-rose-500/90 text-white hover:bg-rose-500'
      : 'bg-gold-gradient text-ink-950 hover:brightness-105'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => !busy && onCancel?.()}
    >
      <div className="card-surface w-full max-w-md p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-display text-lg font-semibold text-gray-50">{title}</h4>
        {description && <p className="mt-2 text-sm text-gray-400">{description}</p>}

        {details.length > 0 && (
          <dl className="mt-4 space-y-1.5 rounded-xl border border-white/[0.08] bg-ink-950/40 px-4 py-3">
            {details.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</dt>
                <dd className="text-right text-sm text-gray-200">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        )}

        {note && (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">{note}</p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={busy} className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-60">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmCls}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
