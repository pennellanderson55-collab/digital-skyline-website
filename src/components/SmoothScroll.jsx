import { useEffect } from 'react'
import Lenis from 'lenis'
import { prefersReducedMotion, isTouchPrimary } from '../lib/device.js'

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
    // Lenis (JS scroll-hijacking + a permanent rAF) is a desktop enhancement.
    // On touch/mobile it fights native momentum scrolling and adds jank, so we
    // fall back to the browser's native scroll there. Anchor links still scroll
    // smoothly via the native scroller below. Reduced-motion → instant jumps.
    const lenisEnabled = !prefersReducedMotion && !isTouchPrimary

    let lenis = null
    let rafId = 0
    if (lenisEnabled) {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.6,
      })
      const raf = (time) => {
        lenis.raf(time)
        rafId = requestAnimationFrame(raf)
      }
      rafId = requestAnimationFrame(raf)
    }

    // Scroll helper — uses Lenis on desktop, native scroll everywhere else.
    const scrollTo = (top) => {
      if (lenis) lenis.scrollTo(top, { duration: 1.2 })
      else window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    }

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
      if (href === '#top') { scrollTo(0); return }

      // Otherwise center the section in the viewport so you land on the actual
      // content (e.g. the Portfolio carousel) rather than the section title.
      const rect = target.getBoundingClientRect()
      const absoluteTop = rect.top + window.scrollY
      const centered =
        absoluteTop + target.offsetHeight / 2 - window.innerHeight / 2
      scrollTo(Math.max(0, centered))
    }
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      if (rafId) cancelAnimationFrame(rafId)
      if (lenis) lenis.destroy()
    }
  }, [])

  return null
}
