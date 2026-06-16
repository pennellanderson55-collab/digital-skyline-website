import { useEffect, useRef } from 'react'

/**
 * Animated neural-network canvas background.
 * Nodes drift slowly; nearby nodes link with gold filaments,
 * and links brighten near the cursor for an "alive" feel.
 */
export default function NeuralBackground({ density = 64, className = '' }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let width = 0
    let height = 0
    let nodes = []
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function seed() {
      const count = Math.min(
        density,
        Math.floor((width * height) / 16000),
      )
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.6,
      }))
    }

    function resize() {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    function step() {
      ctx.clearRect(0, 0, width, height)
      const linkDist = 130

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        if (!prefersReduced) {
          n.x += n.vx
          n.y += n.vy
        }
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1

        // links
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j]
          const dx = n.x - m.x
          const dy = n.y - m.y
          const dist = Math.hypot(dx, dy)
          if (dist < linkDist) {
            const mx = (n.x + m.x) / 2
            const my = (n.y + m.y) / 2
            const near = Math.hypot(mouse.current.x - mx, mouse.current.y - my)
            const glow = near < 160 ? 1 - near / 160 : 0
            const base = (1 - dist / linkDist) * 0.18
            ctx.strokeStyle = `rgba(212,175,55,${base + glow * 0.5})`
            ctx.lineWidth = 0.6 + glow * 0.8
            ctx.beginPath()
            ctx.moveTo(n.x, n.y)
            ctx.lineTo(m.x, m.y)
            ctx.stroke()
          }
        }
      }

      // nodes on top
      for (const n of nodes) {
        const near = Math.hypot(mouse.current.x - n.x, mouse.current.y - n.y)
        const glow = near < 140 ? 1 - near / 140 : 0
        ctx.fillStyle = `rgba(227,191,106,${0.4 + glow * 0.6})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r + glow * 1.4, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(step)
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function onLeave() {
      mouse.current = { x: -9999, y: -9999 }
    }

    resize()
    step()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [density])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  )
}
