// ============================================================================
// Mail provider adapter — Resend (primary OUTBOUND sender).
//
// Implements the provider interface consumed by ../_mail/registry.js. Sends
// branded HTML from a verified business address (hello@digitalskylineco.com)
// via the Resend REST API — no SDK dependency, key stays server-side.
//
// Capabilities: outbound only. Inbox/sync is delegated to a provider that
// supports it (Gmail). The rest of the app never imports this file directly —
// it goes through the registry so providers stay swappable.
// ============================================================================

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const BUSINESS_DOMAIN = 'digitalskylineco.com'

const FROM_DEFAULT = process.env.EMAIL_FROM || process.env.OUTREACH_FROM_EMAIL || 'Digital Skyline Co. <hello@digitalskylineco.com>'
const REPLY_TO_DEFAULT = process.env.EMAIL_REPLY_TO || process.env.OUTREACH_REPLY_TO || 'hello@digitalskylineco.com'

export const id = 'resend'
export const capabilities = { outbound: true, inbox: false, sync: false }
export const isConfigured = () => !!process.env.RESEND_API_KEY

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BTN = 'display:inline-block;margin:6px 0;padding:12px 20px;background:linear-gradient(135deg,#e3bf6a,#a87f22);color:#1a1a1a;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px'
const CHIP = 'display:inline-block;margin:4px 8px 4px 0;padding:8px 14px;border:1px solid #e6e0cf;border-radius:8px;color:#7d5d17;text-decoration:none;font-size:13px'

// Render a single line of body text to HTML: markdown links → styled buttons,
// bare URLs → anchors, everything escaped.
function renderInline(line) {
  // [label](url) → a gold CTA button. The button is the ONLY clickable element —
  // no raw URL is printed underneath (the href lives on the button itself), so
  // the branded preview link is all the client ever sees.
  let out = esc(line).replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label, url) => `<a href="${url}" style="${BTN}">${label}</a>`,
  )
  // Bare URLs that aren't already inside an href.
  out = out.replace(/(^|[^"=>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" style="color:#a87f22;text-decoration:underline">$2</a>')
  return out
}

// Render one paragraph-block: consecutive quote lines ("> …") group into a
// clean blockquote (so reply history never looks like an ugly wall of >), the
// "… wrote:" attribution line is muted, everything else is a normal paragraph.
function renderBlock(block) {
  const lines = block.split('\n')
  const out = []
  let normal = []
  let quote = []
  const flushNormal = () => { if (normal.length) { out.push(`<p style="margin:0 0 16px;line-height:1.6">${normal.map(renderLine).join('<br>')}</p>`); normal = [] } }
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote style="margin:12px 0 0;padding:8px 0 8px 14px;border-left:3px solid #e6e0cf;color:#8a8577;font-size:13px">${quote.map((l) => renderInline(l.replace(/^\s*>\s?/, ''))).join('<br>')}</blockquote>`); quote = [] } }
  for (const l of lines) {
    if (/^\s*>/.test(l)) { flushNormal(); quote.push(l) }
    else { flushQuote(); normal.push(l) }
  }
  flushQuote(); flushNormal()
  return out.join('')
}
// A "… wrote:" attribution line is muted so it reads as a quote header.
const renderLine = (l) => /wrote:\s*$/.test(l)
  ? `<span style="color:#8a8577;font-size:13px">${renderInline(l)}</span>`
  : renderInline(l)

// Turn a plain-text body into branded HTML: paragraphs, quoted reply history
// (lines starting with "> ") into a clean collapsed blockquote, markdown link
// buttons, and hosted attachments (images inline, files as buttons — never a
// raw video attachment).
function toHtml({ body, attachments = [] }) {
  const blocks = String(body || '').split(/\n{2,}/).map(renderBlock).join('')

  // Footer attachments = hosted FILES only (pdf/doc/contract). Videos and images
  // are represented by their in-body CTA buttons (the composer inserts a
  // "View Website Preview Video" / "…Photo N" link), so they're skipped here to
  // avoid duplicates — and images are NEVER embedded inline (they render as a
  // broken image/❓ in Gmail).
  const attachHtml = attachments
    .filter((a) => a.url && a.kind !== 'video' && a.kind !== 'image')
    .map((a) => `<a href="${esc(a.url)}" style="${CHIP}">📎 ${esc(a.label || 'Attachment')}</a>`).join('')

  return `<!doctype html><html><body style="margin:0;background:#f7f5ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #ece7da">
      ${blocks}
      ${attachHtml ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">${attachHtml}</div>` : ''}
    </div>
    <p style="text-align:center;color:#9a927e;font-size:12px;margin:20px 0 0">Digital Skyline Co. · digitalskylineco.com</p>
  </div></body></html>`
}

// Plain-text fallback: strip markdown link syntax to "label: url" so text-only
// clients show something clean rather than "[label](url)".
function toText(body = '') {
  return String(body).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2')
}

// msg: { from?, to, cc?, bcc?, replyTo?, subject, body, html?, attachments? }
// Returns { ok, id } or throws.
export async function send(msg) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  const from = msg.from || FROM_DEFAULT
  if (!from.includes(BUSINESS_DOMAIN)) throw new Error('Refusing to send: From must be a digitalskylineco.com address')
  const to = Array.isArray(msg.to) ? msg.to : String(msg.to || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!to.length || !to.every((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))) throw new Error('Invalid or missing recipient')
  if (!msg.subject?.trim()) throw new Error('Missing subject')
  if (!msg.body?.trim() && !msg.html) throw new Error('Empty message')

  const payload = {
    from,
    to,
    reply_to: msg.replyTo || REPLY_TO_DEFAULT,
    subject: msg.subject,
    html: msg.html || toHtml(msg),
    text: toText(msg.body) || undefined,
  }
  const cc = splitAddr(msg.cc); if (cc.length) payload.cc = cc
  const bcc = splitAddr(msg.bcc); if (bcc.length) payload.bcc = bcc
  // Raw byte attachments are ONLY for small, non-video files that carry base64
  // `content`. Videos are NEVER attached — they're hosted and linked (kind !=
  // 'video' guard). URL assets are surfaced as buttons/inline images in the HTML.
  const files = (msg.attachments || [])
    .filter((a) => a.content && a.kind !== 'video')
    .map((a) => ({ filename: a.label || a.filename || 'file', content: a.content }))
  if (files.length) payload.attachments = files

  const r = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Resend failed (${r.status})`)
  return { ok: true, id: data?.id || null }
}

const splitAddr = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim())).filter(Boolean)
