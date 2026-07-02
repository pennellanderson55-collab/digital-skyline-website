// ============================================================================
// Digital Skyline OS — Performance Dashboard primitives.
//
// Reusable, brand-consistent building blocks: glass cards, count-up numbers,
// sparklines, an interactive area chart, an animated funnel, a slide-over panel
// and small inline icons. Pure presentation — no data fetching, no app state.
// Keeps the existing ink + gold futuristic language (card-surface, gold-gradient
// etc.) while adding glassmorphism, depth and micro-interactions.
// ============================================================================

import { useEffect, useRef, useState } from 'react'

/* ── one-time keyframes / utility CSS ─────────────────────────────────────── */
const STYLE_ID = 'ds-dashboard-css'
const CSS = `
@keyframes dsFadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
@keyframes dsShimmer { 0% { background-position:-400px 0 } 100% { background-position:400px 0 } }
@keyframes dsDraw { from { stroke-dashoffset: var(--len) } to { stroke-dashoffset: 0 } }
@keyframes dsGrow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.ds-fade-up { animation: dsFadeUp .5s cubic-bezier(.2,.8,.3,1) both }
.ds-glass {
  position: relative;
  background: linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015));
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 1.25rem;
  transition: transform .35s cubic-bezier(.2,.8,.3,1), border-color .35s, box-shadow .35s;
  will-change: transform;
}
.ds-glass::before {
  content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background: radial-gradient(120% 80% at 50% -10%, rgba(212,175,55,0.10), transparent 60%);
  opacity:.7; transition:opacity .35s;
}
.ds-glass-hover:hover { transform: translateY(-4px); border-color: rgba(212,175,55,0.4); box-shadow: 0 18px 50px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.08) }
.ds-glass-hover:hover::before { opacity:1 }
.ds-glass-hover:active { transform: translateY(-1px) scale(.995) }
.ds-shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
  background-size: 800px 100%; animation: dsShimmer 1.4s linear infinite;
}
`

export function useDashboardStyles() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = CSS
    document.head.appendChild(el)
  }, [])
}

