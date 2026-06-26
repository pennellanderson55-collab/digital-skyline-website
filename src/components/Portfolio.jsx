import { useState, useEffect, useRef } from 'react'
import SectionHeading from './SectionHeading.jsx'
import { Arrow, Play, Image } from './Icons.jsx'

/* ----------------------------------------------------------------------------
 * Visual Proof gallery — a pinned horizontal-scroll rail.
 *
 * The section pins while you scroll vertically; the card track translates
 * horizontally (eased, for momentum) with a progress indicator, then releases.
 *
 * Every card is a reusable PLACEHOLDER — give an item a `src` (and `poster`
 * for video) to drop in real media; otherwise it renders a gold/black gradient.
 * ------------------------------------------------------------------------- */

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Brand-consistent dark + gold gradient washes for the placeholders.
const GRADIENTS = {
  g1: 'from-[#221903] via-[#2c2008] to-[#0a0a0c]',
  g2: 'from-[#141826] via-[#1d1708] to-[#08080a]',
  g3: 'from-[#1f1607] via-[#100f15] to-[#0a0a0c]',
  g4: 'from-[#2a1e0a] via-[#15110a] to-[#070707]',
  g5: 'from-[#0e1320] via-[#241b08] to-[#0a0a0c]',
  g6: 'from-[#231807] via-[#2a1f0c] to-[#0c0c0e]',
}

// Placeholder items. Replace title/desc/tag and add `src` when ready.
const ITEMS = [
  { id: 8, type: 'image', category: 'Landing Page', tag: 'Landing Page', title: 'Farios', desc: 'A landing page for Farios, a plumbing company.', grad: 'g3', glow: 'right-[26%] top-[26%]', src: '/fario.png', full: '/fario.png' },
  { id: 9, type: 'video', category: 'Landing Page', tag: 'Landing Page', title: 'Farios', desc: 'A walkthrough of the Farios plumbing landing page.', grad: 'g5', glow: 'left-[18%] top-[24%]', src: '/fario.mov', poster: '/fario.png' },
  { id: 5, type: 'image', category: 'Dashboards', tag: 'Dashboard', title: 'Hayes Properties', desc: 'A property-owner dashboard — track units, tenants, and performance at a glance.', grad: 'g5', glow: 'left-[20%] top-[28%]', src: '/hayes-dashboard.png', full: '/hayes-dashboard.png' },
  { id: 6, type: 'video', category: 'Dashboards', tag: 'Dashboard', title: 'Hayes Properties', desc: 'A walkthrough of the Hayes Properties owner dashboard in action.', grad: 'g6', glow: 'right-[20%] top-[22%]', src: '/hayes-dashboard.mov', poster: '/hayes-dashboard.png' },
  { id: 1, type: 'image', category: 'Website', tag: 'Website', title: 'Legacy Quest', desc: 'A premium family legacy platform designed to organize memories, goals, family members, and long-term growth.', grad: 'g1', glow: 'left-[15%] top-[20%]', src: '/knightsoul.png', full: '/knightsoul.png' },
  { id: 2, type: 'video', category: 'Website', tag: 'Website', title: 'KnightSoul', desc: 'A cinematic gaming landing page built with immersive visuals, motion, and interactive web design.', grad: 'g2', glow: 'right-[18%] top-[30%]', src: '/knightsoul.mp4', full: '/knightsoul.mp4', poster: '/knightsoul.png' },
  { id: 3, type: 'image', category: 'Apps', tag: 'App', title: 'Legacy Quest', desc: 'The Family Operating System — organize traditions, build ventures, shape generations.', grad: 'g3', glow: 'left-[25%] bottom-[25%]', src: '/legacy-quest.jpg', full: '/legacy-quest-full.jpg', pos: '50% 50%' },
  { id: 4, type: 'video', category: 'Apps', tag: 'App', title: 'Legacy Quest', desc: 'A walkthrough of Legacy Quest — touring the Family Operating System and how it organizes traditions, ventures, and generations.', grad: 'g4', glow: 'right-[22%] bottom-[20%]', src: '/legacy-quest-video.mov', poster: '/legacy-quest.jpg' },
]

