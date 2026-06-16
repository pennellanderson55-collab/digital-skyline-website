import { useEffect, useRef } from 'react'

/* ============================================================
 * Premium Custom Cursor
 *
 * Architecture (no external deps):
 *   • Two DOM elements: a crisp gold DOT + a lagged gold RING.
 *   • A single RAF loop lerps the ring toward the mouse each frame
 *     and applies magnetic translation to nearby interactive elements
 *     via CSS custom properties (uses the CSS `translate` property
 *     so it never conflicts with Tailwind's transform utilities).
 *   • Hover / click state communicated via data-* attributes so CSS
 *     handles all transitions (no JS style flashing).
 *   • Disabled automatically on touch devices.
 * ============================================================ */

const LERP_RING   = 0.10   // ring lag (lower = more lag)
const MAG_RANGE   = 90     // px radius where magnetic pull starts
const MAG_STRENGTH = 0.28  // 0–1 fraction pulled toward cursor

const HOVER_SELECTOR  = 'a, button, label, [data-cursor-hover]'
const MAG_SELECTOR    = '.btn-gold, .btn-ghost, nav a, .cursor-magnetic'

export default function CustomCursor() {
  const dotRef  = useRef(null)
  const ringRef = useRef(null)
  const rafRef  = useRef(0)

  useEffect(() => {
    // Bail on touch-primary devices
    if (window.matchMedia('(hover: none)').matches) return

    const dot  = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mx = -300, my = -300   // mouse position
    let rx = -300, ry = -300   // ring position (lerped)
    let visible = false

    function lerp(a, b, t) { return a + (b - a) * t }

    // Cache magnetic elements once; they don't change on this single-page site.
    let magEls = []
    const cacheMag = () => { magEls = [...document.querySelectorAll(MAG_SELECTOR)] }
    cacheMag()
    // Re-cache after a moment in case React hasn't painted yet.
    const cacheTimer = setTimeout(cacheMag, 800)

    function tick() {
      // Lerp ring toward cursor
      rx = lerp(rx, mx, LERP_RING)
      ry = lerp(ry, my, LERP_RING)

      // Move elements via transform (translate avoids recalc)
      dot.style.transform  = `translate(${mx}px, ${my}px)`
      ring.style.transform = `translate(${rx}px, ${ry}px)`

      // Magnetic pull on interactive elements
      for (const el of magEls) {
        const r  = el.getBoundingClientRect()
        const cx = r.left + r.width  / 2
        const cy = r.top  + r.height / 2
        const dx = mx - cx
        const dy = my - cy
        const dist = Math.hypot(dx, dy)

        if (dist < MAG_RANGE) {
          const f  = (1 - dist / MAG_RANGE) * MAG_STRENGTH
          el.style.setProperty('--mag-x', `${(dx * f).toFixed(2)}px`)
          el.style.setProperty('--mag-y', `${(dy * f).toFixed(2)}px`)
        } else {
          el.style.setProperty('--mag-x', '0px')
          el.style.setProperty('--mag-y', '0px')
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    // ── Event handlers ────────────────────────────────────────
    function onMove(e) {
      mx = e.clientX
      my = e.clientY
      if (!visible) {
        rx = mx; ry = my  // snap ring on first appearance
        dot.style.opacity  = '1'
        ring.style.opacity = '1'
        visible = true
      }
    }

    function onOver(e) {
      if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
        dot.dataset.hover  = '1'
        ring.dataset.hover = '1'
      }
    }
    function onOut(e) {
      if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
        delete dot.dataset.hover
        delete ring.dataset.hover
      }
    }
    function onDown() {
      dot.dataset.click  = '1'
      ring.dataset.click = '1'
    }
    function onUp() {
      delete dot.dataset.click
      delete ring.dataset.click
    }
    function onDocLeave() {
      dot.style.opacity  = '0'
      ring.style.opacity = '0'
      visible = false
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseover',  onOver)
    document.addEventListener('mouseout',   onOut)
    document.addEventListener('mousedown',  onDown)
    document.addEventListener('mouseup',    onUp)
    document.addEventListener('mouseleave', onDocLeave)

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      clearTimeout(cacheTimer)
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover',  onOver)
      document.removeEventListener('mouseout',   onOut)
      document.removeEventListener('mousedown',  onDown)
      document.removeEventListener('mouseup',    onUp)
      document.removeEventListener('mouseleave', onDocLeave)
      // Reset any lingering magnetic offsets
      for (const el of document.querySelectorAll(MAG_SELECTOR)) {
        el.style.setProperty('--mag-x', '0px')
        el.style.setProperty('--mag-y', '0px')
      }
    }
  }, [])

  return (
    <>
      {/* Outer ring — lagged, expands on hover */}
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
      {/* Inner dot — exact, shrinks on hover */}
      <div ref={dotRef}  className="cursor-dot"  aria-hidden="true" />
    </>
  )
}
