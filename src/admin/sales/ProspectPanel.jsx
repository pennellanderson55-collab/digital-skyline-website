import { useEffect, useState } from 'react'
import ProspectForm from './ProspectForm.jsx'
import WebsiteIntelligence from './WebsiteIntelligence.jsx'
import NoWebsiteOpportunity from './NoWebsiteOpportunity.jsx'
import OutreachAI from './OutreachAI.jsx'
import { hasWebsite } from './noWebsite.js'
import {
  PROSPECT_STATUSES, prospectStatusStyle, ratingStars, scoreBand,
  normalizeUrl, fmtDate, fmtDateTime, fmtMoney,
  expectedRevenue, clampProbability, parseDealValue,
} from './prospects.js'

// The middle tab depends on whether the prospect has a website:
//  - website  → Website Intelligence (audit)
//  - none     → No Website Opportunity (deterministic, Lead-Finder ready)
const panelTabs = (siteExists) => [
  { key: 'overview', label: 'Overview' },
  siteExists
    ? { key: 'intelligence', label: 'Website Intelligence' }
    : { key: 'nowebsite', label: 'No Website Opportunity' },
  { key: 'outreach', label: 'Outreach AI' },
]

/**
 * Premium right-side slide-over for a single prospect.
 * Sections: Business · Contact · Website · Timeline · Notes · Status.
 * Actions: Edit · Delete · Schedule Follow-up · Convert to Client (placeholder).
 */
