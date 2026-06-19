// ============================================================================
// Email templates + addressing for the Resend-backed /api/send-email function.
// Server-side only. The leading underscore keeps Vercel from routing this file.
//
// INVARIANT: NO FormSubmit, ever. Every message here is branded Resend mail.
// Client-facing messages are always `from` a business address (hello@/support@)
// and `to` the client. Internal notifications are `to` a business inbox — the
// client's email is NEVER used as the recipient of an owner notification.
// ============================================================================

// Role-based business addresses (overridable via env).
const FROM = process.env.EMAIL_FROM || 'Digital Skyline Co. <hello@digitalskylineco.com>'
const NOTIFY = process.env.EMAIL_NOTIFY || 'hello@digitalskylineco.com'
const SUPPORT = process.env.EMAIL_SUPPORT || 'support@digitalskylineco.com'
// Support mail goes out FROM the support address so replies thread correctly.
const FROM_SUPPORT = process.env.EMAIL_FROM_SUPPORT || `Digital Skyline Co. <${SUPPORT}>`

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

// Shared premium black/gold shell.
function layout({ heading, intro, rows = [], body = '', footnote = '' }) {
  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
        ${rows.map(([k, v]) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #1d1d22;color:#9aa0aa;font-size:13px;width:42%">${esc(k)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #1d1d22;color:#f5f5f7;font-size:14px;font-weight:600">${esc(v)}</td>
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
 * Returns an array of Resend message objects for the given trigger.
 * Each trigger produces a client-facing email + an internal notification.
 */
export function buildEmail(type, data = {}) {
  switch (type) {
    case 'consultation': {
      const when = `${prettyDate(data.date)}${data.time ? ` at ${esc(data.time)}` : ''}`
      const messages = [{
        from: FROM, to: NOTIFY,
        subject: `New consultation booked — ${data.name || data.email || 'Lead'}`,
        html: layout({
          heading: 'New consultation booked',
          intro: 'A new consultation has been scheduled through the website.',
          rows: [
            ['Name', data.name], ['Business', data.business], ['Email', data.email],
            ['Phone', data.phone || '—'], ['Date', prettyDate(data.date)], ['Time', data.time],
            ['Budget', data.budget || '—'], ['Project type', data.project_type || '—'],
          ],
        }),
      }]
      if (data.email) {
        messages.push({
          from: FROM, to: data.email, reply_to: NOTIFY,
          subject: 'Your Digital Skyline consultation is confirmed',
          html: layout({
            heading: 'Your consultation is confirmed',
            intro: `Thank you${data.name ? `, ${esc(data.name)}` : ''}! Your consultation with ${BRAND} is booked. Here are the details:`,
            rows: [
              ['Date', prettyDate(data.date)], ['Time', data.time],
              ['Business', data.business || '—'],
            ],
            body: `<div style="margin-top:18px;color:#c7ccd4;font-size:14px;line-height:1.7">
              <strong style="color:#fff">What happens next</strong>
              <ol style="margin:8px 0 0;padding-left:18px">
                <li>We review your business goals before the call.</li>
                <li>We discuss the website, app, or system you need.</li>
                <li>We map out the smartest next step together.</li>
              </ol>
              <p style="margin:16px 0 0">We'll confirm your time within 24 hours. Need to reschedule? Just reply to this email.</p>
            </div>`,
          }),
        })
      }
      return messages
    }

    case 'welcome': {
      const ref = data.projectReference || data.project_reference
      const messages = [{
        from: FROM, to: NOTIFY,
        subject: `Client converted — ${ref || ''}`,
        html: layout({
          heading: 'New client created',
          intro: 'A consultation was converted into a client + project.',
          rows: [['Project reference', ref], ['Company', data.companyName], ['Contact', data.contactName], ['Email', data.email]],
        }),
      }]
      if (data.email) {
        messages.push({
          from: FROM, to: data.email, reply_to: NOTIFY,
          subject: `Welcome to ${BRAND} — ${ref || 'your project'}`,
          html: layout({
            heading: `Welcome aboard${data.contactName ? `, ${esc(data.contactName)}` : ''}!`,
            intro: `We're excited to start your project with ${BRAND}. Your project has been set up and assigned a reference number.`,
            rows: [['Your project reference', ref]],
            body: `<div style="margin-top:18px;color:#c7ccd4;font-size:14px;line-height:1.7">
              <strong style="color:#fff">How your project reference works</strong>
              <p style="margin:8px 0 0">Your reference <strong style="color:${GOLD}">${esc(ref)}</strong> is the master ID for everything related to your project — payments, invoices, support requests, files, and timeline all connect to it.</p>
              <p style="margin:12px 0 0">Please include it when you contact us or submit a support request so we can help you faster. It is <strong>not</strong> a password or login — just your project's name in our system.</p>
            </div>`,
          }),
        })
      }
      return messages
    }

    case 'support': {
      const ref = data.projectReference || data.project_reference || '—'
      const messages = [{
        from: FROM_SUPPORT, to: SUPPORT,
        subject: `New support request — ${data.supportType || data.support_type || 'General'}`,
        html: layout({
          heading: 'New support request',
          intro: 'A support request was submitted from the website.',
          rows: [
            ['Project reference', ref], ['Name', data.name], ['Company', data.company || '—'],
            ['Email', data.email], ['Type', data.supportType || data.support_type],
          ],
          body: `<div style="margin-top:14px;color:#c7ccd4;font-size:14px;line-height:1.7"><strong style="color:#fff">Message</strong><p style="margin:6px 0 0;white-space:pre-wrap">${esc(data.message)}</p></div>`,
        }),
      }]
      if (data.email) {
        messages.push({
          from: FROM_SUPPORT, to: data.email, reply_to: SUPPORT,
          subject: 'We received your support request',
          html: layout({
            heading: 'Your support request was received',
            intro: `Thanks${data.name ? `, ${esc(data.name)}` : ''} — our team has your request and will follow up by email as soon as possible.`,
            rows: [['Project reference', ref], ['Support type', data.supportType || data.support_type || '—']],
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
