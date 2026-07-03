// ============================================================================
// Mail provider adapter — Gmail (OPTIONAL: inbox, replies, sync).
//
// Implements the same provider interface as resend.js. Headless server-side
// auth via a long-lived OAuth refresh token (the standard pattern for a single
// business inbox) — no per-request user consent. Set these in Vercel to enable:
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
//   GMAIL_USER (optional, defaults to 'me')
//
// Until configured, isConfigured() is false and the registry simply skips it —
// the app degrades gracefully (inbox shows the empty/seed state, Resend still
// sends). Capabilities: inbox + sync (+ outbound if you prefer Gmail for send).
// ============================================================================

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const USER = process.env.GMAIL_USER || 'me'

export const id = 'gmail'
export const capabilities = { outbound: true, inbox: true, sync: true }
export const isConfigured = () =>
  !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN)

async function getAccessToken() {
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.access_token) throw new Error(data?.error_description || 'Gmail token refresh failed')
  return data.access_token
}

const gfetch = async (token, path) => {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || `Gmail API ${r.status}`)
  return data
}

const header = (headers = [], name) =>
  (headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value) || ''
const parseFrom = (raw) => {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/) || []
  const email = m[2] || raw.trim()
  const name = (m[1] || '').trim() || email.split('@')[0]
  return { name, email }
}

// folder → Gmail search query
const QUERY = { inbox: 'in:inbox', sent: 'in:sent', archive: '-in:inbox -in:sent -in:trash' }

// Return provider-agnostic threads: [{ id, from, email, business, subject, preview, body, unread, at }]
export async function listThreads(folder = 'inbox', { limit = 25 } = {}) {
  const token = await getAccessToken()
  const q = QUERY[folder] || QUERY.inbox
  const list = await gfetch(token, `/messages?maxResults=${limit}&q=${encodeURIComponent(q)}`)
  const ids = (list.messages || []).map((m) => m.id)
  const msgs = await Promise.all(
    ids.map((mid) =>
      gfetch(token, `/messages/${mid}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
        .catch(() => null)),
  )
  return msgs.filter(Boolean).map((m) => {
    const hs = m.payload?.headers || []
    const { name, email } = parseFrom(folder === 'sent' ? header(hs, 'To') : header(hs, 'From'))
    return {
      id: m.id,
      from: folder === 'sent' ? 'You' : name,
      email,
      business: name,
      subject: header(hs, 'Subject') || '(no subject)',
      preview: m.snippet || '',
      body: m.snippet || '',
      unread: (m.labelIds || []).includes('UNREAD'),
      at: header(hs, 'Date') ? new Date(header(hs, 'Date')).toISOString() : new Date(Number(m.internalDate)).toISOString(),
      provider: 'gmail',
    }
  })
}

// Optional outbound via Gmail (raw RFC-2822). Registry prefers Resend, so this
// is only used if Resend is unavailable AND Gmail is configured.
export async function send(msg) {
  const token = await getAccessToken()
  const to = Array.isArray(msg.to) ? msg.to.join(', ') : msg.to
  const lines = [
    `To: ${to}`,
    msg.cc ? `Cc: ${msg.cc}` : '',
    `Subject: ${msg.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    msg.body || '',
  ].filter(Boolean)
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')
  const r = await fetch(`${API}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || `Gmail send ${r.status}`)
  return { ok: true, id: data.id }
}
