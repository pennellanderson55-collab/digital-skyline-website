// ============================================================================
// Digital Skyline OS — Communications data layer.
//
// Business knowledge (so the assistant "sounds like Pernell"), seed inbox/sent/
// draft threads (front-end demo data until a live mail backend is wired), email
// templates, smart project assets, and the assistant's suggestion + command
// catalogs. Pure data + light pure helpers — no React, no network.
// ============================================================================

/* ── Digital Skyline knowledge base ──────────────────────────────────────── */
export const DS = {
  company: 'Digital Skyline Co.',
  founder: 'Pernell',
  region: 'Arizona',
  booking: 'https://digitalskyline.co/book',
  site: 'digitalskyline.co',
  signature:
    'Pernell\nFounder · Digital Skyline Co.\nWebsites · SEO · Automations · Custom Software\ndigitalskyline.co',
  services: [
    'Custom websites (you own 100% of it)',
    'SEO & local search',
    'Automations & workflow software',
    'Dashboards & internal tools',
    'Web & mobile apps',
    'Maintenance & care plans',
  ],
  // Voice: professional, friendly, confident — never spammy.
  tone: 'professional, friendly, confident, concise',
}

/* ── folders (the Communications left rail) ──────────────────────────────── */
export const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: 'Inbox' },
  { id: 'sent', label: 'Sent', icon: 'Send' },
  { id: 'drafts', label: 'Drafts', icon: 'Draft' },
  { id: 'scheduled', label: 'Scheduled', icon: 'Clock' },
  { id: 'previews', label: 'Previews', icon: 'Eye' },
  { id: 'templates', label: 'Templates', icon: 'Template' },
  { id: 'prospects', label: 'Prospects', icon: 'Target' },
  { id: 'clients', label: 'Clients', icon: 'Users' },
  { id: 'assistant', label: 'AI Assistant', icon: 'Robot' },
  { id: 'archive', label: 'Archive', icon: 'Archive' },
]

/* ── seed message threads (demo data) ────────────────────────────────────── */
const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString()
let _id = 0
const uid = (p) => `${p}-${++_id}`

