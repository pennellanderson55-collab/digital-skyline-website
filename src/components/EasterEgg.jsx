import { useEffect, useRef, useState } from 'react'

/* ============================================================
 * Delight moments:
 *   1. A styled hello in the browser console for curious devs.
 *   2. The Konami code (↑↑↓↓←→←→ B A) → a gold confetti burst
 *      with a celebratory message.
 * ============================================================ */

const SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
]

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function EasterEgg() {
  const canvasRef = useRef(null)
  const [active, setActive] = useState(false)

  // 1) console hello + tiny keyframe for the message pop
  useEffect(() => {
    console.log(
      '%c✦ DIGITAL SKYLINE CO. ✦',
      'font: 700 22px "Space Grotesk", sans-serif; color:#d4af37; text-shadow:0 1px 8px rgba(212,175,55,.5)',
    )
    console.log(
      '%cBuilt with obsessive detail. Psst — try the Konami code:  ↑ ↑ ↓ ↓ ← → ← → B A',
      'color:#e3bf6a; font-size:13px; font-family:monospace',
    )
    console.log(
      '%cLike what you see under the hood? We build premium websites & apps →  digitalskyline.co',
      'color:#8a8f98; font-size:12px',
    )

    if (!document.getElementById('egg-kf')) {
      const s = document.createElement('style')
      s.id = 'egg-kf'
      s.textContent =
        '@keyframes eggPop{0%{opacity:0;transform:translateY(14px) scale(.92)}100%{opacity:1;transform:translateY(0) scale(1)}}'
      document.head.appendChild(s)
    }
  }, [])

  // 2) konami listener
  useEffect(() => {
    let idx = 0
    const onKey = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === SEQUENCE[idx]) {
        idx += 1
        if (idx === SEQUENCE.length) {
          idx = 0
          setActive(true)
        }
      } else {
        idx = key === SEQUENCE[0] ? 1 : 0
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 3) gold confetti burst while active
  useEffect(() => {
    if (!active) return
    if (reduced) {
      const t = setTimeout(() => setActive(false), 2200)
      return () => clearTimeout(t)
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const colors = ['#d4af37', '#e3bf6a', '#f5ead0', '#fff7e0', '#a87f22']
    const cx = W / 2
    const cy = H * 0.6
    const parts = Array.from({ length: 150 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 11
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (3 + Math.random() * 5),
        size: 4 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0],
      }
    })

    let raf = 0
    const start = performance.now ? performance.now() : Date.now()
    const draw = (now) => {
      const t = (now || Date.now()) - start
      ctx.clearRect(0, 0, W, H)
      const alpha = t < 2600 ? 1 : Math.max(0, 1 - (t - 2600) / 1100)
      for (const p of parts) {
        p.vy += 0.16 // gravity
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vrot
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (t < 3700) raf = requestAnimationFrame(draw)
      else setActive(false)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div
        className="relative text-center"
        style={{ animation: 'eggPop 0.6s cubic-bezier(0.2,0.8,0.3,1) both' }}
      >
        <div className="font-display text-4xl font-bold text-gold-gradient text-shadow-gold sm:text-6xl">
          ✦ Skyline Unlocked ✦
        </div>
        <div className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-gold-200/80">
          You found the secret
        </div>
      </div>
    </div>
  )
}
