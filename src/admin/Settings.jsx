import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Cog } from '../components/Icons.jsx'
import { loadQueue, deleteDraftRow, typeLabel } from './sales/sending.js'

// ============================================================================
// Settings — admin configuration + safe Development/Testing cleanup.
//
// SAFETY MODEL:
//  - Real prospects are NEVER bulk-deleted. Every prospect delete goes through
//    an individual confirmation modal (one at a time).
//  - The "Testing Cleanup" section only surfaces data that looks like test data
//    (heuristic below). Deleting is still one confirmation per item.
//  - Test outreach DRAFTS (sandbox/test sends, or drafts on test prospects) may
//    be cleared in a batch, but only behind a confirmation modal that lists
//    exactly what will be removed.
//  - Nothing here touches live client/project data.
// ============================================================================

// Heuristic: does this prospect look like test/demo data (not a real lead)?
const TEST_WORD = /\b(test|testing|sample|demo|example|dummy|placeholder|asdf|qwerty|xxx+)\b/i
const TEST_DOMAINS = ['example.com', 'example.org', 'test.com', 'mailinator.com', 'test.test']

export function isLikelyTest(p) {
  if (!p) return false
  const email = (p.email || '').toLowerCase()
  const domain = email.split('@')[1] || ''
  if (TEST_DOMAINS.includes(domain)) return true
  const hay = [p.business_name, p.owner_name, p.notes, p.email].filter(Boolean).join(' ')
  return TEST_WORD.test(hay)
}

const reasonFor = (p) => {
  const email = (p.email || '').toLowerCase()
  const domain = email.split('@')[1] || ''
  if (TEST_DOMAINS.includes(domain)) return `test email domain (@${domain})`
  return 'name/notes contain a test keyword'
}

