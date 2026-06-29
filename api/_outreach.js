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
      'Write a first-touch cold email to the business owner. 90–140 words. Open with one specific, genuine observation about their website (use the biggest weakness or highest-ROI improvement). Briefly say who Digital Skyline is and how the relevant package could help. End with a low-pressure ask for a short call. Plain text, no markdown.',
  },
  follow_up: {
    label: 'Short Follow-Up Email',
    subject: true,
    instruction:
      'Write a short, friendly follow-up email assuming the first email got no reply. 40–70 words. Reference the original note lightly, add one small piece of value or a single relevant question, and a soft call-to-action. Not pushy. Plain text, no markdown.',
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

const SYSTEM_PROMPT = `You write outreach for Digital Skyline Co., a premium web design & development studio that builds websites, apps and business systems for small and mid-sized businesses (Phoenix/Arizona and beyond).

You are helping a salesperson reach out to a prospect after auditing the prospect's CURRENT website. Write copy that sounds like a real, thoughtful human from a boutique studio — professional but conversational.

Hard rules:
- Tone: professional, warm, conversational. Never spammy, never robotic, never overly technical.
- NO exaggerated or fabricated promises. Never guarantee leads, sales, traffic, rankings or revenue. No "I guarantee you more leads."
- No fake claims, no invented statistics, no fake urgency, no manipulative pressure.
- Be specific to THIS business using the audit findings provided. Reference real details (their industry, city, the actual weakness/opportunity).
- Trust the detected signals. If a phone/CTA/booking form WAS detected, don't claim it's missing. If scan confidence is low, stay general and don't assert strong claims about what's missing.
- Keep it tight and natural. Write only the asset requested — no preamble, no notes, no explanation of what you wrote.`

function buildUserPrompt({ type, prospect = {}, audit = {} }) {
  const ai = audit.ai || {}
  const s = audit.signals || {}
  const loc = [prospect.city, prospect.state].filter(Boolean).join(', ')
  // STRUCTURED findings only — never the website HTML.
  const findings = {
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
  return `Asset to write: ${TYPES[type].label}

${TYPES[type].instruction}

Prospect + audit findings (use these; do not invent others):
${JSON.stringify(findings, null, 2)}

Return JSON: { "subject": ${TYPES[type].subject ? '"<email subject>"' : '""'}, "body": "<the asset>" }.`
}

export async function generateOutreach({ type, prospect, audit }) {
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
    messages: [{ role: 'user', content: buildUserPrompt({ type, prospect, audit }) }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') return { error: 'AI declined to write this outreach.' }

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock?.text) return { error: 'AI returned no content.' }

  const out = JSON.parse(textBlock.text)
  const subject = TYPES[type].subject ? (out.subject || '').trim() : ''
  return { type, subject, body: (out.body || '').trim(), model: MODEL }
}