export const SEED_THREADS = {
  inbox: [
    {
      id: uid('t'), from: 'Mario', business: 'Mario Plumbing', email: 'mario@marioplumbing.com',
      subject: 'Re: Your new homepage preview', preview: "This looks incredible — my customers are going to love it. Quick question about the booking button…",
      body: "Hi Pernell,\n\nThis looks incredible — my customers are going to love it. Quick question about the booking button — can we make it a little bigger on mobile?\n\nAlso, do I really own the whole site once it's live?\n\nThanks,\nMario",
      unread: true, starred: true, at: ago(24),
    },
    {
      id: uid('t'), from: 'Dana Reyes', business: 'Reyes Realty', email: 'dana@reyesrealty.com',
      subject: 'Consultation follow-up', preview: 'Thanks for the call yesterday. Can you send over the proposal we talked about?',
      body: "Hi Pernell,\n\nThanks for the call yesterday — really enjoyed it. Can you send over the proposal we talked about, plus the maintenance plan details?\n\nBest,\nDana",
      unread: true, starred: false, at: ago(140),
    },
    {
      id: uid('t'), from: 'Sunrise Dental', business: 'Sunrise Dental', email: 'office@sunrisedental.com',
      subject: 'Website is live 🎉', preview: 'We just got our first booking through the new site. Thank you!',
      body: "Pernell,\n\nWe just got our first booking through the new site — a brand new patient. Thank you so much!\n\nThe team",
      unread: false, starred: true, at: ago(60 * 20),
    },
    {
      id: uid('t'), from: 'Jake', business: 'Desert Auto Detailing', email: 'jake@desertdetail.com',
      subject: 'Invoice question', preview: "Got the invoice — all good. Paying today.",
      body: "Hey Pernell,\n\nGot the invoice, all good. Paying today. Site's been great for us.\n\nJake",
      unread: false, starred: false, at: ago(60 * 46),
    },
  ],
  sent: [
    {
      id: uid('t'), from: 'You', business: 'Copper State HVAC', email: 'owner@copperstatehvac.com',
      subject: 'A faster website for Copper State HVAC', preview: 'I put together a quick preview of what your new site could look like…',
      body: "Hi there,\n\nI put together a quick preview of what a new site for Copper State HVAC could look like — faster, mobile-first, and built to turn searches into booked jobs.\n\nWorth a quick 15-minute call?\n\nPernell", at: ago(60 * 6), opened: true, clicked: false,
    },
    {
      id: uid('t'), from: 'You', business: 'Mario Plumbing', email: 'mario@marioplumbing.com',
      subject: 'Your new homepage preview', preview: 'Here is the homepage preview we discussed — you own 100% of it.',
      body: "Hi Mario,\n\nHere's the homepage preview we discussed. Once it's live you own 100% of it — no lock-in, no rented platform.\n\nPernell", at: ago(60 * 30), opened: true, clicked: true,
    },
  ],
  drafts: [
    {
      id: uid('t'), from: 'You', business: 'Reyes Realty', email: 'dana@reyesrealty.com',
      subject: 'Proposal + maintenance plan', preview: 'Draft — proposal for Reyes Realty…',
      body: "Hi Dana,\n\nGreat talking yesterday. Attached is the proposal along with the maintenance plan we discussed…", at: ago(90),
    },
  ],
  scheduled: [
    {
      id: uid('t'), from: 'You', business: 'Copper State HVAC', email: 'owner@copperstatehvac.com',
      subject: 'Quick follow-up', preview: 'Scheduled to send next Tuesday, 9:00 AM',
      body: "Hi again,\n\nJust circling back on the website preview I sent — happy to walk you through it on a quick call.\n\nPernell",
      at: ago(-60 * 24 * 3), sendAt: 'Next Tuesday · 9:00 AM',
    },
  ],
  archive: [
    {
      id: uid('t'), from: 'Old Lead', business: 'Vista Landscaping', email: 'info@vistascapes.com',
      subject: 'Re: quote', preview: 'Thanks, we went a different direction for now.',
      body: 'Thanks, we went a different direction for now — will keep you in mind.', at: ago(60 * 24 * 40),
    },
  ],
}

/* ── email templates ─────────────────────────────────────────────────────── */
export const TEMPLATES = [
  { id: 'cold-preview', name: 'Cold intro + preview', tag: 'Outreach', subject: 'A faster website for {{business}}',
    body: "Hi {{name}},\n\nI build fast, modern websites for {{region}} businesses — and I put together a quick preview of what {{business}} could look like.\n\nYou'd own 100% of it. Worth a quick 15-minute call?\n\n" },
  { id: 'follow-up', name: 'Gentle follow-up', tag: 'Outreach', subject: 'Following up — {{business}}',
    body: "Hi {{name}},\n\nJust floating this back to the top of your inbox. No pressure at all — happy to send the preview over or hop on a quick call whenever it's useful.\n\n" },
  { id: 'consult', name: 'Free consultation offer', tag: 'Sales', subject: 'Free 15-min consultation for {{business}}',
    body: "Hi {{name}},\n\nI'd love to offer you a free, no-strings consultation. We'll look at your online presence and I'll share exactly what I'd do to bring you more customers.\n\nGrab a time here: {{booking}}\n\n" },
  { id: 'thank-you', name: 'Thank you', tag: 'Client', subject: 'Thank you, {{name}}',
    body: "Hi {{name}},\n\nJust wanted to say thank you — it's a pleasure working with {{business}}. If anything ever comes up, I'm one email away.\n\n" },
  { id: 'update', name: 'Project update', tag: 'Client', subject: 'Project update — {{business}}',
    body: "Hi {{name}},\n\nQuick update on your project:\n\n• \n• \n• \n\nNext up, I'll be… Let me know if you have any questions.\n\n" },
  { id: 'invoice', name: 'Invoice / payment', tag: 'Billing', subject: 'Invoice for {{business}}',
    body: "Hi {{name}},\n\nYour invoice is ready — I've attached it here. You can pay securely online, and let me know if you'd like anything itemized differently.\n\n" },
]

