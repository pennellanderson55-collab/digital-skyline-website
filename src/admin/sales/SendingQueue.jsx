import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Check, Arrow } from '../../components/Icons.jsx'
import { fmtDateTime } from './prospects.js'
import {
  QUEUE_STATES, queueStatusStyle, typeLabel, isSendable,
  loadQueue, deleteDraftRow, duplicateDraft, saveEdits,
  approve, unapprove, queue, archive, restore, sendOne,
} from './sending.js'

const FILTERS = ['All', ...QUEUE_STATES]

/**
 * Sending Queue — the agency outreach workflow. Generated drafts arrive as
 * "Ready for Review"; only Approved drafts can be Queued; only an explicit Send
 * (single or Send Selected) calls the server-side, sandbox-aware Resend route.
 * Nothing sends automatically. Every action persists to Supabase.
 */
export default function SendingQueue({ onProspectUpdate }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(() => new Set())
  const [config, setConfig] = useState(null)
  const [preview, setPreview] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [sendPlan, setSendPlan] = useState(null)   // { items:[{id,state}], running }
  const [busyId, setBusyId] = useState(null)

  const refresh = async () => {
    setLoading(true); setError('')
    try { setRows(await loadQueue(supabase)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    refresh()
    fetch('/api/email-config').then((r) => r.json()).then(setConfig).catch(() => setConfig(null))
  }, [])

  const filtered = useMemo(
    () => (filter === 'All' ? rows : rows.filter((r) => r.queue_status === filter)),
    [rows, filter],
  )
  const counts = useMemo(() => {
    const m = {}
    rows.forEach((r) => { m[r.queue_status] = (m[r.queue_status] || 0) + 1 })
    return m
  }, [rows])

  const replace = (d) => setRows((rs) => rs.map((r) => (r.id === d.id ? d : r)))
  const remove = (id) => setRows((rs) => rs.filter((r) => r.id !== id))

  const act = async (fn, d, msg) => {
    setBusyId(d.id); setError(''); setNotice('')
    try { const updated = await fn(supabase, d); if (updated) replace(updated); if (msg) setNotice(msg) }
    catch (e) { setError(e.message) }
    finally { setBusyId(null) }
  }

  const onDuplicate = async (d) => {
    setBusyId(d.id); setError('')
    try { const copy = await duplicateDraft(supabase, d); setRows((rs) => [copy, ...rs]); setNotice('Draft duplicated.') }
    catch (e) { setError(e.message) } finally { setBusyId(null) }
  }

  const onDelete = async () => {
    const d = confirmDel; setConfirmDel(null); setBusyId(d.id); setError('')
    try { await deleteDraftRow(supabase, d.id); remove(d.id); setSelected((s) => { const n = new Set(s); n.delete(d.id); return n }); setNotice('Draft deleted.') }
    catch (e) { setError(e.message) } finally { setBusyId(null) }
  }

  const onSaveEdit = async (patch) => {
    const d = editing; setBusyId(d.id); setError('')
    try { const updated = await saveEdits(supabase, d, patch); replace(updated); setEditing(null); setNotice('Changes saved.') }
    catch (e) { setError(e.message) } finally { setBusyId(null) }
  }

  // ── Single send ────────────────────────────────────────────────────────────
  const onSend = async (d) => {
    setBusyId(d.id); setError(''); setNotice('')
    try {
      const { draft, sandbox } = await sendOne(supabase, d, { onProspectUpdate })
      replace(draft)
      setNotice(sandbox ? 'Sent in SANDBOX (routed to the test inbox).' : 'Email sent.')
    } catch (e) {
      if (e.draft) replace(e.draft)
      setError(e.message)
    } finally { setBusyId(null) }
  }

  // ── Select + Send Selected (throttled, sequential, continues on failure) ─────
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectableRows = filtered.filter(isSendable)
  const selectAll = () => setSelected(new Set(selectableRows.map((r) => r.id)))
  const clearSel = () => setSelected(new Set())

  const openSendSelected = () => {
    const items = rows.filter((r) => selected.has(r.id) && isSendable(r))
    if (!items.length) { setError('Nothing sendable selected.'); return }
    setSendPlan({ items: items.map((r) => ({ id: r.id, name: r.prospect?.business_name || r.recipient_email, state: 'Pending' })), running: false })
  }

  const runSendSelected = async () => {
    setSendPlan((p) => ({ ...p, running: true })); setError('')
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    let sent = 0, failed = 0
    for (const item of sendPlan.items) {
      const d = rows.find((r) => r.id === item.id)
      setSendPlan((p) => ({ ...p, items: p.items.map((x) => (x.id === item.id ? { ...x, state: 'Sending' } : x)) }))
      try {
        const { draft } = await sendOne(supabase, d, { onProspectUpdate })
        replace(draft); sent++
        setSendPlan((p) => ({ ...p, items: p.items.map((x) => (x.id === item.id ? { ...x, state: 'Sent' } : x)) }))
      } catch (e) {
        if (e.draft) replace(e.draft); failed++
        setSendPlan((p) => ({ ...p, items: p.items.map((x) => (x.id === item.id ? { ...x, state: 'Failed' } : x)) }))
      }
      await sleep(700) // throttle
    }
    setNotice(`Send complete — ${sent} sent, ${failed} failed.`)
    setSelected(new Set())
    setSendPlan((p) => ({ ...p, running: false, done: true }))
  }

  return (
    <div className="relative space-y-5">
      {/* Sandbox banner */}
      {config?.sandbox && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/[0.1] px-4 py-3 text-sm text-amber-100">
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider">EMAIL SANDBOX ACTIVE</span>
          <span>All sends route to <span className="font-mono">{config.sandboxInbox}</span> with a <span className="font-mono">[TEST]</span> subject — no prospect is emailed.</span>
        </div>
      )}
      {config && !config.sandbox && !config.resendConfigured && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">
          RESEND_API_KEY is not configured — sending is disabled until it's set in Vercel.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-gray-50">Sending Queue</h2>
          <p className="text-sm text-gray-500">From <span className="text-gold-200">{config?.from || 'hello@digitalskylineco.com'}</span> · drafts never send automatically.</p>
        </div>
        <button onClick={refresh} className="btn-ghost px-3 py-1.5 text-xs">Refresh</button>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'border-gold-400/60 bg-gold-400/10 text-gold-100' : 'border-white/10 text-gray-400 hover:border-gold-400/40'
            }`}>
            {f}{f !== 'All' && counts[f] ? ` · ${counts[f]}` : ''}
          </button>
        ))}
      </div>

      {/* Selection toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
        <span className="text-xs text-gray-500">{selected.size} selected</span>
        <button onClick={selectAll} className="btn-ghost px-2.5 py-1 text-[11px]">Select All</button>
        <button onClick={clearSel} className="btn-ghost px-2.5 py-1 text-[11px]">Clear</button>
        <button onClick={openSendSelected} disabled={selected.size === 0}
          className="btn-gold ml-auto px-3 py-1.5 text-xs disabled:opacity-40">Send Selected ({selected.size})</button>
      </div>

      {error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{notice}</p>}

      {loading ? (
        <p className="text-gray-500">Loading queue…</p>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-10 text-center text-gray-500 shadow-card">
          No drafts {filter === 'All' ? 'yet' : `in “${filter}”`}. Generate outreach from a prospect’s Outreach AI tab.
        </div>
      ) : (
        <div className="card-surface overflow-x-auto p-2 shadow-card">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
                <th className="px-2 py-2"></th>
                <th className="px-3 py-2">Business</th><th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Subject</th><th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Created</th><th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <QueueRow
                  key={d.id} d={d} busy={busyId === d.id}
                  checked={selected.has(d.id)} onToggle={() => toggleSel(d.id)}
                  onPreview={() => setPreview(d)} onEdit={() => setEditing(d)}
                  onApprove={() => act(approve, d, 'Approved.')} onUnapprove={() => act(unapprove, d)}
                  onQueue={() => act(queue, d, 'Queued.')}
                  onSend={() => onSend(d)} onArchive={() => act(archive, d, 'Archived.')}
                  onRestore={() => act(restore, d, 'Restored.')} onDuplicate={() => onDuplicate(d)}
                  onDelete={() => setConfirmDel(d)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && <PreviewModal d={preview} onClose={() => setPreview(null)} />}
      {editing && <EditModal d={editing} onSave={onSaveEdit} onClose={() => setEditing(null)} busy={busyId === editing.id} />}
      {confirmDel && <ConfirmDelete d={confirmDel} onConfirm={onDelete} onClose={() => setConfirmDel(null)} />}
      {sendPlan && <SendSelectedModal plan={sendPlan} from={config?.from} sandbox={config?.sandbox} onRun={runSendSelected} onClose={() => setSendPlan(null)} />}
    </div>
  )
}

function QueueRow({ d, busy, checked, onToggle, onPreview, onEdit, onApprove, onUnapprove, onQueue, onSend, onArchive, onRestore, onDuplicate, onDelete }) {
  const s = d.queue_status
  const sendable = isSendable(d)
  const Btn = ({ onClick, children, tone }) => (
    <button onClick={onClick} disabled={busy}
      className={`rounded-md px-2 py-1 text-[11px] transition-colors disabled:opacity-40 ${
        tone === 'send' ? 'border border-gold-400/40 bg-gold-400/[0.08] text-gold-200 hover:border-gold-400/70'
        : tone === 'danger' ? 'border border-rose-400/30 text-rose-200 hover:border-rose-400/60'
        : 'border border-white/10 text-gray-300 hover:border-gold-400/40'
      }`}>{children}</button>
  )
  return (
    <tr className="border-t border-white/[0.06] text-gray-300 align-top">
      <td className="px-2 py-3">
        <input type="checkbox" checked={checked} onChange={onToggle} disabled={!sendable} title={sendable ? '' : 'Needs recipient/subject/body; not archived'} className="accent-gold-400" />
      </td>
      <td className="px-3 py-3 font-medium text-gray-100">{d.prospect?.business_name || '—'}</td>
      <td className="px-3 py-3"><span className={(d.recipient_email || '') ? 'text-gray-300' : 'text-rose-300'}>{d.recipient_email || 'no recipient'}</span></td>
      <td className="px-3 py-3 max-w-[220px] truncate" title={d.subject || ''}>{d.subject || <span className="text-gray-600">— (no subject)</span>}</td>
      <td className="px-3 py-3 text-gray-400">{typeLabel(d.type)}</td>
      <td className="px-3 py-3 font-mono text-[11px] text-gray-500">
        <div>{fmtDateTime(d.created_at)}</div>
        {d.approved_at && <div className="text-emerald-300/70">✓ {fmtDateTime(d.approved_at)}</div>}
        {d.last_edited_at && <div className="text-gray-600">edited {fmtDateTime(d.last_edited_at)}</div>}
      </td>
      <td className="px-3 py-3">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${queueStatusStyle(s)}`}>{s}</span>
        {s === 'Sent' && d.sandboxed && <span className="ml-1 font-mono text-[10px] text-amber-300">[TEST]</span>}
        {s === 'Failed' && d.send_error && <div className="mt-1 max-w-[200px] truncate text-[10px] text-rose-300" title={d.send_error}>{d.send_error}</div>}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap justify-end gap-1">
          <Btn onClick={onPreview}>Preview</Btn>
          <Btn onClick={onEdit}>Edit</Btn>
          {s === 'Ready for Review' && <Btn onClick={onApprove}>Approve</Btn>}
          {s === 'Approved' && <><Btn onClick={onUnapprove}>Unapprove</Btn><Btn onClick={onQueue}>Queue</Btn></>}
          {(s === 'Approved' || s === 'Queued' || s === 'Failed') && <Btn onClick={onSend} tone="send" >Send</Btn>}
          <Btn onClick={onDuplicate}>Duplicate</Btn>
          {s === 'Archived' ? <Btn onClick={onRestore}>Restore</Btn> : <Btn onClick={onArchive}>Archive</Btn>}
          <Btn onClick={onDelete} tone="danger">Delete</Btn>
        </div>
      </td>
    </tr>
  )
}

