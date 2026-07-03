// ============================================================================
// Communications — composer body helpers (pure, no React).
//
// Media (video/photos) is delivered as ONE branded "View Website Preview" CTA
// button, not a raw storage link and not per-asset Photo/Video buttons. While
// composing, the button carries a placeholder href; at send time the real
// preview URL (digitalskylineco.com/preview/<token>) is swapped in. The preview
// PAGE decides whether the asset is a photo or a video — the email stays clean.
// ============================================================================

export const PREVIEW_LABEL = 'View Website Preview'
export const PREVIEW_PLACEHOLDER = '#preview'
const BTN_RE = /\[View Website Preview\]\(([^)]+)\)/

export const hasPreviewButton = (body = '') => BTN_RE.test(body)

// Insert a single preview button (idempotent) — used the moment media is added.
export function withPreviewButton(body = '') {
  if (hasPreviewButton(body)) return body
  const base = body.replace(/\s+$/, '')
  return `${base}${base ? '\n\n' : ''}[${PREVIEW_LABEL}](${PREVIEW_PLACEHOLDER})\n`
}

// Remove the preview button (when the last media attachment is removed).
export function withoutPreviewButton(body = '') {
  return body.replace(/\n*\[View Website Preview\]\([^)]*\)\n*/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Swap the placeholder href for the real preview URL just before sending.
export function resolvePreviewUrl(body = '', url) {
  if (!url) return body
  return body.replace(BTN_RE, `[${PREVIEW_LABEL}](${url})`)
}
