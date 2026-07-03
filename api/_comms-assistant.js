// ============================================================================
// Communications Assistant — the live LLM brain behind the right-hand chat.
//
// Given a natural-language instruction, the email currently in the composer,
// and everything the CRM knows about the recipient, it returns a structured
// action: EDIT the email in place, REPLY conversationally, or offer SUBJECT
// ideas. Server-only (ANTHROPIC_API_KEY never reaches the browser). Same cost
// discipline as _outreach.js: low effort, tight token cap, structured JSON out.
//
// Voice = Pernell Anderson, Digital Skyline Co. (first-person, honest, warm,
// never salesy). The client keeps a deterministic offline fallback, so this
// endpoint is an upgrade, not a hard dependency.
// ============================================================================
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.COMMS_MODEL || process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

export const ASSIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['edit', 'reply', 'subjects'], description: 'edit = rewrite the email; reply = just chat; subjects = propose subject lines.' },
    reply: { type: 'string', description: 'Short first-person chat message describing what you did (1–2 sentences).' },
    subject: { type: 'string', description: "The email's subject after your change. Empty if unchanged/na." },
    body: { type: 'string', description: 'The full email body after your change (plain text). Empty when action is reply/subjects.' },
    chips: { type: 'array', items: { type: 'string' }, description: 'When action=subjects, 3–5 subject line options. Otherwise empty.' },
  },
  required: ['action', 'reply', 'subject', 'body', 'chips'],
}

const SIGNATURE = [
  'Best,', '', 'Pernell Anderson', 'Founder', 'Digital Skyline Co.', 'https://digitalskylineco.com',
].join('\n')

const SYSTEM = `You are the writing assistant inside Digital Skyline Co.'s Communications hub. You write and edit emails AS Pernell Anderson — founder of Digital Skyline Co., an independent web developer and AI solutions builder in Arizona who builds websites, dashboards, automations and custom software for small businesses.

VOICE (always):
- First person singular ("I", never "we"/"our team"/"our agency"). Pernell is one independent person.
- Professional, friendly, confident, concise, genuinely helpful. Never spammy, pushy, desperate, or hypey.
- Plain text. No markdown headers, no emojis unless the user explicitly asks, no corporate buzzwords (revolutionary, leverage, cutting-edge, world-class, game-changing, synergy).
- Honest: never invent ratings, stats, or problems. Never promise guaranteed rankings/revenue/leads.

BUSINESS KNOWLEDGE you may use naturally when relevant:
- Services: custom websites (the client owns 100% of it — no lock-in), SEO & local search, automations & workflow software, dashboards & internal tools, web/mobile apps, maintenance & care plans.
- Differentiators: they own their site outright; fast, mobile-first, built to turn searches into booked jobs; a free, no-pressure 15-minute consultation is always on offer. Booking link: https://digitalskylineco.com/book
- Audience: Arizona small businesses (trades, dental, salons, real estate, restaurants, etc.).

HOW TO ACT on the instruction:
- If it asks to WRITE, REWRITE, SHORTEN, lengthen, change tone, add/mention something, fix grammar, translate, or turn notes into an email → action="edit". Return the COMPLETE updated subject + body. Preserve the reader's intent and any real facts already present. If the email is an outreach/first-touch or the body is empty, produce a full, ready-to-send email and end it with this exact signature:\n${SIGNATURE}\n  (Do not duplicate the signature if one is already present.)
- If it asks for SUBJECT LINES → action="subjects", put 3–5 options in chips, leave body empty.
- If it asks a question or wants an explanation/summary and no email edit is warranted → action="reply", leave subject/body empty.
- The "reply" field is your short chat note to Pernell about what you did — keep it to 1–2 sentences.

Use the recipient CONTEXT (business, package, stage, notes, reviews, project/invoice status, past emails) to make the email specific and correct. Never restate the raw context back like a report.`

function contextBlock(contact = {}, context = {}) {
  const c = {
    name: contact.name || null,
    business: contact.business || null,
    type: contact.kind || null,
    pipeline_stage: contact.stage || null,
    google_rating: contact.rating ?? null,
    website: contact.website ? 'has a website' : 'no website',
    website_package: context.package || null,
    project_stage: context.projectStage || null,
    invoice_status: context.invoiceStatus || null,
    last_ai_website_analysis: context.aiAnalysis || null,
    consultation_notes: context.consultationNotes || null,
    proposal: context.proposal || null,
    last_email_sent: context.lastEmail || null,
    last_reply_received: context.lastReply || null,
    notes: contact.notes || null,
  }
  return JSON.stringify(c, null, 2)
}

export async function runCommsAssistant({ instruction, email = {}, contact = {}, context = {} }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY not set' }
  if (!instruction?.trim()) return { error: 'No instruction provided.' }

  const client = new Anthropic({ apiKey })
  const user = `Recipient context (use it; do not repeat it verbatim):
${contextBlock(contact, context)}

Current email in the composer:
SUBJECT: ${email.subject || '(empty)'}
BODY:
${email.body || '(empty)'}

Instruction from Pernell: "${instruction}"

Return JSON per the schema. When action="edit", "body" must be the FULL updated email, not a diff.`

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2400,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ASSIST_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') return { error: 'AI declined this request.' }
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock?.text) return { error: 'AI returned no content.' }

  const out = JSON.parse(textBlock.text)
  return {
    action: out.action,
    reply: (out.reply || '').trim(),
    subject: (out.subject || '').trim(),
    body: (out.body || '').trim(),
    chips: Array.isArray(out.chips) ? out.chips.map((s) => String(s).trim()).filter(Boolean) : [],
    model: MODEL,
  }
}
