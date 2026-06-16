import { useEffect, useState } from 'react'

/* A small "living" detail — the visitor's own city (from their timezone, no
   permission prompt) and a ticking local clock, so the site feels present. */

function cityFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const part = tz.split('/').pop() || ''
    return part.replace(/_/g, ' ')
  } catch {
    return ''
  }
}

export default function LiveStatus({ className = '' }) {
  const [now, setNow] = useState(() => new Date())
  const [city] = useState(cityFromTimezone)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className={`flex items-center gap-2 font-mono text-xs text-gray-500 ${className}`}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold-400" />
      </span>
      <span className="uppercase tracking-[0.18em]">
        {city ? `${city} · ` : ''}
        <span className="tabular-nums text-gray-400">{time}</span>{' '}
        <span className="text-gray-600">local</span>
      </span>
    </div>
  )
}
