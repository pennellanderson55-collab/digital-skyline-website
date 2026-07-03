// ============================================================================
// Communications — composer body helpers (pure, no React).
//
// Hosted media (video/photo) is represented in the email body as a markdown
// link that api/_mail/resend.js renders as a gold CTA button + fallback link.
// These helpers insert/remove those buttons and keep photo buttons numbered:
//   1 photo  → "View Website Preview Photo"
//   2+ photos → "View Website Preview Photo 1", "…Photo 2", …
// Kept framework-free so the logic is unit-testable and shared.
// ============================================================================

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* ── video ───────────────────────────────────────────────────────────────── */
export const VIDEO_BTN_LABEL = '▶ View Website Preview Video'
export function withVideoButton(body = '', url) {
  if (!url || body.includes(url)) return body
  const base = body.replace(/\s+$/, '')
  return `${base}${base ? '\n\n' : ''}[${VIDEO_BTN_LABEL}](${url})\n`
}
export function withoutVideoButton(body = '', url) {
  if (!url) return body
  return body.replace(new RegExp(`\\n*\\[[^\\]]*\\]\\(${reEsc(url)}\\)\\n*`, 'g'), '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/* ── photo (auto-numbered) ───────────────────────────────────────────────── */
export const PHOTO_LABEL = 'View Website Preview Photo'
export const photoButtonsIn = (body = '') =>
  [...body.matchAll(/\[(View Website Preview Photo(?: \d+)?)\]\((https?:\/\/[^)\s]+)\)/g)]

export function withPhotoButton(body = '', url) {
  if (!url || body.includes(url)) return body
  let out = body
  const existing = photoButtonsIn(out)
  const n = existing.length + 1
  // Adding the second photo → renumber the first from "Photo" to "Photo 1".
  if (n === 2) out = out.replace(`[${existing[0][1]}](${existing[0][2]})`, `[${PHOTO_LABEL} 1](${existing[0][2]})`)
  const label = n === 1 ? PHOTO_LABEL : `${PHOTO_LABEL} ${n}`
  const base = out.replace(/\s+$/, '')
  return `${base}${base ? '\n\n' : ''}[${label}](${url})\n`
}
export function withoutPhotoButton(body = '', url) {
  if (!url) return body
  let out = body.replace(new RegExp(`\\n*\\[View Website Preview Photo(?: \\d+)?\\]\\(${reEsc(url)}\\)\\n*`, 'g'), '\n')
  const rest = photoButtonsIn(out)
  if (rest.length === 1) out = out.replace(`[${rest[0][1]}](${rest[0][2]})`, `[${PHOTO_LABEL}](${rest[0][2]})`)
  else rest.forEach((m, i) => { out = out.replace(`[${m[1]}](${m[2]})`, `[${PHOTO_LABEL} ${i + 1}](${m[2]})`) })
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

/* ── dispatch by media kind ──────────────────────────────────────────────── */
export const withMediaButton = (body, chip) =>
  chip.kind === 'video' ? withVideoButton(body, chip.url)
    : chip.kind === 'image' ? withPhotoButton(body, chip.url)
    : body
export const withoutMediaButton = (body, chip) =>
  chip.kind === 'video' ? withoutVideoButton(body, chip.url)
    : chip.kind === 'image' ? withoutPhotoButton(body, chip.url)
    : body