/* ── glass card ────────────────────────────────────────────────────────────── */
export function GlassCard({ as: Tag = 'div', className = '', hover = false, style, children, ...rest }) {
  return (
    <Tag
      className={`ds-glass ${hover ? 'ds-glass-hover cursor-pointer' : ''} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* ── count-up number ─────────────────────────────────────────────────────────
 * Eases a number up on mount (and whenever the value changes). Respects the
 * user's reduced-motion preference. `format` renders the animated value. */
export function CountUp({ value = 0, duration = 900, format = (n) => Math.round(n).toLocaleString(), className = '' }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    const to = Number(value) || 0
    if (reduce || from === to) { setDisplay(to); fromRef.current = to; return }
    let raf = 0
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={className}>{format(display)}</span>
}

/* ── delta chip (monthly change) ─────────────────────────────────────────────*/
export function Delta({ value, suffix = '%', className = '' }) {
  if (value == null || Number.isNaN(value)) return <span className={`text-gray-500 ${className}`}>—</span>
  const up = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        up ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
      } ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={up ? '' : 'rotate-180'}>
        <path d="M6 2.5 10 8H2z" fill="currentColor" />
      </svg>
      {Math.abs(value)}{suffix}
    </span>
  )
}

/* ── sparkline ───────────────────────────────────────────────────────────────*/
export function Sparkline({ data = [], width = 120, height = 34, stroke = '#d4af37', fill = true }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = max - min || 1
  const step = width / Math.max(1, data.length - 1)
  const pts = data.map((v, i) => [i * step, height - ((v - min) / span) * (height - 4) - 2])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const id = `spk-${Math.round(pts[0][1] * 1000) % 100000}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={stroke} />
    </svg>
  )
}

/* ── interactive area chart with hover tooltip ───────────────────────────────
 * points: [{ label, value, meta: {..extra rows..} }]. Renders a smooth area +
 * line that animates in, with a crosshair + tooltip following the cursor. */
export function AreaChart({ points = [], height = 220, prefix = '', renderTooltip }) {
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null) // index
  const [w, setW] = useState(720)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    setW(el.clientWidth || 720)
    return () => ro.disconnect()
  }, [])

  if (!points.length) return <div ref={wrapRef} style={{ height }} />
  const pad = { l: 8, r: 8, t: 14, b: 24 }
  const iw = Math.max(10, w - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const values = points.map((p) => p.value)
  const max = Math.max(...values, 1)
  const step = iw / Math.max(1, points.length - 1)
  const xy = points.map((p, i) => [pad.l + i * step, pad.t + ih - (p.value / max) * ih])
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pad.l + iw},${pad.t + ih} L${pad.l},${pad.t + ih} Z`

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const idx = Math.max(0, Math.min(points.length - 1, Math.round((x - pad.l) / step)))
    setHover(idx)
  }

  const hx = hover != null ? xy[hover][0] : 0
  const hy = hover != null ? xy[hover][1] : 0
  const len = Math.round(iw + ih)

  return (
    <div ref={wrapRef} className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="ds-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad.l} x2={pad.l + iw} y1={pad.t + ih * g} y2={pad.t + ih * g} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#ds-area)" style={{ opacity: 0.001 + 1, animation: 'dsFadeUp .6s ease both' }} />
        <path
          d={line} fill="none" stroke="#d4af37" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: len, ['--len']: len, animation: 'dsDraw 1s cubic-bezier(.4,0,.2,1) both' }}
        />
        {hover != null && (
          <g>
            <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + ih} stroke="rgba(212,175,55,0.4)" strokeWidth="1" />
            <circle cx={hx} cy={hy} r="4.5" fill="#0b0b0f" stroke="#d4af37" strokeWidth="2" />
          </g>
        )}
        {points.map((p, i) => (
          <text key={i} x={xy[i][0]} y={height - 6} textAnchor="middle" className="fill-gray-600" style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>
            {points.length > 12 && i % 2 ? '' : p.label}
          </text>
        ))}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-950/90 px-3 py-2 shadow-card backdrop-blur-xl"
          style={{ left: Math.min(Math.max(hx, 70), w - 70), top: 4 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{points[hover].label}</div>
          {renderTooltip
            ? renderTooltip(points[hover])
            : <div className="mt-0.5 font-display text-sm font-semibold text-gold-100">{prefix}{Math.round(points[hover].value).toLocaleString()}</div>}
        </div>
      )}
    </div>
  )
}

/* ── animated funnel ─────────────────────────────────────────────────────────*/
export function Funnel({ stages = [], onStage }) {
  const max = Math.max(...stages.map((s) => s.value), 1)
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const pct = Math.max(0.06, s.value / max)
        const conv = i === 0 || stages[i - 1].value === 0 ? null : Math.round((s.value / stages[i - 1].value) * 100)
        return (
          <button
            key={s.label}
            onClick={() => onStage?.(s)}
            className="group block w-full text-left"
          >
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-gray-300">{s.label}</span>
              <span className="font-mono text-gray-500">
                {s.value.toLocaleString()}{conv != null && <span className="ml-2 text-gold-300/70">{conv}%</span>}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-xl bg-white/[0.03]">
              <div
                className="flex h-full items-center rounded-xl bg-gradient-to-r from-gold-400/80 to-gold-400/30 pl-3 text-[11px] font-semibold text-ink-950 transition-all duration-300 group-hover:from-gold-400 group-hover:to-gold-400/50"
                style={{ width: `${pct * 100}%`, transformOrigin: 'left', animation: `dsGrow .7s cubic-bezier(.2,.8,.3,1) ${i * 0.06}s both` }}
              >
                {pct > 0.14 && s.value.toLocaleString()}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ── slide-over drill-down panel ─────────────────────────────────────────────*/
export function SlideOver({ title, subtitle, icon, onClose, children, width = 'max-w-2xl' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`relative h-full w-full ${width} overflow-y-auto border-l border-white/10 bg-gradient-to-b from-ink-900/95 to-ink-950/95 shadow-card`}
        style={{ animation: 'dsFadeUp .3s cubic-bezier(.2,.8,.3,1) both' }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.08] bg-ink-950/80 px-6 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {icon && <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.08] text-gold-300">{icon}</span>}
            <div>
              <h3 className="font-display text-xl font-bold text-gray-50">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-gray-500 transition-colors hover:text-gray-200">✕</button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </aside>
    </div>
  )
}

/* ── small inline icons (brand-tinted) ───────────────────────────────────────*/
const ico = (path, extra) => ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}{extra}
  </svg>
)
export const IconMoney = ico(<><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>)
export const IconBell = ico(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>)
export const IconCalendar = ico(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>)
export const IconMail = ico(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>)
export const IconGlobe = ico(<><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></>)
export const IconInvoice = ico(<><path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>)
