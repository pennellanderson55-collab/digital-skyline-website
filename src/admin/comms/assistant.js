// ============================================================================
// Digital Skyline OS — Communications assistant engine.
//
// The "Jarvis" brain behind the right-hand panel + the top command bar. This is
// a deterministic, offline stand-in for a future LLM call: it interprets a
// natural-language instruction, and EITHER edits the current email in place
// (returning a new { subject, body }) OR replies conversationally (subject-line
// ideas, explanations). Every result carries a chat reply string so the panel
// always feels responsive. Swap `runAssistant` for a real model call later —
// the shape ({ reply, patch, chips, undo }) is what the UI consumes.
// ============================================================================

import { DS } from './data.js'

const words = (t) => t.trim().split(/\s+/).filter(Boolean)
const sentences = (t) => t.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.trim())

/* ── text transforms ─────────────────────────────────────────────────────── */
const CASUAL = [
  [/\bgonna\b/gi, 'going to'], [/\bwanna\b/gi, 'want to'], [/\bkinda\b/gi, 'somewhat'],
  [/\byeah\b/gi, 'yes'], [/\bhey\b/gi, 'Hi'], [/\bthanks!+/gi, 'Thank you'],
  [/\bASAP\b/g, 'at your earliest convenience'], [/\bguys\b/gi, 'team'], [/\bawesome\b/gi, 'excellent'],
]

const professional = (t) => {
  let out = t
  CASUAL.forEach(([re, to]) => { out = out.replace(re, to) })
  return out
}

const fixGrammar = (t) =>
  t
    .replace(/\s+([,.!?;:])/g, '$1')      // no space before punctuation
    .replace(/([,.!?;:])(?=[^\s\n])/g, '$1 ') // space after punctuation
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(^|[.!?]\s+|\n)([a-z])/g, (m, p, c) => p + c.toUpperCase()) // capitalize sentences
    .replace(/\bi\b/g, 'I')
    .trim()

const shorten = (t) => {
  const s = sentences(t)
  if (s.length <= 2) return t.trim()
  return s.slice(0, Math.max(2, Math.ceil(s.length / 2))).join(' ')
}

const underWords = (t, limit) => {
  const w = words(t)
  if (w.length <= limit) return t.trim()
  let out = w.slice(0, limit).join(' ')
  if (!/[.!?]$/.test(out)) out += '…'
  return out
}

// Insert a sentence just before the sign-off (blank line / signature) if we can.
const insertBeforeSignoff = (body, line) => {
  const parts = body.split(/\n\n/)
  if (parts.length >= 2) {
    parts.splice(parts.length - 1, 0, line)
    return parts.join('\n\n')
  }
  return `${body.trim()}\n\n${line}`
}

/* ── generators (build a fresh email from context) ───────────────────────── */
const named = (t, ctx) =>
  t.replace(/\{\{name\}\}/g, ctx.name || 'there')
    .replace(/\{\{business\}\}/g, ctx.business || 'your business')
    .replace(/\{\{region\}\}/g, DS.region)
    .replace(/\{\{booking\}\}/g, DS.booking)

const genFollowUp = (ctx) => ({
  subject: `Following up — ${ctx.business || 'your website'}`,
  body: named(
    "Hi {{name}},\n\nJust floating this back to the top of your inbox. I know things get busy — no pressure at all.\n\nWhenever it's useful, I'm happy to send over the preview or hop on a quick 15-minute call. You'd own 100% of whatever we build.\n\n" + DS.signature, ctx),
})

const genThankYou = (ctx) => ({
  subject: `Thank you, ${ctx.name || 'friend'}`,
  body: named(
    "Hi {{name}},\n\nJust a quick note to say thank you — it's genuinely a pleasure working with {{business}}. If anything ever comes up, big or small, I'm one email away.\n\n" + DS.signature, ctx),
})

