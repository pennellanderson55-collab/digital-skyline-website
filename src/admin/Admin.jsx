import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Check, Arrow, Sparkle } from '../components/Icons.jsx'
import Clients from './Clients.jsx'
import Projects from './Projects.jsx'
import Support, { SupportModal } from './Support.jsx'
import ProjectProfile from './ProjectProfile.jsx'
import { INITIAL_PROJECT_STAGE, balanceDue, fmtMoney, fmtDateTime } from './ops.js'

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

const TABS = ['Home', 'Consultations', 'Pipeline', 'Clients', 'Projects', 'Support', 'Analytics']

function Dashboard({ session }) {
  const [tab, setTab] = useState('Home')
  const [rows, setRows] = useState([])          // consultations / leads
  const [projects, setProjects] = useState([])  // projects + embedded client
  const [support, setSupport] = useState([])    // support requests
  const [history, setHistory] = useState([])    // project stage history
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)            // consultation detail modal
  const [activeProject, setActiveProject] = useState(null) // open client/project profile
  const [activeSupport, setActiveSupport] = useState(null) // support detail modal

  // Derive the client list from the projects join (clients 1──1 project for now).
  const clients = useMemo(() => {
    const map = new Map()
    projects.forEach((p) => { if (p.client) map.set(p.client.id, p.client) })
    return [...map.values()]
  }, [projects])

  const load = async () => {
    setLoading(true)
    // Consultations are required (existing system). The Phase-2 tables are
    // loaded best-effort so the dashboard still works before ops.sql is run.
    const cons = await supabase.from('consultations').select('*').order('created_at', { ascending: false })
    if (cons.error) setError(cons.error.message)
    else setRows(cons.data || [])

    const proj = await supabase.from('projects').select('*, client:clients(*)').order('created_at', { ascending: false })
    if (!proj.error) setProjects(proj.data || [])

    const sup = await supabase.from('support_requests').select('*').order('created_at', { ascending: false })
    if (!sup.error) setSupport(sup.data || [])

    const hist = await supabase.from('project_stage_history').select('*').order('changed_at', { ascending: false })
    if (!hist.error) setHistory(hist.data || [])

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateRow = async (id, patch) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setActive((a) => (a && a.id === id ? { ...a, ...patch } : a))
    const { error } = await supabase.from('consultations').update(patch).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  const updateProject = async (id, patch) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    setActiveProject((a) => (a && a.id === id ? { ...a, ...patch } : a))
    const { error } = await supabase.from('projects').update(patch).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  const updateClient = async (clientId, patch) => {
    setProjects((ps) => ps.map((p) => (p.client_id === clientId ? { ...p, client: { ...p.client, ...patch } } : p)))
    setActiveProject((a) => (a && a.client_id === clientId ? { ...a, client: { ...a.client, ...patch } } : a))
    const { error } = await supabase.from('clients').update(patch).eq('id', clientId)
    if (error) { setError(error.message); load() }
  }

  const changeStage = async (project, stage) => {
    if (project.stage === stage) return
    await updateProject(project.id, { stage })
    const { data } = await supabase
      .from('project_stage_history')
      .insert({ project_id: project.id, project_reference: project.project_reference, stage })
      .select().single()
    if (data) setHistory((h) => [data, ...h])
  }

  const updateSupport = async (id, patch) => {
    setSupport((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setActiveSupport((a) => (a && a.id === id ? { ...a, ...patch } : a))
    const { error } = await supabase.from('support_requests').update(patch).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  // Section 1 — Convert a consultation into a Client + Project with a unique
  // Project Reference (DS-YYYY-NNN). Returns the new reference.
  const convertToClient = async (c) => {
    const { data: ref, error: refErr } = await supabase.rpc('next_project_reference')
    if (refErr || !ref) throw new Error(refErr?.message || 'Could not generate a project reference.')

    const { data: client, error: cErr } = await supabase.from('clients').insert({
      consultation_id: c.id,
      company_name: c.business || c.name,
      contact_name: c.name,
      email: c.email,
      phone: c.phone || null,
      industry: classifyIndustry(c.business),
    }).select().single()
    if (cErr) throw new Error(cErr.message)

    const { data: project, error: pErr } = await supabase.from('projects').insert({
      project_reference: ref,
      client_id: client.id,
      project_type: c.project_type || null,
      stage: INITIAL_PROJECT_STAGE,
    }).select('*, client:clients(*)').single()
    if (pErr) throw new Error(pErr.message)

    await supabase.from('project_stage_history').insert({
      project_id: project.id, project_reference: ref, stage: INITIAL_PROJECT_STAGE, note: 'Converted from consultation',
    })
    await supabase.from('consultations')
      .update({ converted: true, client_id: client.id, project_reference: ref, status: 'Closed Won' })
      .eq('id', c.id)

    // Reflect locally without a full reload jank.
    setProjects((ps) => [project, ...ps])
    setRows((rs) => rs.map((r) => (r.id === c.id
      ? { ...r, converted: true, client_id: client.id, project_reference: ref, status: 'Closed Won' } : r)))
    return ref
  }

  const openTab = (t) => { setTab(t); setActiveProject(null) }

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
            onClick={() => openTab(t)}
            className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
              tab === t && !activeProject
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
          <p className="text-gray-500">Loading…</p>
        ) : activeProject ? (
          <ProjectProfile
            project={activeProject}
            history={history.filter((h) => h.project_id === activeProject.id)}
            onClose={() => setActiveProject(null)}
            onSaveProject={(patch) => updateProject(activeProject.id, patch)}
            onSaveClient={(patch) => updateClient(activeProject.client_id, patch)}
            onStageChange={(stage) => changeStage(activeProject, stage)}
          />
        ) : (
          <>
            {tab === 'Home' && <Home consultations={rows} clients={clients} projects={projects} support={support} history={history} />}
            {tab === 'Consultations' && (
              <Consultations rows={rows} onOpen={setActive} onStatus={updateRow} />
            )}
            {tab === 'Pipeline' && <Pipeline rows={rows} onStatus={updateRow} onOpen={setActive} />}
            {tab === 'Clients' && <Clients projects={projects} onOpen={setActiveProject} />}
            {tab === 'Projects' && <Projects projects={projects} onOpen={setActiveProject} onStageChange={changeStage} />}
            {tab === 'Support' && <Support rows={support} onStatus={updateSupport} onOpen={setActiveSupport} />}
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
          onConvert={() => convertToClient(active)}
          onConverted={() => { setActive(null); setTab('Clients') }}
        />
      )}

      {activeSupport && (
        <SupportModal
          row={activeSupport}
          onClose={() => setActiveSupport(null)}
          onStatus={(s) => updateSupport(activeSupport.id, { status: s })}
          onSaveNotes={(n) => updateSupport(activeSupport.id, { admin_notes: n })}
        />
      )}
    </Shell>
  )
}