export default function Settings({ prospects = [], onDeleteProspect }) {
  const [config, setConfig] = useState(null)
  const [drafts, setDrafts] = useState(null)   // null = loading
  const [draftsErr, setDraftsErr] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const [confirmProspect, setConfirmProspect] = useState(null) // prospect pending delete
  const [confirmDrafts, setConfirmDrafts] = useState(null)     // array of drafts pending delete
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch('/api/email-config').then((r) => r.json()).then(setConfig).catch(() => setConfig(null))
    loadQueue(supabase).then(setDrafts).catch((e) => { setDraftsErr(e.message); setDrafts([]) })
  }, [])

  const testProspects = useMemo(() => prospects.filter(isLikelyTest), [prospects])
  const shownProspects = showAll ? prospects : testProspects

  // Test drafts = sandboxed sends OR drafts whose prospect looks like test data.
  const testProspectIds = useMemo(() => new Set(testProspects.map((p) => p.id)), [testProspects])
  const testDrafts = useMemo(
    () => (drafts || []).filter((d) => d.sandboxed || testProspectIds.has(d.prospect_id)),
    [drafts, testProspectIds],
  )

  const doDeleteProspect = async () => {
    const p = confirmProspect
    setConfirmProspect(null); setBusy(true); setNotice('')
    try {
      await onDeleteProspect(p.id)
      setNotice(`Deleted test prospect “${p.business_name}”.`)
    } finally { setBusy(false) }
  }

  const doDeleteDrafts = async () => {
    const list = confirmDrafts
    setConfirmDrafts(null); setBusy(true); setNotice('')
    let removed = 0
    for (const d of list) {
      try { await deleteDraftRow(supabase, d.id); removed++ } catch { /* keep going */ }
    }
    setDrafts((ds) => (ds || []).filter((d) => !list.some((x) => x.id === d.id)))
    setBusy(false)
    setNotice(`Removed ${removed} test draft${removed === 1 ? '' : 's'}.`)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Cog className="h-5 w-5 text-gold-300" />
        <h2 className="font-display text-2xl font-bold text-gray-50">Settings</h2>
      </div>

      {notice && (
        <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>
      )}

      {/* ── Email & Sending (read-only) ─────────────────────────────────────── */}
      <section className="card-surface p-6 shadow-card">
        <h3 className="font-display text-lg font-semibold text-gray-50">Email &amp; Sending</h3>
        <p className="mt-1 text-sm text-gray-500">
          Outreach is sent through Resend. These values come from server environment variables —
          secrets are never shown here.
        </p>
        <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Setting label="Sender address" value={config?.from || 'hello@digitalskylineco.com'} />
          <Setting
            label="Sending provider"
            value={config == null ? '…' : config.resendConfigured ? 'Resend — configured' : 'Resend — RESEND_API_KEY missing'}
            tone={config && !config.resendConfigured ? 'warn' : 'ok'}
          />
          <Setting
            label="Sandbox (test) mode"
            value={config == null ? '…' : config.sandbox ? 'ON — all sends route to the test inbox' : 'OFF — real prospects receive emails'}
            tone={config?.sandbox ? 'warn' : 'ok'}
          />
          <Setting label="Sandbox test inbox" value={config?.sandboxInbox || '—'} />
        </dl>
        <p className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-gray-500">
          To change these, update the environment variables in Vercel
          (<span className="font-mono text-gray-400">OUTREACH_FROM_EMAIL</span>,
          <span className="font-mono text-gray-400"> EMAIL_SANDBOX_MODE</span>,
          <span className="font-mono text-gray-400"> EMAIL_SANDBOX_TO</span>,
          <span className="font-mono text-gray-400"> RESEND_API_KEY</span>) and redeploy.
          Nothing auto-sends — emails go out only from the Sending Queue after you approve them.
        </p>
      </section>

      {/* ── Development / Testing Cleanup ───────────────────────────────────── */}
      <section className="card-surface border border-rose-400/20 p-6 shadow-card">
        <h3 className="font-display text-lg font-semibold text-rose-100">Development / Testing Cleanup</h3>
        <p className="mt-1 text-sm text-gray-400">
          Safely remove <span className="text-rose-200">test data only</span>. Real prospects are never
          bulk-deleted — each deletion is confirmed individually. This does not touch clients or projects.
        </p>

        {/* Test prospects */}
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
              {showAll ? 'All Prospects' : 'Likely Test Prospects'} · {shownProspects.length}
            </h4>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-gold-400" />
              Show all prospects (advanced)
            </label>
          </div>

          {shownProspects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
              No {showAll ? '' : 'test '}prospects found.
            </p>
          ) : (
            <ul className="space-y-2">
              {shownProspects.map((p) => {
                const test = isLikelyTest(p)
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-ink-950/40 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-100">{p.business_name || '(no name)'}</span>
                        {test
                          ? <span className="shrink-0 rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 font-mono text-[10px] text-rose-200">TEST</span>
                          : <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-gray-400">real?</span>}
                      </div>
                      <div className="truncate font-mono text-[11px] text-gray-500">
                        {p.email || 'no email'}{test ? ` · ${reasonFor(p)}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmProspect(p)}
                      disabled={busy}
                      className="shrink-0 rounded-full border border-rose-400/30 bg-rose-400/[0.06] px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/60 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {showAll && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              Advanced view shows every prospect. Deletes are soft (recoverable in the database) — each still requires confirmation.
            </p>
          )}
        </div>

        {/* Test drafts */}
        <div className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
              Test / Sandbox Drafts · {testDrafts.length}
            </h4>
            {testDrafts.length > 0 && (
              <button
                onClick={() => setConfirmDrafts(testDrafts)}
                disabled={busy}
                className="rounded-full border border-rose-400/30 bg-rose-400/[0.06] px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/60 disabled:opacity-50"
              >
                Delete {testDrafts.length} test draft{testDrafts.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
          {draftsErr ? (
            <p className="text-xs text-rose-300">{draftsErr}</p>
          ) : drafts === null ? (
            <p className="text-xs text-gray-500">Loading drafts…</p>
          ) : testDrafts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
              No sandbox or test-prospect drafts to clean up.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {testDrafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-ink-950/30 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-gray-300">
                    {d.prospect?.business_name || 'unknown'} · {typeLabel(d.type)} · {d.subject || '(no subject)'}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-gray-500">
                    {d.sandboxed ? '[TEST] ' : ''}{d.queue_status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Confirm: single prospect */}
      {confirmProspect && (
        <ConfirmModal
          onCancel={() => setConfirmProspect(null)}
          onConfirm={doDeleteProspect}
          title="Delete this prospect?"
          confirmLabel="Delete prospect"
        >
          <p className="text-sm text-gray-400">
            “{confirmProspect.business_name || 'This prospect'}” will be removed from your prospect lists.
            This is a soft delete — the record is retained in the database and can be restored.
          </p>
          {!isLikelyTest(confirmProspect) && (
            <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
              This does not look like test data. Only continue if you are sure.
            </p>
          )}
        </ConfirmModal>
      )}

      {/* Confirm: batch test drafts */}
      {confirmDrafts && (
        <ConfirmModal
          onCancel={() => setConfirmDrafts(null)}
          onConfirm={doDeleteDrafts}
          title={`Delete ${confirmDrafts.length} test draft${confirmDrafts.length === 1 ? '' : 's'}?`}
          confirmLabel={`Delete ${confirmDrafts.length} draft${confirmDrafts.length === 1 ? '' : 's'}`}
        >
          <p className="text-sm text-gray-400">These sandbox / test-prospect drafts will be permanently removed. Prospects are not affected.</p>
          <ul className="mt-3 max-h-[38vh] space-y-1 overflow-y-auto">
            {confirmDrafts.map((d) => (
              <li key={d.id} className="truncate rounded border border-white/[0.06] bg-ink-950/40 px-2.5 py-1.5 font-mono text-[11px] text-gray-400">
                {d.prospect?.business_name || 'unknown'} · {d.subject || typeLabel(d.type)}
              </li>
            ))}
          </ul>
        </ConfirmModal>
      )}
    </div>
  )
}

function Setting({ label, value, tone }) {
  const cls = tone === 'warn' ? 'text-amber-200' : tone === 'ok' ? 'text-gray-200' : 'text-gray-200'
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className={`mt-0.5 text-sm ${cls}`}>{value}</dd>
    </div>
  )
}

function ConfirmModal({ title, children, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="card-surface w-full max-w-md p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-display text-lg font-semibold text-gray-50">{title}</h4>
        <div className="mt-2">{children}</div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
          <button onClick={onConfirm} className="rounded-full bg-rose-500/90 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