export default function ProspectPanel({ prospect, error, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [followDate, setFollowDate] = useState(prospect.next_follow_up || '')
  const [convertNotice, setConvertNotice] = useState(false)

  // Sales Pipeline fields — local so Expected Revenue updates instantly as you
  // type; persisted via onUpdate on change/blur.
  const [dealValue, setDealValue] = useState(prospect.deal_value ?? '')
  const [probability, setProbability] = useState(prospect.probability ?? '')
  const [nextFollowUp, setNextFollowUp] = useState(prospect.next_follow_up || '')
  const [lostReason, setLostReason] = useState(prospect.lost_reason || '')
  const [pipeErr, setPipeErr] = useState('')

  // Reset transient UI whenever a different prospect is opened.
  useEffect(() => {
    setTab('overview'); setEditing(false); setConfirmDel(false); setScheduling(false)
    setFollowDate(prospect.next_follow_up || ''); setConvertNotice(false)
    setDealValue(prospect.deal_value ?? ''); setProbability(prospect.probability ?? '')
    setNextFollowUp(prospect.next_follow_up || ''); setLostReason(prospect.lost_reason || ''); setPipeErr('')
  }, [prospect.id, prospect.next_follow_up, prospect.deal_value, prospect.probability, prospect.lost_reason])

  // Esc closes; lock background scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const saveEdit = async (patch) => {
    setBusy(true)
    await onUpdate(prospect.id, patch)
    setBusy(false)
    setEditing(false)
  }

  const setStatus = (status) => onUpdate(prospect.id, { status })

  // ── Sales Pipeline persistence (normal DB updates — no AI, no extra calls) ──
  const saveDeal = () => {
    if (dealValue !== '' && (Number.isNaN(Number(dealValue)) || Number(dealValue) < 0)) {
      setPipeErr('Deal value must be a number ≥ 0.'); return
    }
    setPipeErr(''); onUpdate(prospect.id, { deal_value: parseDealValue(dealValue) })
  }
  const saveProbability = () => {
    if (probability !== '' && (Number(probability) < 0 || Number(probability) > 100)) {
      setPipeErr('Probability must be between 0 and 100.'); return
    }
    setPipeErr(''); onUpdate(prospect.id, { probability: clampProbability(probability) })
  }
  const saveNextFollowUp = (val) => {
    setNextFollowUp(val)
    onUpdate(prospect.id, { next_follow_up: val || null })
  }
  const saveLostReason = () => onUpdate(prospect.id, { lost_reason: lostReason.trim() || null })

  // Quick actions — each sets the status (+ the relevant timestamp).
  const now = () => new Date().toISOString()
  const markContacted = () => onUpdate(prospect.id, { status: 'Contacted', last_contacted_at: now(), last_contacted: now() })
  const quickSchedule = () => onUpdate(prospect.id, { status: 'Follow-up Scheduled' })
  const markProposalSent = () => onUpdate(prospect.id, { status: 'Proposal Sent', proposal_sent_at: now() })
  const markWon = () => onUpdate(prospect.id, { status: 'Won', closed_at: now() })
  const markLost = () => onUpdate(prospect.id, { status: 'Lost', closed_at: now() })

  const saveFollowUp = async () => {
    setBusy(true)
    await onUpdate(prospect.id, {
      next_follow_up: followDate || null,
      last_contacted: new Date().toISOString(),
    })
    setBusy(false)
    setScheduling(false)
  }

  const remove = async () => {
    setBusy(true)
    await onDelete(prospect.id)
    setBusy(false)
    onClose()
  }

  const p = prospect
  const web = normalizeUrl(p.website)
  const band = scoreBand(p.website_score)
  const siteExists = hasWebsite(p)
  const tabs = panelTabs(siteExists)

  // If the website was added/removed while open, the middle tab key changes —
  // fall back to Overview so we never render a tab that no longer exists.
  useEffect(() => {
    if (!tabs.some((t) => t.key === tab)) setTab('overview')
  }, [siteExists]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-gradient-to-b from-ink-900/95 to-ink-950/95 shadow-card animate-[slideIn_0.28s_cubic-bezier(0.2,0.8,0.3,1)]"
      >
        <style>{`@keyframes slideIn{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}`}</style>

        {/* header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.08] bg-ink-950/80 px-6 py-5 backdrop-blur-xl">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${prospectStatusStyle(p.status)}`}>{p.status}</span>
            <h3 className="mt-2 truncate font-display text-2xl font-bold text-gray-50">{p.business_name}</h3>
            <p className="mt-0.5 truncate text-sm text-gray-400">
              {[p.industry, [p.city, p.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-gray-500 transition-colors hover:text-gray-200">✕</button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-white/[0.08] px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-3 text-sm transition-colors ${
                tab === t.key ? 'border-gold-400 text-gold-100' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</div>
        )}

        <div className="px-6 py-6">
          {tab === 'overview' && (editing ? (
            <ProspectForm initial={p} onSubmit={saveEdit} onCancel={() => setEditing(false)} submitLabel="Save changes" busy={busy} />
          ) : (
            <>
              {/* action bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setEditing(true)} className="btn-ghost px-4 py-2 text-xs">Edit</button>
                <button onClick={() => setScheduling((s) => !s)} className="btn-ghost px-4 py-2 text-xs">Schedule Follow-up</button>
                <button onClick={() => setConvertNotice(true)} className="btn-ghost px-4 py-2 text-xs">Convert to Client</button>
                <button onClick={() => setConfirmDel(true)} className="ml-auto rounded-full border border-rose-400/30 bg-rose-400/[0.06] px-4 py-2 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/60">Delete</button>
              </div>

              {scheduling && (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gold-400/20 bg-gold-400/[0.04] p-4">
                  <div>
                    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gray-400">Next follow-up</label>
                    <input type="date" value={followDate} onChange={(e) => setFollowDate(e.target.value)}
                      className="rounded-xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 focus:border-gold-400/60 focus:outline-none" />
                  </div>
                  <button onClick={saveFollowUp} disabled={busy} className="btn-gold px-4 py-2.5 text-sm disabled:opacity-60">Save</button>
                  <p className="w-full text-xs text-gray-500">Also stamps “last contacted” as today.</p>
                </div>
              )}

              {convertNotice && (
                <div className="mt-4 rounded-xl border border-gold-400/20 bg-gold-400/[0.04] p-4 text-sm text-gold-100">
                  Converting a prospect into a full client + project record arrives in a later sprint.
                  For now, use <span className="font-semibold">Mark Won</span> to close them.
                  <button onClick={() => setConvertNotice(false)} className="mt-2 block text-xs text-gray-400 underline">Dismiss</button>
                </div>
              )}

              {/* ── Sales Pipeline ───────────────────────────────────────── */}
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <SectionLabel>Sales Pipeline</SectionLabel>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  {PROSPECT_STATUSES.map((s) => (
                    <button key={s} onClick={() => setStatus(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        s === p.status ? prospectStatusStyle(s) : 'border-white/10 text-gray-400 hover:border-gold-400/40'
                      }`}>{s}</button>
                  ))}
                </div>

                {/* Deal value · Probability · Next follow-up · Expected revenue */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <PipeField label="Deal Value ($)">
                    <input type="number" min="0" step="100" value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)} onBlur={saveDeal}
                      placeholder="3000" className={pipeInputCls} />
                  </PipeField>
                  <PipeField label="Probability (%)">
                    <input type="number" min="0" max="100" value={probability}
                      onChange={(e) => setProbability(e.target.value)} onBlur={saveProbability}
                      placeholder="70" className={pipeInputCls} />
                  </PipeField>
                  <PipeField label="Next Follow-up">
                    <input type="date" value={nextFollowUp}
                      onChange={(e) => saveNextFollowUp(e.target.value)} className={pipeInputCls} />
                  </PipeField>
                  <PipeField label="Expected Revenue">
                    <div className="rounded-xl border border-gold-400/25 bg-gold-400/[0.05] px-4 py-2.5 text-sm font-semibold text-gold-100">
                      {fmtMoney(expectedRevenue(dealValue, probability))}
                    </div>
                  </PipeField>
                </div>
                {pipeErr && <p className="mt-2 text-xs text-rose-400">{pipeErr}</p>}

                {p.status === 'Lost' && (
                  <div className="mt-4">
                    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gray-400">Lost reason</label>
                    <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} onBlur={saveLostReason}
                      placeholder="Why was this lost? (optional)" className={pipeInputCls} />
                  </div>
                )}

                {/* Quick actions */}
                <div className="mt-4">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">Quick Actions</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={markContacted} className="btn-ghost px-3 py-1.5 text-xs">Mark Contacted</button>
                    <button onClick={quickSchedule} className="btn-ghost px-3 py-1.5 text-xs">Schedule Follow-up</button>
                    <button onClick={markProposalSent} className="btn-ghost px-3 py-1.5 text-xs">Proposal Sent</button>
                    <button onClick={markWon} className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-400/60">Mark Won</button>
                    <button onClick={markLost} className="rounded-full border border-rose-400/30 bg-rose-400/[0.06] px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/60">Mark Lost</button>
                  </div>
                </div>
              </div>

              {/* Business */}
              <Group title="Business Information">
                <Row label="Business" value={p.business_name} />
                <Row label="Owner" value={p.owner_name} />
                <Row label="Industry" value={p.industry} />
                <Row label="Source" value={p.source} />
                <Row label="Location" value={[p.address, p.city, p.state].filter(Boolean).join(', ')} />
              </Group>

              {/* Contact */}
              <Group title="Contact Information">
                <Row label="Phone" value={p.phone ? <a href={`tel:${p.phone}`} className="text-gold-200 hover:underline">{p.phone}</a> : null} />
                <Row label="Email" value={p.email ? <a href={`mailto:${p.email}`} className="text-gold-200 hover:underline">{p.email}</a> : null} />
                <Row label="Website" value={web ? <a href={web} target="_blank" rel="noreferrer" className="text-gold-200 hover:underline">{p.website}</a> : null} />
              </Group>

              {/* Website / signals */}
              <Group title="Website Information">
                <Row label="Website score" value={
                  p.website_score == null ? null : (
                    <span className="inline-flex items-center gap-2">
                      <span className={band.cls}>{band.label}/100</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <span className={`block h-full ${band.bar}`} style={{ width: `${Math.min(100, Number(p.website_score))}%` }} />
                      </span>
                    </span>
                  )
                } />
                <Row label="Google rating" value={p.google_rating ? <span className="text-amber-200">{ratingStars(p.google_rating)} <span className="text-gray-400">{p.google_rating}</span></span> : null} />
                <Row label="Google reviews" value={p.google_reviews != null ? `${p.google_reviews} reviews` : null} />
              </Group>

              {/* Timeline */}
              <Group title="Timeline">
                <Row label="Added" value={fmtDateTime(p.created_at)} />
                <Row label="Last updated" value={fmtDateTime(p.updated_at)} />
                <Row label="Last contacted" value={p.last_contacted ? fmtDateTime(p.last_contacted) : null} />
                <Row label="Next follow-up" value={p.next_follow_up ? fmtDate(p.next_follow_up) : null} />
              </Group>

              {/* Notes */}
              <Group title="Notes">
                <p className="whitespace-pre-wrap text-sm text-gray-300">{p.notes || '—'}</p>
              </Group>
            </>
          ))}

          {tab === 'intelligence' && siteExists && <WebsiteIntelligence prospect={p} onUpdate={onUpdate} />}

          {tab === 'nowebsite' && !siteExists && <NoWebsiteOpportunity prospect={p} />}

          {tab === 'outreach' && <OutreachAI prospect={p} />}
        </div>

        {/* delete confirm */}
        {confirmDel && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4" onClick={() => setConfirmDel(false)}>
            <div className="card-surface w-full max-w-sm p-6 text-center shadow-card" onClick={(e) => e.stopPropagation()}>
              <h4 className="font-display text-lg font-semibold text-gray-50">Delete prospect?</h4>
              <p className="mt-2 text-sm text-gray-400">“{p.business_name}” will be permanently removed. This cannot be undone.</p>
              <div className="mt-5 flex justify-center gap-3">
                <button onClick={() => setConfirmDel(false)} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
                <button onClick={remove} disabled={busy} className="rounded-full bg-rose-500/90 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-60">
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

const SectionLabel = ({ children }) => (
  <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">{children}</div>
)

const pipeInputCls =
  'w-full rounded-xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none'

function PipeField({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gray-400">{label}</label>
      {children}
    </div>
  )
}

function Group({ title, children }) {
  return (
    <div className="mt-6 border-t border-white/[0.08] pt-5">
      <h4 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-gold-300">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm text-gray-200">{value || <span className="text-gray-600">—</span>}</span>
    </div>
  )
}