/* --------------------------- lazy card video ------------------------------ */
/*
 * Bandwidth guard: a card video must NEVER download until its card is actually
 * scrolled into view. We start with `preload="none"` and no `src`, show the
 * poster, and only attach the source + play once the element intersects the
 * viewport (which, because the rail overflows horizontally, also covers cards
 * parked off to the side). Off-screen → paused. This keeps homepage visitors
 * who never reach the gallery from pulling any video bytes at all.
 */
function LazyCardVideo({ item, onError }) {
  const ref = useRef(null)
  const [load, setLoad] = useState(false) // becomes true on first view → attaches src

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setLoad(true); return }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true)
          el.play?.().catch(() => {})
        } else {
          el.pause?.()
        }
      },
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      src={load ? item.src : undefined}
      poster={item.poster}
      muted
      loop
      playsInline
      preload="none"
      onCanPlay={(e) => { e.currentTarget.play?.().catch(() => {}) }}
      onError={onError}
      className="absolute inset-0 h-full w-full"
      style={{ objectFit: item.fit || 'cover', objectPosition: item.pos || 'center' }}
    />
  )
}

/* ------------------------------- card ------------------------------------- */

function PortfolioCard({ item, onView }) {
  // Show real media when a src is provided; fall back to the placeholder if the
  // file is missing (so the slot never shows a broken image).
  const [mediaOk, setMediaOk] = useState(Boolean(item.src))

  return (
    <div className="group">
      {/* the card — image only, with the type badge + View Project on it */}
      <div
        className={`relative aspect-[16/10] w-full overflow-hidden rounded-[1.75rem] border border-white/10 shadow-card transition-colors duration-300 hover:border-gold-400/40 bg-gradient-to-br ${GRADIENTS[item.grad]}`}
      >
        {/* texture + brand glow */}
        <div className="grid-overlay absolute inset-0 opacity-30" aria-hidden="true" />
        <div
          className={`pointer-events-none absolute ${item.glow} h-40 w-40 rounded-full bg-gold-400/15 blur-3xl`}
          aria-hidden="true"
        />

        {/* media fills the card */}
        {item.src && mediaOk ? (
          item.type === 'video' ? (
            <LazyCardVideo item={item} onError={() => setMediaOk(false)} />
          ) : (
            <img
              src={item.src}
              alt={item.title}
              loading="lazy"
              decoding="async"
              onError={() => setMediaOk(false)}
              className="absolute inset-0 h-full w-full"
              style={{ objectFit: item.fit || 'cover', objectPosition: item.pos || 'center' }}
            />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/[0.08] text-gold-300 backdrop-blur-sm">
              {item.type === 'video' ? <Play className="ml-0.5 h-7 w-7" /> : <Image className="h-7 w-7" />}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-200/70">
              {item.type === 'video' ? 'Video placeholder' : 'Image placeholder'}
            </span>
          </div>
        )}

        {/* hover sheen */}
        <div className="pointer-events-none absolute inset-0 bg-gold-sheen bg-[length:200%_100%] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-sheen" aria-hidden="true" />

        {/* type badge — top-left */}
        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-gray-200 backdrop-blur-sm">
          {item.type}
        </span>

        {/* tag chip + View Project — bottom-left on the card (tag sits on top) */}
        <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2">
          <span className="inline-flex rounded-full border border-gold-400/30 bg-black/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold-200 backdrop-blur-sm">
            {item.tag}
          </span>
          <button
            type="button"
            onClick={() => onView(item)}
            className="btn-gold px-4 py-2 text-xs"
          >
            View Project <Arrow className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------- pinned horizontal-scroll rail ---------------------- */

export default function Portfolio() {
  const trackRef = useRef(null)
  const barRef = useRef(null)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const maxScroll = () => el.scrollWidth - el.clientWidth
    const updateBar = () => {
      const m = maxScroll()
      const p = m > 0 ? Math.min(Math.max(el.scrollLeft / m, 0), 1) : 0
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`
    }

    el.addEventListener('scroll', updateBar, { passive: true })
    window.addEventListener('resize', updateBar)
    const t = setTimeout(updateBar, 600)
    updateBar()

    // Wheel → horizontal ONLY while the cursor is over the cards. Eased for a
    // smooth glide, and it RELEASES to vertical page scroll at either edge so
    // you're never trapped in the gallery.
    let cleanupWheel = () => {}
    if (!reduced) {
      let target = el.scrollLeft
      let animating = false
      let raf = 0
      const ease = () => {
        el.scrollLeft += (target - el.scrollLeft) * 0.18
        if (Math.abs(target - el.scrollLeft) < 0.5) {
          el.scrollLeft = target
          animating = false
          updateBar()
          return
        }
        updateBar()
        raf = requestAnimationFrame(ease)
      }
      const onWheel = (e) => {
        const m = maxScroll()
        if (m <= 0) return
        const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
        const atStart = el.scrollLeft <= 0.5
        const atEnd = el.scrollLeft >= m - 0.5
        // edge release → let the page scroll vertically
        if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return
        e.preventDefault()
        if (!animating) target = el.scrollLeft
        target = Math.min(Math.max(target + delta, 0), m)
        if (!animating) {
          animating = true
          raf = requestAnimationFrame(ease)
        }
      }
      el.addEventListener('wheel', onWheel, { passive: false })
      cleanupWheel = () => {
        el.removeEventListener('wheel', onWheel)
        cancelAnimationFrame(raf)
      }
    }

    return () => {
      el.removeEventListener('scroll', updateBar)
      window.removeEventListener('resize', updateBar)
      clearTimeout(t)
      cleanupWheel()
    }
  }, [])

  return (
    <section id="portfolio" className="relative scroll-mt-24 py-24">
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-gold-400/[0.06] blur-[130px]"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="container-max">
          <SectionHeading
            eyebrow="Portfolio"
            title="Visual Proof Of"
            accent="What We Build"
            subtitle="A growing gallery of websites, apps, dashboards, and digital systems created for modern businesses."
          />
        </div>

        {/* Horizontal rail — scroll over the cards moves sideways; over the
            heading / margins (or at either edge) scrolls vertically as normal. */}
        <div
          ref={trackRef}
          {...(reduced ? {} : { 'data-lenis-prevent': '' })}
          className={`mt-12 flex items-start gap-6 overflow-x-auto px-6 pb-4 sm:px-[8vw] ${
            reduced
              ? 'snap-x'
              : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          }`}
        >
          {ITEMS.map((item) => (
            <div
              key={item.id}
              className="w-[82vw] max-w-[640px] shrink-0 sm:w-[60vw] lg:w-[44vw] xl:w-[40vw]"
            >
              <PortfolioCard item={item} onView={setLightbox} />
            </div>
          ))}
        </div>

        {/* progress indicator */}
        <div className="container-max mt-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500">
              Scroll
            </span>
            <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                ref={barRef}
                className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-gold-gradient"
                style={{ transform: 'scaleX(0)' }}
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500">
              {ITEMS.length} Projects
            </span>
          </div>
        </div>
      </div>

      {/* Full-screen viewer */}
      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  )
}

/* ------------------------------- lightbox --------------------------------- */

function Lightbox({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden' // lock background scroll
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} — full view`}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-ink-950/90 p-4 backdrop-blur-md sm:p-8"
    >
      {/* close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-gold-400/30 bg-white/[0.04] text-gold-200 transition-all hover:border-gold-400/70 hover:bg-gold-400/10 active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {/* media (entire image/video, uncropped) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[82vh] w-full max-w-6xl items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 shadow-card"
      >
        {item.src ? (
          item.type === 'video' ? (
            <video
              src={item.src}
              poster={item.poster}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="max-h-[82vh] w-auto max-w-full object-contain"
            />
          ) : (
            <img
              src={item.full || item.src}
              alt={item.title}
              className="max-h-[82vh] w-auto max-w-full object-contain"
            />
          )
        ) : (
          <div className="flex aspect-video w-full max-w-3xl flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/[0.04] to-transparent">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/[0.08] text-gold-300">
              {item.type === 'video' ? <Play className="ml-0.5 h-7 w-7" /> : <Image className="h-7 w-7" />}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold-200/70">
              Preview coming soon
            </span>
          </div>
        )}
      </div>

      {/* caption */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-5 max-w-2xl text-center"
      >
        <span className="inline-flex rounded-full border border-gold-400/30 bg-gold-400/[0.1] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold-200">
          {item.tag}
        </span>
        <h3 className="mt-2 font-display text-2xl font-bold text-gray-50">{item.title}</h3>
        <p className="mt-1 text-sm text-gray-400">{item.desc}</p>
      </div>
    </div>
  )
}
