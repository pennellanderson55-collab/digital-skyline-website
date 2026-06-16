import { useEffect, useRef } from 'react'

/* ============================================================
 * Velocity-reactive marquee.
 *   • Always drifts at a slow base speed.
 *   • Speeds up the faster the user scrolls.
 *   • Reverses direction when the user scrolls up.
 * Content is duplicated for a seamless loop.
 * ============================================================ */

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const WORDS = [
  'Custom Websites',
  'Applications',
  'Dashboards',
  'Business Systems',
  'Automation',
  'Branding',
]

export default function Marquee() {
  const trackRef = useRef(null)

  useEffect(() => {
    if (reduced) return
    const track = trackRef.current
    if (!track) return

    let x = 0
    const baseV = 0.6 // px/frame idle drift
    let boost = 0 // added by scroll velocity (signed)
    let lastY = window.scrollY
    let half = track.scrollWidth / 2 // width of one content set
    let raf = 0

    const measure = () => { half = track.scrollWidth / 2 }
    measure()

    const onScroll = () => {
      const y = window.scrollY
      boost += (y - lastY) * 0.25 // scroll velocity → marquee velocity
      boost = Math.max(-45, Math.min(45, boost)) // clamp
      lastY = y
    }

    const loop = () => {
      const v = baseV + boost
      x += v
      if (half > 0) {
        if (x >= half) x -= half
        else if (x < 0) x += half
      }
      track.style.transform = `translate3d(${-x}px,0,0)`
      boost *= 0.9 // decay back to base drift
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [])

  const set = WORDS.map((w, i) => (
    <span key={i} className="flex items-center gap-8 sm:gap-12">
      <span
        className={
          i % 2 === 0
            ? 'font-display text-3xl font-bold uppercase tracking-tight text-gray-100 sm:text-5xl'
            : 'font-display text-3xl font-bold uppercase tracking-tight text-gold-gradient sm:text-5xl'
        }
      >
        {w}
      </span>
      <span className="text-xl text-gold-400 sm:text-2xl">✦</span>
    </span>
  ))

  return (
    <section
      aria-hidden="true"
      className="relative overflow-hidden border-y border-white/[0.06] bg-ink-900/30 py-7 sm:py-9"
    >
      <div
        ref={trackRef}
        className="flex w-max items-center gap-8 will-change-transform sm:gap-12"
      >
        {set}
        {set}
      </div>
    </section>
  )
}
