import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Arrow, Sparkle, Check, Scan } from '../../components/Icons.jsx'
import { normalizeUrl, fmtDateTime } from './prospects.js'
import {
  CATEGORIES, auditScore, ANALYZE_STEPS, loadAuditHistory, runAudit, findCachedAudit, summarizeChanges,
} from './audit.js'

/**
 * Website Intelligence tab — paste a homepage URL, run a server-side audit,
 * and get scores + an AI sales brief. Every completed audit is saved to
 * Supabase (history preserved) and cached so repeats don't re-fetch.
 */
export default function WebsiteIntelligence({ prospect, onUpdate }) {
  const [url, setUrl] = useState(prospect.website || '')
  const [history, setHistory] = useState([])
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastDiff, setLastDiff] = useState(null)
  const stepTimer = useRef(null)

  // Load history once per prospect; show the latest audit by default.
  useEffect(() => {
    let alive = true
    setError(''); setNotice(''); setResult(null); setLastDiff(null)
    setUrl(prospect.website || '')
    loadAuditHistory(supabase, prospect.id)
      .then((h) => { if (alive) { setHistory(h); setResult(h[0] || null) } })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false; clearInterval(stepTimer.current) }
  }, [prospect.id, prospect.website])

  const analyze = async (force) => {
    setError(''); setNotice(''); setLastDiff(null); setRunning(true); setStep(0)
    // Animate the progress steps while the request is in flight.
    stepTimer.current = setInterval(() => setStep((s) => Math.min(s + 1, ANALYZE_STEPS.length - 1)), 1400)

    try {
      // Instant path: fresh cached audit for this URL.
      if (!force) {
        const cached = findCachedAudit(history, url)
        if (cached) {
          setResult(cached)
          setNotice('Showing a recent saved audit. Use “Re-analyze” to refresh.')
          return
        }
      }
      const { audit, cached, aiSkipped } = await runAudit(supabase, {
        prospect, url, force, history,
      })

      // Change-log: compare against the previous audit of the SAME final URL.
      // The score is deterministic, so any movement is explained by a signal
      // change (site edited, or the scan was blocked / JS-rendered).
      const prior = history.find(
        (a) => (a.final_url || a.url) === (audit.final_url || audit.url) && a.id !== audit.id,
      )
      const diff = summarizeChanges(prior, audit)
      if (diff && diff.scoreDelta !== 0) {
        console.warn(
          `[website-intelligence] score changed ${diff.prevScore} → ${diff.nextScore} for ${audit.final_url || audit.url}. Changed signals:`,
          diff.changes,
        )
      }

      setResult(audit)
      if (!cached) {
        setHistory((h) => [audit, ...h])
        // Reflect on the prospect row so the table/dashboard show the latest score.
        onUpdate(prospect.id, {
          website_score: audit.overall_score,
          website_audit_status: 'complete',
          last_analyzed_at: audit.created_at,
        })
        const conf = audit.signals?.confidence
        if (aiSkipped) setNotice(`Audit saved. AI brief skipped: ${aiSkipped}`)
        else if (diff && diff.scoreDelta !== 0) {
          setNotice(`Audit complete. Score changed ${diff.prevScore} → ${diff.nextScore} — ${diff.changes.length} signal(s) changed (see “What changed”).`)
        } else if (conf === 'low') {
          setNotice('Audit complete — low scan confidence (see banner).')
        } else setNotice('Audit complete.')
        setLastDiff(diff && diff.scoreDelta !== 0 ? diff : null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      clearInterval(stepTimer.current)
      setRunning(false)
      setStep(0)
    }
  }

  return (
    <div className="space-y-5">
      {/* URL + analyze */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gray-400">Homepage URL</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="acmeplumbing.com"
            disabled={running}
            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none disabled:opacity-60"
          />
          <button onClick={() => analyze(false)} disabled={running || !url.trim()} className="btn-gold px-4 py-2.5 text-sm disabled:opacity-60">
            {running ? 'Analyzing…' : result ? 'Re-check' : (<>Analyze Website <Arrow className="h-4 w-4" /></>)}
          </button>
          {result && !running && (
            <button onClick={() => analyze(true)} className="btn-ghost px-4 py-2.5 text-sm">Re-analyze</button>
          )}
        </div>
        {url && <a href={normalizeUrl(url)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-gold-300 hover:underline">Open site ↗</a>}
      </div>

      {error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</p>}
      {notice && !running && <p className="rounded-xl border border-gold-400/20 bg-gold-400/[0.04] px-4 py-3 text-sm text-gold-100">{notice}</p>}

      {running && <Progress step={step} />}

      {!running && result && <AuditResult audit={result} diff={lastDiff} />}

      {!running && !result && !error && (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
          No audit yet. Paste a homepage URL and click <span className="text-gold-200">Analyze Website</span>.
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">Audit History</h4>
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
            {history.map((a) => {
              const c = auditScore(a.overall_score)
              const active = result && a.id === result.id
              return (
                <li key={a.id}>
                  <button onClick={() => setResult(a)} className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gold-400/[0.04] ${active ? 'bg-gold-400/[0.05]' : ''}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-200">{a.url}</span>
                      <span className="font-mono text-[11px] text-gray-500">{fmtDateTime(a.created_at)}{a.ai ? '' : ' · no AI'}</span>
                    </span>
                    <span className={`shrink-0 font-display text-lg font-bold ${c.cls}`}>{a.overall_score}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ progress */

function Progress({ step }) {
  const pct = Math.round(((step + 1) / ANALYZE_STEPS.length) * 100)
  return (
    <div className="rounded-xl border border-gold-400/20 bg-gold-400/[0.04] p-6">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-70" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-gold-400" />
        </span>
        <span className="font-display text-sm text-gold-100">{ANALYZE_STEPS[step]}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-gold-gradient transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 space-y-1.5">
        {ANALYZE_STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 text-xs ${i < step ? 'text-emerald-300' : i === step ? 'text-gold-100' : 'text-gray-600'}`}>
            {i < step ? <Check className="h-3.5 w-3.5" /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------- result */

function AuditResult({ audit, diff }) {
  const cats = audit.category_scores || {}
  const ai = audit.ai
  const s = audit.signals || {}
  return (
    <div className="space-y-6">
      {/* Scan confidence — warn when the scanner couldn't see the full page */}
      {s.confidence === 'low' && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
          <span className="font-semibold">Low confidence</span> — scanner may not see everything visible in a browser.
          {s.confidence_reason && <span className="block text-amber-200/80">{s.confidence_reason}</span>}
        </div>
      )}

      {/* Change-log — explains a moved score (the score itself is deterministic) */}
      {diff && diff.changes?.length > 0 && (
        <details className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <summary className="cursor-pointer text-sm text-gray-300">
            What changed since the last scan — score {diff.prevScore} → {diff.nextScore}
          </summary>
          <ul className="mt-3 space-y-1.5">
            {diff.changes.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-500">{c.key.replace(/_/g, ' ')}</span>
                <span className="text-right font-mono text-gray-300">{fmtVal(c.from)} → {fmtVal(c.to)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* What the scanner detected — raw signals, always shown */}
      <DetectionSummary s={s} />

      {/* Score header */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
        <ScoreRing value={audit.overall_score} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Overall Website Score</div>
          <div className="mt-1 truncate text-sm text-gray-300">{audit.final_url || audit.url}</div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => {
              const v = cats[c.key] ?? 0
              const col = auditScore(v)
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{c.label}</span>
                    <span className={`font-mono ${col.cls}`}>{v}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${col.bar}`} style={{ width: `${v}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* AI sales brief */}
      {ai ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkle className="h-4 w-4 text-gold-300" />
            <h4 className="font-display text-base font-semibold text-gray-50">AI Sales Brief</h4>
            {audit.ai_model && <span className="font-mono text-[10px] text-gray-600">{audit.ai_model}</span>}
          </div>

          <Block title="Executive Summary">{ai.executive_summary}</Block>
          <div className="grid gap-4 sm:grid-cols-2">
            <Block title="Biggest Strength" tone="emerald">{ai.biggest_strength}</Block>
            <Block title="Biggest Weakness" tone="rose">{ai.biggest_weakness}</Block>
          </div>
          <Block title="Highest-ROI Improvement" tone="gold">{ai.highest_roi_improvement}</Block>
          <Block title="Estimated Business Impact">{ai.estimated_business_impact}</Block>

          <ListBlock title="Sales Talking Points" items={ai.sales_talking_points} />
          <ListBlock title="Consultation Follow-up Questions" items={ai.follow_up_questions} />

          <div className="rounded-xl border border-gold-400/25 bg-gold-400/[0.05] p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-gold-300">Suggested Package</div>
            <div className="mt-1 font-display text-lg font-semibold text-gray-50">{ai.suggested_package}</div>
            <p className="mt-1 text-sm text-gray-300">{ai.suggested_package_reason}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-gray-400">
          Technical audit saved. The AI sales brief was not generated — set <span className="font-mono text-gold-200">ANTHROPIC_API_KEY</span> in Vercel to enable it, then Re-analyze.
        </p>
      )}

      {/* Raw signals (collapsible) */}
      <details className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-gray-500">Collected signals</summary>
        <SignalGrid signals={audit.signals || {}} />
      </details>
    </div>
  )
}

function ScoreRing({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const r = 34
  const circ = 2 * Math.PI * r
  const col = auditScore(v)
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={col.ring} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (v / 100) * circ} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-2xl font-bold ${col.cls}`}>{v}</span>
        <span className="font-mono text-[9px] text-gray-500">/100</span>
      </div>
    </div>
  )
}

function Block({ title, tone, children }) {
  const ring = tone === 'emerald' ? 'border-emerald-400/20' : tone === 'rose' ? 'border-rose-400/20' : tone === 'gold' ? 'border-gold-400/25' : 'border-white/[0.08]'
  return (
    <div className={`rounded-xl border ${ring} bg-white/[0.02] p-4`}>
      <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-200">{children || '—'}</p>
    </div>
  )
}

function ListBlock({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">{title}</div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-gray-200">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
            <span className="leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// What the scanner actually detected — the "show your work" panel so an
// inaccurate audit is debuggable at a glance.
function DetectionSummary({ s }) {
  const list = (arr) => (Array.isArray(arr) && arr.length ? arr.join(' · ') : '—')
  const yn = (v) => (v ? 'Yes' : 'No')
  const rows = [
    ['Phone numbers found', list(s.phone_numbers_found)],
    ['tel: links', s.tel_links ?? 0],
    ['CTA phrases found', list(s.cta_phrases_found)],
    ['Buttons / links detected', list(s.buttons_found)],
    ['CTA-style buttons', s.cta_buttons ?? 0],
    ['Forms', s.forms ?? 0],
    ['Booking links', s.booking_links ?? 0],
    ['Quote / service-request links', s.quote_links ?? 0],
    ['Homepage status code', s.status ?? '—'],
    ['Final URL after redirects', s.final_url || '—'],
    ['Blocked by 403 / robots / wall', s.blocked ? `Yes — ${s.blocked_reason || 'access wall'}` : 'No'],
    ['JS-rendered content may be missing', yn(s.js_rendered_maybe_missing)],
    ['Scan confidence', s.confidence === 'low' ? 'Low' : 'High'],
  ]
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Scan className="h-4 w-4 text-gold-300" />
        <h4 className="font-display text-sm font-semibold text-gray-100">What the scanner detected</h4>
      </div>
      <div className="grid gap-x-6 gap-y-1.5">
        {rows.map(([label, val]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-xs">
            <span className="shrink-0 text-gray-500">{label}</span>
            <span className="text-right font-mono text-gray-300">{String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function fmtVal(v) {
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'none'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (v === '' || v == null) return '—'
  return String(v)
}

function SignalGrid({ signals }) {
  const fmt = (v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    if (v && typeof v === 'object') return Object.entries(v).filter(([, on]) => on).map(([k]) => k).join(', ') || 'none'
    if (v === '' || v == null) return '—'
    return String(v).length > 60 ? `${String(v).slice(0, 60)}…` : String(v)
  }
  return (
    <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {Object.entries(signals).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
          <span className="text-right font-mono text-gray-300">{fmt(v)}</span>
        </div>
      ))}
    </div>
  )
}
