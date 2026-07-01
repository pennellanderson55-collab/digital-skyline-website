// ============================================================================
// Outreach AI — turns a Website Intelligence audit into ONE personalized
// outreach asset (cold email, follow-up, call script, DM, objections, or
// consultation questions) on demand. Server-only; the API key never reaches
// the browser.
//
// COST CONTROL: the prompt receives only the STRUCTURED audit findings the
// caller passes in — never raw website HTML. Low reasoning effort, tight token
// cap. One asset per call; nothing runs unless the user clicks Generate.
// ============================================================================
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.OUTREACH_MODEL || process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

export const OUTREACH_TYPES = ['cold_email', 'follow_up', 'call_script', 'dm', 'objections', 'consultation']

// Per-type instruction + whether a subject line is expected.
const TYPES = {
  cold_email: {
    label: 'Cold Email',
    subject: true,
    instruction:
      'Write a first-touch cold email to the business owner, in the FIRST PERSON ("I", never "we"). 90–150 words. Open with one specific, genuine observation about their website (use the biggest weakness or highest-ROI improvement). In one or two humble sentences, make clear I am an independent owner/founder building my name by helping local businesses directly — not a big studio or agency. Invite them to check out my site to see what is possible, and include the plain link https://digitalskylineco.com. End with a simple, low-pressure invitation to a free 15-minute consultation. Do NOT add a greeting line (one is added for you) or a signature. Plain text, no markdown.',
  },
  follow_up: {
    label: 'Short Follow-Up Email',
    subject: true,
    instruction:
      'Write a short, friendly follow-up email in the FIRST PERSON ("I", never "we"), assuming the first email got no reply. 45–80 words. Reference the original note lightly, add one small piece of value or a single relevant question, and gently remind them I am an independent founder helping local businesses (not a big studio). Invite them to take a look at https://digitalskylineco.com and offer a simple 15-minute consultation. Not pushy. Do NOT add a greeting or signature. Plain text, no markdown.',
  },
  call_script: {
    label: 'Cold Call Script',
    subject: false,
    instruction:
      'Write a natural cold call script the salesperson can read on a first call. Include: a one-line intro, a permission-based opener, 2–3 conversational talking points tied to the audit findings, and a soft close asking for a brief consultation. Use short labeled lines (Intro:, Opener:, Talking points:, Close:). Conversational, not robotic.',
  },
  dm: {
    label: 'Instagram / LinkedIn DM',
    subject: false,
    instruction:
      'Write a short, casual but professional direct message for Instagram or LinkedIn. 2–4 sentences, under 60 words. Friendly, specific to their business, one clear soft ask. No links, no hard pitch.',
  },
  objections: {
    label: 'Objection Responses',
    subject: false,
    instruction:
      'Write calm, honest responses to the 4 most likely objections from a small business owner (e.g. "I already have a website", "too expensive", "no time", "I get enough business"). Format as "Objection: ...\\nResponse: ..." pairs. Each response 1–2 sentences, reassuring and non-defensive. No pressure tactics.',
  },
  consultation: {
    label: 'Consultation Opener',
    subject: false,
    instruction:
      'Write a consultation opener: 1 warm opening line to start the meeting, then 5 smart discovery questions tailored to this business and its audit findings that uncover goals and pain points. Number the questions. Consultative, not salesy.',
  },
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: { type: 'string', description: 'Email subject line. Empty string for non-email types.' },
    body: { type: 'string', description: 'The full outreach copy, ready to paste. Plain text.' },
  },
  required: ['subject', 'body'],
}

const SYSTEM_PROMPT = `You write outreach on behalf of the founder of Digital Skyline Co. Digital Skyline is NOT a big agency, studio or team — it is one independent owner/founder who personally designs and builds websites, apps and business systems for local small businesses (Phoenix/Arizona and beyond), and is building his name by helping local businesses directly.

You are helping the founder reach out to a prospect after looking at the prospect's CURRENT website. Write copy that sounds like a real, thoughtful, individual person reaching out personally — not a company or a sales team.

Voice & identity:
- Write in the FIRST PERSON singular ("I", "my"), never "we", "our team" or "us". This is one person, not a studio.
- Be humble and personal: make clear (naturally, not braggy) that I am an independent owner/founder building my name by helping local businesses — not a big studio or agency.
- Tone: personal, humble, professional, and direct. Warm but not salesy.

Hard rules:
- Never spammy, never robotic, never overly technical, never corporate-sounding.
- NO exaggerated or fabricated promises. Never guarantee leads, sales, traffic, rankings or revenue. No "I guarantee you more leads."
- No fake claims, no invented statistics, no fake urgency, no manipulative pressure.
- Be specific to THIS business using the findings provided. Reference real details (their industry, city, rating/reviews, the actual opportunity).
- Keep it tight and natural. Write only the asset requested — no preamble, no notes, no explanation of what you wrote.
- When an asset is an email, use my real site link as plain text exactly as https://digitalskylineco.com (no markdown link syntax).

There are TWO modes — follow the one indicated in the prompt:
- WEBSITE AUDIT mode: the prospect HAS a website that was audited. Trust the detected signals; if a phone/CTA/form WAS detected, don't claim it's missing. If scan confidence is low, stay general about what's "missing."
- NO-WEBSITE mode: the prospect has NO website at all. NEVER mention website improvements, redesigns, audits, fixes, or problems with an existing site — they don't have one. Frame everything as the opportunity to establish their first professional online presence, turning their existing reputation (rating/reviews/word-of-mouth) into customers who find them online.`