const genUpdate = (ctx) => ({
  subject: `Project update — ${ctx.business || 'your project'}`,
  body: named(
    "Hi {{name}},\n\nQuick update on where things stand:\n\n• Design — approved and looking sharp\n• Build — in progress, on track\n• Launch — targeting this week\n\nI'll follow up the moment the next milestone is ready. Any questions, just reply here.\n\n" + DS.signature, ctx),
})

const genNotesToEmail = (ctx, notes) => ({
  subject: `Following up — ${ctx.business || 'quick note'}`,
  body: named(
    `Hi {{name}},\n\n${notes ? polishNotes(notes) : 'Wanted to put the key points from our conversation in one place:'}\n\nHappy to talk any of this through on a quick call.\n\n` + DS.signature, ctx),
})

const polishNotes = (notes) =>
  sentences(notes).map((s) => s.trim()).filter(Boolean).map((s) => `• ${s.replace(/[.]$/, '')}`).join('\n')

const genInvoice = (ctx) => ({
  subject: `Invoice for ${ctx.business || 'your project'}`,
  body: named(
    "Hi {{name}},\n\nYour invoice is ready — I've attached it here. You can pay securely online in a couple of clicks, and let me know if you'd like anything itemized differently.\n\nThank you for your business.\n\n" + DS.signature, ctx),
})

/* ── injected sentence snippets ──────────────────────────────────────────── */
const OWNERSHIP = 'One thing worth stressing: once your site is live, you own 100% of it — no lock-in, no rented platform.'
const CONSULT = "I'd also love to offer you a free, no-strings 15-minute consultation."
const CONSULT_LINK = `Grab a time that works for you here: ${DS.booking}`
const URGENCY = "I only take on a couple of new builds each month, so I wanted to reach out while I had room — no pressure either way."
const reviews = (ctx) =>
  `Your ${ctx.rating ? `${ctx.rating}★ ` : ''}Google reviews already show people love working with you — a stronger site just makes sure more of them find you first.`

/* ── subject-line ideas ──────────────────────────────────────────────────── */
const subjectIdeas = (ctx) => {
  const b = ctx.business || 'your business'
  return [
    `A faster website for ${b}`,
    `${ctx.name || 'Quick'} — 15 minutes to more customers?`,
    `Built ${b} a preview (you own it)`,
    `${b}: turning Google searches into booked jobs`,
    `Free consultation for ${b} this week?`,
  ]
}

/* ── the router ──────────────────────────────────────────────────────────── *
 * ctx: { name, business, rating, notes }  — contact intelligence for tone.
 * email: { subject, body }                — the composer's current content.
 * Returns { reply, patch?, chips?, undo? }.
 *  - patch  : new { subject, body } to apply to the composer.
 *  - chips  : array of strings to render as quick-insert options (subject ideas).
 *  - undo   : true when the change is reversible (UI offers Undo).
 */
