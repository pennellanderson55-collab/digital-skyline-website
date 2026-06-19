import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import usePageMeta from '../lib/usePageMeta.js'

const prettyDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const NEXT_STEPS = [
  'We review your business needs',
  'We discuss your goals and vision',
  'We outline possible solutions',
  'We provide recommendations and next steps',
]

export default function ConsultationConfirmed() {
  const { state } = useLocation()
  const booking = state || null

  usePageMeta({
    title: 'Consultation Confirmed | Digital Skyline Co.',
    description:
      'Your consultation with Digital Skyline Co. has been successfully scheduled.',
  })

  useEffect(() => {
    // ─────────────────────────────────────────────────────────────────────
    // CONVERSION TRACKING — CONSULTATION BOOKED
    // This page renders only after a consultation is successfully booked,
    // making it the canonical place to fire the high-value conversion event.
    //
    // Google Analytics 4 (gtag.js) — uncomment once GA is installed:
    //   window.gtag?.('event', 'schedule', {
    //     event_category: 'consultation',
    //     event_label: 'consultation_confirmed_page',
    //   })
    //
    // Google Ads conversion — uncomment and replace with your IDs:
    //   window.gtag?.('event', 'conversion', {
    //     send_to: 'AW-XXXXXXXXXX/XXXXXXXXXXXXXXXXXXX',
    //   })
    // ─────────────────────────────────────────────────────────────────────
  }, [])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6 py-20 text-gray-200 font-sans">
      {/* Subtle animated background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400/[0.08] blur-[120px] animate-float-slow" />
        <div className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gold-300/[0.05] blur-[100px] animate-float" />
        <div className="absolute inset-0 bg-radial-gold opacity-60" />
      </div>

      <div className="w-full max-w-xl text-center">
        {/* Glowing confirmation icon */}
        <div className="mb-10 flex justify-center">
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full border border-gold-400/40 animate-pulse-ring" />
            <span
              className="absolute inline-flex h-full w-full rounded-full border border-gold-400/30 animate-pulse-ring"
              style={{ animationDelay: '0.8s' }}
            />
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gold-gradient shadow-gold-soft animate-core-glow">
              <svg
                viewBox="0 0 52 52"
                className="h-12 w-12"
                fill="none"
                stroke="#050506"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M14 27 L23 36 L39 18"
                  style={{
                    strokeDasharray: 48,
                    strokeDashoffset: 48,
                    animation: 'checkDraw 0.6s ease-out 0.25s forwards',
                  }}
                />
              </svg>
            </span>
          </span>
        </div>

        <p className="eyebrow mb-6">Booking Confirmed</p>

        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Consultation Confirmed
        </h1>

        <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-gold-100/90">
          Your consultation has been successfully scheduled.
        </p>

        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-gray-400">
          Thank you for booking a consultation with Digital Skyline Co. We look
          forward to learning about your goals and exploring how custom
          websites, applications, dashboards, and AI-powered solutions can help
          grow your business.
        </p>

        {/* Booking details (passed from the booking form) */}
        {booking && (booking.date || booking.business) && (
          <div className="card-surface mx-auto mt-10 max-w-md p-6 text-left">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold-300">
              Your Booking
            </h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              {booking.business && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Business</dt>
                  <dd className="font-medium text-gray-100">{booking.business}</dd>
                </div>
              )}
              {booking.date && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="font-medium text-gray-100">{prettyDate(booking.date)}</dd>
                </div>
              )}
              {booking.time && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Time</dt>
                  <dd className="font-medium text-gray-100">{booking.time}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 border-t border-white/[0.06] pt-3 font-mono text-[11px] text-gray-500">
              A confirmation email is on its way to your inbox.
            </p>
          </div>
        )}

        {/* What Happens Next */}
        <div className="card-surface mx-auto mt-10 max-w-md p-7 text-left">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold-300">
            What Happens Next
          </h2>
          <ul className="mt-5 space-y-3.5">
            {NEXT_STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-3 text-sm leading-relaxed text-gray-300"
                style={{
                  animation: `stepIn 0.5s ease-out ${0.3 + i * 0.12}s both`,
                }}
              >
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold-400/15 text-gold-300">
                  <svg
                    viewBox="0 0 20 20"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 10 L8.5 14.5 L16 5.5" />
                  </svg>
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/" className="btn-ghost w-full sm:w-auto">
            Return Home
          </Link>
          <Link to="/#services" className="btn-gold w-full sm:w-auto">
            View Our Services
          </Link>
        </div>
      </div>

      {/* Local keyframes */}
      <style>{`
        @keyframes checkDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  )
}
