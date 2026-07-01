import { useEffect, useState } from 'react'

/* ============================================================
 * Intro loader — counts 0 → 100 while assets load, then slides
 * up like a curtain to reveal the hero behind it.
 * Locks scroll while active; respects prefers-reduced-motion.
 * ============================================================ */

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Loader() {
  const [count, setCount] = useState(0)
  const [leaving, setLeaving] = useState(false) // exit animation running
  const [gone, setGone] = useState(false) // fully removed

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // lock scroll during intro

    const restore = () => { document.body.style.overflow = prevOverflow }

    const finish = () => {
      setCount(100)
      setLeaving(true)
      // remove after the curtain slide completes
      setTimeout(() => { setGone(true); restore() }, 950)
    }

    if (reduced) {
      setCount(100)
      const t = setTimeout(finish, 200)
      return () => { clearTimeout(t); restore() }
    }

    let loaded = document.readyState === 'complete'
    const onLoad = () => { loaded = true }
    window.addEventListener('load', onLoad)

    let cur = 0
    let raf = 0
    const tick = () => {
      // Climb toward 90 on a timer; only race to 100 once assets have loaded.
      const target = loaded ? 100 : 90
      const step = Math.max(0.5, (target - cur) * 0.08)
      cur = Math.min(cur + step, target)
      setCount(Math.round(cur))
      if (cur >= 100) { finish(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('load', onLoad)
      restore()
    }
  }, [])

  if (gone) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink-950 transition-transform duration-[900ms] [transition-timing-function:cubic-bezier(0.76,0,0.24,1)] ${
        leaving ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* ambient gold glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400/10 blur-[120px]" />

      <div className="relative flex flex-col items-center">
        <span className="block h-20 w-20 overflow-hidden rounded-full opacity-90">
          <img
            src="/logo.png"
            alt="Digital Skyline Co."
            decoding="async"
            className="h-full w-full scale-[1.08] object-cover"
          />
        </span>

        <div className="mt-6 font-display text-6xl font-bold tabular-nums text-gold-gradient sm:text-7xl">
          {String(count).padStart(3, '0')}
        </div>

        {/* progress bar */}
        <div className="mt-6 h-[3px] w-56 overflow-hidden rounded-full bg-white/10 sm:w-72">
          <div
            className="h-full rounded-full bg-gold-gradient transition-[width] duration-150 ease-out"
            style={{ width: `${count}%` }}
          />
        </div>

        <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.35em] text-gray-500">
          Digital Skyline Co.
        </div>
      </div>
    </div>
  )
}
