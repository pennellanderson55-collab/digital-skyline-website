import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Sparkle, Check, Arrow } from '../../components/Icons.jsx'
import { fmtDateTime } from './prospects.js'
import {
  OUTREACH_CARDS, outreachStatusStyle, loadDrafts, latestByType,
  generateDraft, saveDraft, updateDraft,
} from './outreach.js'

/**
 * Outreach AI tab — turns the latest Website Intelligence audit into
 * personalized outreach assets. Draft generation ONLY: no sending, no Gmail,
 * no bulk. The AI runs only when the user clicks Generate/Regenerate; saved
 * drafts are reloaded from Supabase (no re-spend). Nothing calls AI on mount.
 */
export default function OutreachAI({ prospect }) {
  const [audit, setAudit] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gen, setGen] = useState({})     // type -> freshly generated (unsaved) asset
  const [busy, setBusy] = useState({})    // type -> generating?
  const [saving, setSaving] = useState({})
  const [copied, setCopied] = useState('')

  // Load saved drafts + the latest audit for context. DB reads only — NO AI.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setGen({}); setCopied('')
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

  const savedByType = latestByType(drafts)

  const handleGenerate = async (type) => {
    setBusy((b) => ({ ...b, [type]: true })); setError('')
    try {
      const result = await generateDraft({ type, prospect, audit })
      setGen((g) => ({ ...g, [type]: { ...result, audit_id: audit?.id || null } }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy((b) => ({ ...b, [type]: false }))
    }
  }

  const handleSave = async (type) => {
    const draftData = gen[type]
    if (!draftData) return
    setSaving((s) => ({ ...s, [type]: true })); setError('')
    try {
      const saved = await saveDraft(supabase, {
        prospect, audit, type, subject: draftData.subject, body: draftData.body, model: draftData.model,
      })
      setDrafts((d) => [saved, ...d])
      setGen((g) => { const next = { ...g }; delete next[type]; return next }) // now persisted
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving((s) => ({ ...s, [type]: false }))
    }
  }

  const handleMarkUsed = async (draft) => {
    setError('')
    try {
      const updated = await updateDraft(supabase, draft.id, {
        status: draft.status === 'Used' ? 'Draft' : 'Used',
        used_at: draft.status === 'Used' ? null : new Date().toISOString(),
      })
      setDrafts((d) => d.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleCopy = async (type, content) => {
    const text = [content.subject ? `Subject: ${content.subject}` : '', content.body].filter(Boolean).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied((c) => (c === type ? '' : c)), 1600)
    } catch {
      setError('Copy failed — your browser blocked clipboard access.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header / context */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Sparkle className="h-4 w-4 text-gold-300" />
          <h4 className="font-display text-base font-semibold text-gray-50">Outreach AI</h4>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
          Generate personalized outreach from this prospect's latest website audit. Draft generation only —
          nothing is sent. AI runs only when you click <span className="text-gold-200">Generate</span>.
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
              generated={gen[card.type]}
              saved={savedByType[card.type]}
              busy={!!busy[card.type]}
              saving={!!saving[card.type]}
              copied={copied === card.type}
              onGenerate={() => handleGenerate(card.type)}
              onSave={() => handleSave(card.type)}
              onMarkUsed={handleMarkUsed}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OutreachCard({ card, audit, generated, saved, busy, saving, copied, onGenerate, onSave, onMarkUsed, onCopy }) {
  // Active content = freshly generated (unsaved) if present, else the saved draft.
  const content = generated || saved
  const isUnsaved = !!generated
  const when = generated?.generatedAt || saved?.created_at
  const srcScore =
    (saved && audit && saved.audit_id === audit.id) || (generated && audit)
      ? `${audit.overall_score}/100`
      : saved?.audit_id ? 'prior audit' : null

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="font-display text-sm font-semibold text-gray-100">{card.label}</h5>
            {saved && !isUnsaved && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${outreachStatusStyle(saved.status)}`}>{saved.status}</span>
            )}
            {isUnsaved && <span className="rounded-full border border-gold-400/30 bg-gold-400/[0.06] px-2 py-0.5 text-[10px] font-medium text-gold-200">Unsaved</span>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{card.hint}</p>
        </div>
        <button onClick={onGenerate} disabled={busy} className="btn-gold shrink-0 px-3 py-1.5 text-xs disabled:opacity-60">
          {busy ? 'Generating…' : content ? 'Regenerate' : (<>Generate <Arrow className="h-3.5 w-3.5" /></>)}
        </button>
      </div>

      {content && (
        <>
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-ink-950/50 p-3">
            {content.subject ? <div className="mb-2 text-sm font-semibold text-gray-100">Subject: {content.subject}</div> : null}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{content.body}</p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={() => onCopy(card.type, content)} className="btn-ghost px-3 py-1.5 text-xs">
              {copied ? (<><Check className="h-3.5 w-3.5" /> Copied</>) : 'Copy'}
            </button>
            <button onClick={onSave} disabled={!isUnsaved || saving} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">
              {saving ? 'Saving…' : isUnsaved ? 'Save Draft' : 'Saved'}
            </button>
            {saved && !isUnsaved && (
              <button onClick={() => onMarkUsed(saved)} className="btn-ghost px-3 py-1.5 text-xs">
                {saved.status === 'Used' ? 'Mark Unused' : 'Mark Used'}
              </button>
            )}
            <span className="ml-auto font-mono text-[10px] text-gray-600">
              {when ? fmtDateTime(when) : ''}{srcScore ? ` · audit ${srcScore}` : ''}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
