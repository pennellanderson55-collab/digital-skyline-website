import { useEffect, useRef } from 'react'
import { prefersReducedMotion, isTouchPrimary } from '../lib/device.js'

/* ============================================================
 * "In Motion" — the globe spins continuously and smoothly.
 *
 * Instead of seeking frames (which stutters on a compressed
 * clip), we PLAY the video and modulate its playbackRate from
 * the user's scroll / swipe / drag velocity — so the faster you
 * move, the faster the globe spins, always butter-smooth.
 *
 * The 17 MB clip + velocity rAF is desktop-only. On touch/mobile
 * (or reduced-motion) we show a static branded backdrop instead —
 * no video download, no rAF — keeping the section light on phones.
 * ============================================================ */

const reduced = prefersReducedMotion
const play = !reduced && !isTouchPrimary

const IDLE = 0.35 // gentle continuous spin when idle
const MAX = 2.25 // fastest spin — kept low so frame decoding stays smooth

export default function ScrollScrubShowcase() {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const video = videoRef.current
    if (!section || !video) return
    video.loop = true
    video.muted = true

    if (reduced) {
      video.pause()
      return
    }

    let boost = 0 // extra speed from user motion (decays)
    let rate = IDLE // the rate actually applied (eased toward target)
    let visible = false
    let running = false
    let raf = 0
    let lastY = window.scrollY

    const apply = () => {
      const target = Math.min(MAX, Math.max(0.1, IDLE + boost))
      // ease the applied rate toward the target so it never jumps — abrupt
      // playbackRate changes are what make the decoder stutter.
      rate += (target - rate) * 0.12
      try {
        if (Math.abs(video.playbackRate - rate) > 0.01) video.playbackRate = rate
      } catch (e) {}
      boost *= 0.94
      if (boost < 0.01) boost = 0
      if (running) raf = requestAnimationFrame(apply)
    }
    const startLoop = () => { if (!running) { running = true; raf = requestAnimationFrame(apply) } }
    const stopLoop = () => { running = false; cancelAnimationFrame(raf) }

    const addBoost = (amount) => { boost = Math.min(MAX, boost + amount) }

    // any vertical page scroll (while in view) spins the globe
    const onScroll = () => {
      if (!visible) { lastY = window.scrollY; return }
      const dy = window.scrollY - lastY
      lastY = window.scrollY
      addBoost(Math.abs(dy) * 0.008)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // horizontal trackpad swipe spins (and doesn't hijack vertical)
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        addBoost(Math.abs(e.deltaX) * 0.01)
      }
    }
    section.addEventListener('wheel', onWheel, { passive: false })

    // mouse drag spins
    let dragging = false
    let lastX = 0
    const onDown = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      dragging = true
      lastX = e.clientX
      section.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      addBoost(Math.abs(dx) * 0.018)
    }
    const onUp = (e) => {
      dragging = false
      try { section.releasePointerCapture?.(e.pointerId) } catch (err) {}
    }
    section.addEventListener('pointerdown', onDown)
    section.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    const io = new IntersectionObserver(
      ([en]) => {
        visible = en.isIntersecting
        if (visible) {
          lastY = window.scrollY
          video.play?.().catch(() => {})
          startLoop()
        } else {
          video.pause?.()
          stopLoop()
        }
      },
      { threshold: 0 },
    )
    io.observe(section)

    return () => {
      stopLoop()
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      section.removeEventListener('wheel', onWheel)
      section.removeEventListener('pointerdown', onDown)
      section.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full select-none overflow-hidden bg-ink-950"
      style={{ cursor: play ? 'grab' : 'default' }}
    >
      {/* preload="none" + no autoPlay: the IntersectionObserver in the effect
          starts playback (and the download) only once the section is in view,
          and pauses it when it scrolls away — so this 17MB clip costs nothing
          until a visitor reaches it. On touch/mobile we skip the video entirely
          and show a static branded backdrop. */}
      {play ? (
        <video
          ref={videoRef}
          src="/ds-city-1.mp4"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(90% 70% at 50% 42%, rgba(212,175,55,0.14) 0%, transparent 58%),' +
              'radial-gradient(120% 90% at 80% 90%, rgba(90,120,180,0.10) 0%, transparent 60%),' +
              '#050506',
          }}
        />
      )}

      {/* legibility wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-ink-950/60" aria-hidden="true" />

      {/* anchored caption */}
      <div className="pointer-events-none absolute inset-0 flex items-center">
        <div className="container-max">
          <div className="max-w-xl">
            <h2 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-gray-50 sm:text-5xl lg:text-6xl">
              Every detail, engineered to{' '}
              <span className="text-gold-gradient">unfold.</span>
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
              The same obsessive craft we bring to every website, app, and
              system we build.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
