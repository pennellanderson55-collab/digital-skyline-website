/**
 * Circular "Digital Skyline Co." badge — recreated entirely in SVG so it stays
 * crisp at any size and matches the brand mark (gold skyline + wordmark inside a
 * thin gold ring on matte black). `compact` hides the tagline for small sizes.
 */

// gold skyline towers: [x, width, height]; base sits at y=150
const TOWERS = [
  [61, 9, 42],
  [71, 11, 66],
  [83, 11, 56],
  [96, 14, 86],
  [112, 16, 118], // center spire tower
  [130, 13, 92],
  [145, 11, 60],
  [157, 11, 74],
  [170, 9, 44],
]
const BASE = 150

export default function LogoBadge({ className = 'h-16 w-16', compact = false }) {
  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role="img"
      aria-label="Digital Skyline Co."
    >
      <defs>
        <linearGradient id="skyGold" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#8a6516" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#f7e6b0" />
        </linearGradient>
        <linearGradient id="skyGoldH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a87f22" />
          <stop offset="0.5" stopColor="#f5ead0" />
          <stop offset="1" stopColor="#a87f22" />
        </linearGradient>
      </defs>

      {/* matte black disc + gold ring */}
      <circle cx="120" cy="120" r="118" fill="#0a0a0c" />
      <circle cx="120" cy="120" r="115" fill="none" stroke="url(#skyGoldH)" strokeWidth="1.4" />

      {/* skyline */}
      <g>
        {TOWERS.map(([x, w, h], i) => (
          <rect
            key={i}
            x={x}
            y={BASE - h}
            width={w}
            height={h}
            fill="url(#skyGold)"
          />
        ))}
        {/* center spire */}
        <rect x="119" y="18" width="2" height="16" fill="url(#skyGold)" />
        {/* subtle window/structure lines on the tallest towers */}
        <g stroke="#0a0a0c" strokeWidth="0.9" opacity="0.55">
          <line x1="120" y1="34" x2="120" y2="150" />
          <line x1="103" y1="66" x2="103" y2="150" />
          <line x1="136" y1="60" x2="136" y2="150" />
        </g>
        {/* ground line */}
        <line x1="58" y1="151" x2="182" y2="151" stroke="url(#skyGoldH)" strokeWidth="1.4" />
      </g>

      {/* wordmark */}
      <text
        x="120" y="173" textAnchor="middle"
        fontFamily='"Space Grotesk", system-ui, sans-serif'
        fontSize="17" fontWeight="600" letterSpacing="5"
        fill="#f3f1ea"
      >
        DIGITAL
      </text>
      <text
        x="120" y="197" textAnchor="middle"
        fontFamily='"Space Grotesk", system-ui, sans-serif'
        fontSize="22" fontWeight="700" letterSpacing="4"
        fill="url(#skyGoldH)"
      >
        SKYLINE
      </text>

      {/* CO with flanking rules */}
      <line x1="96" y1="210" x2="108" y2="210" stroke="url(#skyGoldH)" strokeWidth="1" />
      <text
        x="120" y="214" textAnchor="middle"
        fontFamily='"Space Grotesk", system-ui, sans-serif'
        fontSize="11" fontWeight="600" letterSpacing="3"
        fill="#f3f1ea"
      >
        CO
      </text>
      <line x1="132" y1="210" x2="144" y2="210" stroke="url(#skyGoldH)" strokeWidth="1" />

      {!compact && (
        <g
          fontFamily='"JetBrains Mono", ui-monospace, monospace'
          fontSize="6.4" letterSpacing="0.5" fill="#c69b2e" textAnchor="middle"
        >
          <text x="120" y="226">DIGITAL PRODUCTS. REAL SOLUTIONS.</text>
          <text x="120" y="235">ENDLESS POSSIBILITIES.</text>
        </g>
      )}
    </svg>
  )
}