export function runAssistant(instruction, { email = { subject: '', body: '' }, ctx = {} } = {}) {
  const q = instruction.toLowerCase().trim()
  const has = (...ks) => ks.some((k) => q.includes(k))
  const body = email.body || ''

  // ── generators ──────────────────────────────────────────────────────────
  if (has('follow-up', 'follow up', 'followup'))
    return { patch: genFollowUp(ctx), reply: 'Drafted a warm follow-up that stays low-pressure and reminds them they own the site.', undo: true }
  if (has('thank-you', 'thank you', 'thankyou'))
    return { patch: genThankYou(ctx), reply: 'Wrote a short, genuine thank-you note.', undo: true }
  if (has('project update', 'update email', 'create a project update'))
    return { patch: genUpdate(ctx), reply: 'Generated a clean project-update email — tweak the bullets to match this milestone.', undo: true }
  if (has('turn these notes', 'notes into', 'from these notes', 'turn notes'))
    return { patch: genNotesToEmail(ctx, ctx.notes), reply: 'Turned your notes into a structured email.', undo: true }
  if (has('invoice'))
    return { patch: genInvoice(ctx), reply: 'Drafted an invoice email. Attach the Stripe-linked invoice from Smart Attachments.', undo: true }

  // ── edits that need existing text ────────────────────────────────────────
  const needBody = () => ({ reply: "There's nothing in the email yet — start typing or ask me to draft one first." })
  if (!body.trim() && has('shorter', 'shorten', 'professional', 'grammar', 'under', 'tone', 'urgency', 'translate'))
    return needBody()

  if (has('shorter', 'shorten', 'trim', 'tighten'))
    return { patch: { ...email, body: shorten(body) }, reply: 'Tightened it up — cut it to the essentials.', undo: true }

  if (has('under 120', '120 words', 'under 100', 'concise', 'brief')) {
    const limit = q.includes('100') ? 100 : 120
    return { patch: { ...email, body: underWords(body, limit) }, reply: `Trimmed the email to under ${limit} words.`, undo: true }
  }

  if (has('professional', 'formal', 'polished'))
    return { patch: { ...email, body: professional(body) }, reply: 'Elevated the tone — more polished, still human.', undo: true }

  if (has('my tone', 'rewrite in my', 'sound like me'))
    return { patch: { ...email, body: professional(fixGrammar(body)) }, reply: "Rewrote it in your voice: professional, friendly, confident — never salesy.", undo: true }

  if (has('grammar', 'spelling', 'proofread', 'fix'))
    return { patch: { ...email, body: fixGrammar(body) }, reply: 'Cleaned up grammar, spacing and capitalization.', undo: true }

  if (has('own the website', 'own their website', 'own 100', 'ownership', 'they own'))
    return { patch: { ...email, body: insertBeforeSignoff(body, OWNERSHIP) }, reply: 'Added a line making clear they own 100% of their site.', undo: true }

  if (has('free consultation', 'consultation') && has('link', 'attach'))
    return { patch: { ...email, body: insertBeforeSignoff(body, `${CONSULT} ${CONSULT_LINK}`) }, reply: 'Added the free-consultation offer with your booking link.', undo: true }

  if (has('free consultation', 'mention.*consult', 'consultation'))
    return { patch: { ...email, body: insertBeforeSignoff(body, CONSULT) }, reply: 'Mentioned the free consultation.', undo: true }

  if (has('google review', 'reviews', 'rating'))
    return { patch: { ...email, body: insertBeforeSignoff(body, reviews(ctx)) }, reply: 'Referenced their Google reviews as social proof.', undo: true }

  if (has('urgency', 'urgent', 'scarcity'))
    return { patch: { ...email, body: insertBeforeSignoff(body, URGENCY) }, reply: 'Added gentle urgency — scarcity without the hard sell.', undo: true }

  if (has('subject line', 'subject lines', 'subjects', 'generate subject'))
    return { reply: 'Here are five subject lines — click one to use it:', chips: subjectIdeas(ctx) }

  if (has('translate')) {
    return { reply: 'Translation is coming online soon — I\'ll be able to send in Spanish, French and more. For now I kept your draft intact.' }
  }

  if (has('explain', 'summarize', 'summarise', 'proposal'))
    return { reply: 'I can summarize or explain any attached document once your knowledge base is connected. Attach the proposal and I\'ll break it down in plain English.' }

  // ── fallback: treat as a fresh draft brief ────────────────────────────────
  return {
    patch: genNotesToEmail(ctx, instruction),
    reply: 'Drafted an email from your request. Refine it with "make it shorter" or "sound more professional".',
    undo: true,
  }
}

/* ── command-bar parser ──────────────────────────────────────────────────── *
 * Interprets a Raycast-style command into a structured intent the page acts on.
 * Returns { kind, ...payload, label }. Kinds:
 *   compose  → { business? }        open a new email (optionally to a contact)
 *   attach   → { asset }            attach a smart asset
 *   assist   → { instruction }      run the assistant against the composer
 *   schedule → { when }             schedule the current draft
 *   bulk     → { days }             bulk follow-up action (placeholder)
 */
