// ============================================================================
// Digital Skyline OS — Communications icon set.
//
// Compact, dependency-free inline SVGs sharing the same 24×24 stroke language as
// components/Icons.jsx. Kept local to the Communications module so the shared
// icon file stays lean. Brand-tinted via `currentColor`.
// ============================================================================

const ico = (path) => ({ className = 'h-4 w-4' } = {}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}
  </svg>
)

/* ── folder / nav icons ──────────────────────────────────────────────────── */
export const Inbox = ico(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>)
export const Send = ico(<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>)
export const Draft = ico(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>)
export const Clock = ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
export const Template = ico(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>)
export const Target = ico(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>)
export const Users = ico(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>)
export const Robot = ico(<><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4M8 2h8" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /><path d="M2 14h2M20 14h2" /></>)
export const Archive = ico(<><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></>)

/* ── compose / toolbar icons ─────────────────────────────────────────────── */
export const Paperclip = ico(<path d="M21.44 11.05 12 20.5a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" />)
export const Bold = ico(<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />)
export const Italic = ico(<><path d="M19 4h-9M14 20H5M15 4 9 20" /></>)
export const Underline = ico(<><path d="M6 4v6a6 6 0 0 0 12 0V4M4 21h16" /></>)
export const ListBullet = ico(<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.2" /><circle cx="3.5" cy="12" r="1.2" /><circle cx="3.5" cy="18" r="1.2" /></>)
export const ListNumber = ico(<><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2" /><path d="M6 16H4v-1l2-1v-1H4" /></>)
export const LinkIcon = ico(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>)
export const Heading = ico(<><path d="M6 4v16M18 4v16M6 12h12" /></>)
export const Highlight = ico(<><path d="m9 11-6 6v3h3l6-6" /><path d="M14 6 18 2l4 4-4 4M11 8l5 5" /></>)
export const Emoji = ico(<><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9.5" r="1" /><circle cx="15" cy="9.5" r="1" /></>)
export const Signature = ico(<><path d="M3 17c3 0 3-8 6-8s2 6 4 6 2-4 4-4 1 3 4 3" /><path d="M3 21h18" /></>)

/* ── attachment / asset icons ────────────────────────────────────────────── */
export const FileImage = ico(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>)
export const FileVideo = ico(<><rect x="2" y="5" width="14" height="14" rx="2" /><path d="m16 10 6-3v10l-6-3Z" /></>)
export const FilePdf = ico(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 15h1.5a1.5 1.5 0 0 0 0-3H9v6M14 12v6M17 12h-3" /></>)
export const FileDoc = ico(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></>)
export const FileContract = ico(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h4" /><path d="m14.5 18.5 1.5 1.5 3-3" /></>)

/* ── utility icons ───────────────────────────────────────────────────────── */
export const Search = ico(<><circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5" /></>)
export const Command = ico(<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 3-6z" />)
export const Mic = ico(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>)
export const Trash = ico(<><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>)
export const Reply = ico(<><path d="M9 17 4 12l5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></>)
export const Star = ico(<path d="m12 2 3 6.9 7.6.6-5.8 5 1.8 7.4L12 18l-6.4 3.9 1.8-7.4-5.8-5 7.6-.6Z" />)
export const Dot = ({ className = 'h-2 w-2' } = {}) => (
  <svg viewBox="0 0 8 8" className={className}><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
)
export const ChevronLeft = ico(<path d="m15 18-6-6 6-6" />)
export const Plus = ico(<><path d="M12 5v14M5 12h14" /></>)
export const Screen = ico(<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>)
export const Layers = ico(<><path d="m12 2 9 5-9 5-9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>)
export const Eye = ico(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>)
export const Sparkle = ico(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />)
export const Brain = ico(<><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 6 17a3 3 0 0 0 3 3 2.5 2.5 0 0 0 3-2.5V5.5A2.5 2.5 0 0 0 9 3Z" /><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3 3 0 0 1 18 17a3 3 0 0 1-3 3 2.5 2.5 0 0 1-3-2.5" /></>)
export const Play = ({ className = 'h-4 w-4' } = {}) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" /></svg>
)
