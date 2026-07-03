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

// Turn a plain-text body (what the composer/assistant produce) into simple,
// premium-looking branded HTML. Links in the text are auto-linked.
function toHtml({ subject, body, attachments = [] }) {
  const linkify = (line) =>
    esc(line).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#a87f22;text-decoration:underline">$1</a>')
  const paras = String(body || '')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.split('\n').map(linkify).join('<br>')}</p>`)
    .join('')
  const attachLinks = attachments.filter((a) => a.url).map(
    (a) => `<a href="${esc(a.url)}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 12px;border:1px solid #e6e0cf;border-radius:8px;color:#7d5d17;text-decoration:none;font-size:13px">📎 ${esc(a.label || 'Attachment')}</a>`,
  ).join('')
  return `<!doctype html><html><body style="margin:0;background:#f7f5ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #ece7da">
      ${paras}
      ${attachLinks ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">${attachLinks}</div>` : ''}
    </div>
    <p style="text-align:center;color:#9a927e;font-size:12px;margin:20px 0 0">Digital Skyline Co. · digitalskylineco.com</p>
  </div></body></html>`
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
    text: msg.body || undefined,
  }
  const cc = splitAddr(msg.cc); if (cc.length) payload.cc = cc
  const bcc = splitAddr(msg.bcc); if (bcc.length) payload.bcc = bcc
  // Only real byte attachments (base64 content) go as Resend attachments; URL
  // assets are surfaced as branded links inside the HTML body instead.
  const files = (msg.attachments || []).filter((a) => a.content).map((a) => ({ filename: a.label || a.filename || 'file', content: a.content }))
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
