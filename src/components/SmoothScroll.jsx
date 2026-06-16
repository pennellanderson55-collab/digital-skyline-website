import { useEffect } from 'react'
import Lenis from 'lenis'

/* ============================================================
 * Premium smooth scrolling (Lenis).
 *
 * • Drives a single rAF loop — all scroll-tied animations
 *   (hero video scrub, parallax, navbar state) stay in sync
 *   because Lenis updates the real native scroll position.
 * • Accessibility: fully disabled under prefers-reduced-motion
 *   (falls back to the browser's native scrolling).
 * • In-page anchor links scroll smoothly with a navbar offset.
 * ============================================================ */
export default function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return // native scroll — no smoothing

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    })

    let rafId = 0
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    // Smooth in-page anchor navigation (offset clears the fixed navbar)
    const onClick = (e) => {
      const link = e.target.closest('a[href^="#"]')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href || href === '#') return
      const target = document.querySelector(href)
      if (!target) return
      e.preventDefault()

      // The logo/home link always goes to the very top.
      if (href === '#top') {
        lenis.scrollTo(0, { duration: 1.2 })
        return
      }

      // Otherwise center the section in the viewport so you land on the actual
      // content (e.g. the Portfolio carousel) rather than the section title.
      const rect = target.getBoundingClientRect()
      const absoluteTop = rect.top + window.scrollY
      const centered =
        absoluteTop + target.offsetHeight / 2 - window.innerHeight / 2
      lenis.scrollTo(Math.max(0, centered), { duration: 1.2 })
    }
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return null
}