function Modal({ children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`card-surface relative my-8 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} p-6 shadow-card`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-gray-500 hover:text-gray-200">✕</button>
        {children}
      </div>
    </div>
  )
}

function PreviewModal({ d, onClose }) {
  return (
    <Modal onClose={onClose} wide>
      <div className="eyebrow mb-1">{typeLabel(d.type)} · {d.queue_status}</div>
      <h3 className="font-display text-xl font-bold text-gray-50">{d.prospect?.business_name || 'Preview'}</h3>
      <p className="mt-1 text-xs text-gray-500">To: {d.recipient_email || '—'} · From: {d.sender_email || 'hello@digitalskylineco.com'}</p>
      {d.subject && <div className="mt-4 text-sm font-semibold text-gray-100">Subject: {d.subject}</div>}
      <div className="mt-2 max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-ink-950/50 p-4 text-sm leading-relaxed text-gray-300">{d.body}</div>
    </Modal>
  )
}

function EditModal({ d, onSave, onClose, busy }) {
  const [subject, setSubject] = useState(d.subject || '')
  const [body, setBody] = useState(d.body || '')
  const [recipient, setRecipient] = useState(d.recipient_email || d.prospect?.email || '')
  const cls = 'w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-gray-100 focus:border-gold-400/60 focus:outline-none'
  return (
    <Modal onClose={onClose} wide>
      <h3 className="font-display text-xl font-bold text-gray-50">Edit draft</h3>
      <p className="mt-1 text-xs text-gray-500">Saving keeps the previous version in history.</p>
      <div className="mt-4 space-y-3">
        <div><label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-gray-400">Recipient</label>
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className={cls} placeholder="owner@business.com" /></div>
        {d.subject != null && <div><label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-gray-400">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={cls} /></div>}
        <div><label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-gray-400">Body</label>
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className={`${cls} resize-y`} /></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
        <button onClick={() => onSave({ subject, body, recipient_email: recipient })} disabled={busy} className="btn-gold px-4 py-2 text-sm disabled:opacity-60">{busy ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </Modal>
  )
}

function ConfirmDelete({ d, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose}>
      <h3 className="font-display text-lg font-semibold text-gray-50">Delete this draft permanently?</h3>
      <p className="mt-2 text-sm text-gray-400">“{d.subject || typeLabel(d.type)}” for {d.prospect?.business_name || 'this prospect'} will be removed. This deletes only this draft and cannot be undone.</p>
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
        <button onClick={onConfirm} className="rounded-full bg-rose-500/90 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500">Delete</button>
      </div>
    </Modal>
  )
}

function SendSelectedModal({ plan, from, sandbox, onRun, onClose }) {
  const tone = { Pending: 'text-gray-400', Sending: 'text-gold-200', Sent: 'text-teal-300', Failed: 'text-rose-300' }
  const done = plan.done
  return (
    <Modal onClose={done || !plan.running ? onClose : undefined}>
      <h3 className="font-display text-lg font-semibold text-gray-50">Send {plan.items.length} email{plan.items.length === 1 ? '' : 's'}?</h3>
      <p className="mt-2 text-sm text-gray-400">
        You are about to send {plan.items.length} email{plan.items.length === 1 ? '' : 's'} from <span className="text-gold-200">{from || 'hello@digitalskylineco.com'}</span>.
        {sandbox && <span className="mt-1 block text-amber-300">Sandbox is ACTIVE — these route to the test inbox, not real prospects.</span>}
      </p>
      <ul className="mt-4 max-h-[40vh] space-y-1.5 overflow-y-auto">
        {plan.items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-1.5 text-xs">
            <span className="truncate text-gray-300">{it.name}</span>
            <span className={`font-mono ${tone[it.state]}`}>{it.state === 'Sending' ? 'Sending…' : it.state}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-3">
        {!done && <button onClick={onClose} disabled={plan.running} className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-40">Cancel</button>}
        {done
          ? <button onClick={onClose} className="btn-gold px-5 py-2.5 text-sm">Done</button>
          : <button onClick={onRun} disabled={plan.running} className="btn-gold px-5 py-2.5 text-sm disabled:opacity-60">{plan.running ? 'Sending…' : `Send ${plan.items.length}`}</button>}
      </div>
    </Modal>
  )
}
