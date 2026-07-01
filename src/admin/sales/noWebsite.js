// ============================================================================
// No Website Mode — deterministic "opportunity" analysis for prospects that
// have no website. No AI, no network: computed instantly from the prospect's
// own fields, so Lead Finder leads (often website-less) enter this workflow the
// moment they're added. Also the context Outreach AI uses instead of an audit.
// ============================================================================

// A prospect is in No Website mode when the website field is empty/blank.
export const hasWebsite = (p) => !!(p && typeof p.website === 'string' && p.website.trim())

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))

// Opportunity score (0–100, higher = bigger/easier opportunity). A business
// with a strong reputation but NO website is the prime case: established demand,
// nothing online to capture it.
export function opportunityScore(p) {
  const reviews = Number(p?.google_reviews) || 0
  const rating = Number(p?.google_rating) || 0
  let s = 55 // baseline: having no website is itself an opportunity
  if (reviews >= 100) s += 20
  else if (reviews >= 30) s += 14
  else if (reviews >= 5) s += 8
  if (rating >= 4.5) s += 18
  else if (rating >= 4.0) s += 12
  else if (rating > 0) s += 6
  return clamp(s)
}

// Recommended Digital Skyline package for a website-less prospect.
export function recommendedPackage(p) {
  const reviews = Number(p?.google_reviews) || 0
  const rating = Number(p?.google_rating) || 0
  if (reviews >= 50 || rating >= 4.5) {
    return { name: 'Business Website', reason: 'Established reputation — a multi-page, lead-generating site to convert the demand they already earn.' }
  }
  return { name: 'Starter Website', reason: 'Get them online fast with a clean, professional presence they can grow from.' }
}

// Full deterministic opportunity brief used by the panel AND by Outreach AI.
export function buildNoWebsiteOpportunity(p = {}) {
  const name = p.business_name || 'This business'
  const industry = p.industry || ''
  const loc = [p.city, p.state].filter(Boolean).join(', ')
  const reviews = Number(p.google_reviews) || 0
  const rating = Number(p.google_rating) || 0

  const ratingPart = rating ? `a ${rating}★ rating` : 'a solid local reputation'
  const reviewsPart = reviews ? ` from ${reviews} reviews` : ''
  const score = opportunityScore(p)
  const pkg = recommendedPackage(p)

  const why =
    `${name}${industry ? ` is a ${industry} business` : ''}${loc ? ` in ${loc}` : ''} with ${ratingPart}${reviewsPart} — but no website. ` +
    `They're winning customers on reputation alone, while everyone who searches for them online finds nothing (or finds a competitor). ` +
    `A professional website turns that existing reputation into calls, bookings and trust they're currently leaving on the table.`

  const talkingPoints = [
    reviews || rating
      ? `You've clearly earned trust${rating ? ` — ${rating}★${reviews ? ` from ${reviews} reviews` : ''}` : ''} — but there's nothing online to capture the people who look you up before they call.`
      : `You've built a real local reputation — but there's nothing online to capture the people who look you up before they call.`,
    `More and more customers check for a website before reaching out; not having one quietly sends that business to competitors.`,
    `We can get ${name} online quickly with a site that shows your services, highlights your reputation, and makes it easy to call or book.`,
    `A clean, professional site pays for itself by converting searches you're already getting into paying customers.`,
  ]

  const consultationQuestions = [
    `How are most of your customers finding you today?`,
    `Have you ever missed business because someone couldn't find you online?`,
    `Would you want customers to be able to request a quote or book directly online?`,
    `What's the first thing you'd want a new customer to know when they find ${name}?`,
    `Are there competitors whose online presence you've noticed or worried about?`,
  ]

  return {
    website_status: 'No Website Detected',
    score,
    why,
    recommended_package: pkg.name,
    recommended_package_reason: pkg.reason,
    talking_points: talkingPoints,
    consultation_questions: consultationQuestions,
  }
}
