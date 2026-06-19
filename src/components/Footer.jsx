import { Link } from 'react-router-dom'
import LiveStatus from './LiveStatus.jsx'

const SOCIALS = {
  Instagram: 'https://www.instagram.com/digitalskylineassets/',
  LinkedIn: 'https://www.linkedin.com/in/pennell-anderson-a407473b3/',
}

// In-page section targets (centered on content by the smooth-scroll handler)
const SECTION_HREFS = {
  Websites: '#services',
  'Web & Mobile Apps': '#services',
  'Customer Portals': '#services',
  Automation: '#services',
  'Growth & SEO': '#services',
  Work: '#portfolio',
  Pricing: '#pricing',
  FAQ: '#faq',
  About: '#top',
}

// Internal route targets (rendered as SPA links, not in-page anchors)
const ROUTE_HREFS = {
  'Client Portal': '/client-portal',
  'Pay Invoice': '/client-portal#payment',
  Support: '/support',
}

const COLS = [
  {
    title: 'Services',
    links: ['Websites', 'Web & Mobile Apps', 'Customer Portals', 'Automation', 'Growth & SEO'],
  },
  {
    title: 'Company',
    links: ['Work', 'Pricing', 'FAQ', 'About'],
  },
  {
    title: 'Portal',
    links: ['Client Portal', 'Pay Invoice', 'Support'],
  },
  {
    title: 'Connect',
    links: ['Instagram', 'LinkedIn'],
  },
]

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.08] bg-ink-900/40">
      <div className="container-max py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <a href="#top" className="flex items-center gap-3" aria-label="Digital Skyline Co. — home">
              <span className="block h-20 w-20 overflow-hidden rounded-full">
                <img src="/logo.png" alt="Digital Skyline Co." className="h-full w-full scale-[1.08] object-cover" />
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm text-gray-400">
              A premium digital agency crafting immersive websites, apps, and
              experiences that help businesses grow.
            </p>
            <a href="#consultation" className="btn-gold mt-6 px-5 py-2.5 text-sm">
              Book a Free Consultation
            </a>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-gray-300">
                {c.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => {
                  const cls = 'text-sm text-gray-400 transition-colors hover:text-gold-200'
                  // Internal route links (Client Portal / Pay Invoice)
                  if (ROUTE_HREFS[l]) {
                    return (
                      <li key={l}>
                        <Link to={ROUTE_HREFS[l]} className={cls}>{l}</Link>
                      </li>
                    )
                  }
                  const social = SOCIALS[l]
                  const href =
                    SECTION_HREFS[l] || (l.includes('@') ? `mailto:${l}` : social || '#')
                  const external = Boolean(social)
                  return (
                    <li key={l}>
                      <a
                        href={href}
                        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className={cls}
                      >
                        {l}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-6 sm:flex-row">
          <p className="font-mono text-xs text-gray-500">
            © {2026} Digital Skyline Co. — All rights reserved.
          </p>
          <LiveStatus />
          <div className="flex gap-6 font-mono text-xs text-gray-500">
            <Link to="/privacy" className="hover:text-gold-200 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-gold-200 transition-colors">Terms</Link>
            <Link to="/status" className="hover:text-gold-200 transition-colors">Status</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