function buildUserPrompt({ type, prospect = {}, audit = {}, noWebsite = null }) {
  const loc = [prospect.city, prospect.state].filter(Boolean).join(', ')

  // NO-WEBSITE mode — context is the deterministic opportunity analysis, NOT an
  // audit. Never reference an existing website.
  if (noWebsite) {
    const findings = {
      mode: 'NO-WEBSITE',
      has_website: false,
      business_name: prospect.business_name || 'the business',
      industry: prospect.industry || 'unknown',
      location: loc || 'unknown',
      google_rating: prospect.google_rating ?? null,
      google_reviews: prospect.google_reviews ?? null,
      opportunity_score: noWebsite.score ?? null,
      why_opportunity: noWebsite.why || null,
      recommended_package: noWebsite.recommended_package || null,
    }
    return `Mode: NO-WEBSITE (the prospect has NO website — never mention improving, fixing, or auditing a site).
Asset to write: ${TYPES[type].label}

${TYPES[type].instruction}

Prospect + opportunity findings (use these; do not invent others):
${JSON.stringify(findings, null, 2)}

Return JSON: { "subject": ${TYPES[type].subject ? '"<email subject>"' : '""'}, "body": "<the asset>" }.`
  }

  // WEBSITE AUDIT mode — STRUCTURED findings only, never the website HTML.
  const ai = audit.ai || {}
  const s = audit.signals || {}
  const findings = {
    mode: 'WEBSITE-AUDIT',
    has_website: true,
    business_name: prospect.business_name || 'the business',
    industry: prospect.industry || 'unknown',
    location: loc || 'unknown',
    website_score: audit.overall_score ?? 'n/a',
    biggest_strength: ai.biggest_strength || null,
    biggest_weakness: ai.biggest_weakness || null,
    highest_roi_improvement: ai.highest_roi_improvement || null,
    suggested_package: ai.suggested_package || null,
    detected: {
      phone: !!s.has_phone,
      cta: !!s.has_cta,
      booking_link: (s.booking_links || 0) > 0,
      contact_form: (s.forms || 0) > 0,
    },
    scan_confidence: s.confidence || 'high',
  }
  return `Mode: WEBSITE-AUDIT.
Asset to write: ${TYPES[type].label}

${TYPES[type].instruction}

Prospect + audit findings (use these; do not invent others):
${JSON.stringify(findings, null, 2)}

Return JSON: { "subject": ${TYPES[type].subject ? '"<email subject>"' : '""'}, "body": "<the asset>" }.`
}

// Generate N additional consultation discovery questions for an audit. Returns
// { questions: string[] } or { error }. Same cost discipline as outreach:
// structured findings only, low effort, tight cap.
const QUESTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: { type: 'array', items: { type: 'string' }, description: 'New discovery questions.' },
  },
  required: ['questions'],
}

export async function generateMoreQuestions({ prospect, audit, count = 5, existing = [] }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY not set' }

  const ai = audit?.ai || {}
  const findings = {
    business_name: prospect?.business_name || 'the business',
    industry: prospect?.industry || 'unknown',
    location: [prospect?.city, prospect?.state].filter(Boolean).join(', ') || 'unknown',
    website_score: audit?.overall_score ?? 'n/a',
    biggest_weakness: ai.biggest_weakness || null,
    highest_roi_improvement: ai.highest_roi_improvement || null,
    suggested_package: ai.suggested_package || null,
  }
  const client = new Anthropic({ apiKey })
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 800,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: QUESTIONS_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Write ${count} additional smart consultation discovery questions for this prospect — tailored to their business and audit findings, consultative, open-ended, and DIFFERENT from these already-asked questions:
${JSON.stringify(existing)}

Findings:
${JSON.stringify(findings, null, 2)}

Return JSON: { "questions": [${count} strings] }.` }],
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') return { error: 'AI declined.' }
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock?.text) return { error: 'AI returned no content.' }
  const out = JSON.parse(textBlock.text)
  return { questions: (out.questions || []).map((q) => String(q).trim()).filter(Boolean).slice(0, count) }
}

export async function generateOutreach({ type, prospect, audit, noWebsite }) {
  if (!OUTREACH_TYPES.includes(type)) {
    return { error: `Unknown outreach type: ${type}` }
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY not set' }

  const client = new Anthropic({ apiKey })
  // Low effort + modest token cap — outreach copy is short. Stream + finalMessage
  // so a slightly longer turn can't hit an HTTP timeout.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1200,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt({ type, prospect, audit, noWebsite }) }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') return { error: 'AI declined to write this outreach.' }

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock?.text) return { error: 'AI returned no content.' }

  const out = JSON.parse(textBlock.text)
  const subject = TYPES[type].subject ? (out.subject || '').trim() : ''
  return { type, subject, body: (out.body || '').trim(), model: MODEL }
}
