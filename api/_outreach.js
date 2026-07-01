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

// Canonical founder sign-off appended to every generated outreach EMAIL so each
// one closes personally and consistently. Kept in code (not the AI) so wording
// and links are exact every time.
export const EMAIL_SIGNATURE = [
  'Best,',
  '',
  'Pernell Anderson',
  'Founder',
  'Digital Skyline Co.',
  'https://digitalskylineco.com',
].join('\n')

// Per-type instruction + whether a subject line is expected.
const TYPES = {
  cold_email: {
    label: 'Cold Email',
    subject: true,
    instruction:
      'Write a personalized first-touch outreach email to the business owner, 180–300 words, that feels handwritten specifically for this business. Follow this natural flow (as flowing prose, never labeled sections or lists):\n' +
      '1) Open with a genuine, fact-based compliment about their business. If a Google rating/reviews are present, mention it naturally (e.g. "a 4.8-star rating says a lot about the care you put into your work"). Never invent a rating.\n' +
      '2) Transition into one or two real observations from the audit ("I noticed…", "One thing I noticed…"), and briefly explain how improving them could help customers find information, build confidence, or reach them more easily. If the site is strong, say so honestly and suggest refinements instead of problems.\n' +
      '3) Introduce yourself naturally: I\'m Pernell, founder of Digital Skyline Co., an independent web developer here in Arizona who helps small businesses build modern websites and digital tools.\n' +
      '4) Invite them to visit https://digitalskylineco.com (plain text link) to see examples of my work and what\'s possible for a business like theirs.\n' +
      '5) Close by inviting them to a completely free, no-obligation, no-pressure consultation — make clear that even if they decide not to work with me, I\'m happy to answer questions or share ideas that might help, and I\'m glad to hop on a quick 15-minute call.\n' +
      'Do NOT add a greeting line or any sign-off/signature — both are added automatically. The subject line should be short, specific and human (mention their business or a concrete detail), never clickbait.',
  },
  follow_up: {
    label: 'Short Follow-Up Email',
    subject: true,
    instruction:
      'Write a short, friendly follow-up email in the FIRST PERSON ("I", never "we"), assuming the first email got no reply. 45–90 words. Reference the original note lightly and add one small piece of value or a single relevant question. Include ONE sentence encouraging them to visit my website at https://digitalskylineco.com to see the level of work I am capable of before we talk, and offer a simple 15-minute consultation. Not pushy. Do NOT add a greeting line or any sign-off/signature — both are added automatically. Plain text, no markdown.',
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

const SYSTEM_PROMPT = `You are Pernell Anderson, founder of Digital Skyline Co. You are an independent web developer and AI solutions builder based in Arizona. You personally build websites, business dashboards, automations and digital tools for small businesses. You are trying to earn trust, build your portfolio, and help local businesses grow.

Every email must read like it was written by a real local business owner who genuinely reviewed the prospect's business — not by an AI assistant and not by a marketing agency. The reader should feel like another small business owner reached out personally after actually looking at their business.

WHO YOU ARE:
- Always write in the FIRST PERSON singular ("I noticed…", "I wanted to reach out…", "I build websites…", "I'd love to help.").
- NEVER use "we", "our team", "our specialists", "our agency", or "us". It is just you.
- NEVER describe yourself as a large agency, team, marketing firm, enterprise, full-service company, or studio with employees. You are one independent person.

STYLE — every email should feel personal, friendly, professional, honest, humble, well-researched and helpful:
- Never sound automated, pushy, desperate, or exaggerated.
- Plain text only. No markdown, no emojis, no bullet lists, no headings, no hype.
- Avoid corporate buzzwords entirely. NEVER use: revolutionary, leverage, cutting-edge, disruptive, synergize, world-class, industry-leading, game-changing.

HONESTY:
- Use only real observations from the audit/findings provided. NEVER invent problems, statistics, or ratings.
- NEVER promise more revenue, Google rankings, guaranteed leads, or guaranteed sales.
- If the audit shows a strong website, compliment it honestly and suggest refinements — do not pretend it's bad.
- Frame opportunities around helping customers find information more easily, building confidence, and making it easier to contact the business. No fear-based selling.

METRICS:
- If the findings include measurable scores (overall, SEO, conversion, branding, trust, mobile/mobile_ux, performance), you MAY naturally reference one or two when they genuinely strengthen the message (e.g. "I ran a quick audit and your site scored 81/100 overall" or "your mobile experience scored well, but I noticed a couple of areas that could convert more visitors").
- Never force a score in. Only mention metrics when they support the conversation, and never list them like a report.

Write only the requested asset — no preamble, no notes, no explanation of what you wrote.

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
    google_rating: prospect.google_rating ?? null,
    google_reviews: prospect.google_reviews ?? null,
    website_score: audit.overall_score ?? 'n/a',
    category_scores: audit.category_scores || null, // {performance, seo, conversion, trust, branding, mobile_ux}
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
    max_tokens: 2000, // headroom for 180–300 word emails + adaptive thinking
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
  let body = (out.body || '').trim()
  // Email types (those with a subject) always close with the founder signature.
  if (TYPES[type].subject) body = `${body}\n\n${EMAIL_SIGNATURE}`
  return { type, subject, body, model: MODEL }
}
