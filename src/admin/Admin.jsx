import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Check, Arrow, Sparkle, Activity, Chart, User, Shield, Cube, Bolt, Scan, Cog, Menu, Close } from '../components/Icons.jsx'
import Clients from './Clients.jsx'
import Projects from './Projects.jsx'
import Support, { SupportModal } from './Support.jsx'
import ProjectProfile from './ProjectProfile.jsx'
import Settings from './Settings.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { INITIAL_PROJECT_STAGE, balanceDue, fmtMoney, fmtDateTime } from './ops.js'
import { sendEmail } from '../lib/email.js'
import { findProspectDuplicates, prospectFromConsultation } from './sales/prospects.js'
import DuplicateWarning from './sales/DuplicateWarning.jsx'
import SalesDashboard from './sales/SalesDashboard.jsx'
import Prospects from './sales/Prospects.jsx'
import SalesPipeline from './sales/SalesPipeline.jsx'
import FollowUps from './sales/FollowUps.jsx'
import SalesAnalytics from './sales/SalesAnalytics.jsx'
import SendingQueue from './sales/SendingQueue.jsx'
import ProspectPanel from './sales/ProspectPanel.jsx'

// Admin navigation — grouped sidebar. Operations = the existing modules;
// Sales = the new Outreach CRM (expandable). Keys are unique across groups.
const OPS_NAV = [
  { key: 'Home', label: 'Home', icon: Activity },
  { key: 'Consultations', label: 'Consultations', icon: User },
  { key: 'Pipeline', label: 'Pipeline', icon: Chart },
  { key: 'Clients', label: 'Clients', icon: Shield },
  { key: 'Projects', label: 'Projects', icon: Cube },
  { key: 'Support', label: 'Support', icon: Bolt },
  { key: 'Analytics', label: 'Analytics', icon: Chart },
  { key: 'Settings', label: 'Settings', icon: Cog },
]
const SALES_NAV = [
  { key: 'sales:dashboard', label: 'Dashboard', icon: Activity },
  { key: 'sales:prospects', label: 'Prospects', icon: Scan },
  { key: 'sales:queue', label: 'Sending Queue', icon: Bolt },
  { key: 'sales:pipeline', label: 'Pipeline', icon: Chart },
  { key: 'sales:followups', label: 'Follow-ups', icon: Bolt },
  { key: 'sales:analytics', label: 'Analytics', icon: Chart },
]

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

// Select active (non-soft-deleted) rows, newest first. Falls back to an
// unfiltered query if the `deleted_at` column doesn't exist yet (before the
// sprint6 migration is run) so the dashboard never breaks.
async function selectActive(table, select) {
  const build = (withFilter) => {
    let q = supabase.from(table).select(select)
    if (withFilter) q = q.is('deleted_at', null)
    return q.order('created_at', { ascending: false })
  }
  let res = await build(true)
  if (res.error && /deleted_at|column .* does not exist/i.test(res.error.message)) res = await build(false)
  return res
}

// True when an error is caused by the soft-delete columns not existing yet.
const isMissingSoftDelete = (msg = '') => /deleted_at|source_consultation_id|column .* does not exist/i.test(msg)
const softDeleteHint = (msg = '') =>
  isMissingSoftDelete(msg)
    ? 'This needs the soft-delete columns. Run supabase/sprint6_admin_soft_delete.sql in Supabase, then Refresh.'
    : msg

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

