// ============================================================================
// Branded Website Preview — /preview/:token
//
// A private, premium presentation a client opens instead of a raw storage link.
// Black + gold, glassmorphism, elegant. Streams its media through the app's
// proxy (/api/preview-asset) so the Supabase location is never exposed. Ends
// with an interactive "Ready to Launch?" section that turns the preview into a
// sales page — the responses drive the CRM pipeline server-side.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Logo, Arrow, Check, Sparkle } from '../components/Icons.jsx'

const WHY = [
  ['Custom built', 'Designed for your business — not a template.'],
  ['100% ownership', 'You own the site outright. No lock-in, ever.'],
  ['Mobile optimized', 'Flawless on every screen size.'],
  ['SEO ready', 'Built to be found on Google.'],
  ['Fast loading', 'Engineered for speed and conversions.'],
  ['No templates', 'Every pixel crafted from scratch.'],
  ['Arizona based', 'Local, personal, and responsive.'],
  ['Lifetime scalability', 'Grows with you — apps, dashboards, automations.'],
]

const asset = (token, i) => `/api/preview-asset?token=${encodeURIComponent(token)}&i=${i}`
const doc = (token, file) => `/api/preview-asset?token=${encodeURIComponent(token)}&file=${file}`

export default function Preview() {
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading' })
  const startRef = useRef(Date.now())
  const viewIdRef = useRef(null)

  useEffect(() => { document.title = 'Website Preview · Digital Skyline Co.' }, [])

  useEffect(() => {
    let alive = true
    fetch(`/api/preview-view?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.ok) { viewIdRef.current = d.viewId; setState({ status: 'ready', data: d }) } else setState({ status: 'invalid' }) })
      .catch(() => alive && setState({ status: 'invalid' }))
    return () => { alive = false }
  }, [token])

  // Best-effort "time viewed" — beacon the elapsed ms on the way out.
  useEffect(() => {
    const flush = () => {
      const id = viewIdRef.current; if (!id) return
      const ms = Date.now() - startRef.current
      try { navigator.sendBeacon('/api/preview-view', new Blob([JSON.stringify({ token, viewId: id, ms })], { type: 'application/json' })) } catch { /* ignore */ }
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
    return () => window.removeEventListener('pagehide', flush)
  }, [token])

  return (
    <div className="preview-scope confirm-scope relative min-h-screen overflow-x-clip bg-ink-950 text-gray-200">
      <PreviewStyles />
      {/* ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="ds-orb ds-orb-1" /><div className="ds-orb ds-orb-2" />
        <div className="absolute inset-0 grid-overlay opacity-[0.15]" style={{ maskImage: 'radial-gradient(circle at 50% 0%, black, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle at 50% 0%, black, transparent 70%)' }} />
        <div className="absolute inset-x-0 top-0 h-[420px]" style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(212,175,55,0.12), transparent 70%)' }} />
      </div>

      {state.status === 'loading' && <Centered><Spinner /></Centered>}
      {state.status === 'invalid' && <Invalid />}
      {state.status === 'ready' && <Presentation token={token} data={state.data} />}
    </div>
  )
}

function Presentation({ token, data }) {
  const { business, owner } = data
  const assets = data.assets || []
  const videos = assets.filter((a) => a.kind === 'video')
  const images = assets.filter((a) => a.kind === 'image')
  const [lb, setLb] = useState(null)
  const first = (owner || '').split(' ')[0]

  return (
    <div className="relative mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      {/* brand bar */}
      <div className="mb-10 flex items-center justify-center gap-2.5 ds-fade-up">
        <Logo className="h-7 w-7" />
        <span className="font-display text-sm font-semibold tracking-wide text-gray-200">Digital Skyline <span className="text-gold-gradient">Co.</span></span>
      </div>

      {/* hero */}
      <header className="text-center ds-fade-up" style={{ animationDelay: '.05s' }}>
        <div className="eyebrow mx-auto"><Sparkle className="h-3.5 w-3.5" /> Private Preview</div>
        <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-gray-50 sm:text-5xl">
          Website <span className="text-gold-gradient">Preview</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-400">
          {first ? `${first}, this` : 'This'} preview was created exclusively for {business ? <span className="text-gray-200">{business}</span> : 'your business'}.
        </p>
      </header>

      {/* media */}
      <section className="mt-10 space-y-5 ds-fade-up" style={{ animationDelay: '.1s' }}>
        {videos.map((v) => (
          <div key={v.i} className="preview-glass overflow-hidden rounded-2xl p-1.5">
            <video controls playsInline preload="metadata" className="w-full rounded-xl bg-black" src={asset(token, v.i)}>
              Your browser can’t play this video. <a href={asset(token, v.i)} className="text-gold-300">Open it here.</a>
            </video>
          </div>
        ))}
        {images.length > 0 && (
          <div className={`grid gap-4 ${images.length === 1 ? '' : 'sm:grid-cols-2'}`}>
            {images.map((im) => (
              <button key={im.i} onClick={() => setLb(im.i)} className="preview-glass group relative overflow-hidden rounded-2xl p-1.5 transition-transform hover:-translate-y-1">
                <img src={asset(token, im.i)} alt={im.label || 'Website preview'} loading="lazy" className="w-full rounded-xl object-cover" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-ink-950/0 transition-colors group-hover:bg-ink-950/30">
                  <span className="translate-y-2 rounded-full border border-gold-400/40 bg-ink-950/70 px-3 py-1 text-xs text-gold-100 opacity-0 backdrop-blur transition-all group-hover:translate-y-0 group-hover:opacity-100">View full size</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* primary actions */}
      <section className="mt-8 flex flex-wrap items-center justify-center gap-3 ds-fade-up" style={{ animationDelay: '.15s' }}>
        {data.liveSite && <a href={data.liveSite} target="_blank" rel="noreferrer" className="btn-gold px-6 py-3 text-sm">View Live Website <Arrow className="h-4 w-4" /></a>}
        <a href="/consultation" className="btn-ghost px-6 py-3 text-sm">Book Free Consultation</a>
        {data.hasProposal && <a href={doc(token, 'proposal')} className="btn-ghost px-6 py-3 text-sm">Download Proposal</a>}
        {data.hasContract && <a href={doc(token, 'contract')} className="btn-ghost px-6 py-3 text-sm">Download Contract</a>}
      </section>

      {/* why digital skyline */}
      <section className="mt-16 ds-fade-up" style={{ animationDelay: '.2s' }}>
        <h2 className="text-center font-display text-2xl font-bold text-gray-50">Why <span className="text-gold-gradient">Digital Skyline</span></h2>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {WHY.map(([title, desc]) => (
            <div key={title} className="preview-glass flex items-start gap-3 rounded-xl p-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/10 text-gold-300"><Check className="h-3.5 w-3.5" /></span>
              <div>
                <div className="font-display text-sm font-semibold text-gray-100">{title}</div>
                <div className="text-xs leading-relaxed text-gray-500">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ready to launch */}
      <ReadyToLaunch token={token} initial={data.response} />

      {/* footer */}
      <PreviewFooter contact={data.contact} />

      {lb != null && <Lightbox src={asset(token, lb)} onClose={() => setLb(null)} />}
    </div>
  )
}

/* ── Ready to Launch? — the interactive sales close ───────────────────────── */
function ReadyToLaunch({ token, initial }) {
  const [done, setDone] = useState(initial || null)
  const [busy, setBusy] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const [note, setNote] = useState('')

  const respond = async (action, msg) => {
    setBusy(true)
    try {
      const r = await fetch('/api/preview-respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action, note: msg }) })
      const d = await r.json().catch(() => ({}))
      setDone(action)
      if (action === 'consult' && d.bookingUrl) setTimeout(() => { window.location.href = d.bookingUrl }, 1200)
    } catch { setDone(action) } finally { setBusy(false) }
  }

  if (done) return <Responded action={done} />

  return (
    <section className="mt-16 ds-fade-up" style={{ animationDelay: '.25s' }}>
      <div className="preview-glass preview-glow rounded-2xl p-7 text-center sm:p-9">
        <h2 className="font-display text-2xl font-bold text-gray-50">Ready to <span className="text-gold-gradient">Launch?</span></h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">Tell me what you think — I’ll take it from here.</p>

        {!showChanges ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <LaunchBtn primary emoji="🚀" label="I Love It" sub="Let’s build it" disabled={busy} onClick={() => respond('loved')} />
            <LaunchBtn emoji="✏️" label="A Few Changes" sub="I have notes" disabled={busy} onClick={() => setShowChanges(true)} />
            <LaunchBtn emoji="📅" label="Book a Call" sub="Free consultation" disabled={busy} onClick={() => respond('consult')} />
          </div>
        ) : (
          <div className="mt-6 text-left">
            <label className="mb-2 block text-xs font-medium text-gray-400">What would you like changed?</label>
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={4}
              placeholder="A bigger booking button, different colors, add a gallery…"
              className="w-full resize-y rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => respond('changes', note)} className="btn-gold px-5 py-2.5 text-sm disabled:opacity-60">Send my notes <Arrow className="h-4 w-4" /></button>
              <button onClick={() => setShowChanges(false)} className="btn-ghost px-5 py-2.5 text-sm">Back</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function LaunchBtn({ emoji, label, sub, primary, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`group flex flex-col items-center gap-1 rounded-xl border px-4 py-5 transition-all active:scale-[.98] disabled:opacity-60 ${
        primary ? 'border-gold-400/50 bg-gold-400/10 hover:border-gold-400/80 hover:bg-gold-400/[0.16] hover:shadow-gold-soft' : 'border-white/10 bg-white/[0.03] hover:border-gold-400/40 hover:bg-white/[0.05]'
      }`}>
      <span className="text-2xl transition-transform group-hover:scale-110">{emoji}</span>
      <span className={`font-display text-sm font-semibold ${primary ? 'text-gold-100' : 'text-gray-100'}`}>{label}</span>
      <span className="text-[11px] text-gray-500">{sub}</span>
    </button>
  )
}

function Responded({ action }) {
  const copy = {
    loved: ['🚀', 'Amazing — let’s build it!', 'I just got the notification and I’m already on it. Expect to hear from me shortly with next steps.'],
    changes: ['✏️', 'Got your notes — thank you!', 'I’ll make those changes and send you an updated preview soon.'],
    consult: ['📅', 'Perfect — taking you to booking…', 'Grab any time that works. Talk soon!'],
  }[action] || ['✅', 'Thank you!', 'I’ll be in touch shortly.']
  return (
    <section className="mt-16 ds-fade-up">
      <div className="preview-glass preview-glow rounded-2xl p-9 text-center">
        <div className="text-4xl">{copy[0]}</div>
        <h2 className="mt-3 font-display text-2xl font-bold text-gray-50">{copy[1]}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{copy[2]}</p>
        <a href="/consultation" className="btn-gold mx-auto mt-6 px-6 py-3 text-sm">Book a Free Consultation <Arrow className="h-4 w-4" /></a>
      </div>
    </section>
  )
}

function PreviewFooter({ contact = {} }) {
  const site = contact.site || 'digitalskylineco.com'
  const email = contact.email || 'hello@digitalskylineco.com'
  return (
    <footer className="mt-16 border-t border-white/[0.06] pt-8 text-center">
      <div className="flex items-center justify-center gap-2">
        <Logo className="h-6 w-6" />
        <span className="font-display text-sm font-semibold text-gray-300">Digital Skyline <span className="text-gold-gradient">Co.</span></span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-500">
        <a href={`https://${site}`} target="_blank" rel="noreferrer" className="hover:text-gold-200">{site}</a>
        <a href={`mailto:${email}`} className="hover:text-gold-200">{email}</a>
        {contact.phone && <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="hover:text-gold-200">{contact.phone}</a>}
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Custom Websites · SEO · Automations · Apps · Arizona</p>
    </footer>
  )
}

/* ── lightbox ─────────────────────────────────────────────────────────────── */
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={onClose} style={{ animation: 'dsFadeUp .25s ease both' }}>
      <img src={src} alt="Website preview" className="max-h-[92vh] max-w-full rounded-xl shadow-card" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-gray-200 hover:border-gold-400/60 hover:text-gold-100">✕</button>
    </div>
  )
}

