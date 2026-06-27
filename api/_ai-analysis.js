// ============================================================================
// AI sales-intelligence layer. Turns the deterministic signals + scores into
// plain-English sales material via Claude (Opus 4.8, structured output).
//
// This is NOT a website grader — its job is to help close the sale: what to
// say, what it's worth, what to pitch. Server-only; the API key never reaches
// the browser. Degrades gracefully: if ANTHROPIC_API_KEY is unset, returns
// { ai: null } and the deterministic audit is still saved and shown.
// ============================================================================
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

const PACKAGES = ['Starter Website', 'Business Website', 'Custom Solutions', 'Maintenance']

// Structured-output schema — guarantees the 8 fields come back parseable.
// (No min/maxLength: structured outputs ignore string-length constraints.)
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executive_summary: { type: 'string', description: '2–3 sentence plain-English overview a salesperson can read aloud.' },
    biggest_strength: { type: 'string', description: 'The single strongest thing about their current site.' },
    biggest_weakness: { type: 'string', description: 'The single most important problem to fix.' },
    highest_roi_improvement: { type: 'string', description: 'The one change that would most improve their results, and why.' },
    sales_talking_points: {
      type: 'array',
      description: '3–5 concise, conversational points to use in an email, call, or consultation.',
      items: { type: 'string' },
    },
    estimated_business_impact: { type: 'string', description: 'Concrete, believable impact of fixing the issues (leads, calls, trust) — no invented hard numbers.' },
    suggested_package: { type: 'string', enum: PACKAGES, description: 'Which Digital Skyline package fits best.' },
    suggested_package_reason: { type: 'string', description: 'One sentence on why that package fits.' },
    follow_up_questions: {
      type: 'array',
      description: '3–5 smart questions to ask the prospect during the consultation.',
      items: { type: 'string' },
    },
  },
  required: [
    'executive_summary', 'biggest_strength', 'biggest_weakness', 'highest_roi_improvement',
    'sales_talking_points', 'estimated_business_impact', 'suggested_package',
    'suggested_package_reason', 'follow_up_questions',
  ],
}

const SYSTEM_PROMPT = `You are the Sales Intelligence engine for Digital Skyline Co., a premium web design & development studio that builds websites, apps, dashboards and business systems for small and mid-sized businesses (Phoenix/Arizona and beyond).

Your job is to help the Digital Skyline salesperson SELL a new or improved website to a prospect, using a homepage audit of the prospect's CURRENT site. You are not writing a generic SEO report and you are not talking to the prospect — you are briefing the salesperson in plain, confident English they can paste into an email, say on a call, or use in a consultation.

Rules:
- Be specific to THIS business and THIS audit data. Reference the actual findings (missing contact form, no mobile viewport, weak SEO, no testimonials, etc.).
- Lead with opportunity, not jargon. Translate technical gaps into business consequences (lost leads, looks untrustworthy, hard to find on Google, loses mobile visitors).
- Be honest but constructive — if the site is strong, say so and pitch enhancement/maintenance rather than a rebuild.
- Never invent hard statistics or fake numbers. Estimated impact should be qualitative or clearly framed as a general expectation.
- Keep every field tight and useful. Talking points and questions must sound human, not like a checklist.
- Packages: "Starter Website" (simple presence, very small biz), "Business Website" (multi-page, lead-gen, most SMBs), "Custom Solutions" (apps/portals/dashboards/automation), "Maintenance" (site is already good, ongoing care/optimization).`

function buildUserPrompt({ businessName, industry, url, signals, categoryScores, overallScore }) {
  return `Prospect: ${businessName || 'Unknown business'}${industry ? ` (${industry})` : ''}
Website analyzed: ${url}

Overall Website Score: ${overallScore}/100
Category scores (0–100): ${JSON.stringify(categoryScores)}

Collected homepage signals:
${JSON.stringify(signals, null, 2)}

Using ONLY this data, produce the sales-intelligence brief as structured JSON.`
}

export async function generateAiAnalysis(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ai: null, model: null, skipped: 'ANTHROPIC_API_KEY not set' }
  }

  const client = new Anthropic({ apiKey })
  // Stream + finalMessage so a longer adaptive-thinking turn can't hit an HTTP
  // timeout. Structured output guarantees the text block is schema-valid JSON.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  })

  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') {
    return { ai: null, model: MODEL, error: 'AI declined to analyze this request.' }
  }

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock?.text) return { ai: null, model: MODEL, error: 'AI returned no content.' }

  const ai = JSON.parse(textBlock.text)
  return { ai, model: MODEL }
}
