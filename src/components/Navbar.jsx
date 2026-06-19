import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Arrow } from './Icons.jsx'

const LINKS = [
  { label: 'Portfolio', href: '#portfolio' },
  { label: 'What We Do', href: '#services' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const onHome = pathname === '/'

  // In-page hash links smooth-scroll on the home page; from any other route
  // they navigate home first (the browser scrolls to the anchor on load).
  const sectionHref = (href) => (onHome ? href : `/${href}`)
  const consultHref = onHome ? '#consultation' : '/#consultation'

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent">
      <nav className="container-max flex h-20 items-center justify-between py-4">
        <a href={onHome ? '#top' : '/'} className="group flex items-center gap-3" aria-label="Digital Skyline Co. — home">
          <span className="block h-14 w-14 overflow-hidden rounded-full transition-transform duration-700 ease-out group-hover:rotate-[360deg] group-hover:[filter:drop-shadow(0_0_12px_rgba(212,175,55,0.6))]">
            <img
              src="/logo.png"
              alt="Digital Skyline Co."
              className="h-full w-full scale-[1.08] object-cover"
            />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-gray-50 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
            Digital Skyline<span className="text-gold-400">.</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={sectionHref(l.href)}
              className="font-display text-sm text-gray-300 transition-colors hover:text-gold-200"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/client-portal"
            className="font-display text-sm text-gray-300 transition-colors hover:text-gold-200"
          >
            Client Portal
          </Link>
        </div>

        <div className="hidden md:block">
          <a href={consultHref} className="btn-gold px-5 py-2.5 text-sm">
            Book a Free Consultation <Arrow className="h-4 w-4" />
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-gold-200 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <div className="space-y-1.5">
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${
                open ? 'translate-y-2 rotate-45' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-opacity ${
                open ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${
                open ? '-translate-y-2 -rotate-45' : ''
              }`}
            />
          </div>
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-ink-950/95 backdrop-blur-xl md:hidden">
          <div className="container-max flex flex-col gap-1 py-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={sectionHref(l.href)}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 font-display text-gray-200 hover:bg-white/5 hover:text-gold-200"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/client-portal"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 font-display text-gray-200 hover:bg-white/5 hover:text-gold-200"
            >
              Client Portal
            </Link>
            <a
              href={consultHref}
              onClick={() => setOpen(false)}
              className="btn-gold mt-2 w-full"
            >
              Book a Free Consultation
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
