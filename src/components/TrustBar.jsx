import { Code, Cube, Chart, Shield } from './Icons.jsx'

// What we build — no fake logos or statistics, just our core capabilities.
const CAPABILITIES = [
  { label: 'Custom Websites', Icon: Code },
  { label: 'Applications', Icon: Cube },
  { label: 'Dashboards', Icon: Chart },
  { label: 'Business Systems', Icon: Shield },
]

export default function TrustBar() {
  return (
    <section className="relative border-y border-white/[0.06] bg-ink-900/40 py-10">
      <div className="container-max">
        <p className="text-center font-mono text-xs uppercase tracking-[0.25em] text-gray-500">
          What we build for businesses of every size
        </p>

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] sm:grid-cols-4">
          {CAPABILITIES.map(({ label, Icon }) => (
            <div
              key={label}
              className="group flex items-center justify-center gap-3 bg-ink-950/40 px-5 py-6 transition-colors hover:bg-gold-400/[0.04]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-400/25 bg-gold-400/[0.06] text-gold-300 transition-colors group-hover:border-gold-400/50">
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-display text-base font-medium text-gray-100">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
