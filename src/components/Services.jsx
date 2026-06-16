import SectionHeading from './SectionHeading.jsx'
import { Brain, Scan, Code, Cube, Chart, Shield } from './Icons.jsx'

const SERVICES = [
  {
    icon: Code,
    title: 'Premium Websites',
    desc: 'Beautiful, fast websites designed to build trust, generate inquiries, and help your business stand out from the competition.',
    tags: ['Web design', 'Mobile ready', 'Conversions'],
    featured: true,
  },
  {
    icon: Cube,
    title: 'Landing Pages & Leads',
    desc: 'Purpose-built pages engineered to capture more calls, bookings, and qualified leads from your traffic.',
    tags: ['Leads', 'Bookings', 'Growth'],
  },
  {
    icon: Shield,
    title: 'Smart Automations',
    desc: 'Simplify the busywork with practical automations for follow-ups, forms, reminders, and customer communication.',
    tags: ['Automation', 'Workflows', 'Time-saving'],
  },
  {
    icon: Brain,
    title: 'CRM & Client Systems',
    desc: 'Keep your leads organized with streamlined systems that help you respond faster and never miss an opportunity.',
    tags: ['CRM', 'Pipelines', 'Follow-up'],
  },
  {
    icon: Scan,
    title: 'Local SEO',
    desc: 'Help customers find you through Google with strong SEO foundations and an optimized online presence.',
    tags: ['SEO', 'Google', 'Visibility'],
  },
  {
    icon: Chart,
    title: 'Brand & Insights',
    desc: 'Elevate your image with polished design and clear reporting that shows what is working and where to grow.',
    tags: ['Branding', 'Analytics', 'Reporting'],
  },
]

export default function Services() {
  return (
    <section id="services" className="relative scroll-mt-24 py-24">
      <div
        className="absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gold-400/[0.07] blur-[120px]"
        aria-hidden="true"
      />
      <div className="container-max relative">
        <SectionHeading
          eyebrow="What we do"
          title="Everything your business needs"
          accent="to grow online."
          subtitle="From premium websites to custom apps, portals, and automation — we design and build the entire experience, so your brand performs as premium as it looks."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const Icon = s.icon
            return (
              <article
                key={s.title}
                className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                  s.featured
                    ? 'border-gold-400/40 bg-gradient-to-b from-gold-400/[0.08] to-transparent shadow-gold'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-gold-400/30'
                }`}
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-400/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.07] text-gold-300">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="relative mt-5 font-display text-xl font-semibold text-gray-50">
                  {s.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-gray-400">
                  {s.desc}
                </p>
                <div className="relative mt-5 flex flex-wrap gap-2">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-gray-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
