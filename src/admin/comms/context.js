// ============================================================================
// AI Context loader — assembles everything the assistant (and the AI Context
// drawer) knows about the person being emailed.
//
// Pulls from the CRM the app already has (contact + projects) and enriches it,
// best-effort, from Supabase: latest AI website analysis, consultation notes,
// proposal/invoice status, project progress, and the last email sent / reply
// received (from comms_messages). Every query is guarded — a missing table or a
// null client just yields a partial context, never an error. Works with
// supabase=null (returns the derived-only context) so the demo harness renders.
// ============================================================================

// Pipeline/project stage → rough completion %, for the progress bar.
const STAGE_PROGRESS = {
  'New Lead': 5, 'Website Audited': 12, 'Analyzed': 16, 'Outreach Started': 20, 'Outreach Generated': 24,
  'Contacted': 30, 'Approved': 34, 'Queued': 36, 'Email Sent': 38, 'Follow-up Scheduled': 42,
  'Consultation Booked': 48, 'Consultation Scheduled': 50, 'Consultation Completed': 58,
  'Proposal Sent': 64, 'Negotiating': 70, 'Won': 80, 'Client': 82,
  // project stages
  'Lead': 10, 'Discovery': 40, 'Design': 55, 'Build': 70, 'Development': 70, 'Review': 82,
  'Launch': 92, 'Completed': 100, 'Maintenance': 100, 'Lost': 0,
}

const fmtDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const money = (n) => (n == null || n === '' ? null : `$${Number(n).toLocaleString()}`)

function invoiceStatusOf(project) {
  if (!project) return null
  if (project.paid_in_full || project.final_invoice_paid) return 'Paid in full'
  if (project.stripe_invoice_status) return `Invoice ${project.stripe_invoice_status}`
  const paid = Number(project.amount_paid || 0)
  const total = Number(project.total_price || 0)
  if (total > 0 && paid > 0 && paid < total) return `Partially paid — ${money(paid)} of ${money(total)}`
  if (total > 0 && paid === 0) return `Unpaid — ${money(total)} due`
  if (project.final_invoice_sent) return 'Invoice sent'
  return null
}

function summarizeAI(ai, score) {
  if (!ai || typeof ai !== 'object') return null
  const bits = []
  if (score != null) bits.push(`Site scored ${score}/100`)
  if (ai.biggest_strength) bits.push(`Strength: ${ai.biggest_strength}`)
  if (ai.biggest_weakness) bits.push(`Weakness: ${ai.biggest_weakness}`)
  if (ai.highest_roi_improvement) bits.push(`Best fix: ${ai.highest_roi_improvement}`)
  if (ai.suggested_package) bits.push(`Suggested: ${ai.suggested_package}`)
  return bits.length ? bits.join(' · ') : null
}

// Base context from data already in memory (no network). Always available.
export function deriveContext(contact = {}) {
  const proj = contact.project || null
  const stage = contact.projectStage || contact.stage
  return {
    name: contact.name || null,
    business: contact.business || null,
    package: contact.projectType || null,
    projectStage: contact.projectStage || null,
    progress: STAGE_PROGRESS[stage] ?? null,
    invoiceStatus: invoiceStatusOf(proj),
    projectRef: contact.projectRef || null,
    aiAnalysis: null,
    aiScores: null,
    consultationNotes: null,
    proposal: contact.proposalSentAt ? `Sent ${fmtDate(contact.proposalSentAt)}` : null,
    conversations: 0,
    lastEmail: null,
    lastReply: null,
    loading: false,
  }
}

// Full context — derive first, then enrich from Supabase where possible.
export async function loadContactContext(supabase, contact = {}, { signal } = {}) {
  const base = deriveContext(contact)
  if (!supabase) return base
  const email = (contact.email || '').trim()

  const tasks = []

  // Latest AI website analysis (prospects only carry audits today).
  if (contact.prospectId) {
    tasks.push(
      supabase.from('website_audits').select('overall_score, category_scores, ai, created_at')
        .eq('prospect_id', contact.prospectId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => {
          if (data) {
            base.aiAnalysis = summarizeAI(data.ai, data.overall_score)
            base.aiScores = { overall: data.overall_score, ...(data.category_scores || {}) }
          }
        }).catch(() => {}),
    )
    // Previous conversations / drafts for this prospect.
    tasks.push(
      supabase.from('outreach_drafts').select('id, created_at', { count: 'exact', head: false })
        .eq('prospect_id', contact.prospectId).order('created_at', { ascending: false })
        .then(({ data }) => { if (data) base.conversations += data.length }).catch(() => {}),
    )
  }

  // Consultation notes (matched by email).
  if (email) {
    tasks.push(
      supabase.from('consultations').select('notes, admin_notes, status, date')
        .eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => {
          if (data) base.consultationNotes = (data.admin_notes || data.notes || '').trim() || null
        }).catch(() => {}),
    )
    // Last email sent + last reply from the comms log.
    tasks.push(
      supabase.from('comms_messages').select('subject, sent_at, created_at, direction, folder')
        .eq('contact_email', email).order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => {
          if (!data) return
          base.conversations += data.length
          const sent = data.find((m) => m.direction === 'outbound' && m.folder === 'sent')
          const reply = data.find((m) => m.direction === 'inbound')
          if (sent) base.lastEmail = { subject: sent.subject, at: sent.sent_at || sent.created_at }
          if (reply) base.lastReply = { subject: reply.subject, at: reply.created_at }
        }).catch(() => {}),
    )
  }

  await Promise.allSettled(tasks)
  if (signal?.aborted) return base
  return base
}