/* ── smart project assets (attach existing, not just upload) ─────────────── */
export const SMART_ASSETS = [
  { id: 'screenshot', label: 'Latest Website Screenshot', kind: 'image', size: '1.4 MB', icon: 'FileImage', hint: 'Homepage preview · PNG' },
  { id: 'demo', label: 'Latest Demo Video', kind: 'video', size: '86 MB', icon: 'FileVideo', hint: 'Auto-uploads to secure link', big: true },
  { id: 'proposal', label: 'Proposal', kind: 'pdf', size: '320 KB', icon: 'FilePdf', hint: 'PDF · 4 pages' },
  { id: 'contract', label: 'Contract', kind: 'contract', size: '210 KB', icon: 'FileContract', hint: 'E-sign ready' },
  { id: 'invoice', label: 'Invoice', kind: 'pdf', size: '96 KB', icon: 'FilePdf', hint: 'Stripe-linked' },
  { id: 'consult-pdf', label: 'Consultation PDF', kind: 'pdf', size: '180 KB', icon: 'FilePdf', hint: 'What to expect' },
  { id: 'brand', label: 'Brand Guidelines', kind: 'pdf', size: '2.1 MB', icon: 'FileDoc', hint: 'Colors + type' },
  { id: 'logos', label: 'Logo Files', kind: 'image', size: '5.3 MB', icon: 'FileImage', hint: 'SVG · PNG pack' },
]

/* ── assistant suggestion chips (right panel) ────────────────────────────── */
export const ASSISTANT_SUGGESTIONS = [
  'Write a follow-up email', 'Make this shorter', 'Sound more professional', 'Rewrite in my tone',
  'Mention they own the website', 'Mention free consultation', 'Reference their Google reviews',
  'Create urgency without sounding salesy', 'Make this under 120 words', 'Attach a consultation link',
  'Generate subject lines', 'Fix grammar', 'Translate this', 'Turn these notes into an email',
  'Write a thank-you email', 'Create a project update',
]

/* ── command-bar example commands ────────────────────────────────────────── */
export const COMMAND_EXAMPLES = [
  'Email Mario Plumbing about their homepage',
  'Attach the latest website preview',
  'Attach the latest demo video',
  'Tell them they own 100% of their website',
  'Mention the free consultation',
  'Send next Tuesday',
  'Generate an invoice email',
  "Follow up with everyone that hasn't replied in 10 days",
]

/* ── future-feature placeholders (design stubs) ──────────────────────────── */
export const FUTURE_FEATURES = [
  { icon: 'Clock', label: 'Email scheduling', note: 'Send at the perfect time' },
  { icon: 'Eye', label: 'Open tracking', note: 'Know the moment they read' },
  { icon: 'LinkIcon', label: 'Click tracking', note: 'See every link opened' },
  { icon: 'Reply', label: 'Reply tracking', note: 'Auto-detect responses' },
  { icon: 'Layers', label: 'Sequences', note: 'Multi-step drip flows' },
  { icon: 'Send', label: 'Campaigns', note: 'One-to-many, personalized' },
  { icon: 'Users', label: 'Bulk email', note: 'Segments & mail-merge' },
  { icon: 'Star', label: 'Saved prompts', note: 'Your best AI recipes' },
  { icon: 'Robot', label: 'AI prompt history', note: 'Every ask, searchable' },
  { icon: 'Robot', label: 'AI memory', note: 'It remembers each contact' },
  { icon: 'Draft', label: 'Internal notes', note: 'Private team context' },
  { icon: 'Inbox', label: 'Shared team inbox', note: 'Collaborate on threads' },
  { icon: 'Mic', label: 'Voice dictation', note: 'Speak your emails' },
  { icon: 'Screen', label: 'Screen recording', note: 'Attach quick Looms' },
  { icon: 'FileVideo', label: 'Video introductions', note: 'Say hi, face to face' },
  { icon: 'Template', label: 'Project updates', note: 'Auto-drafted from status' },
]

/* ── pure formatting helpers ─────────────────────────────────────────────── */
export const initialsOf = (name = '') =>
  (name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || '·').toUpperCase()

export function relTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'scheduled'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Deterministic gold-ish accent hue per contact, for avatar variety.
export function avatarHue(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}
