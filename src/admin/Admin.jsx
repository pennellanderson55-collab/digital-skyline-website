import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Check, Arrow, Sparkle } from '../components/Icons.jsx'

const STATUSES = [
  'New', 'Contacted', 'Consultation Scheduled',
  'Proposal Sent', 'Closed Won', 'Closed Lost',
]

const STATUS_STYLES = {
  'New': 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  'Contacted': 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  'Consultation Scheduled': 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  'Proposal Sent': 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
  'Closed Won': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  'Closed Lost': 'border-rose-400/40 bg-rose-400/10 text-rose-200',
}

const LEAD_SOURCES = ['Google', 'Instagram', 'Referral', 'Networking Event', 'Returning Client', 'Other']
const BUDGET_RANGES = ['Under $1,000', '$1,000–$2,500', '$2,500–$5,000', '$5,000+', 'Not Sure Yet']

// Best-effort industry classification from the free-text "business" field.
const INDUSTRY_RULES = [
  ['Plumbers', /\bplumb/i],
  ['Salons & Spas', /salon|barber|\bhair\b|beauty|\bspa\b|\bnail/i],
  ['Contractors', /contract|construction|remodel|roofing|hvac|electric|builder|landscap|paint/i],
  ['Realtors', /real estate|realtor|realty|\bproperty\b|mortgage|broker/i],
  ['Restaurants & Food', /restaurant|cafe|coffee|catering|bakery|\bgrill\b|\bfood\b|\bbar\b/i],
  ['Fitness', /\bgym\b|fitness|yoga|pilates|crossfit|personal train/i],
  ['Automotive', /\bauto\b|detailing|mechanic|\btire\b|body shop|car wash/i],
  ['Legal', /\blaw\b|legal|attorney|lawyer|firm/i],
  ['Health & Medical', /dental|dentist|clinic|medical|chiro|therapy|wellness|\bvet\b/i],
  ['Cleaning', /clean|janitor|maid|pressure wash/i],
]

const classifyIndustry = (business) => {
  const b = business || ''
  for (const [label, rx] of INDUSTRY_RULES) if (rx.test(b)) return label
  return 'Other / Uncategorized'
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function Admin() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return (
      <Shell>
        <p className="text-center text-rose-300">
          Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.
        </p>
      </Shell>
    )
  }

  if (!authReady) return <Shell><p className="text-center text-gray-500">Loading…</p></Shell>
  if (!session) return <Login />
  return <Dashboard session={session} />
}

/* ------------------------------------------------------------------ shell */

function Shell({ children }) {
  return (
    <div className="admin-scope relative min-h-screen bg-ink-950 text-gray-200">
      {/* Static premium glow — a plain radial gradient (no blur filter) so it
          costs nothing to composite, unlike a large blur-[130px] element. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(212,175,55,0.06), transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="container-max relative py-10">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ login */

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const onLogin = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr(error.message)
    setLoading(false)
  }

  return (
    <Shell>
      <div className="mx-auto mt-10 max-w-md">
        <div className="mb-6 text-center">
          <div className="eyebrow mx-auto"><Sparkle className="h-3.5 w-3.5" /> Internal</div>
          <h1 className="mt-4 font-display text-3xl font-bold text-gray-50">
            Digital Skyline <span className="text-gold-gradient">Admin</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to manage consultations.</p>
        </div>

        <form onSubmit={onLogin} className="card-surface space-y-4 p-7 shadow-card">
          <AdminField label="Email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@digitalskyline.co" />
          <AdminField label="Password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full text-sm disabled:opacity-60">
            {loading ? 'Signing in…' : (<>Sign In <Arrow className="h-4 w-4" /></>)}
          </button>
        </form>
        <p className="mt-4 text-center font-mono text-[11px] text-gray-600">
          Authorized access only.
        </p>
      </div>
    </Shell>
  )
}

/* -------------------------------------------------------------- dashboard */

const TABS = ['Home', 'Consultations', 'Pipeline', 'Analytics']

function Dashboard({ session }) {
  const [tab, setTab] = useState('Home')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null) // row open in detail modal

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateRow = async (id, patch) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setActive((a) => (a && a.id === id ? { ...a, ...patch } : a))
    const { error } = await supabase.from('consultations').update(patch).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  return (
    <Shell>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-50">
            Digital Skyline <span className="text-gold-gradient">Admin</span>
          </h1>
          <p className="text-xs text-gray-500">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost text-xs">Refresh</button>
          <button onClick={() => supabase.auth.signOut()} className="btn-ghost text-xs">Sign out</button>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
              tab === t
                ? 'border-gold-400/60 bg-gold-400/10 text-gold-100'
                : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-gold-400/40'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <div className="mt-8">
        {loading ? (
          <p className="text-gray-500">Loading consultations…</p>
        ) : (
          <>
            {tab === 'Home' && <Home rows={rows} />}
            {tab === 'Consultations' && (
              <Consultations rows={rows} onOpen={setActive} onStatus={updateRow} />
            )}
            {tab === 'Pipeline' && <Pipeline rows={rows} onStatus={updateRow} onOpen={setActive} />}
            {tab === 'Analytics' && <Analytics rows={rows} />}
          </>
        )}
      </div>

      {active && (
        <DetailModal
          row={active}
          onClose={() => setActive(null)}
          onStatus={(s) => updateRow(active.id, { status: s })}
          onSaveNotes={(n) => updateRow(active.id, { admin_notes: n })}
        />
      )}
    </Shell>
  )
}

