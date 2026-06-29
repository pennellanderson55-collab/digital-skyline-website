// ============================================================================
// Outreach AI — client orchestration + constants.
// Loads saved drafts, generates ONE asset on demand (only when the user clicks
// Generate), and persists drafts to Supabase under the authenticated session.
//
// COST: nothing here calls the AI on mount. /api/generate-outreach runs only
// from generateDraft(). Saved drafts are reused from Supabase — no re-spend.
// ============================================================================

// The six outreach assets, in display order. `subject: true` = email type.
export const OUTREACH_CARDS = [
  { type: 'cold_email',   label: 'Cold Email',             subject: true,  hint: 'First-touch email to the owner.' },
  { type: 'follow_up',    label: 'Follow-Up',              subject: true,  hint: 'Short nudge after no reply.' },
  { type: 'call_script',  label: 'Call Script',            subject: false, hint: 'Natural first-call script.' },
  { type: 'dm',           label: 'DM',                     subject: false, hint: 'Instagram / LinkedIn message.' },
  { type: 'objections',   label: 'Objections',             subject: false, hint: 'Honest replies to pushback.' },
  { type: 'consultation', label: 'Consultation Questions', subject: false, hint: 'Opener + discovery questions.' },
]

export const OUTREACH_STATUSES = ['Draft', 'Used', 'Archived']

export function outreachStatusStyle(status) {
  switch (status) {
    case 'Used': return 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200'
    case 'Archived': return 'border-white/10 bg-white/[0.04] text-gray-400'
    default: return 'border-gold-400/30 bg-gold-400/[0.06] text-gold-200' // Draft
  }
}

// Load every saved draft for a prospect (newest first). Best-effort.
export async function loadDrafts(supabase, prospectId) {
  if (!supabase || !prospectId) return []
  const { data, error } = await supabase
    .from('outreach_drafts')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      throw new Error('outreach_drafts table not found — run supabase/sprint3_outreach_drafts.sql.')
    }
    throw new Error(error.message)
  }
  return data || []
}

// Group all drafts by type (each list newest-first) for the Saved Drafts area.
export function groupByType(drafts) {
  const map = {}
  for (const d of drafts) (map[d.type] ||= []).push(d) // input already newest-first
  return map
}

// Generate ONE asset via the API. Returns { type, subject, body, model,
// generatedAt }. Does NOT save — caller decides whether to Save Draft.
export async function generateDraft({ type, prospect, audit }) {
  const res = await fetch('/api/generate-outreach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      prospect: {
        business_name: prospect?.business_name,
        industry: prospect?.industry,
        city: prospect?.city,
        state: prospect?.state,
      },
      // Structured findings only — never HTML.
      audit: audit
        ? { overall_score: audit.overall_score, ai: audit.ai, signals: audit.signals }
        : {},
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || `Generation failed (${res.status}).`)
  return data
}

// Persist a generated asset as a Draft. Returns the saved row.
export async function saveDraft(supabase, { prospect, audit, type, subject, body, model }) {
  const insert = {
    prospect_id: prospect.id,
    audit_id: audit?.id || null,
    type,
    subject: subject || null,
    body,
    tone: 'professional-conversational',
    status: 'Draft',
  }
  const { data, error } = await supabase.from('outreach_drafts').insert(insert).select().single()
  if (error) throw new Error(error.message)
  return data
}

// Update an existing draft (status change, mark used, edits). Returns the row.
export async function updateDraft(supabase, id, patch) {
  const { data, error } = await supabase.from('outreach_drafts').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

// Permanently delete a single draft by id (does not touch other drafts).
export async function deleteDraft(supabase, id) {
  const { error } = await supabase.from('outreach_drafts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
