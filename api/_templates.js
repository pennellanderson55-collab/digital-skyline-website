// ============================================================================
// Email templates + addressing for the Resend-backed /api/send-email function.
// Server-side only. The leading underscore keeps Vercel from routing this file.
//
// INVARIANT: NO FormSubmit, ever. Every message here is branded Resend mail.
//
// Routing:
//   • Client confirmations  → the customer's email, FROM a business address
//     (hello@ for consultation/welcome, support@ for support). Simple + branded.
//   • Internal notifications → OWNER_EMAIL with the FULL submission details and
//     a subject like "New Consultation Request - <Name>". The client's email is
//     NEVER used as the recipient of an internal notification.
// ============================================================================

// --- Constants (overridable via env) ---------------------------------------
// The owner inbox ALWAYS resolves to the verified business address. We only
// honor an OWNER_EMAIL override when it's actually a valid-looking address —
// a missing or malformed env var must never silently drop the internal lead
// notification (that's how the owner stopped receiving consultation emails).
const OWNER_FALLBACK = 'digitalskyline@digitalskylineco.com'
const envOwner = (process.env.OWNER_EMAIL || '').trim()
const OWNER_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(envOwner) ? envOwner : OWNER_FALLBACK
const HELLO_EMAIL = process.env.HELLO_EMAIL || 'hello@digitalskylineco.com'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@digitalskylineco.com'

// Absolute base URL so email clients can load public assets (no relative paths).
const SITE_URL = (process.env.SITE_URL || 'https://digitalskylineco.com').replace(/\/$/, '')

// Premium brand visual shown ONLY at the bottom of client confirmations
// (never in the internal owner notification). Referenced by absolute URL —
// not attached as a file — and fully responsive across email clients.
const confirmationImage = `<div style="margin-top:26px">
  <img src="${SITE_URL}/orb-header.png" alt="${'Digital Skyline Co.'}" width="488"
    style="display:block;width:100%;max-width:488px;height:auto;border-radius:12px;border:1px solid #23232a" />
</div>`

// Sender identities (must be on a Resend-verified business domain).
const FROM_HELLO = process.env.EMAIL_FROM || `Digital Skyline Co. <${HELLO_EMAIL}>`
const FROM_SUPPORT = process.env.EMAIL_FROM_SUPPORT || `Digital Skyline Co. <${SUPPORT_EMAIL}>`
const ADMIN_URL = process.env.ADMIN_URL || 'https://digitalskylineco.com/admin'

const BRAND = 'Digital Skyline Co.'
const GOLD = '#d4af37'
const INK = '#0a0a0c'

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const prettyDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return esc(iso)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Combine a select value with its free-text "Other" companion, if present.
const withOther = (value, other) =>
  value === 'Other' && other ? `Other — ${other}` : (value || '')

// Drop empty rows so internal emails stay clean.
const compact = (rows) => rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')

const adminLinkBlock = `<div style="margin-top:18px">
  <a href="${ADMIN_URL}" style="display:inline-block;background:${GOLD};color:${INK};text-decoration:none;font-weight:700;font-size:13px;padding:10px 16px;border-radius:8px">Open the admin dashboard →</a>
</div>`