/* ------------------------------------------------------------------- home */

function Home({ rows }) {
  // Recomputes only when `rows` changes — not on every parent re-render.
  const stats = useMemo(() => {
    const now = new Date()
    const count = (s) => rows.filter((r) => r.status === s).length
    const thisMonth = rows.filter((r) => {
      if (!r.created_at) return false
      const d = new Date(r.created_at)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length

    return [
      { label: 'Total consultations', value: rows.length },
      { label: 'New leads', value: count('New') },
      { label: 'Contacted leads', value: count('Contacted') },
      { label: 'Closed Won', value: count('Closed Won') },
      { label: 'Closed Lost', value: count('Closed Lost') },
      { label: 'This month', value: thisMonth },
    ]
  }, [rows])

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="card-surface p-6 shadow-card">
          <div className="font-display text-4xl font-bold text-gold-gradient">{s.value}</div>
          <div className="mt-2 text-sm text-gray-400">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- consultations */

function Consultations({ rows, onOpen, onStatus }) {
  if (rows.length === 0) return <Empty />
  return (
    <div className="card-surface overflow-x-auto p-2 shadow-card">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
            <Th>Name</Th><Th>Business</Th><Th>Date</Th><Th>Time</Th>
            <Th>Budget</Th><Th>Lead Source</Th><Th>Status</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/[0.06] text-gray-300">
              <Td className="font-medium text-gray-100">{r.name}</Td>
              <Td>{r.business}</Td>
              <Td>{fmtDate(r.date)}</Td>
              <Td>{r.time}</Td>
              <Td>{r.budget}</Td>
              <Td>{r.heard_about}{r.heard_about === 'Other' && r.heard_about_other ? ` — ${r.heard_about_other}` : ''}</Td>
              <Td>
                <StatusSelect value={r.status} onChange={(s) => onStatus(r.id, { status: s })} />
              </Td>
              <Td>
                <button onClick={() => onOpen(r)} className="btn-ghost px-3 py-1.5 text-xs">
                  View
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Th = ({ children }) => <th className="px-3 py-3">{children}</th>
const Td = ({ children, className = '' }) => <td className={`px-3 py-3 align-middle ${className}`}>{children}</td>

function StatusSelect({ value, onChange }) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-lg border px-3 py-1.5 pr-7 text-xs font-medium focus:outline-none ${STATUS_STYLES[value] || 'border-white/10 text-gray-200'}`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-ink-900 text-gray-100">{s}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70">
        <Arrow className="h-3 w-3 rotate-90" />
      </span>
    </div>
  )
}

/* --------------------------------------------------------------- pipeline */

function Pipeline({ rows, onStatus, onOpen }) {
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)

  const drop = (status) => {
    if (dragId) onStatus(dragId, { status })
    setDragId(null)
    setOver(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUSES.map((status) => {
        const cards = rows.filter((r) => r.status === status)
        return (
          <div
            key={status}
            onDragOver={(e) => { e.preventDefault(); setOver(status) }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={() => drop(status)}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition-colors ${
              over === status ? 'border-gold-400/60 bg-gold-400/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
                {status}
              </span>
              <span className="font-mono text-xs text-gray-500">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragEnd={() => { setDragId(null); setOver(null) }}
                  onClick={() => onOpen(r)}
                  className="cursor-grab rounded-xl border border-white/10 bg-ink-950/60 p-3 transition-colors hover:border-gold-400/40 active:cursor-grabbing"
                >
                  <div className="font-display text-sm font-semibold text-gray-100">{r.name}</div>
                  <div className="truncate text-xs text-gray-400">{r.business}</div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-gray-500">
                    <span>{fmtDate(r.date)}</span>
                    <span>{r.budget}</span>
                  </div>
                </div>
              ))}
              {cards.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-gray-600">
                  Drop here
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------- analytics */

function Analytics({ rows }) {
  // All three tallies recompute only when `rows` changes.
  const { sources, budgets, industries } = useMemo(() => {
    const tally = (keyFn, keys) => {
      const map = {}
      keys.forEach((k) => { map[k] = 0 })
      rows.forEach((r) => {
        const k = keyFn(r)
        if (k == null) return
        map[k] = (map[k] || 0) + 1
      })
      return Object.entries(map)
    }
    return {
      sources: tally((r) => r.heard_about, LEAD_SOURCES),
      budgets: tally((r) => r.budget, BUDGET_RANGES),
      industries: tally((r) => classifyIndustry(r.business), []).sort((a, b) => b[1] - a[1]),
    }
  }, [rows])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BarCard title="Lead Sources" data={sources} total={rows.length} />
      <BarCard title="Budget Ranges" data={budgets} total={rows.length} />
      <BarCard
        title="Industries"
        data={industries}
        total={rows.length}
        note="Inferred from each client's business description — review for accuracy."
      />
    </div>
  )
}

function BarCard({ title, data, total, note }) {
  const max = Math.max(1, ...data.map(([, v]) => v))
  return (
    <div className="card-surface p-6 shadow-card">
      <h3 className="font-display text-lg font-semibold text-gray-50">{title}</h3>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
      <div className="mt-5 space-y-3">
        {data.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
        {data.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-gray-300">{label}</span>
              <span className="font-mono text-gray-500">
                {value}{total ? ` · ${Math.round((value / total) * 100)}%` : ''}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full bg-gold-gradient"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ detail modal */

function DetailModal({ row, onClose, onStatus, onSaveNotes }) {
  const [notes, setNotes] = useState(row.admin_notes || '')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setNotes(row.admin_notes || ''); setSaved(false) }, [row.id, row.admin_notes])

  const save = () => { onSaveNotes(notes); setSaved(true) }

  const answers = [
    ['Business & services', row.business],
    ['What they need help with', row.project_type],
    ['Biggest challenge', row.challenge === 'Other' ? `Other — ${row.challenge_other || ''}` : row.challenge],
    ['Success outcome (6–12 mo)', row.success_outcome],
    ['Current systems', (row.current_systems || []).join(', ') || '—'],
    ['Budget', row.budget],
    ['Heard about us', row.heard_about === 'Other' ? `Other — ${row.heard_about_other || ''}` : row.heard_about],
    ['Client notes', row.notes || '—'],
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="card-surface relative my-8 w-full max-w-2xl p-7 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-gray-500 transition-colors hover:text-gray-200"
          aria-label="Close"
        >
          ✕
        </button>

        <h3 className="font-display text-2xl font-bold text-gray-50">{row.name}</h3>
        <p className="mt-1 text-sm text-gray-400">
          {row.email}{row.phone ? ` · ${row.phone}` : ''}
        </p>
        <p className="mt-1 font-mono text-xs text-gold-200">
          {fmtDate(row.date)} · {row.time}
        </p>

        <div className="mt-5">
          <span className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gray-500">Status</span>
          <StatusSelect value={row.status} onChange={onStatus} />
        </div>

        <div className="mt-6 space-y-4 border-t border-white/[0.08] pt-6">
          {answers.map(([label, val]) => (
            <div key={label}>
              <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-gray-200">{val || '—'}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-white/[0.08] pt-6">
          <label className="mb-2 block font-display text-sm text-gray-300">Internal notes</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
            placeholder="Private notes about this lead (not visible to the client)…"
            className="w-full resize-y rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={save} className="btn-gold text-sm">
              {saved ? (<>Saved <Check className="h-4 w-4" /></>) : 'Save notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- helpers */

function AdminField({ label, type = 'text', ...props }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">{label}</label>
      <input
        type={type}
        {...props}
        className="w-full rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-gold-400/60 focus:outline-none"
      />
    </div>
  )
}

function Empty() {
  return (
    <div className="card-surface p-10 text-center text-gray-500 shadow-card">
      No consultations yet. They'll appear here as soon as someone books.
    </div>
  )
}
