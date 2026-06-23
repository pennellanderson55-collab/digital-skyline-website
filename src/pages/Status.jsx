import { Link } from 'react-router-dom'
import CustomCursor from '../components/CustomCursor.jsx'

const SERVICES = [
  { name: 'Website', status: 'Operational' },
  { name: 'Consultation Form', status: 'Operational' },
  { name: 'Email', status: 'Operational' },
  { name: 'Project Intake', status: 'Operational' },
]

function StatusDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
    </span>
  )
}

export default function Status() {
  return (
    <div className="min-h-screen bg-ink-950 text-gray-200 font-sans">
      <CustomCursor />
      {/* Header bar */}
      <div className="border-b border-white/[0.06] bg-ink-900/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-max flex items-center justify-between h-16">
          <Link to="/" className="font-display text-sm font-semibold text-gold-300 tracking-wider uppercase hover:text-gold-200 transition-colors">
            ← Digital Skyline Co.
          </Link>
          <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">System Status</span>
        </div>
      </div>

      <div className="container-max py-20 max-w-2xl">
        {/* Page title */}
        <div className="mb-14">
          <p className="font-mono text-xs text-gold-400 uppercase tracking-widest mb-4">Operations</p>
          <h1 className="font-display text-4xl font-bold text-white mb-4">System Status</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Current availability for Digital Skyline Co. services.
          </p>
          <div className="mt-6 h-px bg-gradient-to-r from-gold-600/60 via-gold-400/30 to-transparent" />
        </div>

        {/* Overall status banner */}
        <div className="mb-8 flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-5">
          <StatusDot />
          <div>
            <p className="font-display text-base font-semibold text-emerald-400">All Systems Operational</p>
            <p className="text-xs text-gray-500 mt-0.5">No incidents reported.</p>
          </div>
        </div>

        {/* Individual service rows */}
        <div className="rounded-xl border border-white/[0.06] bg-ink-800/40 overflow-hidden">
          {SERVICES.map((s, i) => (
            <div
              key={s.name}
              className={`flex items-center justify-between px-6 py-4 ${
                i < SERVICES.length - 1 ? 'border-b border-white/[0.05]' : ''
              }`}
            >
              <span className="text-sm text-gray-300 font-medium">{s.name}</span>
              <div className="flex items-center gap-2.5">
                <StatusDot />
                <span className="text-xs font-mono text-emerald-400">{s.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="mt-8 rounded-lg border border-gold-700/20 bg-gold-400/5 px-6 py-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            For urgent issues, contact{' '}
            <a
              href="mailto:hello@digitalskylineco.com"
              className="text-gold-300 hover:text-gold-200 transition-colors"
            >
              hello@digitalskylineco.com
            </a>
            .
          </p>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-xs text-gray-600 leading-relaxed">
          This page is for informational purposes and does not replace legal advice. Status indicators reflect general availability and are updated manually.
        </p>
      </div>
    </div>
  )
}
