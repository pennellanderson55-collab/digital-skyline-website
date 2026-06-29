import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Sparkle, Check, Arrow } from '../../components/Icons.jsx'
import { fmtDateTime } from './prospects.js'
import {
  OUTREACH_CARDS, outreachStatusStyle, loadDrafts, groupByType,
  generateDraft, saveDraft, updateDraft,
} from './outreach.js'

/**
 * Outreach AI tab — turns the latest Website Intelligence audit into
 * personalized outreach assets. Draft generation ONLY: no sending, no Gmail,
 * no bulk.
 *
 * Persistence: generating an asset AUTO-SAVES it to outreach_drafts, so drafts
 * never disappear when you leave and return — the tab reloads them from
 * Supabase on open and never regenerates unless you click Generate/Regenerate.
 */
export default function OutreachAI({ prospect }) {
  const [audit, setAudit] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState({})        // type -> generating?
  const [collapsed, setCollapsed] = useState({}) // type -> collapsed?
  const [editing, setEditing] = useState({})    // draftId -> { subject, body }
  const [savingId, setSavingId] = useState(null)
  const [copiedId, setCopiedId] = useState('')

  // Load saved drafts + the latest audit for context. DB reads only — NO AI.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setEditing({}); setCopiedId('')
    Promise.allSettled([
      loadDrafts(supabase, prospect.id),
      supabase
        ? supabase.from('website_audits').select('*').eq('prospect_id', prospect.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([dRes, aRes]) => {
      if (!alive) return
      if (dRes.status === 'fulfilled') setDrafts(dRes.value)
      else setError(dRes.reason?.message || 'Could not load drafts.')
      if (aRes.status === 'fulfilled') setAudit(aRes.value?.data || null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [prospect.id])

  const byType = groupByType(drafts)

  // Generate ONE asset, then auto-save it so it persists across navigation.
  const handleGenerate = async (type) => {
    setBusy((b) => ({ ...b, [type]: true })); setError('')
    try {
      const result = await generateDraft({ type, prospect, audit })
      const saved = await saveDraft(supabase, {
        prospect, audit, type, subject: result.subject, body: result.body, model: result.model,
      })
      setDrafts((d) => [saved, ...d])
      setCollapsed((c) => ({ ...c, [type]: false })) // keep it visible
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy((b) => ({ ...b, [type]: false }))
    }
  }

  const patchDraft = async (id, patch) => {
    setSavingId(id); setError('')
    try {
      const updated = await updateDraft(supabase, id, patch)
      setDrafts((d) => d.map((x) => (x.id === id ? updated : x)))
      return updated
    } catch (e) { setError(e.message); return null } finally { setSavingId(null) }
  }

  const startEdit = (d) => setEditing((e) => ({ ...e, [d.id]: { subject: d.subject || '', body: d.body || '' } }))
  const cancelEdit = (id) => setEditing((e) => { const n = { ...e }; delete n[id]; return n })
  const changeEdit = (id, field, val) => setEditing((e) => ({ ...e, [id]: { ...e[id], [field]: val } }))
  const saveEdit = async (id) => {
    const buf = editing[id]
    const updated = await patchDraft(id, { subject: buf.subject || null, body: buf.body })
    if (updated) cancelEdit(id)
  }

  const markUsed = (d) => patchDraft(d.id, d.status === 'Used'
    ? { status: 'Draft', used_at: null }
    : { status: 'Used', used_at: new Date().toISOString() })
  const archive = (d) => patchDraft(d.id, { status: d.status === 'Archived' ? 'Draft' : 'Archived' })

  const copy = async (d) => {
    const text = [d.subject ? `Subject: ${d.subject}` : '', d.body].filter(Boolean).join('\n\n')
    try { await navigator.clipboard.writeText(text); setCopiedId(d.id); setTimeout(() => setCopiedId((c) => (c === d.id ? '' : c)), 1600) }
    catch { setError('Copy failed — your browser blocked clipboard access.') }
  }

  const setAllCollapsed = (val) => setCollapsed(Object.fromEntries(OUTREACH_CARDS.map((c) => [c.type, val])))

  return (
    <div className="space-y-5">
      {/* Header / context */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkle className="h-4 w-4 text-gold-300" />
            <h4 className="font-display text-base font-semibold text-gray-50">Outreach AI</h4>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAllCollapsed(false)} className="btn-ghost px-2.5 py-1 text-[11px]">Expand all</button>
            <button onClick={() => setAllCollapsed(true)} className="btn-ghost px-2.5 py-1 text-[11px]">Collapse all</button>
          </div>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
          Generate personalized outreach from this prospect's latest website audit. Draft generation only —
          nothing is sent. Generating <span className="text-gold-200">auto-saves</span> a draft; AI runs only when you click Generate.
        </p>
        <div className="mt-3 text-xs">
          {audit ? (
            <span className="text-gray-400">
              Source audit: <span className="font-mono text-gold-200">{audit.overall_score}/100</span>
              <span className="text-gray-600"> · {fmtDateTime(audit.created_at)}</span>
              {!audit.ai && <span className="text-amber-300"> · no AI brief (run/re-analyze the audit for richer context)</span>}
            </span>
          ) : (
            <span className="text-amber-300">
              No website audit yet — run one in <span className="text-gold-200">Website Intelligence</span> first for personalized, on-point outreach.
            </span>
          )}
        </div>
      </div>

      {error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading saved drafts…</p>
      ) : (
        <div className="space-y-4">
          {OUTREACH_CARDS.map((card) => (
            <OutreachCard
              key={card.type}
              card={card}
              audit={audit}
              drafts={byType[card.type] || []}
              busy={!!busy[card.type]}
              collapsed={!!collapsed[card.type]}
              editing={editing}
              savingId={savingId}
              copiedId={copiedId}
              onToggle={() => setCollapsed((c) => ({ ...c, [card.type]: !c[card.type] }))}
              onGenerate={() => handleGenerate(card.type)}
              onStartEdit={startEdit}
              onChangeEdit={changeEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onMarkUsed={markUsed}
              onArchive={archive}
              onCopy={copy}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OutreachCard({
  card, audit, drafts, busy, collapsed, editing, savingId, copiedId,
  onToggle, onGenerate, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit, onMarkUsed, onArchive, onCopy,
}) {
  const count = drafts.length
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <button onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
          <Arrow className={`h-3.5 w-3.5 text-gold-300 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
          <span className="font-display text-sm font-semibold text-gray-100">{card.label}</span>
          {count > 0 && <span className="rounded-full bg-gold-400/10 px-1.5 py-0.5 text-[10px] text-gold-200">{count}</span>}
        </button>
        <button onClick={onGenerate} disabled={busy} className="btn-gold shrink-0 px-3 py-1.5 text-xs disabled:opacity-60">
          {busy ? 'Generating…' : count > 0 ? 'Regenerate' : (<>Generate <Arrow className="h-3.5 w-3.5" /></>)}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3 px-4 pb-4">
          <p className="text-xs text-gray-500">{card.hint}</p>

          {count === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
              No drafts yet — click Generate.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-gray-600">Saved Drafts</div>
              {drafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  audit={audit}
                  edit={editing[d.id]}
                  saving={savingId === d.id}
                  copied={copiedId === d.id}
                  onStartEdit={() => onStartEdit(d)}
                  onChangeEdit={(field, val) => onChangeEdit(d.id, field, val)}
                  onSaveEdit={() => onSaveEdit(d.id)}
                  onCancelEdit={() => onCancelEdit(d.id)}
                  onMarkUsed={() => onMarkUsed(d)}
                  onArchive={() => onArchive(d)}
                  onCopy={() => onCopy(d)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DraftRow({ draft, audit, edit, saving, copied, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit, onMarkUsed, onArchive, onCopy }) {
  const isEditing = !!edit
  const archived = draft.status === 'Archived'
  const srcScore = audit && draft.audit_id === audit.id ? `${audit.overall_score}/100` : draft.audit_id ? 'prior audit' : null

  return (
    <div className={`rounded-lg border p-3 ${archived ? 'border-white/[0.05] bg-white/[0.01] opacity-70' : 'border-white/[0.07] bg-ink-950/40'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${outreachStatusStyle(draft.status)}`}>{draft.status}</span>
        <span className="ml-auto font-mono text-[10px] text-gray-600">
          {fmtDateTime(draft.created_at)}{srcScore ? ` · audit ${srcScore}` : ''}
        </span>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {draft.subject != null && (
            <input
              value={edit.subject}
              onChange={(e) => onChangeEdit('subject', e.target.value)}
              placeholder="Subject"
              className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-gray-100 focus:border-gold-400/50 focus:outline-none"
            />
          )}
          <textarea
            value={edit.body}
            onChange={(e) => onChangeEdit('body', e.target.value)}
            rows={6}
            className="w-full resize-y rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-gray-200 focus:border-gold-400/50 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={onSaveEdit} disabled={saving} className="btn-gold px-3 py-1.5 text-xs disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
            <button onClick={onCancelEdit} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {draft.subject ? <div className="mb-1 text-sm font-semibold text-gray-100">Subject: {draft.subject}</div> : null}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{draft.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={onCopy} className="btn-ghost px-3 py-1.5 text-xs">{copied ? (<><Check className="h-3.5 w-3.5" /> Copied</>) : 'Copy'}</button>
            <button onClick={onStartEdit} className="btn-ghost px-3 py-1.5 text-xs">Edit</button>
            <button onClick={onMarkUsed} className="btn-ghost px-3 py-1.5 text-xs">{draft.status === 'Used' ? 'Mark Unused' : 'Mark Used'}</button>
            <button onClick={onArchive} className="btn-ghost px-3 py-1.5 text-xs">{archived ? 'Unarchive' : 'Archive'}</button>
          </div>
        </>
      )}
    </div>
  )
}
