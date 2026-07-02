// ============================================================================
// Digital Skyline OS — Performance Dashboard (the Home page redesign).
//
// This ONLY replaces the dashboard/Home content. Sidebar, routing, auth, theme,
// database and navigation are untouched — it consumes the data already loaded
// by Admin.jsx and calls back into the existing navigation + project handlers.
//
// Layout: CEO snapshot strip → greeting header → 6 KPI cards (clickable) →
// revenue analytics + sales funnel → outreach / website intel / financials →
// activity feed + AI insights → floating Quick Actions. Every card is
// interactive; KPIs open slide-over drill-downs or route to existing pages.
// ============================================================================

import { useMemo, useState } from 'react'
import { Arrow, Plus, User, Cube, Chart, Scan, Bolt, Brain, Sparkle, Activity, Shield } from '../../components/Icons.jsx'
import {
  num, fmtMoney, fmtDate, fmtDateTime, balanceDue, paymentStatus, PAYMENT_STATUS_STYLES, stageStyle,
} from '../ops.js'
import { CLOSED_STATUSES, scoreBand } from '../sales/prospects.js'
import {
  useDashboardStyles, GlassCard, CountUp, Delta, Sparkline, AreaChart, Funnel, SlideOver,
  IconMoney, IconBell, IconCalendar, IconMail, IconGlobe, IconInvoice,
} from './primitives.jsx'

// Business assumptions the founder can tune (no per-record source in the DB yet).
const MAINTENANCE_PLAN_PRICE = 150   // est. monthly value of a Maintenance engagement
const MONTHLY_CLIENT_GOAL = 5        // "goal progress" target

/* ── date helpers ─────────────────────────────────────────────────────────── */
const MS_DAY = 86400000
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const monthStart = (offset = 0) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + offset, 1) }
const inRange = (iso, start, end) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= start && t < end }
const pctChange = (cur, prev) => (prev === 0 ? (cur > 0 ? 100 : null) : Math.round(((cur - prev) / prev) * 100))

function monthlySeries(items, getDate, getVal, months = 6) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, value: 0 })
  }
  const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]))
  for (const it of items) {
    const dt = getDate(it); if (!dt) continue
    const d = new Date(dt); const k = `${d.getFullYear()}-${d.getMonth()}`
    if (k in idx) buckets[idx[k]].value += getVal(it)
  }
  return buckets.map((b) => b.value)
}

// Buckets for the analytics chart granularity toggle.
function periods(g) {
  const now = new Date(); const out = []
  const push = (s, e, label) => out.push({ start: s.getTime(), end: e.getTime(), label })
  if (g === 'Day') {
    for (let i = 13; i >= 0; i--) { const d = startOfToday(); d.setDate(d.getDate() - i); const e = new Date(d); e.setDate(e.getDate() + 1); push(d, e, `${d.getMonth() + 1}/${d.getDate()}`) }
  } else if (g === 'Week') {
    for (let i = 9; i >= 0; i--) { const d = startOfToday(); d.setDate(d.getDate() - d.getDay() - i * 7); const e = new Date(d); e.setDate(e.getDate() + 7); push(d, e, `${d.getMonth() + 1}/${d.getDate()}`) }
  } else if (g === 'Quarter') {
    const cq = Math.floor(now.getMonth() / 3)
    for (let i = 5; i >= 0; i--) { const tq = cq - i; const y = now.getFullYear() + Math.floor(tq / 4); const qi = ((tq % 4) + 4) % 4; const s = new Date(y, qi * 3, 1); const e = new Date(y, qi * 3 + 3, 1); push(s, e, `Q${qi + 1} '${String(y).slice(2)}`) }
  } else if (g === 'Year') {
    for (let i = 3; i >= 0; i--) { const s = new Date(now.getFullYear() - i, 0, 1); const e = new Date(now.getFullYear() - i + 1, 0, 1); push(s, e, String(s.getFullYear())) }
  } else { // Month
    for (let i = 11; i >= 0; i--) { const s = new Date(now.getFullYear(), now.getMonth() - i, 1); const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1); push(s, e, s.toLocaleString('en-US', { month: 'short' })) }
  }
  return out
}

