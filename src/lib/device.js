// ============================================================================
// Device / capability flags used to gate heavy visual effects.
//
// Evaluated ONCE at module load — pointer type and reduced-motion don't change
// within a session, so this stays cheap and consistent across components.
//
// Philosophy: desktop keeps the full premium experience (scroll-scrubbed hero
// video, particle canvas, animated blur orbs, Lenis smooth scroll, autoplaying
// portfolio previews). Touch/mobile devices get lighter equivalents so the site
// stays smooth and doesn't stream tens of MB of video over cellular.
// ============================================================================

const mm = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches

// Respect the OS "reduce motion" setting everywhere.
export const prefersReducedMotion = mm('(prefers-reduced-motion: reduce)')

// Touch-primary devices (phones/tablets): no hover + coarse pointer. Also treat
// Data Saver ("Lite mode") as touch-lite so we never auto-stream heavy media.
export const isTouchPrimary =
  mm('(hover: none) and (pointer: coarse)') ||
  (typeof navigator !== 'undefined' && Boolean(navigator.connection?.saveData))

// Convenience: skip always-on heavy effects when EITHER reduced-motion is on
// OR we're on a touch/lite device.
export const liteMode = prefersReducedMotion || isTouchPrimary
