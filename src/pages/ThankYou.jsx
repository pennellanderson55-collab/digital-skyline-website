import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import usePageMeta from '../lib/usePageMeta.js'

export default function ThankYou() {
  usePageMeta({
    title: 'Thank You | Digital Skyline Co.',
    description:
      'Thank you for contacting Digital Skyline Co. We have received your message and will be in touch shortly.',
  })

  useEffect(() => {
    // ─────────────────────────────────────────────────────────────────────
    // CONVERSION TRACKING — CONTACT FORM SUBMISSION
    // This page renders only after a successful contact-form submit, so it is
    // the ideal place to fire a conversion event.
    //
    // Google Analytics 4 (gtag.js) — uncomment once GA is installed:
    //   window.gtag?.('event', 'generate_lead', {
    //     event_category: 'contact',
    //     event_label: 'thank_you_page',
    //   })
    //
    // Google Ads conversion — uncomment and replace with your IDs:
    //   window.gtag?.('event', 'conversion', {
    //     send_to: 'AW-XXXXXXXXXX/XXXXXXXXXXXXXXXXXXX',
    //   })
    // ─────────────────────────────────────────────────────────────────────
  }, [])

  return (
    <main className="confirm-scope relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6 py-20 text-gray-200 font-sans">
      {/* Subtle animated background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400/[0.08] blur-[120px] animate-float-slow" />
        <div className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gold-300/[0.05] blur-[100px] animate-float" />
        <div className="absolute inset-0 bg-radial-gold opacity-60" />
      </div>

      <div className="w-full max-w-xl text-center">
        {/* Success / checkmark animation */}
        <div className="mb-10 flex justify-center">
          <span className="relative flex h-24 w-24 items-center justify-center">
            {/* Expanding pulse rings */}
            <span className="absolute inline-flex h-full w-full rounded-full border border-gold-400/40 animate-pulse-ring" />
            <span
              className="absolute inline-flex h-full w-full rounded-full border border-gold-400/30 animate-pulse-ring"
              style={{ animationDelay: '0.8s' }}
            />
            {/* Gold disc */}
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gold-gradient shadow-gold-soft">
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

        <p className="eyebrow mb-6">Message Received</p>

        <h1 className="font-display text-5xl font-bold text-white sm:text-6xl">
          Thank You!
        </h1>

        <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-gold-100/90">
          We've received your message and appreciate your interest in Digital
          Skyline Co.
        </p>

        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-gray-400">
          A member of our team will review your inquiry and reach out as soon as
          possible. We're excited to learn more about your business and discuss
          how we can help.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/" className="btn-ghost w-full sm:w-auto">
            Return Home
          </Link>
          <Link to="/#consultation" className="btn-gold w-full sm:w-auto">
            Schedule a Consultation
          </Link>
        </div>
      </div>

      {/* Local keyframes for the checkmark draw */}
      <style>{`
        @keyframes checkDraw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </main>
  )
}