/* ── states ───────────────────────────────────────────────────────────────── */
const Centered = ({ children }) => <div className="flex min-h-screen items-center justify-center px-6">{children}</div>
const Spinner = () => (
  <div className="flex flex-col items-center gap-4">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-gold-400" />
    <span className="font-mono text-xs uppercase tracking-widest text-gray-500">Loading your preview…</span>
  </div>
)
function Invalid() {
  return (
    <Centered>
      <div className="preview-glass max-w-md rounded-2xl p-9 text-center">
        <Logo className="mx-auto h-9 w-9" />
        <h1 className="mt-4 font-display text-xl font-bold text-gray-50">This preview isn’t available</h1>
        <p className="mt-2 text-sm text-gray-400">The link may have expired or been mistyped. Reach out and I’ll send you a fresh one.</p>
        <a href="https://digitalskylineco.com" className="btn-gold mx-auto mt-6 px-6 py-3 text-sm">Visit Digital Skyline <Arrow className="h-4 w-4" /></a>
      </div>
    </Centered>
  )
}

function PreviewStyles() {
  return (
    <style>{`
      .preview-scope .preview-glass {
        background: linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015));
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 24px 70px -30px rgba(0,0,0,0.85);
      }
      .preview-scope .preview-glow { box-shadow: 0 0 0 1px rgba(212,175,55,0.14), 0 30px 80px -30px rgba(212,175,55,0.28); }
    `}</style>
  )
}