// Shared premium black/gold shell.
function layout({ heading, intro, rows = [], body = '', footnote = '' }) {
  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
        ${rows.map(([k, v]) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #1d1d22;color:#9aa0aa;font-size:13px;width:42%;vertical-align:top">${esc(k)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #1d1d22;color:#f5f5f7;font-size:14px;font-weight:600;white-space:pre-wrap">${esc(v)}</td>
          </tr>`).join('')}
      </table>`
    : ''

  return `<!doctype html><html><body style="margin:0;background:${INK};padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#101014;border:1px solid #23232a;border-radius:16px;overflow:hidden">
          <tr><td style="height:4px;background:linear-gradient(90deg,#7d5d17,${GOLD},#f5ead0)"></td></tr>
          <tr><td style="padding:32px 36px 8px">
            <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};font-weight:700">${BRAND}</div>
            <h1 style="margin:14px 0 0;color:#ffffff;font-size:24px;line-height:1.25">${heading}</h1>
          </td></tr>
          <tr><td style="padding:12px 36px 0;color:#c7ccd4;font-size:15px;line-height:1.6">${intro}</td></tr>
          <tr><td style="padding:8px 36px">${rowsHtml}${body}</td></tr>
          ${footnote ? `<tr><td style="padding:4px 36px 8px;color:#7c828c;font-size:12px;line-height:1.6">${footnote}</td></tr>` : ''}
          <tr><td style="padding:24px 36px 32px;border-top:1px solid #1d1d22;color:#6b7079;font-size:12px">
            ${BRAND} · <a href="https://digitalskylineco.com" style="color:${GOLD};text-decoration:none">digitalskylineco.com</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`
}

/**
 * Returns an array of Resend message objects for the given trigger:
 * one full internal notification (to OWNER_EMAIL) + one simple client
 * confirmation (to the customer), when a client email is present.
 */
export function buildEmail(type, data = {}) {
  switch (type) {
    case 'consultation': {
      const name = data.name || data.email || 'Lead'
      // Internal — full submission details to the owner.
      const messages = [{
        from: FROM_HELLO, to: OWNER_EMAIL,
        subject: `New Consultation Request - ${name}`,
        html: layout({
          heading: 'New Consultation Request',
          intro: 'A new consultation was booked through the website.',
          rows: compact([
            ['Client name', data.name],
            ['Email', data.email],
            ['Phone', data.phone],
            ['Business / company', data.business],
            ['Website', data.website],
            ['Project type', data.project_type],
            ['Budget', data.budget],
            ['Lead source', withOther(data.heard_about, data.heard_about_other)],
            ['Challenge', withOther(data.challenge, data.challenge_other)],
            ['Success outcome', data.success_outcome],
            ['Current systems', Array.isArray(data.current_systems) ? data.current_systems.join(', ') : data.current_systems],
            ['Requested date', prettyDate(data.date)],
            ['Requested time', data.time],
            ['Notes', data.notes],
          ]),
          body: adminLinkBlock,
        }),
      }]
      // Client — simple branded confirmation.
      if (data.email) {
        messages.push({
          from: FROM_HELLO, to: data.email, reply_to: HELLO_EMAIL,
          subject: 'Your Digital Skyline consultation is confirmed',
          html: layout({
            heading: 'Your consultation is confirmed',
            intro: `Thank you${data.name ? `, ${esc(data.name)}` : ''}! Your consultation with ${BRAND} is booked. Here are the details:`,
            rows: compact([
              ['Date', prettyDate(data.date)],
              ['Time', data.time],
              ['Business', data.business],
            ]),
            body: `<div style="margin-top:18px;color:#c7ccd4;font-size:14px;line-height:1.7">
              <strong style="color:#fff">What happens next</strong>
              <ol style="margin:8px 0 0;padding-left:18px">
                <li>We review your business goals before the call.</li>
                <li>We discuss the website, app, or system you need.</li>
                <li>We map out the smartest next step together.</li>
              </ol>
              <p style="margin:16px 0 0">We'll confirm your time within 24 hours. Need to reschedule? Just reply to this email.</p>
            </div>${confirmationImage}`,
          }),
        })
      }
      return messages
    }

    case 'welcome': {
      const ref = data.projectReference || data.project_reference || ''
      // Internal — conversion details to the owner.
      const messages = [{
        from: FROM_HELLO, to: OWNER_EMAIL,
        subject: `Lead Converted To Client - ${ref}`,
        html: layout({
          heading: 'Lead Converted To Client',
          intro: 'A consultation was converted into a client + project.',
          rows: compact([
            ['Project reference', ref],
            ['Company', data.companyName],
            ['Contact name', data.contactName],
            ['Email', data.email],
            ['Phone', data.phone],
            ['Project type', data.projectType],
            ['Budget', data.budget],
          ]),
          body: adminLinkBlock,
        }),
      }]
      // Client — welcome + project reference explanation.
      if (data.email) {
        messages.push({
          from: FROM_HELLO, to: data.email, reply_to: HELLO_EMAIL,
          subject: `Welcome to ${BRAND} — ${ref || 'your project'}`,
          html: layout({
            heading: `Welcome aboard${data.contactName ? `, ${esc(data.contactName)}` : ''}!`,
            intro: `We're excited to start your project with ${BRAND}. Your project has been set up and assigned a reference number.`,
            rows: compact([['Your project reference', ref]]),
            body: `<div style="margin-top:18px;color:#c7ccd4;font-size:14px;line-height:1.7">
              <strong style="color:#fff">How your project reference works</strong>
              <p style="margin:8px 0 0">Your reference <strong style="color:${GOLD}">${esc(ref)}</strong> is the master ID for everything related to your project — payments, invoices, support requests, files, and timeline all connect to it.</p>
              <p style="margin:12px 0 0">Please include it when you contact us or submit a support request so we can help you faster. It is <strong>not</strong> a password or login — just your project's name in our system.</p>
            </div>${confirmationImage}`,
          }),
        })
      }
      return messages
    }

    case 'support': {
      const name = data.name || data.email || 'Client'
      const ref = data.projectReference || data.project_reference || '—'
      const supportType = data.supportType || data.support_type || 'General Support'
      // Internal — full request to the owner.
      const messages = [{
        from: FROM_SUPPORT, to: OWNER_EMAIL,
        subject: `New Support Request - ${name}`,
        html: layout({
          heading: 'New Support Request',
          intro: 'A support request was submitted from the website.',
          rows: compact([
            ['Project reference', ref],
            ['Client name', data.name],
            ['Email', data.email],
            ['Company', data.company],
            ['Support type', supportType],
          ]),
          body: `<div style="margin-top:14px;color:#c7ccd4;font-size:14px;line-height:1.7"><strong style="color:#fff">Message</strong><p style="margin:6px 0 0;white-space:pre-wrap">${esc(data.message)}</p></div>${adminLinkBlock}`,
        }),
      }]
      // Client — simple branded confirmation.
      if (data.email) {
        messages.push({
          from: FROM_SUPPORT, to: data.email, reply_to: SUPPORT_EMAIL,
          subject: 'We received your support request',
          html: layout({
            heading: 'Your support request was received',
            intro: `Thanks${data.name ? `, ${esc(data.name)}` : ''} — our team has your request and will follow up by email as soon as possible.`,
            rows: compact([['Project reference', ref], ['Support type', supportType]]),
            body: confirmationImage,
            footnote: 'Please keep this email for your records. Replying to it reaches our support team directly.',
          }),
        })
      }
      return messages
    }

    default:
      throw new Error(`Unknown email type: ${type}`)
  }
}
