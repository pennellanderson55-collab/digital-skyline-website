import { useEffect, useRef, useState } from 'react'

/* ============================================================
 * Tasteful audio feedback (synthesized — no asset files):
 *   • soft tick when hovering interactive elements
 *   • subtle whoosh as a new section scrolls into view
 * A clearly visible toggle defaults to OFF; sound only ever
 * starts from the user's click (a gesture) — never autoplay.
 * ============================================================ */

export default function SoundToggle() {
  const [on, setOn] = useState(false)
  const onRef = useRef(false)
  const ctxRef = useRef(null)
  const lastHover = useRef(null)
  const lastWhoosh = useRef(0)

  useEffect(() => { onRef.current = on }, [on])

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) ctxRef.current = new AC()
    }
    const ctx = ctxRef.current
    if (ctx && ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  const toggle = () => {
    const next = !on
    setOn(next)
    if (next) ensureCtx() // create/resume the context on the user's gesture
  }

  const playTick = () => {
    const ctx = ctxRef.current
    if (!ctx || !onRef.current) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(900, t)
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.03)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.07)
  }

  const playWhoosh = () => {
    const ctx = ctxRef.current
    if (!ctx || !onRef.current) return
    const t = ctx.currentTime
    const dur = 0.5
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) // decaying noise
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(280, t)
    filter.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.5)
    filter.frequency.exponentialRampToValueAtTime(180, t + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.04, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start(t)
    src.stop(t + dur)
  }

  // hover tick (only when entering a new interactive element)
  useEffect(() => {
    const onOver = (e) => {
      if (!onRef.current) return
      const el = e.target.closest && e.target.closest('a, button, [data-cursor-hover]')
      if (el && el !== lastHover.current) {
        lastHover.current = el
        playTick()
      } else if (!el) {
        lastHover.current = null
      }
    }
    document.addEventListener('mouseover', onOver)
    return () => document.removeEventListener('mouseover', onOver)
  }, [])

  // whoosh on section transitions
  useEffect(() => {
    const sections = document.querySelectorAll('main section')
    if (!sections.length) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!onRef.current) return
        for (const en of entries) {
          if (en.isIntersecting && en.intersectionRatio >= 0.55) {
            const now = Date.now()
            if (now - lastWhoosh.current > 700) {
              lastWhoosh.current = now
              playWhoosh()
            }
          }
        }
      },
      { threshold: [0.55] },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Mute sound' : 'Enable sound'}
      title={on ? 'Sound on — click to mute' : 'Sound off — click to enable'}
      className="fixed bottom-5 right-5 z-[90] flex h-12 w-12 items-center justify-center rounded-full border border-gold-400/40 bg-ink-950/70 text-gold-200 backdrop-blur-md transition-all duration-300 hover:border-gold-400/70 hover:bg-gold-400/10 active:scale-95"
    >
      {on ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="m17 9 4 6M21 9l-4 6" />
        </svg>
      )}
    </button>
  )
}
