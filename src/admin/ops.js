// ============================================================================
// Phase 2 Internal Operations — shared constants & helpers
// Used by the Clients, Projects, Support and Home (KPI) admin views.
// ============================================================================

// Project pipeline stages (Section 5). Order = left→right on the Kanban board.
export const PROJECT_STAGES = [
  'Lead',
  'Discovery Call Booked',
  'Proposal Sent',
  'Contract Sent',
  'Deposit Paid',
  'Content Collection',
  'Strategy',
  'Design',
  'Development',
  'Review',
  'Launch',
  'Maintenance',
  'Completed',
]

// The stage a freshly converted lead lands on. Converting implies they've
// committed, so we skip the pre-sale stages.
export const INITIAL_PROJECT_STAGE = 'Deposit Paid'

// Tailwind chip styles per stage (cycled through a small premium palette).
const STAGE_PALETTE = [
  'border-sky-400/40 bg-sky-400/10 text-sky-200',
  'border-indigo-400/40 bg-indigo-400/10 text-indigo-200',
  'border-violet-400/40 bg-violet-400/10 text-violet-200',
  'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
  'border-amber-400/40 bg-amber-400/10 text-amber-200',
  'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
  'border-teal-400/40 bg-teal-400/10 text-teal-200',
  'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
]
export const stageStyle = (stage) => {
  if (stage === 'Completed') return 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
  const i = Math.max(0, PROJECT_STAGES.indexOf(stage))
  return STAGE_PALETTE[i % STAGE_PALETTE.length]
}

// Support ticket statuses (Section 7).
export const SUPPORT_STATUSES = ['New', 'In Progress', 'Waiting On Client', 'Resolved', 'Closed']
export const SUPPORT_STATUS_STYLES = {
  'New': 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  'In Progress': 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  'Waiting On Client': 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  'Resolved': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  'Closed': 'border-gray-400/30 bg-gray-400/10 text-gray-300',
}

// Mirrors the dropdown on /support.
export const SUPPORT_TYPES = ['Project Update', 'Payment Help', 'Website/App Issue', 'General Support']

// Suggested values (free-text inputs use these as a datalist).
export const PACKAGES = ['Starter Website', 'Business Website', 'Custom Solutions', 'Maintenance']
export const PROJECT_TYPES = ['Website', 'Website Redesign', 'App', 'Portal', 'Dashboard', 'Automation', 'Not Sure Yet']

// Payment status indicators (Section 6): Pending · Partial · Paid · Overdue.
export const PAYMENT_STATUS_STYLES = {
  Pending: 'border-gray-400/30 bg-gray-400/10 text-gray-300',
  Partial: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  Paid: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  Overdue: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
}

export const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const balanceDue = (p) => Math.max(0, num(p?.total_price) - num(p?.amount_paid))

export const paymentStatus = (p) => {
  if (!p) return 'Pending'
  const total = num(p.total_price)
  const paid = num(p.amount_paid)
  if (p.paid_in_full || (total > 0 && paid >= total)) return 'Paid'
  // Overdue: money still owed and the launch date has already passed.
  if (balanceDue(p) > 0 && p.launch_date && new Date(p.launch_date) < new Date()) return 'Overdue'
  if (paid > 0) return 'Partial'
  return 'Pending'
}

export const fmtMoney = (v) =>
  num(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
