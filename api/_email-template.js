// ============================================================================
// Branded outreach email template — mobile-responsive HTML wrapped around the
// generated copy. Logo, signature, CTA buttons (Schedule / Portfolio / Packages
// / Visit), footer, social links and (future-ready) unsubscribe text.
//
// Pure string builder — no secrets, no network. Used by /api/send-outreach.
// ============================================================================

const SITE = (process.env.SITE_URL || 'https://digitalskylineco.com').replace(/\/$/, '')
const BRAND = 'Digital Skyline'
const GOLD = '#d4af37'
const INK = '#0b0b0f'

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Plain-text body -> safe HTML paragraphs (preserves line breaks).
function bodyToHtml(body = '') {
  return esc(body)
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;line-height:1.6;color:#2b2b2b;font-size:15px;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function button(href, label, primary) {
  const bg = primary ? GOLD : '#ffffff'
  const color = primary ? INK : INK
  const border = primary ? GOLD : '#d9d9d9'
  return `<a href="${esc(href)}" target="_blank"
    style="display:inline-block;margin:6px 6px 6px 0;padding:12px 20px;border-radius:9999px;
    background:${bg};color:${color};border:1px solid ${border};text-decoration:none;
    font-weight:600;font-size:14px;font-family:Arial,Helvetica,sans-serif;">${esc(label)}</a>`
}

// Build the full HTML email. `links.book` is the prospect-specific booking URL.
export function buildOutreachEmail({ subject = '', body = '', prospect = {}, links = {} }) {
  const book = links.book || `${SITE}/book`
  const portfolio = links.portfolio || `${SITE}/#portfolio`
  const packages = links.packages || `${SITE}/#packages`
  const site = links.site || SITE
  const recipientName = prospect.owner_name || prospect.business_name || 'there'

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ececf0;font-family:Arial,Helvetica,sans-serif;">

        <!-- Header / logo -->
        <tr><td style="background:${INK};padding:22px 28px;">
          <span style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.2px;">Digital Skyline<span style="color:${GOLD};">.</span></span>
          <span style="float:right;color:#9aa0aa;font-size:12px;padding-top:6px;">Web Design &amp; Development</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;color:#2b2b2b;font-size:15px;">Hi ${esc(recipientName)},</p>
          ${bodyToHtml(body)}

          <!-- Primary CTA -->
          <div style="margin:24px 0 8px;">${button(book, 'Schedule Your Free 15-Minute Strategy Call', true)}</div>
          <!-- Secondary CTAs -->
          <div style="margin:0 0 4px;">
            ${button(portfolio, 'View Portfolio', false)}
            ${button(packages, 'View Website Packages', false)}
            ${button(site, 'Visit Digital Skyline', false)}
          </div>
        </td></tr>

        <!-- Signature -->
        <tr><td style="padding:0 28px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-left:3px solid ${GOLD};padding-left:14px;">
              <div style="font-weight:bold;color:${INK};font-size:15px;">${esc(BRAND)} Co.</div>
              <div style="color:#6b7280;font-size:13px;">Independent founder · Websites, Apps &amp; Business Systems</div>
              <div style="font-size:13px;margin-top:4px;">
                <a href="mailto:hello@digitalskylineco.com" style="color:${INK};text-decoration:none;">hello@digitalskylineco.com</a>
                &nbsp;·&nbsp;<a href="${esc(site)}" style="color:${INK};text-decoration:none;">${esc(site.replace(/^https?:\/\//, ''))}</a>
              </div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafb;border-top:1px solid #ececf0;padding:18px 28px;">
          <div style="color:#9aa0aa;font-size:12px;line-height:1.6;">
            <a href="${esc(site)}" style="color:#6b7280;text-decoration:none;">Website</a> ·
            <a href="${esc(portfolio)}" style="color:#6b7280;text-decoration:none;">Portfolio</a> ·
            <a href="${esc(packages)}" style="color:#6b7280;text-decoration:none;">Packages</a>
            <br/>
            <span style="color:#b3b9c2;">Phoenix, Arizona</span>
            <br/><br/>
            You're receiving this because I thought ${esc(prospect.business_name || 'your business')} could benefit from a stronger online presence.
            If you'd prefer not to hear from me, just reply and I'll remove you.
          </div>
        </td></tr>

      </table>
      <div style="max-width:600px;color:#b3b9c2;font-size:11px;font-family:Arial,Helvetica,sans-serif;padding:12px 8px;">
        © ${esc(BRAND)} Co.
      </div>
    </td></tr>
  </table>
</body></html>`
}
