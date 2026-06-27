// ============================================================================
// Homepage signal collection + category scoring (deterministic, no AI).
// Pure functions so they're easy to test and reason about. Homepage-only for
// Sprint 2 — no crawling.
// ============================================================================

const UA = 'Mozilla/5.0 (compatible; DigitalSkylineBot/1.0; +https://digitalskylineco.com)'
const FETCH_TIMEOUT_MS = 12000

// Fetch a URL with a hard timeout. Returns { ok, status, text, finalUrl, error }.
async function fetchWithTimeout(url, { method = 'GET' } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    })
    const text = method === 'GET' ? await res.text() : ''
    return { ok: res.ok, status: res.status, text, finalUrl: res.url || url }
  } catch (e) {
    return { ok: false, status: 0, text: '', finalUrl: url, error: String(e?.message || e) }
  } finally {
    clearTimeout(t)
  }
}

const count = (re, html) => (html.match(re) || []).length
const has = (re, html) => re.test(html)
const firstGroup = (re, html) => {
  const m = html.match(re)
  return m ? (m[1] || '').trim() : ''
}

// ── HOMEPAGE SIGNAL COLLECTION ──────────────────────────────────────────────
export async function collectSignals(inputUrl) {
  const url = normalizeUrl(inputUrl)
  const main = await fetchWithTimeout(url)
  if (!main.ok && !main.text) {
    return { ok: false, error: main.error || `Could not reach ${url} (status ${main.status})`, finalUrl: main.finalUrl }
  }

  const html = main.text
  const finalUrl = main.finalUrl
  const https = finalUrl.startsWith('https://')
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0]
  const lower = html.toLowerCase()
  const origin = safeOrigin(finalUrl)

  // robots.txt + sitemap (separate cheap requests; never block the audit)
  let robotsTxt = false
  let sitemap = false
  if (origin) {
    const robots = await fetchWithTimeout(`${origin}/robots.txt`)
    robotsTxt = robots.ok && /user-agent/i.test(robots.text)
    if (robots.ok && /sitemap:/i.test(robots.text)) sitemap = true
    if (!sitemap) {
      const sm = await fetchWithTimeout(`${origin}/sitemap.xml`, { method: 'HEAD' })
      sitemap = sm.ok
    }
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) || []
  const imagesWithAlt = imgTags.filter((t) => /\balt\s*=\s*["'][^"']+["']/i.test(t)).length

  const socials = {
    facebook: /facebook\.com\//i.test(html),
    instagram: /instagram\.com\//i.test(html),
    twitter: /(twitter\.com|x\.com)\//i.test(html),
    linkedin: /linkedin\.com\//i.test(html),
    youtube: /(youtube\.com|youtu\.be)\//i.test(html),
    tiktok: /tiktok\.com\//i.test(html),
  }

  const title = firstGroup(/<title[^>]*>([\s\S]*?)<\/title>/i, html)
  const metaDescription = firstGroup(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i, head)
    || firstGroup(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i, head)

  return {
    ok: true,
    finalUrl,
    signals: {
      https,
      status: main.status,
      page_bytes: html.length,

      // SEO / head
      title,
      title_length: title.length,
      meta_description: metaDescription,
      meta_description_length: metaDescription.length,
      h1_count: count(/<h1\b/gi, html),
      h1_text: firstGroup(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html).replace(/<[^>]+>/g, '').trim().slice(0, 160),
      h2_count: count(/<h2\b/gi, html),
      viewport: has(/<meta[^>]+name=["']viewport["']/i, head),
      lang: firstGroup(/<html[^>]*\blang=["']([^"']+)["']/i, html),
      canonical: has(/<link[^>]+rel=["']canonical["']/i, head),
      robots_txt: robotsTxt,
      sitemap,
      open_graph_count: count(/<meta[^>]+property=["']og:[^"']+["']/gi, head),
      has_og_image: has(/<meta[^>]+property=["']og:image["']/i, head),
      twitter_card: has(/<meta[^>]+name=["']twitter:card["']/i, head),
      json_ld_count: count(/<script[^>]+type=["']application\/ld\+json["']/gi, html),
      favicon: has(/<link[^>]+rel=["'][^"']*icon[^"']*["']/i, head),

      // Conversion
      forms: count(/<form\b/gi, html),
      email_links: count(/href=["']mailto:/gi, html),
      phone_links: count(/href=["']tel:/gi, html),
      contact_links: count(/href=["'][^"']*contact[^"']*["']/gi, html),
      booking_links: count(/href=["'][^"']*(calendly|cal\.com|acuity|book|booking|schedule|appointment|setmore)[^"']*["']/gi, html),
      cta_buttons: count(/<(button|a)\b[^>]*(btn|button|cta)[^>]*>/gi, html),

      // Trust / content
      faq: /\bfaq\b/i.test(lower) || /frequently asked questions/i.test(lower),
      testimonials: /(testimonial|what our (clients|customers)|client reviews?|customer reviews?|5[\s-]?star)/i.test(lower),
      social_links: socials,
      social_count: Object.values(socials).filter(Boolean).length,

      // Media / branding
      images: imgTags.length,
      images_with_alt: imagesWithAlt,
      images_missing_alt: Math.max(0, imgTags.length - imagesWithAlt),
      video: has(/<video\b/i, html) || /(youtube\.com\/embed|player\.vimeo\.com|<iframe[^>]+(youtube|vimeo))/i.test(html),

      // Performance proxies (homepage-only; PageSpeed optional, see route)
      script_tags: count(/<script\b/gi, html),
      stylesheet_links: count(/<link[^>]+rel=["']stylesheet["']/gi, head),
      inline_styles: count(/<style\b/gi, html),
      render_blocking_head_scripts: count(/<script\b(?![^>]*\b(async|defer|type=["']module["'])\b)[^>]*\bsrc=/gi, head),
    },
  }
}

// ── SCORING ─────────────────────────────────────────────────────────────────
// Each category returns 0–100. Overall is a weighted average.
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))

export function scoreCategories(s, pageSpeed) {
  // Performance — use PageSpeed if provided, else a homepage heuristic.
  let performance
  if (pageSpeed != null) {
    performance = clamp(pageSpeed * 100)
  } else {
    let p = 100
    if (s.page_bytes > 3_000_000) p -= 35
    else if (s.page_bytes > 1_500_000) p -= 22
    else if (s.page_bytes > 700_000) p -= 12
    p -= Math.min(20, s.render_blocking_head_scripts * 5)
    p -= Math.min(15, Math.max(0, s.script_tags - 10) * 1.2)
    p -= Math.min(10, Math.max(0, s.stylesheet_links - 4) * 2)
    if (s.images > 30) p -= 8
    performance = clamp(p)
  }

  // SEO
  let seo = 0
  seo += s.title_length >= 10 && s.title_length <= 65 ? 18 : s.title ? 9 : 0
  seo += s.meta_description_length >= 50 && s.meta_description_length <= 165 ? 16 : s.meta_description ? 8 : 0
  seo += s.h1_count === 1 ? 14 : s.h1_count > 1 ? 7 : 0
  seo += s.h2_count >= 2 ? 8 : s.h2_count === 1 ? 4 : 0
  seo += s.canonical ? 8 : 0
  seo += s.sitemap ? 8 : 0
  seo += s.robots_txt ? 6 : 0
  seo += s.json_ld_count > 0 ? 12 : 0
  seo += s.open_graph_count >= 3 ? 6 : s.open_graph_count > 0 ? 3 : 0
  seo += s.lang ? 4 : 0

  // Conversion
  let conversion = 0
  conversion += s.forms > 0 ? 22 : 0
  conversion += s.phone_links > 0 ? 18 : 0
  conversion += s.email_links > 0 ? 12 : 0
  conversion += s.booking_links > 0 ? 18 : 0
  conversion += s.contact_links > 0 ? 14 : 0
  conversion += s.cta_buttons >= 3 ? 16 : s.cta_buttons > 0 ? 8 : 0

  // Trust
  let trust = 0
  trust += s.https ? 26 : 0
  trust += s.testimonials ? 24 : 0
  trust += s.social_count >= 2 ? 22 : s.social_count === 1 ? 11 : 0
  trust += s.faq ? 14 : 0
  trust += s.favicon ? 6 : 0
  trust += s.phone_links > 0 || s.contact_links > 0 ? 8 : 0

  // Branding
  let branding = 0
  branding += s.has_og_image ? 20 : 0
  branding += s.favicon ? 14 : 0
  branding += s.video ? 18 : 0
  branding += s.images >= 5 ? 18 : s.images > 0 ? 9 : 0
  branding += s.title && /[-|–—:]/.test(s.title) ? 14 : s.title ? 7 : 0 // brand + tagline pattern
  branding += s.open_graph_count >= 3 ? 16 : s.open_graph_count > 0 ? 8 : 0

  // Mobile UX
  let mobile = 0
  mobile += s.viewport ? 45 : 0
  mobile += s.images === 0 || s.images_missing_alt / Math.max(1, s.images) < 0.3 ? 20 : 8
  mobile += s.render_blocking_head_scripts <= 2 ? 15 : 5
  mobile += s.page_bytes < 1_500_000 ? 20 : s.page_bytes < 3_000_000 ? 10 : 0

  const category_scores = {
    performance: clamp(performance),
    seo: clamp(seo),
    conversion: clamp(conversion),
    trust: clamp(trust),
    branding: clamp(branding),
    mobile_ux: clamp(mobile),
  }

  // Weighted overall — conversion + performance matter most for selling websites.
  const w = { performance: 0.2, seo: 0.2, conversion: 0.22, trust: 0.16, branding: 0.1, mobile_ux: 0.12 }
  const overall = clamp(
    Object.entries(w).reduce((sum, [k, weight]) => sum + category_scores[k] * weight, 0),
  )

  return { category_scores, overall }
}

// Optional PageSpeed Insights (only if PAGESPEED_API_KEY is set). Returns the
// 0–1 performance score, or null on any failure (heuristic fallback applies).
export async function tryPageSpeed(url) {
  const key = process.env.PAGESPEED_API_KEY
  if (!key) return null
  try {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&category=performance&url=${encodeURIComponent(url)}&key=${key}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(api, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    const score = data?.lighthouseResult?.categories?.performance?.score
    return typeof score === 'number' ? score : null
  } catch {
    return null
  }
}

export function normalizeUrl(url) {
  const u = (url || '').trim()
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

function safeOrigin(url) {
  try { return new URL(url).origin } catch { return '' }
}
