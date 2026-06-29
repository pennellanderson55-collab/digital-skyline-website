// ============================================================================
// Outreach Sending — Sending Queue orchestration + constants.
//
// Workflow: Generate → Edit → Approve → Queue → Send. Generated drafts NEVER
// send automatically; only Approved drafts may be Queued; only the explicit
// Send action calls the (server-side, sandbox-aware) Resend route. Every state
// change persists to Supabase; nothing disappears.
// ============================================================================

// Queue states + color coding (Blue draft · Green approved · Gold queued ·
// Teal sent · Red failed · Gray archived).
export const QUEUE_STATES = ['Ready for Review', 'Approved', 'Queued', 'Sent', 'Failed', 'Archived']

export const queueStatusStyle = (s) => ({
  'Ready for Review': 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  'Approved': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  'Queued': 'border-gold-400/40 bg-gold-400/10 text-gold-200',
  'Sent': 'border-teal-400/40 bg-teal-400/10 text-teal-200',
  'Failed': 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  'Archived': 'border-gray-400/30 bg-gray-400/10 text-gray-300',
}[s] || 'border-white/10 bg-white/[0.03] text-gray-200')

const TYPE_LABELS = {
  cold_email: 'Cold Email', follow_up: 'Follow-Up', call_script: 'Call Script',
  dm: 'DM', objections: 'Objections', consultation: 'Consultation',
}
export const typeLabel = (t) => TYPE_LABELS[t] || t

// Only email-shaped, non-empty, recipient-bearing, non-archived drafts can send.
export const isSendable = (d) =>
  !!d && d.queue_status !== 'Archived' && !!(d.recipient_email || '').trim() &&
  !!(d.subject || '').trim() && !!(d.body || '').trim()

// Add N business days (skip Sat/Sun) to a date → yyyy-mm-dd.
export function addBusinessDays(from, n) {
  const d = new Date(from)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

// ── Supabase loaders ───────────────────────────────────────────────────────
// Load ALL drafts joined with their prospect (for the cross-prospect queue).
export async function loadQueue(supabase) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('outreach_drafts')
    .select('*, prospect:prospects(id,business_name,owner_name,email,status)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) throw new Error('outreach_drafts not found — run supabase/sprint3_outreach_drafts.sql.')
    if (/column .*queue_status.* does not exist/i.test(error.message)) throw new Error('Sending columns missing — run supabase/sprint5_outreach_sending.sql.')
    throw new Error(error.message)
  }
  return data || []
}

export async function patchDraft(supabase, id, patch) {
  const { data, error } = await supabase.from('outreach_drafts').update(patch).eq('id', id).select('*, prospect:prospects(id,business_name,owner_name,email,status)').single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteDraftRow(supabase, id) {
  const { error } = await supabase.from('outreach_drafts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// Snapshot the current subject/body into version history (called before edits).
export async function snapshotVersion(supabase, draft) {
  if (!supabase || !draft) return
  await supabase.from('outreach_draft_versions').insert({
    draft_id: draft.id, version: draft.version || 1, subject: draft.subject || null, body: draft.body || '',
  })
}

export async function loadVersions(supabase, draftId) {
  if (!supabase || !draftId) return []
  const { data } = await supabase.from('outreach_draft_versions').select('*').eq('draft_id', draftId).order('created_at', { ascending: false }).limit(50)
  return data || []
}

// Duplicate a draft back to Ready for Review (independent copy).
export async function duplicateDraft(supabase, draft) {
  const insert = {
    prospect_id: draft.prospect_id, audit_id: draft.audit_id || null, type: draft.type,
    subject: draft.subject, body: draft.body, tone: draft.tone, status: 'Draft',
    queue_status: 'Ready for Review', recipient_email: draft.recipient_email || null,
  }
  const { data, error } = await supabase.from('outreach_drafts').insert(insert).select('*, prospect:prospects(id,business_name,owner_name,email,status)').single()
  if (error) throw new Error(error.message)
  return data
}

// ── State transitions (persisted) ───────────────────────────────────────────
const nowISO = () => new Date().toISOString()

export const approve = (supabase, d) => patchDraft(supabase, d.id, { queue_status: 'Approved', approved_at: nowISO() })
export const unapprove = (supabase, d) => patchDraft(supabase, d.id, { queue_status: 'Ready for Review', approved_at: null, queued_at: null })
export const queue = (supabase, d) => patchDraft(supabase, d.id, { queue_status: 'Queued', queued_at: nowISO(), approved_at: d.approved_at || nowISO() })
export const archive = (supabase, d) => patchDraft(supabase, d.id, { queue_status: 'Archived', archived_from: d.queue_status })
export const restore = (supabase, d) => patchDraft(supabase, d.id, { queue_status: d.archived_from && d.archived_from !== 'Archived' ? d.archived_from : 'Ready for Review', archived_from: null })

export async function saveEdits(supabase, d, { subject, body, recipient_email }) {
  await snapshotVersion(supabase, d) // keep the pre-edit version
  return patchDraft(supabase, d.id, {
    subject: subject ?? d.subject, body: body ?? d.body,
    recipient_email: recipient_email ?? d.recipient_email,
    version: (d.version || 1) + 1, last_edited_at: nowISO(),
  })
}

// SEND one draft: server route (Resend, sandbox-aware), then persist result +
// advance the CRM. Returns { ok, draft, prospectPatch, sandbox } or throws.
export async function sendOne(supabase, draft, { onProspectUpdate } = {}) {
  if (!isSendable(draft)) throw new Error('Draft is not sendable (needs recipient, subject and body; not archived).')
  const prospect = draft.prospect || {}

  const res = await fetch('/api/send-outreach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft: { id: draft.id, subject: draft.subject, body: draft.body, recipient_email: draft.recipient_email || prospect.email },
      prospect: { id: prospect.id, business_name: prospect.business_name, owner_name: prospect.owner_name, email: prospect.email },
    }),
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok || !data.ok) {
    // Persist the failure so it shows in the queue.
    const failed = await patchDraft(supabase, draft.id, { queue_status: 'Failed', send_error: data.error || `Send failed (${res.status}).` })
    const err = new Error(data.error || `Send failed (${res.status}).`)
    err.draft = failed
    throw err
  }

  const updated = await patchDraft(supabase, draft.id, {
    queue_status: 'Sent', status: 'Used', sent_at: data.sentAt || nowISO(),
    resend_message_id: data.messageId || null, delivery_status: 'sent',
    sender_email: data.from || 'hello@digitalskylineco.com', sandboxed: !!data.sandbox, send_error: null,
  })

  // Advance CRM: status → Email Sent, stamp contact, set a follow-up reminder
  // (+3 business days) — we DO NOT auto-send it, just remind.
  const prospectPatch = {
    status: 'Email Sent',
    last_contacted: nowISO(),
    last_contacted_at: nowISO(),
    next_follow_up: addBusinessDays(new Date(), 3),
  }
  if (prospect.id && onProspectUpdate) await onProspectUpdate(prospect.id, prospectPatch)

  return { ok: true, draft: updated, prospectPatch, sandbox: !!data.sandbox }
}
