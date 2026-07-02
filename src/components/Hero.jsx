import { useEffect, useRef } from 'react'
import { Arrow, Sparkle } from './Icons.jsx'
import { prefersReducedMotion, isTouchPrimary } from '../lib/device.js'

const CAPABILITIES = [
  'Custom Websites',
  'Automations',
  'Dashboards',
  'Business Systems',
]

const reduced = prefersReducedMotion

// The scroll-scrubbed 18 MB hero video + per-frame seek loop is desktop-only.
// On touch/mobile (or reduced-motion) we render a lightweight static branded
// backdrop instead — no video download, no scroll rAF — so the hero paints
// instantly and stays smooth. Desktop keeps the full cinematic scrub.
const scrub = !reduced && !isTouchPrimary

/* ◆ Scrub distance. The hero is this tall; the inner stage is pinned (sticky)
   for the first 100vh and the remaining height is the scroll runway that maps
   to the video timeline. Larger = slower, more cinematic scrub. */
const SCRUB_HEIGHT = '170vh'

export default function Hero() {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const stageRef = useRef(null)

  // Subtle mouse-reactive parallax across the hero's depth layers
  useEffect(() => {
    if (reduced) return
    const stage = stageRef.current
    if (!stage) return
    let raf = 0
    const onMove = (e) => {
      const r = stage.getBoundingClientRect()
      const mx = ((e.clientX - r.left) / r.width) * 2 - 1
      const my = ((e.clientY - r.top) / r.height) * 2 - 1
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        stage.style.setProperty('--mx', mx.toFixed(3))
        stage.style.setProperty('--my', my.toFixed(3))
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    const video = videoRef.current
    if (!section || !video) return

    // Pause any implicit playback — we drive currentTime from scroll.
    video.pause()

    let duration = 5.04

    if (reduced) {
      // Reduced motion: hold on the LAST frame, no scrubbing.
      const holdEnd = () => { try { video.currentTime = video.duration || duration } catch (e) {} }
      video.addEventListener('loadedmetadata', holdEnd)
      return () => video.removeEventListener('loadedmetadata', holdEnd)
    }

    let target = duration   // start at the END of the clip
    let current = duration
    let running = false
    let raf = 0

    const onMeta = () => {
      duration = video.duration || duration
      target = duration
      current = duration
      try { video.currentTime = duration } catch (e) {}
      onScroll()
    }
    video.addEventListener('loadedmetadata', onMeta)

    const tick = () => {
      // Smoothly ease the playhead toward the scroll-driven target so the
      // reverse scrub feels fluid even between keyframes.
      current += (target - current) * 0.16
      if (Math.abs(target - current) < 0.0015) {
        current = target
        running = false
      }
      if (video.readyState >= 1) {
        try { video.currentTime = current } catch (e) {}
      }
      if (running) raf = requestAnimationFrame(tick)
    }
    const startLoop = () => {
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    const onScroll = () => {
      const rect = section.getBoundingClientRect()
      const runway = section.offsetHeight - window.innerHeight
      const scrolled = Math.min(Math.max(-rect.top, 0), runway)
      const progress = runway > 0 ? scrolled / runway : 0

      // REVERSED: header shows the END frame; scrolling down rewinds to the start.
      //   video.currentTime = video.duration * (1 - scrollProgress)
      target = duration * (1 - progress)
      startLoop()

      // Cinematic zoom tied to scroll: 1.08 at the top → 1.0 as you scroll down
      // (scrolling back up zooms in again toward the end frame).
      video.style.transform = `scale(${(1.08 - progress * 0.08).toFixed(3)})`
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    // If metadata already loaded before this listener attached, sync now.
    if (video.readyState >= 1) onMeta()
    else video.load()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      video.removeEventListener('loadedmetadata', onMeta)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="top"
      className="relative"
      style={{ height: scrub ? SCRUB_HEIGHT : '100vh' }}
    >
      {/* Pinned cinematic stage */}
      <div
        ref={stageRef}
        className="sticky top-0 h-screen w-full overflow-hidden bg-ink-950"
        style={{ '--mx': '0', '--my': '0' }}
      >

        {/* Scroll-scrubbed city video — full-bleed background, reverse on scroll
            (desktop only; the scrub loop drives currentTime from scroll). */}
        {scrub ? (
          <video
            ref={videoRef}
            src="/ds-city.mp4"
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transformOrigin: 'center center', willChange: 'transform' }}
          />
        ) : (
          /* Mobile / reduced-motion: static branded backdrop — no video bytes. */
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(115% 90% at 72% 18%, rgba(212,175,55,0.12) 0%, transparent 55%),' +
                'radial-gradient(100% 80% at 15% 95%, rgba(90,120,180,0.10) 0%, transparent 60%),' +
                '#050506',
            }}
          />
        )}

        {/* Mouse-reactive depth layers — multiple parallax planes for a 3D feel */}
        {!reduced && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {/* far — soft gold atmosphere */}
            <div
              style={{
                position: 'absolute', top: '42%', left: '64%',
                width: '42rem', height: '42rem',
                background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 65%)',
                filter: 'blur(40px)', mixBlendMode: 'screen',
                transform: 'translate(-50%,-50%) translate(calc(var(--mx,0) * 6px), calc(var(--my,0) * 6px))',
                transition: 'transform 0.5s ease-out',
              }}
            />
            {/* mid — diagonal light ray */}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(115deg, transparent 42%, rgba(212,175,55,0.06) 55%, transparent 68%)',
                mixBlendMode: 'screen',
                transform: 'translate(calc(var(--mx,0) * 12px), calc(var(--my,0) * 9px))',
                transition: 'transform 0.4s ease-out',
              }}
            />
            {/* near — fine highlight that tracks the cursor most */}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at 66% 46%, rgba(255,236,180,0.06) 0%, transparent 52%)',
                mixBlendMode: 'screen',
                transform: 'translate(calc(var(--mx,0) * 20px), calc(var(--my,0) * 15px))',
                transition: 'transform 0.3s ease-out',
              }}
            />
          </div>
        )}

        {/* Dark gradient overlay — keeps the existing hero text readable */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, #050506 0%, rgba(5,5,6,0.85) 26%, rgba(5,5,6,0.45) 52%, transparent 82%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: 'linear-gradient(to top, #050506 0%, rgba(5,5,6,0.4) 50%, transparent 100%)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{ background: 'linear-gradient(to bottom, rgba(5,5,6,0.85), transparent)' }}
          aria-hidden="true"
        />

        {/* Content overlay (unchanged — wording, buttons, layout all preserved) */}
        <div className="absolute inset-0 flex items-center">
          <div className="container-max grid w-full items-center gap-8 lg:grid-cols-[2fr_3fr]">
            <div className="relative">
              <div className="eyebrow">
                <Sparkle className="h-3.5 w-3.5" />
                Premium Software &amp; Web Studio
              </div>

              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.06] tracking-tight text-gray-50 sm:text-5xl">
                Websites &amp; Apps Built For{' '}
                <span className="metallic-text">Businesses</span>{' '}
                Of Every Size.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
                From local businesses to growing companies, Digital Skyline Co.
                creates premium websites, applications, and digital experiences
                tailored to the way your business operates.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a href="#consultation" className="btn-gold text-base">
                  Book a Free Consultation <Arrow className="h-5 w-5" />
                </a>
                <a href="#portfolio" className="btn-ghost text-base">
                  View Our Work
                </a>
              </div>

              <div className="mt-12 border-t border-white/[0.07] pt-6">
                <div className="grid max-w-sm grid-cols-2 gap-x-6 gap-y-3">
                  {CAPABILITIES.map((c) => (
                    <div key={c} className="flex items-center gap-2.5 font-display text-sm text-gray-300">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400 shadow-[0_0_5px_2px_rgba(212,175,55,0.5)]" />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden lg:block" aria-hidden="true" />
          </div>
        </div>

        {/* Scroll cue */}
        {!reduced && (
          <div
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            aria-hidden="true"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-400">
              Scroll to explore
            </span>
            <span className="flex h-8 w-5 items-start justify-center rounded-full border border-gold-400/40 p-1">
              <span className="h-2 w-1 animate-bounce rounded-full bg-gold-400" />
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