function Dashboard({ session }) {
  const [nav, setNav] = useState('Home')
  const [rows, setRows] = useState([])          // consultations / leads
  const [projects, setProjects] = useState([])  // projects + embedded client
  const [support, setSupport] = useState([])    // support requests
  const [history, setHistory] = useState([])    // project stage history
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)            // consultation detail modal
  const [activeProject, setActiveProject] = useState(null) // open client/project profile
  const [activeSupport, setActiveSupport] = useState(null) // support detail modal

  // Sales / Outreach CRM — loaded lazily the first time a Sales view is opened
  // (one query for the whole module; no extra load for visitors who never
  // touch Sales). Best-effort so the dashboard still works before the
  // sprint1_prospects.sql migration has been run.
  const [prospects, setProspects] = useState([])
  const [prospectsLoaded, setProspectsLoaded] = useState(false)
  const [prospectsLoading, setProspectsLoading] = useState(false)
  const [prospectsError, setProspectsError] = useState('')
  const [activeProspect, setActiveProspect] = useState(null) // panel opened from dashboard/pipeline/follow-ups

  // Dashboard funnel — real Emails Sent / Replies counts from outreach_drafts
  // (sent_at / replied_at). Count-only queries (head:true) so egress stays tiny.
  const [outreachCounts, setOutreachCounts] = useState({ sent: null, replies: null })

  // Operations delete confirmation + Move-to-Sales duplicate warning + notice.
  const [pendingDelete, setPendingDelete] = useState(null) // { title, description, details, note, confirmLabel, onConfirm }
  const [pendingMove, setPendingMove] = useState(null)      // { consultation, matches }
  const [opsNotice, setOpsNotice] = useState('')

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
    // `.is('deleted_at', null)` hides soft-deleted rows, but falls back cleanly
    // if the sprint6 migration hasn't been run yet (column doesn't exist).
    const cons = await selectActive('consultations', '*')
    if (cons.error) setError(cons.error.message)
    else setRows(cons.data || [])

    const proj = await selectActive('projects', '*, client:clients(*)')
    if (!proj.error) setProjects(proj.data || [])

    const sup = await supabase.from('support_requests').select('*').order('created_at', { ascending: false })
    if (!sup.error) setSupport(sup.data || [])

    const hist = await supabase.from('project_stage_history').select('*').order('changed_at', { ascending: false })
    if (!hist.error) setHistory(hist.data || [])

    setLoading(false)
  }

  // Load the funnel email counts (best-effort — 0 if the table isn't migrated).
  const loadOutreachCounts = async () => {
    if (!supabase) return
    const [sent, rep] = await Promise.all([
      supabase.from('outreach_drafts').select('id', { count: 'exact', head: true }).not('sent_at', 'is', null),
      supabase.from('outreach_drafts').select('id', { count: 'exact', head: true }).not('replied_at', 'is', null),
    ])
    setOutreachCounts({
      sent: sent.error ? null : (sent.count ?? 0),
      replies: rep.error ? null : (rep.count ?? 0),
    })
  }

  // Eager-load consultations/projects AND the sales prospects + funnel counts so
  // the dashboard stat row is populated on Home (prospects also feed Sales views).
  useEffect(() => { load(); loadProspects(); loadOutreachCounts() }, [])

  // ── Sales / Outreach CRM data ──────────────────────────────────────────
  const loadProspects = async () => {
    setProspectsLoading(true)
    setProspectsError('')
    // Ordered + bounded so the query stays cheap and is pagination-ready
    // (the Prospects table paginates client-side over this set for now).
    // Soft-deleted prospects are hidden, with a fallback if sprint6 isn't run.
    const buildProspects = (withFilter) => {
      let q = supabase.from('prospects').select('*')
      if (withFilter) q = q.is('deleted_at', null)
      return q.order('created_at', { ascending: false }).limit(1000)
    }
    let res = await buildProspects(true)
    if (res.error && isMissingSoftDelete(res.error.message)) res = await buildProspects(false)
    if (res.error) {
      setProspectsError(
        /relation .* does not exist/i.test(res.error.message)
          ? 'Prospects table not found — run supabase/sprint1_prospects.sql in Supabase, then Refresh.'
          : res.error.message,
      )
    } else {
      setProspects(res.data || [])
    }
    setProspectsLoaded(true)
    setProspectsLoading(false)
  }

  // Lazy-load the first time any Sales view — or Settings (needs the prospect
  // list for the testing-cleanup section) — is opened.
  useEffect(() => {
    if ((nav.startsWith('sales:') || nav === 'Settings') && !prospectsLoaded && !prospectsLoading) loadProspects()
  }, [nav, prospectsLoaded, prospectsLoading])

  // Make DB rejections actionable instead of a silent revert. The most common
  // cause after Sprint 4.1 is the pipeline migration not being applied yet:
  // new status values / pipeline columns are rejected by the old schema.
  const friendlyProspectError = (msg = '') => {
    if (/check constraint .*status|violates check constraint .*status/i.test(msg))
      return 'That status was rejected by the database. Run supabase/sprint4_pipeline.sql in Supabase to enable the new pipeline statuses, then Refresh.'
    if (/source_consultation_id|deleted_at/i.test(msg))
      return 'This needs the sprint6 columns. Run supabase/sprint6_admin_soft_delete.sql in Supabase, then Refresh.'
    if (/column .* does not exist/i.test(msg))
      return 'A pipeline column is missing. Run supabase/sprint4_pipeline.sql in Supabase, then Refresh.'
    if (/violates check constraint/i.test(msg))
      return `${msg} — if this is a new pipeline field, run supabase/sprint4_pipeline.sql, then Refresh.`
    return msg
  }

  const addProspect = async (patch) => {
    const { data, error: e } = await supabase.from('prospects').insert(patch).select().single()
    if (e) { setProspectsError(friendlyProspectError(e.message)); return }
    setProspects((ps) => [data, ...ps])
  }

  const updateProspect = async (id, patch) => {
    // Optimistic — reflect immediately, reconcile/revert on error.
    setProspects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    const { data, error: e } = await supabase.from('prospects').update(patch).eq('id', id).select().single()
    if (e) { setProspectsError(friendlyProspectError(e.message)); loadProspects(); return }
    if (data) setProspects((ps) => ps.map((p) => (p.id === id ? data : p)))
  }

  // Soft delete — sets deleted_at (recoverable in the DB), never a hard DELETE.
  const deleteProspect = async (id) => {
    const prev = prospects
    setProspects((ps) => ps.filter((p) => p.id !== id))
    setActiveProspect((a) => (a && a.id === id ? null : a))
    const { error: e } = await supabase.from('prospects').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (e) { setProspectsError(friendlyProspectError(e.message)); setProspects(prev) }
  }

  const updateRow = async (id, patch) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setActive((a) => (a && a.id === id ? { ...a, ...patch } : a))
    const { error } = await supabase.from('consultations').update(patch).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  // ── Soft delete: Consultation (Operations) ─────────────────────────────────
  const deleteConsultation = async (id) => {
    const prev = rows
    setRows((rs) => rs.filter((r) => r.id !== id))
    setActive((a) => (a && a.id === id ? null : a))
    const { error } = await supabase.from('consultations').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { setError(softDeleteHint(error.message)); setRows(prev) }
  }

  // ── Soft delete: Project + its Client (covers the Projects & Clients tabs) ──
  const deleteProjectAndClient = async (project) => {
    const prev = projects
    setProjects((ps) => ps.filter((p) => p.id !== project.id))
    setActiveProject((a) => (a && a.id === project.id ? null : a))
    const nowISO = new Date().toISOString()
    const { error: pErr } = await supabase.from('projects').update({ deleted_at: nowISO }).eq('id', project.id)
    let cErr = null
    if (project.client_id) {
      const r = await supabase.from('clients').update({ deleted_at: nowISO }).eq('id', project.client_id)
      cErr = r.error
    }
    if (pErr || cErr) { setError(softDeleteHint((pErr || cErr).message)); setProjects(prev) }
  }

  // ── Move to Sales: Consultation (Operations) → Prospect (Sales) ────────────
  const insertProspectFromConsultation = async (c) => {
    const today = new Date().toISOString().slice(0, 10)
    const patch = prospectFromConsultation(c, today)
    const { data, error: e } = await supabase.from('prospects').insert(patch).select().single()
    if (e) { setProspectsError(friendlyProspectError(e.message)); return null }
    setProspects((ps) => [data, ...ps])
    return data
  }

  const doMoveToSales = async (c) => {
    setPendingMove(null)
    const created = await insertProspectFromConsultation(c)
    if (created) setOpsNotice(`Moved “${c.business || c.name || 'this lead'}” into Sales as a prospect.`)
  }

  // Duplicate pre-check before moving — warns if a matching prospect exists.
  const requestMoveToSales = (c) => {
    setOpsNotice('')
    const candidate = prospectFromConsultation(c)
    const matches = findProspectDuplicates(candidate, prospects)
    if (matches.length) { setPendingMove({ consultation: c, matches }); return }
    doMoveToSales(c)
  }

  const requestDeleteConsultation = (c) => setPendingDelete({
    title: 'Delete this consultation?',
    description: 'It will be removed from your Consultations list. This is a soft delete — the record is retained in the database and can be restored.',
    details: [
      ['Contact', c.name],
      ['Business', c.business],
      ['Email', c.email],
      ['Phone', c.phone],
      ['Date', c.date ? fmtDate(c.date) : null],
    ],
    confirmLabel: 'Delete consultation',
    onConfirm: () => deleteConsultation(c.id),
  })

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

    // Welcome email + internal notification — fire-and-forget so the conversion
    // never blocks or fails on email.
    sendEmail('welcome', {
      email: c.email,
      contactName: c.name,
      companyName: c.business || c.name,
      phone: c.phone,
      projectType: c.project_type,
      budget: c.budget,
      projectReference: ref,
    }).then((ok) => {
      if (!ok) console.error('[welcome] email did not send (conversion still completed)')
    })

    // Reflect locally without a full reload jank.
    setProjects((ps) => [project, ...ps])
    setRows((rs) => rs.map((r) => (r.id === c.id
      ? { ...r, converted: true, client_id: client.id, project_reference: ref, status: 'Closed Won' } : r)))
    return ref
  }

  // Revert an accidental/test conversion: delete the generated client + project
  // (project delete cascades its stage history) and return the ORIGINAL
  // consultation to the leads workflow with all its data preserved.
  const revertToLead = async (project) => {
    const clientId = project.client_id
    const consultationId = project.client?.consultation_id

    if (consultationId) {
      const { error } = await supabase.from('consultations')
        .update({ converted: false, client_id: null, project_reference: null, status: 'New' })
        .eq('id', consultationId)
      if (error) throw new Error(error.message)
    }

    const { error: pErr } = await supabase.from('projects').delete().eq('id', project.id)
    if (pErr) throw new Error(pErr.message)

    if (clientId) {
      const { error: cErr } = await supabase.from('clients').delete().eq('id', clientId)
      if (cErr) throw new Error(cErr.message)
    }

    // Reflect locally.
    setProjects((ps) => ps.filter((p) => p.id !== project.id))
    setHistory((h) => h.filter((x) => x.project_id !== project.id))
    if (consultationId) {
      setRows((rs) => rs.map((r) => (r.id === consultationId
        ? { ...r, converted: false, client_id: null, project_reference: null, status: 'New' } : r)))
    }
    setActiveProject(null)
  }

  const [navOpenMobile, setNavOpenMobile] = useState(false)
  const openNav = (key) => { setNav(key); setActiveProject(null); setNavOpenMobile(false) }

  const isSales = nav.startsWith('sales:')
  const navLabel = [...OPS_NAV, ...SALES_NAV].find((n) => n.key === nav)?.label || 'Home'

  return (
    <Shell>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Burger — opens the mobile nav drawer (hidden on desktop). */}
          <button
            onClick={() => setNavOpenMobile(true)}
            aria-label="Open navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-gray-200 transition-colors hover:border-gold-400/40 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-50">
              Digital Skyline <span className="text-gold-gradient">OS</span>
            </h1>
            <p className="text-xs text-gray-500">{isSales ? `Sales · ${navLabel}` : navLabel} · {session.user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isSales ? loadProspects : load}
            className="btn-ghost text-xs"
          >
            Refresh
          </button>
          <button onClick={() => supabase.auth.signOut()} className="btn-ghost text-xs">Sign out</button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Mobile drawer backdrop */}
        {navOpenMobile && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setNavOpenMobile(false)} aria-hidden="true" />
        )}

        {/* sidebar — static column on desktop, slide-out drawer on mobile */}
        <aside
          className={`${
            navOpenMobile
              ? 'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-white/10 bg-ink-950 p-6 shadow-2xl animate-[drawerIn_0.24s_cubic-bezier(0.2,0.8,0.3,1)]'
              : 'hidden'
          } lg:static lg:z-auto lg:block lg:w-60 lg:shrink-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          <style>{`@keyframes drawerIn{from{transform:translateX(-16px);opacity:0}to{transform:none;opacity:1}}`}</style>
          {/* drawer header (mobile only) */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <span className="font-display text-sm font-semibold text-gray-100">Menu</span>
            <button onClick={() => setNavOpenMobile(false)} aria-label="Close navigation menu" className="text-gray-400 hover:text-gray-200">
              <Close className="h-5 w-5" />
            </button>
          </div>
          <nav className="lg:sticky lg:top-6 space-y-6">
            <NavGroup label="Operations">
              {OPS_NAV.map((item) => (
                <NavItem key={item.key} item={item} active={nav === item.key && !activeProject} onClick={() => openNav(item.key)} />
              ))}
            </NavGroup>
            <NavGroup label="Sales" collapsible defaultOpen badge={prospectsLoaded ? prospects.length : null}>
              {SALES_NAV.map((item) => (
                <NavItem key={item.key} item={item} active={nav === item.key} onClick={() => openNav(item.key)} />
              ))}
            </NavGroup>
          </nav>
        </aside>

        {/* content */}
        <div className="min-w-0 flex-1">
          {error && !isSales && <p className="mb-4 text-sm text-rose-400">{error}</p>}
          {opsNotice && !isSales && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">
              <span>{opsNotice}</span>
              <button onClick={() => { setOpsNotice(''); openNav('sales:prospects') }} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">View in Sales</button>
            </div>
          )}

          {/* Sales / Outreach CRM */}
          {isSales ? (
            <>
              {prospectsError && <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{prospectsError}</p>}
              {nav === 'sales:dashboard' && (
                <SalesDashboard
                  prospects={prospects} consultations={rows} clients={clients} projects={projects}
                  onGoToProspects={() => openNav('sales:prospects')}
                />
              )}
              {nav === 'sales:prospects' && (
                <Prospects
                  prospects={prospects} loading={prospectsLoading} error={null}
                  onAdd={addProspect} onUpdate={updateProspect} onDelete={deleteProspect}
                />
              )}
              {nav === 'sales:pipeline' && (
                <SalesPipeline prospects={prospects} onUpdate={updateProspect} onOpen={setActiveProspect} />
              )}
              {nav === 'sales:followups' && (
                <FollowUps prospects={prospects} onOpen={setActiveProspect} />
              )}
              {nav === 'sales:queue' && <SendingQueue onProspectUpdate={updateProspect} />}
              {nav === 'sales:analytics' && <SalesAnalytics prospects={prospects} />}
            </>
          ) : loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : activeProject ? (
            <ProjectProfile
              project={activeProject}
              history={history.filter((h) => h.project_id === activeProject.id)}
              onClose={() => setActiveProject(null)}
              onSaveProject={(patch) => updateProject(activeProject.id, patch)}
              onSaveClient={(patch) => updateClient(activeProject.client_id, patch)}
              onStageChange={(stage) => changeStage(activeProject, stage)}
              onRevert={() => revertToLead(activeProject)}
              onDelete={() => deleteProjectAndClient(activeProject)}
            />
          ) : (
            <>
              {nav === 'Home' && <Home consultations={rows} clients={clients} projects={projects} support={support} history={history} prospects={prospects} outreach={outreachCounts} />}
              {nav === 'Consultations' && (
                <Consultations
                  rows={rows} onOpen={setActive} onStatus={updateRow}
                  onMoveToSales={requestMoveToSales} onDelete={requestDeleteConsultation}
                />
              )}
              {nav === 'Pipeline' && <Pipeline rows={rows} onStatus={updateRow} onOpen={setActive} />}
              {nav === 'Clients' && <Clients projects={projects} onOpen={setActiveProject} />}
              {nav === 'Projects' && <Projects projects={projects} onOpen={setActiveProject} onStageChange={changeStage} />}
              {nav === 'Support' && <Support rows={support} onStatus={updateSupport} onOpen={setActiveSupport} />}
              {nav === 'Analytics' && <Analytics rows={rows} />}
              {nav === 'Settings' && (
                <>
                  {prospectsError && <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{prospectsError}</p>}
                  <Settings prospects={prospects} onDeleteProspect={deleteProspect} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {active && (
        <DetailModal
          row={active}
          onClose={() => setActive(null)}
          onStatus={(s) => updateRow(active.id, { status: s })}
          onSaveNotes={(n) => updateRow(active.id, { admin_notes: n })}
          onConvert={() => convertToClient(active)}
          onConverted={() => { setActive(null); setNav('Clients') }}
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

      {/* Operations delete confirmation (Consultations) */}
      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.title}
          description={pendingDelete.description}
          details={pendingDelete.details}
          note={pendingDelete.note}
          confirmLabel={pendingDelete.confirmLabel}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { const fn = pendingDelete.onConfirm; setPendingDelete(null); fn?.() }}
        />
      )}

      {/* Move-to-Sales duplicate warning */}
      {pendingMove && (
        <DuplicateWarning
          matches={pendingMove.matches}
          onViewExisting={(p) => { setPendingMove(null); setActiveProspect(p) }}
          onSaveAnyway={() => doMoveToSales(pendingMove.consultation)}
          onCancel={() => setPendingMove(null)}
        />
      )}

      {/* Prospect panel opened from Sales Pipeline / Follow-ups (the Prospects
          table opens its own panel internally). */}
      {activeProspect && (() => {
        const live = prospects.find((p) => p.id === activeProspect.id)
        return live ? (
          <ProspectPanel
            prospect={live}
            onClose={() => setActiveProspect(null)}
            onUpdate={updateProspect}
            onDelete={deleteProspect}
          />
        ) : null
      })()}
    </Shell>
  )
}

/* ----------------------------------------------------------- sidebar nav */

function NavGroup({ label, children, collapsible, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        className={`mb-2 flex w-full items-center justify-between px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 ${collapsible ? 'hover:text-gray-300' : 'cursor-default'}`}
      >
        <span className="flex items-center gap-2">
          {label}
          {badge != null && <span className="rounded-full bg-gold-400/10 px-1.5 py-0.5 text-[10px] text-gold-200">{badge}</span>}
        </span>
        {collapsible && <Arrow className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

function NavItem({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-gold-400/60 bg-gold-400/10 text-gold-100'
          : 'border-transparent text-gray-400 hover:border-white/10 hover:bg-white/[0.03] hover:text-gray-200'
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {item.label}
    </button>
  )
}

/* ------------------------------------------------------------------- home */

// Statuses that count as a booked consultation / a closed client in the funnel.
const FUNNEL_CONSULT = ['Consultation Booked', 'Consultation Scheduled', 'Consultation Completed']
const FUNNEL_CLOSED = ['Won', 'Client']

function Home({ consultations, clients, projects, support, history, prospects = [], outreach = {} }) {
  // Sales funnel row (top of dashboard). New Leads / Consultations Booked /
  // Clients Closed / Close Rate come from the Prospects CRM; Emails Sent and
  // Replies are real counts from outreach_drafts (sent_at / replied_at).
  const funnel = useMemo(() => {
    const newLeads = prospects.filter((p) => p.status === 'New Lead').length
    const consults = prospects.filter((p) => FUNNEL_CONSULT.includes(p.status)).length
    const closed = prospects.filter((p) => FUNNEL_CLOSED.includes(p.status)).length
    const total = prospects.length
    const closeRate = total ? Math.round((closed / total) * 100) : 0
    return [
      { label: 'New Leads', value: newLeads },
      { label: 'Emails Sent', value: outreach.sent == null ? '—' : outreach.sent },
      { label: 'Replies', value: outreach.replies == null ? '—' : outreach.replies },
      { label: 'Consultations Booked', value: consults },
      { label: 'Clients Closed', value: closed },
      { label: 'Close Rate', value: `${closeRate}%` },
    ]
  }, [prospects, outreach])

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
      {/* Sales funnel — top statistics row */}
      <div>
        <div className="eyebrow mb-3"><Chart className="h-3.5 w-3.5" /> Sales Funnel</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {funnel.map((s) => (
            <div key={s.label} className="card-surface p-5 shadow-card">
              <div className="font-display text-2xl font-bold text-gold-gradient md:text-3xl">{s.value}</div>
              <div className="mt-1.5 text-xs leading-tight text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

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

function Consultations({ rows, onOpen, onStatus, onMoveToSales, onDelete }) {
  if (rows.length === 0) return <Empty />
  return (
    <div className="card-surface overflow-x-auto p-2 shadow-card">
      <table className="w-full min-w-[960px] border-collapse text-sm">
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
                <div className="flex items-center gap-2">
                  <button onClick={() => onOpen(r)} className="btn-ghost px-3 py-1.5 text-xs">
                    View
                  </button>
                  {onMoveToSales && (
                    <button
                      onClick={() => onMoveToSales(r)}
                      className="whitespace-nowrap rounded-full border border-gold-400/30 bg-gold-400/[0.06] px-3 py-1.5 text-xs font-medium text-gold-200 transition-colors hover:border-gold-400/60"
                    >
                      Move to Sales
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(r)}
                      aria-label={`Delete consultation for ${r.name || r.business || 'lead'}`}
                      className="rounded-full border border-rose-400/30 bg-rose-400/[0.06] px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/60"
                    >
                      Delete
                    </button>
                  )}
                </div>
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
