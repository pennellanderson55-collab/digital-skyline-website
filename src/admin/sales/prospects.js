// ============================================================================
// Digital Skyline OS — Sales / Outreach CRM shared constants & helpers.
// Used by the Sales Dashboard, Prospects, Pipeline, Follow-ups and Analytics
// modules. Mirrors the conventions in ../ops.js so the OS feels like one app.
// ============================================================================

import { fmtDate, fmtDateTime, num } from '../ops.js'

export { fmtDate, fmtDateTime, num }

// Prospect pipeline statuses. Order = left→right on the sales Pipeline board.
export const PROSPECT_STATUSES = [
  'New',
  'Contacted',
  'Follow-up',
  'Consultation',
  'Proposal',
  'Client',
  'Lost',
]

// Tailwind chip styles per status (premium dark + gold palette, matching ops).
export const PROSPECT_STATUS_STYLES = {
  'New': 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  'Contacted': 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  'Follow-up': 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  'Consultation': 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
  'Proposal': 'border-indigo-400/40 bg-indigo-400/10 text-indigo-200',
  'Client': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  'Lost': 'border-gray-400/30 bg-gray-400/10 text-gray-300',
}

export const prospectStatusStyle = (s) =>
  PROSPECT_STATUS_STYLES[s] || 'border-white/10 bg-white/[0.03] text-gray-200'

// Suggested industries (free-text inputs use these as a datalist; filters too).
export const INDUSTRIES = [
  'Plumbers',
  'HVAC',
  'Electricians',
  'Roofing',
  'Landscaping',
  'Contractors',
  'Cleaning',
  'Salons & Spas',
  'Fitness',
  'Restaurants & Food',
  'Automotive',
  'Real Estate',
  'Legal',
  'Health & Medical',
  'Dental',
  'Other',
]

// Where the prospect came from.
export const PROSPECT_SOURCES = [
  'Google Maps',
  'Google Search',
  'Instagram',
  'Facebook',
  'Referral',
  'Networking Event',
  'Cold Outreach',
  'Manual Entry',
  'Other',
]

// US states for the location dropdown.
export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC',
]

// Website score → colour band. A LOW score = a strong opportunity (their site
// needs work), so low scores are highlighted gold/amber, high scores muted.
export const scoreBand = (score) => {
  const n = Number(score)
  if (!Number.isFinite(n)) return { label: '—', cls: 'text-gray-500', bar: 'bg-white/10' }
  if (n < 40) return { label: `${n}`, cls: 'text-emerald-200', bar: 'bg-emerald-400/70' } // big opportunity
  if (n < 70) return { label: `${n}`, cls: 'text-amber-200', bar: 'bg-amber-400/70' }
  return { label: `${n}`, cls: 'text-gray-300', bar: 'bg-gray-400/60' }
}

// Star string for a Google rating (e.g. 4.6).
export const ratingStars = (rating) => {
  const n = Number(rating)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const full = Math.round(n)
  return `${'★'.repeat(full)}${'☆'.repeat(Math.max(0, 5 - full))}`
}

// A date is "due" if it is today or in the past (and the prospect isn't done).
export const isFollowUpDue = (p, today = new Date()) => {
  if (!p?.next_follow_up) return false
  if (p.status === 'Client' || p.status === 'Lost') return false
  const d = new Date(`${p.next_follow_up}T23:59:59`)
  return d.getTime() <= today.getTime()
}

export const sameDay = (iso, day = new Date()) => {
  if (!iso) return false
  const d = new Date(iso)
  return d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
}

// ISO (yyyy-mm-dd) for <input type="date"> values.
export const toISODate = (d) => {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${m}-${day}`
}

// Normalise a URL for display / linking (adds https:// if missing).
export const normalizeUrl = (url) => {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