export function parseCommand(text) {
  const q = text.trim()
  const l = q.toLowerCase()
  if (!q) return null

  // Bulk follow-up: "follow up with everyone that hasn't replied in 10 days"
  const bulk = l.match(/follow[- ]?up.*?(\d+)\s*days?/)
  if (bulk || (l.includes('everyone') && l.includes('follow')))
    return { kind: 'bulk', days: bulk ? Number(bulk[1]) : 10, label: `Follow up with everyone silent ${bulk ? bulk[1] : 10}+ days` }

  // Schedule: "send next tuesday", "send tomorrow at 9"
  const sched = l.match(/\bsend\b.*(next \w+|tomorrow|monday|tuesday|wednesday|thursday|friday|today|later)/)
  if (sched) return { kind: 'schedule', when: capitalize(sched[1]), label: `Schedule send · ${capitalize(sched[1])}` }

  // Attach: "attach the latest demo video" / "attach the latest website preview"
  if (l.startsWith('attach') || l.includes('attach the')) {
    let asset = 'screenshot'
    if (l.includes('demo') || l.includes('video')) asset = 'demo'
    else if (l.includes('preview') || l.includes('screenshot') || l.includes('website')) asset = 'screenshot'
    else if (l.includes('proposal')) asset = 'proposal'
    else if (l.includes('contract')) asset = 'contract'
    else if (l.includes('invoice')) asset = 'invoice'
    else if (l.includes('consultation')) asset = 'consult-pdf'
    return { kind: 'attach', asset, label: `Attach ${asset.replace('-', ' ')}` }
  }

  // Invoice email generator
  if (l.includes('invoice') && (l.includes('email') || l.includes('generate')))
    return { kind: 'assist', instruction: 'generate an invoice email', label: 'Generate invoice email' }

  // Inline assistant instructions surfaced through the command bar
  if (l.startsWith('tell them') || l.startsWith('mention') || l.includes('own 100') || l.includes('free consultation') || l.includes('reference'))
    return { kind: 'assist', instruction: q, label: `AI · ${q}` }

  // Compose to a named business: "email Mario Plumbing about their homepage"
  const em = q.match(/^(?:email|write to|message|draft (?:an? )?email to)\s+(.+?)(?:\s+about\s+(.+))?$/i)
  if (em) return { kind: 'compose', business: em[1].trim(), about: em[2]?.trim(), label: `New email → ${em[1].trim()}` }

  // Default: treat as an assistant brief
  return { kind: 'assist', instruction: q, label: `AI · ${q}` }
}

const capitalize = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase())

/* ── live LLM bridge (with offline fallback) ─────────────────────────────── *
 * Calls the server-side Communications assistant (Claude) and normalizes its
 * structured response into the same { reply, patch?, chips?, undo? } shape the
 * UI already consumes. On ANY failure — no backend, no API key, network error —
 * it falls back to the deterministic offline engine above, so the assistant
 * always responds. `context` is the AI-context summary for the recipient. */
export async function assistRemote(instruction, { email = { subject: '', body: '' }, ctx = {}, contact = {}, context = {} } = {}) {
  try {
    const r = await fetch('/api/comms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'assistant', instruction, email, contact, context }),
    })
    if (r.ok) {
      const d = await r.json()
      if (d?.ok) return { ...normalizeRemote(d, email), remote: true }
    }
  } catch {
    /* fall through to offline engine */
  }
  return { ...runAssistant(instruction, { email, ctx }), remote: false }
}

// Map the server's { action, reply, subject, body, chips } to the UI shape.
function normalizeRemote(d, email) {
  if (d.action === 'subjects') return { reply: d.reply || 'Here are a few subject lines:', chips: d.chips || [] }
  if (d.action === 'edit' && (d.body || d.subject)) {
    return {
      reply: d.reply || 'Updated the email.',
      patch: { subject: d.subject || email.subject, body: d.body || email.body },
      undo: true,
    }
  }
  return { reply: d.reply || 'Done.' }
}
