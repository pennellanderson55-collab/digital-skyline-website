// Minimal inline SVG icon set — keeps the bundle dependency-free.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

export function Logo({ className = 'h-8 w-8' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5ead0" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#a87f22" />
        </linearGradient>
      </defs>
      <path
        d="M12 46 L26 18 L33 32 L41 12 L52 46"
        stroke="url(#logoG)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="41" cy="12" r="4" fill="url(#logoG)" />
    </svg>
  )
}

export const Scan = (p) => (
  <svg {...base} className={p.className}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M4 12h16" className="opacity-70" />
  </svg>
)

export const Bolt = (p) => (
  <svg {...base} className={p.className}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
  </svg>
)

export const Brain = (p) => (
  <svg {...base} className={p.className}>
    <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 6 17a3 3 0 0 0 3 3 2.5 2.5 0 0 0 3-2.5V5.5A2.5 2.5 0 0 0 9 3Z" />
    <path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3 3 0 0 1 18 17a3 3 0 0 1-3 3 2.5 2.5 0 0 1-3-2.5" />
  </svg>
)

export const Code = (p) => (
  <svg {...base} className={p.className}>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </svg>
)

export const Cube = (p) => (
  <svg {...base} className={p.className}>
    <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </svg>
)

export const Chart = (p) => (
  <svg {...base} className={p.className}>
    <path d="M3 3v18h18" />
    <path d="m7 14 3-4 3 3 5-7" />
  </svg>
)

export const Shield = (p) => (
  <svg {...base} className={p.className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

export const Check = (p) => (
  <svg {...base} className={p.className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const Arrow = (p) => (
  <svg {...base} className={p.className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const Plus = (p) => (
  <svg {...base} className={p.className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Sparkle = (p) => (
  <svg {...base} className={p.className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
)

export const Activity = (p) => (
  <svg {...base} className={p.className}>
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </svg>
)

export const User = (p) => (
  <svg {...base} className={p.className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

export const Image = (p) => (
  <svg {...base} className={p.className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
)

export const Play = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden="true">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
)
