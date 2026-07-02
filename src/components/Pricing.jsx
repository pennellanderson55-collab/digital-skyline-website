import SectionHeading from './SectionHeading.jsx'
import { Check, Arrow } from './Icons.jsx'

const PLANS = [
  {
    name: 'Starter Website',
    valuePrice: '$2,500',
    price: 'Starting at $750',
    cadence: 'per project',
    blurb: 'Perfect for small businesses that need a professional online presence.',
    features: [
      'Up to 5 custom pages',
      'Mobile responsive design',
      'Contact form integration',
      'Google Maps integration',
      'Basic SEO setup',
      'Social media links',
      '1 round of revisions',
    ],
    cta: 'Book a Free Consultation',
  },
  {
    name: 'Business Website',
    valuePrice: '$5,000',
    price: 'Starting at $1,500',
    cadence: 'per project',
    blurb: 'Designed for growing businesses that need a more complete digital presence.',
    features: [
      'Up to 8 custom pages',
      'Everything in Starter Website',
      'Photo galleries',
      'Booking or quote request forms',
      'Enhanced SEO setup',
      'Analytics integration',
      '2 rounds of revisions',
    ],
    cta: 'Book a Free Consultation',
    featured: true,
  },
  {
    name: 'Custom Solutions',
    valuePrice: '$8,000+',
    price: 'Custom Quote',
    cadence: 'project scope',
    blurb: 'For businesses that need applications, portals, dashboards, automations, or fully custom digital systems.',
    features: [
      'Custom applications',
      'Client portals',
      'Business dashboards',
      'Workflow automations',
      'CRM integrations',
      'Advanced functionality',
      'Custom project scope',
    ],
    cta: 'Book a Free Consultation',
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24">
      <div
        className="absolute left-1/2 top-10 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-gold-400/[0.06] blur-[130px]"
        aria-hidden="true"
      />
      <div className="container-max relative">
        <SectionHeading
          eyebrow="Pricing"
          title="Professional Websites For"
          accent="Businesses Of Every Size."
          subtitle="Whether you're launching a new business or upgrading your online presence, every project begins with a free consultation to determine the best solution for your goals."
        />

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl border p-7 transition-transform duration-300 hover:-translate-y-1 ${
                p.featured
                  ? 'border-gold-400/50 bg-gradient-to-b from-gold-400/[0.1] to-transparent shadow-gold'
                  : 'border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold-gradient px-4 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-950">
                  Most popular
                </span>
              )}

              <h3 className="font-display text-xl font-semibold text-gray-50">
                {p.name}
              </h3>
              <p className="mt-2 min-h-[2.5rem] text-sm text-gray-400">{p.blurb}</p>

              <div className="mt-5">
                {p.valuePrice && (
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="font-display text-lg font-medium text-gold-200/40 line-through decoration-gold-400/40 decoration-[1.5px]">
                      {p.valuePrice}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                      value
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold text-gold-gradient">
                    {p.price}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-wider text-gray-500">
                    {p.cadence}
                  </span>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/10 text-gold-300">
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Optional maintenance — same on every package; clearly an add-on,
                  never bundled or implied as required. */}
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-gold-300/80">
                  Optional add-on
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                  Optional monthly maintenance plans are available after launch to help keep your
                  website secure, updated, and running smoothly.
                </p>
              </div>

              <a
                href="#consultation"
                className={`mt-8 ${p.featured ? 'btn-gold' : 'btn-ghost'} w-full text-sm`}
              >
                {p.cta} <Arrow className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-xs text-gray-500">
          Flexible payment options available · Custom quotes for larger projects · Free consultation included
        </p>
      </div>
    </section>
  )
}