/* ------------------------------------------------------------------- home */

function Home({ consultations, clients, projects, support, history }) {
  const { kpis, activity } = useMemo(() => {
    const now = new Date()
    const sameMonth = (d) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()

    const activeLeads = consultations.filter(
      (r) => !r.converted && r.status !== 'Closed Won' && r.status !== 'Closed Lost'
    ).length
    const inProgress = projects.filter((p) => p.stage !== 'Completed' && p.stage !== 'Lead').length
    const launching = projects.filter((p) => p.launch_date && sameMonth(new Date(p.launch_date))).length
    const openTickets = support.filter((s) => s.status !== 'Resolved' && s.status !== 'Closed').length
    const revenue = projects.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
    const outstanding = projects.reduce((sum, p) => sum + balanceDue(p), 0)

    const kpis = [
      { label: 'Active Leads', value: activeLeads },
      { label: 'Active Clients', value: clients.length },
      { label: 'Projects In Progress', value: inProgress },
      { label: 'Launching This Month', value: launching },
      { label: 'Open Support Tickets', value: openTickets },
      { label: 'Revenue Closed', value: fmtMoney(revenue) },
      { label: 'Outstanding Balance', value: fmtMoney(outstanding) },
    ]

    // Recent activity feed — merge events across the system, newest first.
    const events = []
    consultations.forEach((r) => events.push({ at: r.created_at, kind: 'Consultation', label: `New consultation — ${r.name}` }))
    clients.forEach((c) => events.push({ at: c.created_at, kind: 'Client', label: `New client — ${c.company_name || c.contact_name}` }))
    support.forEach((s) => events.push({ at: s.created_at, kind: 'Support', label: `Support request — ${s.client_name || s.email}` }))
    history.forEach((h) => events.push({ at: h.changed_at, kind: 'Project', label: `${h.project_reference} → ${h.stage}` }))
    const activity = events
      .filter((e) => e.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 10)

    return { kpis, activity }
  }, [consultations, clients, projects, support, history])

  const KIND_STYLES = {
    Consultation: 'text-sky-200',
    Client: 'text-emerald-200',
    Support: 'text-amber-200',
    Project: 'text-violet-200',
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((s) => (
          <div key={s.label} className="card-surface p-6 shadow-card">
            <div className="font-display text-3xl font-bold text-gold-gradient">{s.value}</div>
            <div className="mt-2 text-sm text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card-surface p-6 shadow-card">
        <h3 className="font-display text-lg font-semibold text-gray-50">Recent Activity</h3>
        {activity.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No activity yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {activity.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${KIND_STYLES[e.kind] || 'text-gray-400'}`}>
                    {e.kind}
                  </span>
                  <span className="text-sm text-gray-200">{e.label}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-gray-500">{fmtDateTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
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

function DetailModal({ row, onClose, onStatus, onSaveNotes, onConvert, onConverted }) {
  const [notes, setNotes] = useState(row.admin_notes || '')
  const [saved, setSaved] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convError, setConvError] = useState('')
  const [newRef, setNewRef] = useState(row.project_reference || null)

  useEffect(() => {
    setNotes(row.admin_notes || ''); setSaved(false)
    setNewRef(row.project_reference || null); setConvError('')
  }, [row.id, row.admin_notes, row.project_reference])

  const save = () => { onSaveNotes(notes); setSaved(true) }

  const convert = async () => {
    setConverting(true); setConvError('')
    try {
      const ref = await onConvert()
      setNewRef(ref)
    } catch (e) {
      setConvError(e.message || 'Conversion failed. Make sure ops.sql has been run in Supabase.')
    } finally {
      setConverting(false)
    }
  }

  const converted = row.converted || Boolean(newRef)

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

        {/* Section 1 — Convert To Client */}
        <div className="mt-5 rounded-xl border border-gold-400/20 bg-gold-400/[0.04] p-4">
          {converted ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Converted to client</div>
                <div className="mt-1 font-mono text-sm text-gold-200">{newRef || row.project_reference}</div>
              </div>
              {onConverted && (
                <button onClick={onConverted} className="btn-ghost text-xs">View in Clients</button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-300">
                Create a client + project record and generate a Project Reference.
              </p>
              <button onClick={convert} disabled={converting} className="btn-gold text-sm disabled:opacity-60">
                {converting ? 'Converting…' : (<>Convert To Client <Arrow className="h-4 w-4" /></>)}
              </button>
            </div>
          )}
          {convError && <p className="mt-2 text-xs text-rose-400">{convError}</p>}
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