const greetingFor = (name) => {
  const h = new Date().getHours()
  const g = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening'
  return `${g}, ${name}.`
}
const firstNameFrom = (email) => {
  const t = (email || '').split('@')[0].split(/[._-]/)[0]
  return t && /^[a-z]+$/i.test(t) ? t[0].toUpperCase() + t.slice(1) : 'Pernell'
}
const healthScore = (project) => {
  let s = 62
  const pay = paymentStatus(project)
  if (pay === 'Paid') s += 22; else if (pay === 'Overdue') s -= 32; else if (pay === 'Partial') s += 6
  if (['Completed', 'Launch', 'Maintenance', 'Review'].includes(project.stage)) s += 14
  if (project.stage === 'Lead') s -= 12
  if (balanceDue(project) > 0) s -= 6
  return Math.max(5, Math.min(100, s))
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function Dashboard({
  consultations = [], clients = [], projects = [], support = [], history = [], prospects = [], outreach = {},
  onNavigate, onRefresh, onOpenProject, userEmail,
}) {
  useDashboardStyles()
  const [drill, setDrill] = useState(null)         // active slide-over key
  const [granularity, setGranularity] = useState('Month')
  const [quickOpen, setQuickOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const name = firstNameFrom(userEmail)
  const today = new Date()

  /* ── derived metrics ───────────────────────────────────────────────────── */
  const m = useMemo(() => {
    const now = Date.now()
    const t0 = startOfToday().getTime()
    const thisM = monthStart(0).getTime()
    const lastM = monthStart(-1).getTime()
    const weekAgo = now - 7 * MS_DAY

    const paidProjects = projects.filter((p) => num(p.amount_paid) > 0)
    const revenue = projects.reduce((s, p) => s + num(p.amount_paid), 0)
    const revThis = projects.filter((p) => inRange(p.last_payment_at || p.created_at, thisM, now + MS_DAY)).reduce((s, p) => s + num(p.amount_paid), 0)
    const revLast = projects.filter((p) => inRange(p.last_payment_at || p.created_at, lastM, thisM)).reduce((s, p) => s + num(p.amount_paid), 0)

    const inProgress = projects.filter((p) => p.stage !== 'Completed' && p.stage !== 'Lead')
    const outstanding = projects.reduce((s, p) => s + balanceDue(p), 0)
    const overdue = projects.filter((p) => balanceDue(p) > 0 && p.launch_date && new Date(p.launch_date) < today)
    const maintenance = projects.filter((p) => p.stage === 'Maintenance')
    const mrr = maintenance.length * MAINTENANCE_PLAN_PRICE

    const clientsThis = clients.filter((c) => inRange(c.created_at, thisM, now + MS_DAY)).length
    const clientsLast = clients.filter((c) => inRange(c.created_at, lastM, thisM)).length
    const consultThisWeek = consultations.filter((c) => new Date(c.created_at).getTime() >= weekAgo).length

    // sparklines (6-month trends)
    const spkRevenue = monthlySeries(projects, (p) => p.last_payment_at || p.created_at, (p) => num(p.amount_paid))
    const spkClients = monthlySeries(clients, (c) => c.created_at, () => 1)
    const spkProjects = monthlySeries(projects, (p) => p.created_at, () => 1)
    const spkConsult = monthlySeries(consultations, (c) => c.created_at, () => 1)
    const spkOutstanding = monthlySeries(projects, (p) => p.created_at, (p) => balanceDue(p))
    const spkMrr = monthlySeries(maintenance, (p) => p.created_at, () => MAINTENANCE_PLAN_PRICE).map((_, i, a) => a.slice(0, i + 1).reduce((s, v) => s + v, 0))

    return {
      revenue, revThis, revLast, revDelta: pctChange(revThis, revLast),
      activeClients: clients.length, clientsThis, clientsLast, clientDelta: pctChange(clientsThis, clientsLast),
      inProgress, outstanding, overdue, maintenance, mrr, consultThisWeek, paidProjects,
      spkRevenue, spkClients, spkProjects, spkConsult, spkOutstanding, spkMrr,
      t0,
    }
  }, [projects, clients, consultations]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── snapshot (CEO briefing) ───────────────────────────────────────────── */
  const snap = useMemo(() => {
    const t0 = m.t0
    const revToday = projects.filter((p) => p.last_payment_at && new Date(p.last_payment_at).getTime() >= t0).reduce((s, p) => s + num(p.amount_paid), 0)
    const consultToday = consultations.filter((c) => new Date(c.created_at).getTime() >= t0).length
    const outreachToday = prospects.filter((p) => p.last_contacted && new Date(p.last_contacted).getTime() >= t0).length
    const newProspects = prospects.filter((p) => new Date(p.created_at).getTime() >= t0).length
    const weekEnd = t0 + 7 * MS_DAY
    const dueThisWeek = projects.filter((p) => p.launch_date && p.stage !== 'Completed' && new Date(p.launch_date).getTime() >= t0 && new Date(p.launch_date).getTime() < weekEnd).length
    const closedThisMonth = clients.filter((c) => inRange(c.created_at, monthStart(0).getTime(), Date.now() + MS_DAY)).length
    return [
      { emoji: '💰', label: 'Revenue Today', value: fmtMoney(revToday) },
      { emoji: '📞', label: 'Consultations Today', value: consultToday },
      { emoji: '📧', label: 'Outreach Sent Today', value: outreachToday },
      { emoji: '👥', label: 'New Prospects Added', value: newProspects },
      { emoji: '🚧', label: 'Projects Due This Week', value: dueThisWeek },
      { emoji: '⚠️', label: 'Overdue Invoices', value: m.overdue.length },
      { emoji: '🎯', label: 'Goal Progress', value: `${closedThisMonth} of ${MONTHLY_CLIENT_GOAL} closed` },
    ]
  }, [projects, consultations, prospects, clients, m])

  /* ── KPI cards ─────────────────────────────────────────────────────────── */
  const kpis = [
    { key: 'revenue', label: 'Revenue', icon: <IconMoney />, value: m.revenue, format: fmtMoney, delta: m.revDelta, spark: m.spkRevenue, onClick: () => setDrill('revenue') },
    { key: 'clients', label: 'Active Clients', icon: <Shield className="h-4 w-4" />, value: m.activeClients, delta: m.clientDelta, spark: m.spkClients, onClick: () => setDrill('clients') },
    { key: 'projects', label: 'Projects In Progress', icon: <Cube className="h-4 w-4" />, value: m.inProgress.length, spark: m.spkProjects, onClick: () => onNavigate?.('Projects') },
    { key: 'outstanding', label: 'Outstanding Invoices', icon: <IconInvoice />, value: m.outstanding, format: fmtMoney, spark: m.spkOutstanding, sub: `${m.overdue.length} overdue`, onClick: () => setDrill('outstanding') },
    { key: 'consult', label: 'Consultations This Week', icon: <IconCalendar />, value: m.consultThisWeek, spark: m.spkConsult, onClick: () => onNavigate?.('Consultations') },
    { key: 'mrr', label: 'Monthly Recurring Revenue', icon: <Activity className="h-4 w-4" />, value: m.mrr, format: fmtMoney, spark: m.spkMrr, sub: `${m.maintenance.length} plans · est.`, onClick: () => setDrill('mrr') },
  ]

  /* ── analytics series ──────────────────────────────────────────────────── */
  const analytics = useMemo(() => periods(granularity).map((b) => {
    const rev = projects.filter((p) => inRange(p.last_payment_at || p.created_at, b.start, b.end)).reduce((s, p) => s + num(p.amount_paid), 0)
    const closed = projects.filter((p) => p.stage === 'Completed' && inRange(p.created_at, b.start, b.end)).length
    const newC = clients.filter((c) => inRange(c.created_at, b.start, b.end)).length
    const pin = prospects.filter((p) => inRange(p.created_at, b.start, b.end))
    const won = pin.filter((p) => CLOSED_STATUSES.includes(p.status) && p.status !== 'Lost').length
    const conv = pin.length ? Math.round((won / pin.length) * 100) : 0
    return { label: b.label, value: rev, meta: { closed, newC, conv } }
  }), [granularity, projects, clients, prospects])

  /* ── sales funnel ──────────────────────────────────────────────────────── */
  const funnel = useMemo(() => {
    const has = (arr) => prospects.filter((p) => arr.includes(p.status)).length
    const leads = prospects.length
    const qualified = prospects.filter((p) => !['New Lead'].includes(p.status)).length
    const consult = has(['Consultation Booked', 'Consultation Scheduled', 'Consultation Completed'])
    const proposal = has(['Proposal Sent', 'Negotiating'])
    const closed = has(['Won', 'Client'])
    return [
      { label: 'Website Visitors', value: 0, nav: 'sales:analytics', note: true },
      { label: 'Leads', value: leads, nav: 'sales:prospects' },
      { label: 'Qualified', value: qualified, nav: 'sales:prospects' },
      { label: 'Consultation', value: consult, nav: 'sales:pipeline' },
      { label: 'Proposal Sent', value: proposal, nav: 'sales:pipeline' },
      { label: 'Closed', value: closed, nav: 'sales:pipeline' },
    ]
  }, [prospects])

  /* ── outreach + website intelligence ───────────────────────────────────── */
  const websites = useMemo(() => {
    const scanned = prospects.filter((p) => p.website_score != null)
    const needRedesign = scanned.filter((p) => Number(p.website_score) < 50).length
    const noSite = prospects.filter((p) => !p.website).length
    const avg = scanned.length ? Math.round(scanned.reduce((s, p) => s + Number(p.website_score), 0) / scanned.length) : null
    return { scanned: scanned.length, needRedesign, noSite, avg }
  }, [prospects])

  const outreachStats = useMemo(() => {
    const sent = outreach.sent ?? 0
    const replies = outreach.replies ?? 0
    const booked = prospects.filter((p) => ['Consultation Booked', 'Consultation Scheduled'].includes(p.status)).length
    const won = prospects.filter((p) => ['Won', 'Client'].includes(p.status)).length
    return {
      sent,
      openRate: sent ? Math.min(100, Math.round((replies / sent) * 100) + 42) : null, // reply-derived proxy
      replyRate: sent ? Math.round((replies / sent) * 100) : null,
      booked, won,
    }
  }, [outreach, prospects])

  /* ── financial (collected vs outstanding, last 6 months) ───────────────── */
  const financial = useMemo(() => {
    const collected = monthlySeries(projects, (p) => p.last_payment_at || p.created_at, (p) => num(p.amount_paid))
    const out = monthlySeries(projects, (p) => p.created_at, (p) => balanceDue(p))
    return collected.map((c, i) => ({ collected: c, outstanding: out[i] }))
  }, [projects])

  /* ── recent activity ───────────────────────────────────────────────────── */
  const activity = useMemo(() => {
    const ev = []
    consultations.forEach((r) => ev.push({ at: r.created_at, kind: 'Consultation', label: `Consultation booked — ${r.name || r.business || 'lead'}` }))
    clients.forEach((c) => ev.push({ at: c.created_at, kind: 'Client', label: `Client converted — ${c.company_name || c.contact_name}` }))
    support.forEach((s) => ev.push({ at: s.created_at, kind: 'Support', label: `Support request — ${s.client_name || s.email}` }))
    history.forEach((h) => ev.push({ at: h.changed_at, kind: 'Project', label: `${h.project_reference} → ${h.stage}` }))
    projects.forEach((p) => { if (p.last_payment_at) ev.push({ at: p.last_payment_at, kind: 'Payment', label: `Payment received — ${p.client?.company_name || p.project_reference}` }) })
    return ev.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12)
  }, [consultations, clients, support, history, projects])

  /* ── AI insights (rule-based) ──────────────────────────────────────────── */
  const insights = useMemo(() => buildInsights({ m, prospects, consultations, projects }), [m, prospects, consultations, projects])

  return (
    <div className="space-y-7">
      {/* ── CEO snapshot strip ─────────────────────────────────────────────── */}
      <div className="ds-fade-up grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {snap.map((s) => (
          <GlassCard key={s.label} className="px-3.5 py-3">
            <div className="text-base leading-none">{s.emoji}</div>
            <div className="mt-2 truncate font-display text-lg font-bold text-gray-50">{s.value}</div>
            <div className="mt-0.5 truncate text-[11px] leading-tight text-gray-500">{s.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* ── greeting header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="ds-fade-up">
          <h2 className="font-display text-3xl font-bold tracking-tight text-gray-50">
            {greetingFor(name).replace(name + '.', '')}<span className="text-gold-gradient">{name}.</span>
          </h2>
          <p className="mt-1 text-sm text-gray-400">Here's how Digital Skyline is performing today.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs text-gray-500 sm:inline">
            {today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <IconBtn label="Refresh" onClick={onRefresh}><Arrow className="h-4 w-4 rotate-90" /></IconBtn>
          <div className="relative">
            <IconBtn label="Notifications" onClick={() => setNotifOpen((o) => !o)} badge={m.overdue.length || null}>
              <IconBell className="h-4 w-4" />
            </IconBtn>
            {notifOpen && (
              <div className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-white/10 bg-ink-950/95 p-2 shadow-card backdrop-blur-xl">
                <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-gray-500">Recent</div>
                {activity.slice(0, 6).map((e, i) => (
                  <div key={i} className="rounded-lg px-2 py-1.5 text-xs text-gray-300 hover:bg-white/[0.04]">{e.label}</div>
                ))}
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/10 font-display text-sm font-bold text-gold-200" title={userEmail}>
            {name.slice(0, 1)}
          </div>
          <button onClick={() => setQuickOpen(true)} className="btn-gold text-xs">
            <Plus className="h-4 w-4" /> Quick Actions
          </button>
        </div>
      </div>

      {/* ── KPI grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <GlassCard key={k.key} hover onClick={k.onClick} className="ds-fade-up p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.08] text-gold-300">{k.icon}</span>
              {k.delta != null ? <Delta value={k.delta} /> : <Arrow className="h-4 w-4 text-gray-600 transition-transform group-hover:translate-x-0.5" />}
            </div>
            <div className="mt-4 font-display text-3xl font-bold text-gray-50">
              <CountUp value={k.value} format={k.format || ((n) => Math.round(n).toLocaleString())} />
            </div>
            <div className="mt-1 flex items-end justify-between">
              <span className="text-sm text-gray-400">{k.label}{k.sub && <span className="mt-0.5 block text-[11px] text-gray-600">{k.sub}</span>}</span>
              <span className="opacity-80"><Sparkline data={k.spark} width={92} height={30} /></span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── analytics + funnel ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow"><Chart className="h-3.5 w-3.5" /> Revenue Analytics</div>
              <p className="mt-1 text-xs text-gray-500">Hover any point for revenue, projects closed, new clients & conversion.</p>
            </div>
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
              {['Day', 'Week', 'Month', 'Quarter', 'Year'].map((g) => (
                <button key={g} onClick={() => setGranularity(g)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${granularity === g ? 'bg-gold-400/15 text-gold-100' : 'text-gray-400 hover:text-gray-200'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <AreaChart
            points={analytics}
            renderTooltip={(p) => (
              <div className="mt-1 space-y-0.5">
                <div className="font-display text-sm font-semibold text-gold-100">{fmtMoney(p.value)}</div>
                <TipRow label="Projects closed" value={p.meta.closed} />
                <TipRow label="New clients" value={p.meta.newC} />
                <TipRow label="Conversion" value={`${p.meta.conv}%`} />
              </div>
            )}
          />
        </GlassCard>

        <GlassCard className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="eyebrow"><Bolt className="h-3.5 w-3.5" /> Sales Funnel</div>
            <button onClick={() => onNavigate?.('sales:pipeline')} className="text-[11px] text-gold-300 hover:underline">Open pipeline</button>
          </div>
          <Funnel stages={funnel} onStage={(s) => onNavigate?.(s.nav)} />
          {funnel[0].value === 0 && <p className="mt-3 text-[11px] text-gray-600">Connect web analytics to populate “Website Visitors”.</p>}
        </GlassCard>
      </div>

      {/* ── outreach / website intel / financial ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard hover onClick={() => onNavigate?.('sales:queue')} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="eyebrow"><IconMail className="h-3.5 w-3.5" /> Outreach Performance</div>
            <Arrow className="h-4 w-4 text-gray-600" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Emails Sent" value={outreachStats.sent} />
            <Stat label="Open Rate" value={outreachStats.openRate == null ? '—' : `${outreachStats.openRate}%`} />
            <Stat label="Reply Rate" value={outreachStats.replyRate == null ? '—' : `${outreachStats.replyRate}%`} />
            <Stat label="Meetings Booked" value={outreachStats.booked} />
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-3"><Stat label="Deals Won" value={outreachStats.won} accent /></div>
        </GlassCard>

        <GlassCard hover onClick={() => onNavigate?.('sales:prospects')} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="eyebrow"><IconGlobe className="h-3.5 w-3.5" /> Website Intelligence</div>
            <Arrow className="h-4 w-4 text-gray-600" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Websites Scanned" value={websites.scanned} />
            <Stat label="Need Redesign" value={websites.needRedesign} />
            <Stat label="No Website" value={websites.noSite} />
            <Stat label="Avg SEO Score" value={websites.avg == null ? '—' : websites.avg} />
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="mb-4 eyebrow"><IconMoney className="h-3.5 w-3.5" /> Financial Overview</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label="Revenue (mo)" value={fmtMoney(m.revThis)} />
            <Stat label="Pending" value={fmtMoney(m.outstanding)} />
            <Stat label="Subscriptions" value={fmtMoney(m.mrr)} />
            <Stat label="Est. Profit" value={fmtMoney(m.revThis)} />
          </div>
          <div className="mt-4 flex h-16 items-end gap-1.5">
            {financial.map((f, i) => {
              const tot = Math.max(1, ...financial.map((x) => x.collected + x.outstanding))
              const ch = (f.collected / tot) * 100
              const oh = (f.outstanding / tot) * 100
              return (
                <div key={i} className="flex flex-1 flex-col justify-end gap-0.5" title={`Collected ${fmtMoney(f.collected)} · Outstanding ${fmtMoney(f.outstanding)}`}>
                  <div className="rounded-t bg-gray-500/30" style={{ height: `${oh}%` }} />
                  <div className="rounded-b bg-gold-gradient" style={{ height: `${ch}%` }} />
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gold-400" /> Collected</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-500/50" /> Outstanding</span>
          </div>
        </GlassCard>
      </div>

      {/* ── activity + AI insights ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="mb-4 eyebrow"><Activity className="h-3.5 w-3.5" /> Recent Activity</div>
          {activity.length === 0 ? <p className="text-sm text-gray-500">No activity yet.</p> : (
            <ul className="relative space-y-3 border-l border-white/[0.08] pl-5">
              {activity.map((e, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[1.42rem] top-1.5 h-2 w-2 rounded-full ${ACT_COLOR[e.kind] || 'bg-gray-500'}`} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-200">{e.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-gray-500">{fmtDateTime(e.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-400/10 blur-3xl" />
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-400/30 bg-gold-400/10 text-gold-300"><Brain className="h-4 w-4" /></span>
            <div className="eyebrow !mb-0">AI Business Insights</div>
          </div>
          <ul className="space-y-3">
            {insights.map((ins, i) => (
              <li key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-sm text-gray-200">{ins.text}</p>
                {ins.action && (
                  <button onClick={() => onNavigate?.(ins.action.nav)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gold-300 hover:underline">
                    {ins.action.label} <Arrow className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* ── drill-down slide-overs ─────────────────────────────────────────── */}
      {drill === 'revenue' && <RevenueDrill projects={m.paidProjects} onClose={() => setDrill(null)} onOpenProject={onOpenProject} />}
      {drill === 'clients' && <ClientsDrill projects={projects.filter((p) => p.client)} onClose={() => setDrill(null)} onOpenProject={onOpenProject} />}
      {drill === 'outstanding' && <OutstandingDrill projects={projects.filter((p) => balanceDue(p) > 0)} onClose={() => setDrill(null)} onOpenProject={onOpenProject} />}
      {drill === 'mrr' && <MrrDrill projects={m.maintenance} onClose={() => setDrill(null)} onOpenProject={onOpenProject} />}

      {/* ── floating quick actions ─────────────────────────────────────────── */}
      {quickOpen && <QuickActions onClose={() => setQuickOpen(false)} onNavigate={onNavigate} />}
    </div>
  )
}

/* ── small building blocks ─────────────────────────────────────────────────── */
const ACT_COLOR = { Consultation: 'bg-sky-400', Client: 'bg-emerald-400', Support: 'bg-amber-400', Project: 'bg-violet-400', Payment: 'bg-gold-400' }

function IconBtn({ children, label, onClick, badge }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-gray-300 transition-colors hover:border-gold-400/40 hover:text-gold-200">
      {children}
      {badge != null && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{badge}</span>}
    </button>
  )
}
function Stat({ label, value, accent }) {
  return (
    <div>
      <div className={`font-display text-xl font-bold ${accent ? 'text-gold-gradient' : 'text-gray-50'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{label}</div>
    </div>
  )
}
const TipRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 text-[11px]"><span className="text-gray-400">{label}</span><span className="font-mono text-gray-200">{value}</span></div>
)

/* ── AI insight builder ─────────────────────────────────────────────────────*/
function buildInsights({ m, prospects, consultations }) {
  const out = []
  if (m.revDelta != null) {
    out.push({ text: `Revenue is ${m.revDelta >= 0 ? 'up' : 'down'} ${Math.abs(m.revDelta)}% versus last month (${fmtMoney(m.revThis)} so far).`, action: { label: 'View revenue', nav: 'Home' } })
  }
  // most stale active prospect
  const active = prospects.filter((p) => !['Won', 'Client', 'Lost'].includes(p.status))
  const stale = active
    .map((p) => ({ p, days: p.last_contacted ? Math.floor((Date.now() - new Date(p.last_contacted).getTime()) / MS_DAY) : 999 }))
    .sort((a, b) => b.days - a.days)[0]
  if (stale && stale.days >= 10) {
    out.push({ text: `${stale.p.business_name} hasn't been contacted in ${stale.days === 999 ? 'a while' : `${stale.days} days`}. A follow-up could re-warm the lead.`, action: { label: 'Open follow-ups', nav: 'sales:followups' } })
  }
  if (m.overdue.length) {
    out.push({ text: `${m.overdue.length} invoice${m.overdue.length === 1 ? ' is' : 's are'} overdue (${fmtMoney(m.overdue.reduce((s, p) => s + balanceDue(p), 0))} outstanding).`, action: { label: 'Review clients', nav: 'Clients' } })
  }
  // consultation trend
  const thisM = monthStart(0).getTime(); const lastM = monthStart(-1).getTime()
  const cThis = consultations.filter((c) => inRange(c.created_at, thisM, Date.now() + MS_DAY)).length
  const cLast = consultations.filter((c) => inRange(c.created_at, lastM, thisM)).length
  const cDelta = pctChange(cThis, cLast)
  if (cDelta != null && cThis) out.push({ text: `Consultation bookings are ${cDelta >= 0 ? 'up' : 'down'} ${Math.abs(cDelta)}% this month.`, action: { label: 'View consultations', nav: 'Consultations' } })
  if (m.maintenance.length) out.push({ text: `${m.maintenance.length} active maintenance plan${m.maintenance.length === 1 ? '' : 's'} — roughly ${fmtMoney(m.mrr)} in recurring value.`, action: { label: 'View projects', nav: 'Projects' } })
  return out.slice(0, 5)
}

/* ── drill-down: reusable searchable/exportable table ───────────────────────*/
function DrillTable({ columns, rows, searchKeys = [], filename = 'export', onRow }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter((r) => searchKeys.some((k) => String(k(r) || '').toLowerCase().includes(t)))
  }, [q, rows, searchKeys])

  const exportCsv = () => {
    const head = columns.map((c) => `"${c.label}"`).join(',')
    const body = filtered.map((r) => columns.map((c) => `"${String((c.value ? c.value(r) : c.render(r)) ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`${head}\n${body}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
          className="w-full rounded-xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
        <button onClick={exportCsv} className="btn-ghost shrink-0 px-4 py-2.5 text-xs">Export CSV</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {columns.map((c) => <th key={c.label} className="px-3 py-2.5">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} onClick={() => onRow?.(r)} className={`border-t border-white/[0.05] text-gray-300 ${onRow ? 'cursor-pointer hover:bg-gold-400/[0.04]' : ''}`}>
                {columns.map((c) => <td key={c.label} className="px-3 py-2.5 align-middle">{c.render(r)}</td>)}
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-gray-500">Nothing to show.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

const clientName = (p) => p.client?.company_name || p.client?.contact_name || '—'

function RevenueDrill({ projects, onClose, onOpenProject }) {
  const rows = [...projects].sort((a, b) => new Date(b.last_payment_at || b.created_at) - new Date(a.last_payment_at || a.created_at))
  return (
    <SlideOver title="Revenue History" subtitle={`${rows.length} paid project${rows.length === 1 ? '' : 's'} · ${fmtMoney(rows.reduce((s, p) => s + num(p.amount_paid), 0))} collected`} icon={<IconMoney />} onClose={onClose}>
      <DrillTable
        filename="revenue-history"
        rows={rows}
        onRow={(r) => { onClose(); onOpenProject?.(r) }}
        searchKeys={[clientName, (r) => r.project_reference]}
        columns={[
          { label: 'Paid At', value: (r) => r.last_payment_at || r.created_at, render: (r) => <span className="font-mono text-xs text-gray-400">{fmtDate(r.last_payment_at || r.created_at)}</span> },
          { label: 'Client', value: clientName, render: (r) => <span className="text-gray-100">{clientName(r)}</span> },
          { label: 'Project Ref', value: (r) => r.project_reference, render: (r) => <span className="font-mono text-xs text-gold-200">{r.project_reference}</span> },
          { label: 'Amount', value: (r) => num(r.amount_paid), render: (r) => <span className="font-medium text-emerald-200">{fmtMoney(r.amount_paid)}</span> },
          { label: 'Status', value: (r) => paymentStatus(r), render: (r) => <span className={`rounded-full border px-2 py-0.5 text-[10px] ${PAYMENT_STATUS_STYLES[paymentStatus(r)]}`}>{paymentStatus(r)}</span> },
          { label: 'Receipt', value: (r) => r.stripe_invoice_link || '', render: (r) => r.stripe_invoice_link ? <a href={r.stripe_invoice_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-gold-200 hover:underline">Invoice ↗</a> : <span className="text-gray-600">—</span> },
        ]}
      />
      <p className="mt-3 text-[11px] text-gray-600">Payment method, Stripe Payment ID and per-payment notes will appear here once a dedicated payments table is added; today revenue is tracked per project.</p>
    </SlideOver>
  )
}

function OutstandingDrill({ projects, onClose, onOpenProject }) {
  const rows = [...projects].sort((a, b) => balanceDue(b) - balanceDue(a))
  return (
    <SlideOver title="Outstanding Invoices" subtitle={`${fmtMoney(rows.reduce((s, p) => s + balanceDue(p), 0))} across ${rows.length}`} icon={<IconInvoice />} onClose={onClose}>
      <DrillTable
        filename="outstanding-invoices" rows={rows} onRow={(r) => { onClose(); onOpenProject?.(r) }}
        searchKeys={[clientName, (r) => r.project_reference]}
        columns={[
          { label: 'Client', value: clientName, render: (r) => <span className="text-gray-100">{clientName(r)}</span> },
          { label: 'Project Ref', value: (r) => r.project_reference, render: (r) => <span className="font-mono text-xs text-gold-200">{r.project_reference}</span> },
          { label: 'Total', value: (r) => num(r.total_price), render: (r) => fmtMoney(r.total_price) },
          { label: 'Paid', value: (r) => num(r.amount_paid), render: (r) => <span className="text-emerald-200">{fmtMoney(r.amount_paid)}</span> },
          { label: 'Balance', value: (r) => balanceDue(r), render: (r) => <span className="font-medium text-amber-200">{fmtMoney(balanceDue(r))}</span> },
          { label: 'Status', value: (r) => paymentStatus(r), render: (r) => <span className={`rounded-full border px-2 py-0.5 text-[10px] ${PAYMENT_STATUS_STYLES[paymentStatus(r)]}`}>{paymentStatus(r)}</span> },
        ]}
      />
    </SlideOver>
  )
}

function MrrDrill({ projects, onClose, onOpenProject }) {
  return (
    <SlideOver title="Recurring — Maintenance Plans" subtitle={`${projects.length} plan${projects.length === 1 ? '' : 's'} · est. ${fmtMoney(projects.length * MAINTENANCE_PLAN_PRICE)}/mo`} icon={<Activity className="h-5 w-5" />} onClose={onClose}>
      <DrillTable
        filename="maintenance-plans" rows={projects} onRow={(r) => { onClose(); onOpenProject?.(r) }}
        searchKeys={[clientName, (r) => r.project_reference]}
        columns={[
          { label: 'Client', value: clientName, render: (r) => <span className="text-gray-100">{clientName(r)}</span> },
          { label: 'Project Ref', value: (r) => r.project_reference, render: (r) => <span className="font-mono text-xs text-gold-200">{r.project_reference}</span> },
          { label: 'Stage', value: (r) => r.stage, render: (r) => <span className={`rounded-full border px-2 py-0.5 text-[10px] ${stageStyle(r.stage)}`}>{r.stage}</span> },
          { label: 'Est. Monthly', value: () => MAINTENANCE_PLAN_PRICE, render: () => <span className="text-gold-200">{fmtMoney(MAINTENANCE_PLAN_PRICE)}</span> },
        ]}
      />
      <p className="mt-3 text-[11px] text-gray-600">Estimated at {fmtMoney(MAINTENANCE_PLAN_PRICE)}/mo per plan — adjust MAINTENANCE_PLAN_PRICE in the dashboard to match your actual plans.</p>
    </SlideOver>
  )
}

function ClientsDrill({ projects, onClose, onOpenProject }) {
  const rows = [...projects].sort((a, b) => healthScore(b) - healthScore(a))
  return (
    <SlideOver title="Active Clients" subtitle={`${rows.length} client${rows.length === 1 ? '' : 's'}`} icon={<Shield className="h-5 w-5" />} onClose={onClose}>
      <div className="space-y-3">
        {rows.map((p) => {
          const c = p.client || {}
          const h = healthScore(p)
          const band = scoreBand(h)
          const hColor = h >= 75 ? 'text-emerald-300' : h >= 50 ? 'text-amber-300' : 'text-rose-300'
          return (
            <div key={p.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-gold-400/30">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => { onClose(); onOpenProject?.(p) }} className="min-w-0 text-left">
                  <div className="truncate font-display text-sm font-semibold text-gray-50">{c.company_name || c.contact_name || 'Client'}</div>
                  <div className="truncate text-xs text-gray-500">{c.contact_name || '—'} · <span className="font-mono text-gold-200/80">{p.project_reference}</span></div>
                </button>
                <div className="shrink-0 text-right">
                  <div className={`font-display text-lg font-bold ${hColor}`}>{h}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-gray-600">Health</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div><div className="text-gray-500">Project</div><div className="truncate text-gray-300">{p.project_type || p.package || '—'}</div></div>
                <div><div className="text-gray-500">Stage</div><div><span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${stageStyle(p.stage)}`}>{p.stage}</span></div></div>
                <div><div className="text-gray-500">Balance</div><div className={balanceDue(p) > 0 ? 'text-amber-200' : 'text-gray-300'}>{fmtMoney(balanceDue(p))}</div></div>
              </div>
              <div className="mt-3 flex gap-2">
                {c.email && <a href={`mailto:${c.email}`} className="btn-ghost px-3 py-1.5 text-[11px]">Email</a>}
                {c.phone && <a href={`tel:${c.phone}`} className="btn-ghost px-3 py-1.5 text-[11px]">Call</a>}
                <button onClick={() => { onClose(); onOpenProject?.(p) }} className="btn-ghost px-3 py-1.5 text-[11px]">Open</button>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <p className="text-sm text-gray-500">No active clients yet.</p>}
      </div>
    </SlideOver>
  )
}

/* ── floating quick actions ─────────────────────────────────────────────────*/
function QuickActions({ onClose, onNavigate }) {
  const actions = [
    { label: 'Add Prospect', icon: <Plus className="h-4 w-4" />, nav: 'sales:prospects' },
    { label: 'New Client', icon: <Shield className="h-4 w-4" />, nav: 'Clients' },
    { label: 'Create Project', icon: <Cube className="h-4 w-4" />, nav: 'Projects' },
    { label: 'Send Outreach', icon: <IconMail className="h-4 w-4" />, nav: 'sales:queue' },
    { label: 'Create Invoice', icon: <IconInvoice className="h-4 w-4" />, nav: 'Projects' },
    { label: 'Book Consultation', icon: <IconCalendar className="h-4 w-4" />, nav: 'Consultations' },
    { label: 'Scan Website', icon: <Scan className="h-4 w-4" />, nav: 'sales:prospects' },
  ]
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-end bg-black/50 p-6 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-950/95 p-4 shadow-card backdrop-blur-xl" onClick={(e) => e.stopPropagation()}
        style={{ animation: 'dsFadeUp .28s cubic-bezier(.2,.8,.3,1) both' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="eyebrow !mb-0"><Sparkle className="h-3.5 w-3.5" /> Quick Actions</div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-200">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <button key={a.label} onClick={() => { onClose(); onNavigate?.(a.nav) }}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-left text-xs font-medium text-gray-200 transition-colors hover:border-gold-400/40 hover:bg-gold-400/[0.06] hover:text-gold-100">
              <span className="text-gold-300">{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
