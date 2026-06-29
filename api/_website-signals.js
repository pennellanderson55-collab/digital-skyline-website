// ============================================================================
// Homepage signal collection + category scoring (deterministic, no AI).
//
// Detection is TEXT-AWARE: it reads the visible text and the visible text of
// buttons/links (not just CSS class names), so CTAs like "Book Your Service"
// and visible phone numbers are detected even when they aren't tel: links or
// don't carry a btn/cta class. Pure functions so the same HTML always yields
// the same signals → the same rule-based score (no PageSpeed/network variance).
// Homepage-only for Sprint 2 — no crawling.
// ============================================================================

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
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
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
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

// ── TEXT / ENTITY HELPERS ───────────────────────────────────────────────────
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'",
  '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&rsquo;': '’', '&lsquo;': '‘',
  '&hellip;': '…', '&#8217;': '’', '&#8211;': '–', '&#8212;': '—', '&middot;': '·',
}
function decodeEntities(s) {
  return s.replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => {
    if (ENTITIES[m] != null) return ENTITIES[m]
    const num = m.match(/^&#(\d+);$/)
    if (num) { try { return String.fromCharCode(parseInt(num[1], 10)) } catch { return m } }
    return m
  })
}
// Approximate visible page text: drop script/style/noscript/comments + tags.
function visibleText(html) {
  const t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(t).replace(/\s+/g, ' ').trim()
}
function stripInner(inner) {
  return decodeEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// Every clickable: <a>, <button>, and submit/button <input>. Captures the
// VISIBLE text, the href, and the raw attributes (for class/role checks).
function extractClickables(html) {
  const out = []
  let m
  const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  while ((m = aRe.exec(html))) out.push({ text: stripInner(m[2]), href: attr(m[1], 'href'), attrs: m[1] })
  const bRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi
  while ((m = bRe.exec(html))) out.push({ text: stripInner(m[2]), href: '', attrs: m[1] })
  const iRe = /<input\b([^>]*\btype\s*=\s*["'](?:submit|button)["'][^>]*)\/?>/gi
  while ((m = iRe.exec(html))) out.push({ text: decodeEntities(attr(m[1], 'value')).trim(), href: '', attrs: m[1] })
  return out
}
const attr = (attrs, name) => (attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1] || ''

// ── PHONE DETECTION ─────────────────────────────────────────────────────────
// Requires separators/parens so long digit runs (IDs, prices) don't match.
const PHONE_RE = /(?:\+?1[\s.\-]?)?(?:\(\d{3}\)|\d{3})[\s.\-]\d{3}[\s.\-]\d{4}/g
function normalizePhone(raw) {
  let d = String(raw).replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') d = d.slice(1)
  if (d.length !== 10) return null
  if (!/[2-9]/.test(d[0])) return null // valid US area codes start 2–9
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}
function uniquePush(arr, seen, v) { if (v && !seen.has(v)) { seen.add(v); arr.push(v) } }

// ── CTA DETECTION ───────────────────────────────────────────────────────────
const CTA_PHRASES = [
  'book your service', 'book service', 'schedule service', 'request service',
  'call now', 'call today', 'call us', 'get estimate', 'free estimate', 'get a free estimate',
  'request quote', 'request a quote', 'get a quote', 'get quote', 'free quote', 'get a free quote',
  'contact us', 'book now', 'book online', 'book appointment', 'schedule now', 'schedule online',
  'schedule appointment', 'request appointment', 'make an appointment', 'get started',
  'request a callback', 'get a callback', 'request service today',
]
// A clickable counts as a CTA if its (short) label reads like an action.
const CTA_WORD_RE = /\b(book|schedule|request|call|quote|estimate|appointment|consultation|get\s+started|sign\s?up|contact|reserve|order|get\s+a)\b/i
const BOOKING_HREF_RE = /(calendly|cal\.com|acuity|setmore|housecallpro|getjobber|jobber|servicetitan|squareup\.com\/appointments|book(ing)?|schedule|appointment|appt)/i
const QUOTE_RE = /(quote|estimate|request[-\s]?service|get[-\s]?a[-\s]?quote)/i
// Bot-wall / challenge markers — when the scanner is being blocked.
const BLOCK_RE = /(captcha|cf-browser-verification|cf-challenge|just a moment\.\.\.|attention required!|access denied|request unsuccessful|enable javascript (and cookies )?to (continue|view)|you have been blocked)/i
// SPA shells whose real content only appears after JS runs.
const SPA_RE = /(<div\s+id=["'](root|app|__next|__nuxt)["']|__NEXT_DATA__|window\.__NUXT__|data-reactroot|ng-version=)/i

// ── HOMEPAGE SIGNAL COLLECTION ──────────────────────────────────────────────
export async function collectSignals(inputUrl) {
  const url = normalizeUrl(inputUrl)
  const main = await fetchWithTimeout(url)
  // Only a hard failure with no body at all is unrecoverable. A 403/blocked
  // page WITH a body still gets scanned — and flagged as low confidence.
  if (!main.text) {
    return {
      ok: false,
      error: main.error || `Could not reach ${url} (status ${main.status})`,
      finalUrl: main.finalUrl,
    }
  }

  const finalUrl = main.finalUrl
  const origin = safeOrigin(finalUrl)

  // robots.txt + sitemap (cheap, never block the audit).
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

  const signals = extractSignals(main.text, {
    finalUrl,
    status: main.status,
    robotsTxt,
    sitemap,
  })
  return { ok: true, finalUrl, signals }
}

// PURE: derive every signal from the HTML. No network, no clock → deterministic.
// (robotsTxt/sitemap are passed in because they need separate requests.)
export function extractSignals(html, { finalUrl = '', status = 200, robotsTxt = false, sitemap = false } = {}) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0]
  const lower = html.toLowerCase()
  const https = finalUrl.startsWith('https://')
  const text = visibleText(html)
  const textLower = text.toLowerCase()

  // Clickables → CTA / phone / booking / quote detection from VISIBLE content.
  const clickables = extractClickables(html)
  const clickTexts = clickables.map((c) => c.text).filter(Boolean)

  // Phones: visible text + tel: hrefs.
  const phones = []
  const seenPhones = new Set()
  for (const m of text.matchAll(PHONE_RE)) uniquePush(phones, seenPhones, normalizePhone(m[0]))
  for (const c of clickables) {
    if (/^tel:/i.test(c.href)) uniquePush(phones, seenPhones, normalizePhone(c.href))
  }
  const tel_links = clickables.filter((c) => /^tel:/i.test(c.href)).length

  // CTA phrases present anywhere in visible text or in a button/link label.
  const haystack = `${textLower} ${clickTexts.join(' ').toLowerCase()}`
  const cta_phrases_found = CTA_PHRASES.filter((p) => haystack.includes(p))

  // CTA-like clickables: a short label that reads like an action, or an element
  // explicitly marked as a button (class btn/button/cta or role=button).
  const ctaButtons = clickables.filter((c) => {
    const t = c.text
    if (t && t.length <= 40 && CTA_WORD_RE.test(t)) return true
    if ((/\b(btn|button|cta)\b/i.test(c.attrs) || /role\s*=\s*["']button["']/i.test(c.attrs)) && t && t.length <= 40) return true
    return false
  })

  const booking_links = clickables.filter(
    (c) => BOOKING_HREF_RE.test(c.href) || /\b(book|schedule|appointment)\b/i.test(c.text),
  ).length
  const quote_links = clickables.filter(
    (c) => QUOTE_RE.test(c.href) || /\b(quote|estimate|request service)\b/i.test(c.text),
  ).length

  // Sample of the actual button/link labels we saw (for the raw-signals display).
  const buttons_found = []
  const seenBtn = new Set()
  for (const c of clickables) {
    const t = c.text
    if (t && t.length <= 40) uniquePush(buttons_found, seenBtn, t)
    if (buttons_found.length >= 12) break
  }

  const has_phone = phones.length > 0 || tel_links > 0
  const has_cta = ctaButtons.length > 0 || cta_phrases_found.length > 0 || booking_links > 0

  // Confidence — did we actually see a real, readable homepage?
  const blocked = status === 403 || status === 401 || status === 429 || BLOCK_RE.test(html)
  let blocked_reason = ''
  if (status === 403 || status === 401 || status === 429) blocked_reason = `HTTP ${status}`
  else if (BLOCK_RE.test(html)) blocked_reason = 'bot-challenge / access wall detected'
  const js_rendered_maybe_missing =
    (SPA_RE.test(html) && text.length < 1200) || (text.length < 500 && count(/<script\b/gi, html) > 0)

  let confidence = 'high'
  let confidence_reason = ''
  if (blocked) { confidence = 'low'; confidence_reason = `Scanner appears blocked (${blocked_reason || 'access wall'}).` }
  else if (status >= 400) { confidence = 'low'; confidence_reason = `Homepage returned HTTP ${status}.` }
  else if (js_rendered_maybe_missing) { confidence = 'low'; confidence_reason = 'Content is likely JavaScript-rendered; raw HTML may omit visible buttons/text.' }
  else if (text.length < 300) { confidence = 'low'; confidence_reason = 'Very little readable text was found on the page.' }

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
    https,
    status,
    final_url: finalUrl,
    page_bytes: html.length,
    visible_text_length: text.length,

    // Scan confidence
    blocked,
    blocked_reason: blocked_reason || null,
    js_rendered_maybe_missing,
    confidence,
    confidence_reason: confidence_reason || null,

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

    // Conversion — TEXT-AWARE
    forms: count(/<form\b/gi, html),
    email_links: count(/href=["']mailto:/gi, html),
    phone_links: tel_links, // back-compat: number of tel: links
    tel_links,
    phone_numbers_found: phones,
    has_phone,
    contact_links: count(/href=["'][^"']*contact[^"']*["']/gi, html),
    booking_links,
    quote_links,
    cta_phrases_found,
    cta_buttons: ctaButtons.length,
    buttons_found,
    has_cta,

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

    // Performance proxies (homepage-only, deterministic — no PageSpeed)
    script_tags: count(/<script\b/gi, html),
    stylesheet_links: count(/<link[^>]+rel=["']stylesheet["']/gi, head),
    inline_styles: count(/<style\b/gi, html),
    render_blocking_head_scripts: count(/<script\b(?![^>]*\b(async|defer|type=["']module["'])\b)[^>]*\bsrc=/gi, head),
  }
}

// ── SCORING ─────────────────────────────────────────────────────────────────
// Each category returns 0–100. Overall is a weighted average. Purely a function
// of the signals → identical signals always produce the identical score.
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))

export function scoreCategories(s) {
  // Performance — deterministic homepage heuristic (no external PageSpeed call).
  let p = 100
  if (s.page_bytes > 3_000_000) p -= 35
  else if (s.page_bytes > 1_500_000) p -= 22
  else if (s.page_bytes > 700_000) p -= 12
  p -= Math.min(20, s.render_blocking_head_scripts * 5)
  p -= Math.min(15, Math.max(0, s.script_tags - 10) * 1.2)
  p -= Math.min(10, Math.max(0, s.stylesheet_links - 4) * 2)
  if (s.images > 30) p -= 8
  const performance = clamp(p)

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

  // Conversion — uses the text-aware signals.
  let conversion = 0
  conversion += s.forms > 0 ? 20 : 0
  conversion += s.has_phone ? 18 : 0
  conversion += s.email_links > 0 ? 10 : 0
  conversion += s.booking_links > 0 ? 16 : 0
  conversion += s.quote_links > 0 ? 8 : 0
  conversion += s.contact_links > 0 ? 12 : 0
  conversion += s.has_cta ? 16 : s.cta_buttons > 0 ? 8 : 0

  // Trust
  let trust = 0
  trust += s.https ? 26 : 0
  trust += s.testimonials ? 24 : 0
  trust += s.social_count >= 2 ? 22 : s.social_count === 1 ? 11 : 0
  trust += s.faq ? 14 : 0
  trust += s.favicon ? 6 : 0
  trust += s.has_phone || s.contact_links > 0 ? 8 : 0

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

export function normalizeUrl(url) {
  const u = (url || '').trim()
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

function safeOrigin(url) {
  try { return new URL(url).origin } catch { return '' }
}
