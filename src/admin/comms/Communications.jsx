// ============================================================================
// Digital Skyline OS — Communications.
//
// The company communication hub: a three-panel, Gmail-meets-Linear/Arc/Notion
// workspace built in the ink + gold Digital Skyline language. Left rail = mail
// folders + smart lists; center = a premium email composer (rich toolbar, smart
// attachments, contact intelligence); right = the Digital Skyline AI Assistant
// that edits the email in place. A Raycast-style command bar sits on top.
//
// This replaces the old per-prospect "Outreach AI" tab with a flagship,
// company-wide surface. Front-end + deterministic assistant today; the data
// hooks (send, threads, tracking) are stubbed with clearly-labeled demo state
// and future-feature placeholders, ready to wire to a live backend.
// ============================================================================

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import mail from '../../lib/mail/index.js'
import { useDashboardStyles, GlassCard } from '../dashboard/primitives.jsx'
import * as I from './icons.jsx'
import {
  DS, FOLDERS, SEED_THREADS, TEMPLATES, SMART_ASSETS, ASSISTANT_SUGGESTIONS,
  COMMAND_EXAMPLES, FUTURE_FEATURES, initialsOf, relTime, avatarHue,
} from './data.js'
import { assistRemote, parseCommand } from './assistant.js'
import { loadContactContext, deriveContext } from './context.js'
import { uploadToStorage, fileKindOf, iconForKind, humanSize, mustHost } from '../../lib/mail/storage.js'

/* ── module-scoped styles (typing dots, glows, entrances) ────────────────── */
const STYLE_ID = 'ds-comms-css'
const CSS = `
@keyframes dsBlink { 0%,80%,100% { opacity:.25; transform:translateY(0) } 40% { opacity:1; transform:translateY(-2px) } }
@keyframes dsPop { from { opacity:0; transform:translateY(6px) scale(.98) } to { opacity:1; transform:none } }
@keyframes dsSlideL { from { opacity:0; transform:translateX(14px) } to { opacity:1; transform:none } }
@keyframes dsCmdGlow { 0%,100% { box-shadow:0 0 0 1px rgba(212,175,55,.18), 0 18px 50px -24px rgba(212,175,55,.35) } 50% { box-shadow:0 0 0 1px rgba(212,175,55,.35), 0 18px 60px -20px rgba(212,175,55,.5) } }
.ds-pop { animation: dsPop .32s cubic-bezier(.2,.8,.3,1) both }
.ds-slidel { animation: dsSlideL .3s cubic-bezier(.2,.8,.3,1) both }
.ds-row { transition: background .2s, border-color .2s, transform .2s }
.ds-row:hover { background: rgba(255,255,255,.035); border-color: rgba(212,175,55,.28) }
.ds-typing span { display:inline-block; width:5px; height:5px; border-radius:9999px; background:#d4af37; margin:0 1.5px; animation: dsBlink 1.2s infinite }
.ds-typing span:nth-child(2){ animation-delay:.15s } .ds-typing span:nth-child(3){ animation-delay:.3s }
.ds-scroll::-webkit-scrollbar { width:8px } .ds-scroll::-webkit-scrollbar-thumb { background:rgba(212,175,55,.25); border-radius:9999px }
.ds-tool { transition: color .18s, background .18s, transform .12s }
.ds-tool:hover { color:#f5ead0; background:rgba(212,175,55,.1) } .ds-tool:active { transform:scale(.9) }
`

function useCommsStyles() {
  useDashboardStyles()
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const el = document.createElement('style')
    el.id = STYLE_ID; el.textContent = CSS
    document.head.appendChild(el)
  }, [])
}

/* ── contact normalization (prospects + clients → one shape) ─────────────── */
function buildContacts(prospects, clients, projects) {
  const projByClient = new Map(projects.map((p) => [p.client_id, p]))
  const ps = prospects.map((p) => ({
    id: `p-${p.id}`, prospectId: p.id, kind: 'Prospect', business: p.business_name || 'Unknown business',
    name: p.owner_name || '', email: p.email || '', phone: p.phone || '',
    website: p.website || '', stage: p.status || 'New Lead', rating: p.google_rating,
    followUp: p.next_follow_up, notes: p.notes || '', tags: p.tags || [],
    score: p.website_score, created: p.created_at, lastContacted: p.last_contacted_at,
    proposalSentAt: p.proposal_sent_at,
  }))
  const cs = clients.map((c) => {
    const proj = projByClient.get(c.id)
    return {
      id: `c-${c.id}`, clientId: c.id, kind: 'Client', business: c.company_name || c.contact_name || 'Client',
      name: c.contact_name || '', email: c.email || '', phone: c.phone || '',
      website: c.website || '', stage: proj?.stage || 'Client', rating: c.google_rating,
      notes: c.notes || '', tags: c.industry ? [c.industry] : [], projectRef: proj?.project_reference,
      projectStage: proj?.stage, project: proj || null, projectType: c.project_type || proj?.project_type,
      created: c.created_at,
    }
  })
  return [...cs, ...ps]
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function Communications({ prospects = [], clients = [], projects = [], userEmail }) {
  useCommsStyles()
  const contacts = useMemo(() => buildContacts(prospects, clients, projects), [prospects, clients, projects])

  const [folder, setFolder] = useState('inbox')
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [composing, setComposing] = useState(false)
  const [openThread, setOpenThread] = useState(null)
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [commandOpen, setCommandOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const [contact, setContact] = useState(null)           // active recipient / intelligence
  const [email, setEmail] = useState(blankEmail())        // composer content
  const [undoBuf, setUndoBuf] = useState(null)            // last assistant patch (for undo)
  const [sending, setSending] = useState(false)

  const [providers, setProviders] = useState(null)        // { canSend, outbound, inbox, ... }
  const [aiContext, setAiContext] = useState(null)        // loaded AI context for `contact`
  const [contextOpen, setContextOpen] = useState(false)   // AI Context drawer open?
  const [liveThreads, setLiveThreads] = useState({})      // folder -> { configured, threads }
  const aiContextRef = useRef(null)
  aiContextRef.current = aiContext

  // Provider capabilities (which send/inbox providers are live). One call.
  useEffect(() => { mail.getProviders().then(setProviders).catch(() => {}) }, [])

  // Load the full AI context whenever the active contact changes. Derived data
  // shows instantly; Supabase enrichment fills in async.
  useEffect(() => {
    if (!contact) { setAiContext(null); return }
    setAiContext(deriveContext(contact))
    let alive = true
    loadContactContext(supabase, contact).then((ctx) => { if (alive) setAiContext(ctx) }).catch(() => {})
    return () => { alive = false }
  }, [contact?.id])

  // Live threads for the active list folder (falls back to seed demo data when
  // no provider/log is configured, so the workspace always looks alive).
  useEffect(() => {
    const listFolders = ['inbox', 'sent', 'drafts', 'scheduled', 'archive']
    if (!listFolders.includes(folder)) return
    if (liveThreads[folder]) return
    let alive = true
    mail.listThreads(folder).then((r) => {
      if (alive && r.configured && r.threads.length) setLiveThreads((m) => ({ ...m, [folder]: r }))
    }).catch(() => {})
    return () => { alive = false }
  }, [folder])

  // unread counts per folder (demo — inbox only for now)
  const counts = useMemo(() => ({
    inbox: (SEED_THREADS.inbox || []).filter((t) => t.unread).length,
    drafts: (SEED_THREADS.drafts || []).length,
    scheduled: (SEED_THREADS.scheduled || []).length,
    prospects: prospects.length,
    clients: clients.length,
  }), [prospects.length, clients.length])

  const flash = (msg, tone = 'gold') => { setToast({ msg, tone }); }
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t) }, [toast])

  // ⌘K / Ctrl+K opens the command bar.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen((o) => !o) }
      if (e.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── composer actions ──────────────────────────────────────────────────── */
  const startCompose = (to = null, seed = {}) => {
    setComposing(true); setOpenThread(null)
    if (to) {
      setContact(to)
      setEmail((e) => ({ ...blankEmail(), to: to.email || '', ...seed, subject: seed.subject ?? e.subject }))
    } else {
      setEmail((e) => ({ ...e, ...seed }))
    }
  }

  const applyTemplate = (tpl) => {
    const ctx = contactCtx(contact)
    const fill = (s) => s.replace(/\{\{name\}\}/g, ctx.name || 'there').replace(/\{\{business\}\}/g, ctx.business || 'your business')
      .replace(/\{\{region\}\}/g, DS.region).replace(/\{\{booking\}\}/g, DS.booking)
    setComposing(true); setOpenThread(null); setFolder('inbox')
    setEmail((e) => ({ ...e, subject: fill(tpl.subject), body: fill(tpl.body) + '\n' + DS.signature }))
    flash(`Template “${tpl.name}” loaded into composer`)
  }

  // Attach a pre-hosted project asset (Smart Attachments). A hosted VIDEO drops
  // the "View Website Preview Video" button into the body; everything else just
  // becomes a chip (rendered inline / as a button in the sent email).
  const attachAsset = (asset) => {
    setComposing(true)
    setEmail((e) => {
      if (e.attachments.some((a) => a.id === asset.id)) return e
      const chip = { ...asset, kind: asset.kind || 'doc', hosted: !!asset.url }
      let body = e.body
      if (chip.kind === 'video' && chip.url) body = withVideoButton(body, chip.url)
      return { ...e, attachments: [...e.attachments, chip], body }
    })
    flash(asset.kind === 'video' ? 'Video added as a hosted preview link' : `Attached ${asset.label}`, asset.kind === 'video' ? 'blue' : 'gold')
  }

  // Remove an attachment — and if it was a hosted video, strip its body button.
  const removeAttachment = (id) => setEmail((e) => {
    const gone = e.attachments.find((a) => a.id === id)
    const body = gone?.kind === 'video' && gone.url ? withoutVideoButton(e.body, gone.url) : e.body
    return { ...e, attachments: e.attachments.filter((a) => a.id !== id), body }
  })

  // Upload files. Videos (and anything oversized) upload to Supabase Storage and
  // become a hosted link — never a raw attachment. Each chip shows an
  // uploading → hosted/failed lifecycle; a failed upload is surfaced, not silent.
  const onUpload = async (files) => {
    setComposing(true)
    const items = Array.from(files).map((f, i) => {
      const kind = fileKindOf(f)
      const host = mustHost(f)
      return {
        file: f,
        chip: { id: `up-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`, label: f.name, kind, icon: iconForKind(kind), size: humanSize(f.size), hosted: host, uploading: host },
      }
    })
    // Show every chip immediately (hosted ones as "uploading…").
    setEmail((e) => ({ ...e, attachments: [...e.attachments, ...items.map((it) => it.chip)] }))

    for (const { file, chip } of items) {
      if (!chip.uploading) continue // small non-video: kept as a local chip (inline attach handled server-side later)
      const res = await uploadToStorage(file, { prefix: contact?.business ? slugify(contact.business) : 'uploads' })
      setEmail((e) => {
        const attachments = e.attachments.map((a) => a.id !== chip.id ? a
          : res.ok ? { ...a, uploading: false, hosted: true, url: res.url } : { ...a, uploading: false, failed: true, error: res.error })
        const body = res.ok && chip.kind === 'video' ? withVideoButton(e.body, res.url) : e.body
        return { ...e, attachments, body }
      })
      if (res.ok) flash(chip.kind === 'video' ? 'Video uploaded → preview link added to the email' : `Uploaded ${chip.label}`, 'gold')
      else flash(`Upload failed: ${res.error}`, 'blue')
    }
    const small = items.filter((it) => !it.chip.uploading)
    if (small.length) flash(`Attached ${small.length} file${small.length > 1 ? 's' : ''}`, 'gold')
  }

  /* ── assistant (live LLM, offline fallback) ────────────────────────────── */
  const assistantRef = useRef(null)
  const runAssist = async (instruction) => {
    setAssistantOpen(true)
    const before = email
    const log = assistantRef.current
    log?.pushUser?.(instruction)                       // user bubble + typing dots
    let res
    try {
      res = await assistRemote(instruction, { email, ctx: contactCtx(contact), contact: contact || {}, context: aiContextRef.current || {} })
    } catch {
      res = { reply: 'I hit a snag reaching the model — try again in a moment.' }
    }
    if (res.patch) { setEmail((e) => ({ ...e, ...res.patch })); setUndoBuf({ before }); setComposing(true) }
    log?.pushAI?.(res)
    return res
  }
  const undoAssist = () => { if (undoBuf) { setEmail(undoBuf.before); setUndoBuf(null); flash('Reverted the assistant’s last edit') } }

  /* ── send / schedule / draft via the provider-agnostic mail service ─────── */
  const crmFor = (c) => c ? { prospect_id: c.prospectId || null, client_id: c.clientId || null, contact_email: c.email || email.to || null } : { contact_email: email.to || null }
  // Final body = the clean message, plus quoted thread history only if opted in.
  const composedBody = (e) => (e.includeHistory && e.quoted ? `${e.body.replace(/\s+$/, '')}\n\n${e.quoted}` : e.body)
  // Only hosted (url) or byte (content) attachments are sendable — skip chips
  // still uploading or that failed.
  const sendableAttachments = (e) => e.attachments.filter((a) => (a.url || a.content) && !a.uploading && !a.failed)
    .map((a) => ({ id: a.id, label: a.label, kind: a.kind, size: a.size, url: a.url, content: a.content }))
  const doSend = async () => {
    if (sending) return
    const action = email.scheduledFor ? 'schedule' : 'send'
    if (!email.to.trim()) { flash('Add a recipient first', 'blue'); return }
    if (!email.subject.trim()) { flash('Add a subject first', 'blue'); return }
    if (email.attachments.some((a) => a.uploading)) { flash('An attachment is still uploading…', 'blue'); return }
    setSending(true)
    const res = await mail.send({
      action, to: email.to, cc: email.cc, bcc: email.bcc, subject: email.subject, body: composedBody(email),
      attachments: sendableAttachments(email), scheduledFor: scheduleISO(email.scheduledFor), crm: crmFor(contact),
    })
    setSending(false)
    if (res.ok) {
      if (res.folder === 'scheduled') flash(`Scheduled · ${email.scheduledFor}`, 'blue')
      else flash(res.sandbox ? 'Sent (sandbox → test inbox)' : `Sent to ${res.to || email.to}`)
      setComposing(false); setEmail(blankEmail()); setContact(contact)
      setLiveThreads((m) => ({ ...m, sent: undefined, scheduled: undefined }))
    } else if (res.offline) {
      flash('No mail backend reachable — deploy to Vercel or run `vercel dev`', 'blue')
    } else {
      flash(res.error || 'Send failed', 'blue')
    }
  }
  const saveDraft = async () => {
    const res = await mail.send({ action: 'draft', to: email.to, subject: email.subject, body: composedBody(email), attachments: sendableAttachments(email), crm: crmFor(contact) })
    flash(res.ok ? 'Saved to Drafts' : 'Draft saved locally', 'gold')
    setLiveThreads((m) => ({ ...m, drafts: undefined }))
  }

  /* ── command bar dispatch ──────────────────────────────────────────────── */
  const runCommand = (text) => {
    const cmd = parseCommand(text)
    setCommandOpen(false)
    if (!cmd) return
    if (cmd.kind === 'compose') {
      const match = fuzzyContact(contacts, cmd.business)
      startCompose(match, match ? { subject: cmd.about ? `About ${cmd.about}` : '' } : {})
      flash(match ? `New email → ${match.business}` : `New email → ${cmd.business} (no matching contact)`)
    } else if (cmd.kind === 'attach') {
      const asset = SMART_ASSETS.find((a) => a.id === cmd.asset) || SMART_ASSETS[0]
      attachAsset(asset)
    } else if (cmd.kind === 'assist') {
      runAssist(cmd.instruction)
    } else if (cmd.kind === 'schedule') {
      setComposing(true)
      setEmail((e) => ({ ...e, scheduledFor: cmd.when }))
      flash(`Scheduled to send · ${cmd.when}`, 'blue')
    } else if (cmd.kind === 'bulk') {
      const n = contacts.filter((c) => c.kind === 'Prospect').length
      flash(`Queued follow-ups to ${n} prospect${n === 1 ? '' : 's'} silent ${cmd.days}+ days (preview)`, 'blue')
    }
  }

  // Prefer live (provider/log-backed) threads; fall back to seed demo data so
  // the workspace always renders something premium.
  const threads = liveThreads[folder]?.threads?.length ? liveThreads[folder].threads : (SEED_THREADS[folder] || [])
  const threadsAreLive = !!liveThreads[folder]?.configured

  const openFolder = (id) => {
    setFolder(id); setOpenThread(null)
    if (id === 'assistant') { setAssistantOpen(true); setComposing(true) }
    else if (id === 'templates' || id === 'prospects' || id === 'clients') setComposing(false)
    else setComposing(false)
  }

  const readThread = (t) => { setOpenThread(t); setComposing(false) }
  // Reply starts CLEAN — a greeting, no quoted wall of text. The original thread
  // is kept aside and only appended if the sender flips "Include original message".
  const replyTo = (t) => {
    const c = fuzzyContact(contacts, t.business) || { business: t.business, name: t.from, email: t.email }
    setContact(c)
    const first = (c.name || t.from || '').split(' ')[0]
    startCompose(c, {
      to: t.email,
      subject: t.subject.startsWith('Re:') ? t.subject : `Re: ${t.subject}`,
      body: first ? `Hi ${first},\n\n` : '',
      quoted: `On ${new Date(t.at).toLocaleString()}, ${t.from} wrote:\n${quote(t.body)}`,
      includeHistory: false,
    })
    flash(`Replying to ${t.from}`)
  }

  return (
    <div className="ds-fade-up">
      {/* ── command bar ─────────────────────────────────────────────────── */}
      <CommandBar open={commandOpen} onOpen={() => setCommandOpen(true)} onClose={() => setCommandOpen(false)} onRun={runCommand} />

      {/* ── three-panel workspace ───────────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT RAIL */}
        <FolderRail
          folder={folder} counts={counts} collapsed={railCollapsed} providers={providers}
          onSelect={openFolder} onToggle={() => setRailCollapsed((c) => !c)} onCompose={() => startCompose()}
        />

        {/* CENTER */}
        <div className="min-w-0 flex-1">
          <CenterHeader
            folder={folder} composing={composing} openThread={openThread}
            onCompose={() => startCompose()} onCloseCompose={() => setComposing(false)}
            onBack={() => setOpenThread(null)} assistantOpen={assistantOpen}
            onToggleAssistant={() => setAssistantOpen((o) => !o)}
          />
          <div className="mt-3">
            {composing ? (
              <Composer
                email={email} setEmail={setEmail} contact={contact} setContact={setContact}
                contacts={contacts} onAttachAsset={attachAsset} onRemoveAttachment={removeAttachment}
                onUpload={onUpload} onAssist={runAssist} undoBuf={undoBuf} onUndo={undoAssist}
                onSend={doSend} onSaveDraft={saveDraft} sending={sending} providers={providers}
              />
            ) : openThread ? (
              <Reader thread={openThread} onReply={() => replyTo(openThread)} onBack={() => setOpenThread(null)} />
            ) : folder === 'templates' ? (
              <TemplatesGallery onUse={applyTemplate} />
            ) : folder === 'prospects' || folder === 'clients' ? (
              <ContactList
                contacts={contacts.filter((c) => (folder === 'clients' ? c.kind === 'Client' : c.kind === 'Prospect'))}
                kind={folder} onCompose={(c) => startCompose(c)} onSelect={setContact} active={contact}
              />
            ) : folder === 'assistant' ? (
              <AssistantSplash onCompose={() => startCompose()} />
            ) : (
              <MessageList folder={folder} threads={threads} live={threadsAreLive} onOpen={readThread} onReply={replyTo} onCompose={() => startCompose()} />
            )}
          </div>

          {/* Future features rail — shown on browse views (kept out of the way
              while composing or reading so the workspace stays focused). */}
          {!composing && !openThread && <FutureStrip />}
        </div>

        {/* RIGHT — AI CONTEXT + ASSISTANT */}
        {assistantOpen && (
          <Assistant
            ref={assistantRef} contact={contact} email={email} providers={providers}
            aiContext={aiContext} contextOpen={contextOpen} onToggleContext={() => setContextOpen((o) => !o)}
            onRun={runAssist} onClose={() => setAssistantOpen(false)}
            onUseSubject={(s) => { setEmail((e) => ({ ...e, subject: s })); setComposing(true); flash('Subject applied') }}
            onUndo={undoAssist} canUndo={!!undoBuf}
          />
        )}
      </div>

      {toast && <Toast {...toast} />}
    </div>
  )
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
const blankEmail = () => ({ to: '', cc: '', bcc: '', subject: '', body: '', attachments: [], scheduledFor: null, quoted: '', includeHistory: false })
// Best-effort: turn a loose schedule label ("Next Tuesday · 9:00 AM", "Tomorrow")
// into an ISO timestamp for the backend. Falls back to +3 days at 9am.
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
function scheduleISO(label) {
  if (!label) return null
  const l = String(label).toLowerCase()
  const d = new Date(); d.setHours(9, 0, 0, 0)
  if (l.includes('tomorrow')) d.setDate(d.getDate() + 1)
  else {
    const wd = WEEKDAYS.findIndex((w) => l.includes(w))
    if (wd >= 0) { let add = (wd - d.getDay() + 7) % 7; if (add === 0 || l.includes('next')) add = add === 0 ? 7 : add; d.setDate(d.getDate() + add) }
    else d.setDate(d.getDate() + 3)
  }
  const t = l.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/)
  if (t) { let h = Number(t[1]) % 12; if (t[3] === 'pm') h += 12; d.setHours(h, Number(t[2] || 0), 0, 0) }
  return d.toISOString()
}
const contactCtx = (c) => c ? { name: (c.name || '').split(' ')[0], business: c.business, rating: c.rating, notes: c.notes } : {}
const quote = (b = '') => b.split('\n').map((l) => `> ${l}`).join('\n')
const slugify = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'uploads'

// The clean, hosted "View Website Preview Video" button is inserted into the
// email body as a markdown link — resend.js renders it as a real button, and it
// stays clickable as a plain URL in text-only clients. One per URL, idempotent.
const VIDEO_BTN_LABEL = '▶ View Website Preview Video'
const videoButtonMd = (url) => `[${VIDEO_BTN_LABEL}](${url})`
function withVideoButton(body = '', url) {
  if (!url || body.includes(url)) return body
  const base = body.replace(/\s+$/, '')
  return `${base}${base ? '\n\n' : ''}${videoButtonMd(url)}\n`
}
function withoutVideoButton(body = '', url) {
  if (!url) return body
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return body.replace(new RegExp(`\\n*\\[[^\\]]*\\]\\(${escaped}\\)\\n*`, 'g'), '\n').replace(/\n{3,}/g, '\n\n').trim()
}
function fuzzyContact(contacts, q = '') {
  const n = q.trim().toLowerCase()
  if (!n) return null
  return contacts.find((c) => c.business.toLowerCase() === n)
    || contacts.find((c) => c.business.toLowerCase().includes(n) || n.includes(c.business.toLowerCase()))
    || null
}
const Ic = ({ name, className }) => { const C = I[name]; return C ? <C className={className} /> : null }

/* ═══════════════════════════════════════════════════ COMMAND BAR ═════════ */
function CommandBar({ open, onOpen, onClose, onRun }) {
  const [val, setVal] = useState('')
  const [ph, setPh] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20) }, [open])
  useEffect(() => {
    if (open) return
    const t = setInterval(() => setPh((p) => (p + 1) % COMMAND_EXAMPLES.length), 3200)
    return () => clearInterval(t)
  }, [open])

  const submit = (e) => { e?.preventDefault(); if (val.trim()) { onRun(val.trim()); setVal('') } }

  return (
    <div className="relative">
      <form
        onSubmit={submit}
        className="flex items-center gap-3 rounded-2xl border border-gold-400/25 bg-gradient-to-r from-white/[0.05] to-white/[0.015] px-4 py-3"
        style={open ? { animation: 'dsCmdGlow 3s ease-in-out infinite' } : undefined}
      >
        <span className="font-mono text-lg font-bold text-gold-300">&gt;</span>
        <input
          ref={inputRef} value={val} onFocus={onOpen} onChange={(e) => setVal(e.target.value)}
          placeholder={open ? 'Type a command… e.g. Email Mario Plumbing about their homepage' : COMMAND_EXAMPLES[ph]}
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
        />
        <kbd className="hidden shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-gray-500 sm:flex">⌘K</kbd>
        {val && <button type="submit" className="shrink-0 rounded-lg bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-ink-950">Run</button>}
      </form>

      {open && (
        <div className="ds-pop absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-card backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Try a command</span>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200">✕</button>
          </div>
          <div className="max-h-72 overflow-y-auto ds-scroll p-2">
            {COMMAND_EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => { onRun(ex); setVal('') }}
                className="ds-row flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gold-400/30 bg-gold-400/[0.08] text-gold-300"><I.Command className="h-3.5 w-3.5" /></span>
                <span className="text-sm text-gray-300">{ex}</span>
                <I.Send className="ml-auto h-3.5 w-3.5 text-gray-600" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════ FOLDER RAIL ═════════ */
function FolderRail({ folder, counts, collapsed, providers, onSelect, onToggle, onCompose }) {
  return (
    <aside className={`shrink-0 transition-all duration-300 ${collapsed ? 'lg:w-16' : 'lg:w-56'} w-full`}>
      <GlassCard className="p-3">
        <div className={`mb-3 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold-400/30 bg-gold-400/[0.08] text-gold-300"><I.Inbox className="h-4 w-4" /></span>
              <span className="font-display text-sm font-bold text-gray-50">Communications</span>
            </div>
          )}
          <button onClick={onToggle} aria-label="Collapse sidebar"
            className="ds-tool flex h-7 w-7 items-center justify-center rounded-lg text-gray-500">
            <I.ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <button onClick={onCompose}
          className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-gradient py-2.5 font-display text-sm font-semibold text-ink-950 shadow-gold transition-transform hover:brightness-110 active:scale-[.98] ${collapsed ? 'px-0' : 'px-3'}`}>
          <I.Plus className="h-4 w-4" />{!collapsed && 'Compose'}
        </button>

        <nav className="space-y-1">
          {FOLDERS.map((f) => {
            const active = folder === f.id
            const count = counts[f.id]
            return (
              <button key={f.id} onClick={() => onSelect(f.id)} title={f.label}
                className={`group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${collapsed ? 'justify-center px-0' : ''} ${
                  active ? 'border-gold-400/60 bg-gold-400/10 text-gold-100' : 'border-transparent text-gray-400 hover:border-white/10 hover:bg-white/[0.03] hover:text-gray-200'
                }`}>
                <span className={`shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-gold-300' : ''}`}><Ic name={f.icon} className="h-4 w-4" /></span>
                {!collapsed && <span className="flex-1 text-left">{f.label}</span>}
                {!collapsed && count > 0 && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'bg-gold-400/25 text-gold-100' : 'bg-white/[0.06] text-gray-400'}`}>{count}</span>
                )}
                {collapsed && count > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold-400" />}
              </button>
            )
          })}
        </nav>

        {!collapsed && <ProviderStatus providers={providers} />}
      </GlassCard>
    </aside>
  )
}

/* ── provider status card (which email providers are live) ───────────────── */
function ProviderStatus({ providers }) {
  const send = providers?.canSend
  const inbox = providers?.canReceive
  const cap = (label, on, detail) => (
    <div className="flex items-center gap-2">
      <span className={`flex h-2 w-2 rounded-full ${on ? 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,.5)]' : 'bg-gray-600'}`} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className={`ml-auto text-[10px] ${on ? 'text-emerald-300' : 'text-gray-600'}`}>{detail}</span>
    </div>
  )
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      {cap('Outbound', !!send, send ? cap0(providers?.outbound) : (providers ? 'set up' : '…'))}
      {cap('Inbox', !!inbox, inbox ? cap0(providers?.inbox) : 'Gmail (opt)')}
      <p className="pt-1 text-[11px] leading-relaxed text-gray-500">
        {send ? <>Sending via <span className="text-gold-200">{cap0(providers?.outbound)}</span> from hello@digitalskylineco.com.</> : 'Add RESEND_API_KEY in Vercel to send live.'}
      </p>
    </div>
  )
}
const cap0 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '—')

/* ═══════════════════════════════════════════════════ CENTER HEADER ═══════ */
function CenterHeader({ folder, composing, openThread, onCompose, onCloseCompose, onBack, assistantOpen, onToggleAssistant }) {
  const title = composing ? 'New Message' : openThread ? openThread.subject : FOLDERS.find((f) => f.id === folder)?.label
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {(composing || openThread) && (
          <button onClick={composing ? onCloseCompose : onBack} className="ds-tool flex h-8 w-8 items-center justify-center rounded-lg text-gray-400">
            <I.ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="truncate font-display text-xl font-bold text-gray-50">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {!composing && <button onClick={onCompose} className="btn-gold px-4 py-2 text-xs"><I.Plus className="h-4 w-4" /> Compose</button>}
        <button onClick={onToggleAssistant}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${assistantOpen ? 'border-gold-400/50 bg-gold-400/10 text-gold-100' : 'border-white/10 text-gray-400 hover:text-gray-200'}`}>
          <I.Robot className="h-4 w-4" /> Assistant
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════ COMPOSER ════════════ */
function Composer({ email, setEmail, contact, setContact, contacts, onAttachAsset, onRemoveAttachment, onUpload, onAssist, undoBuf, onUndo, onSend, onSaveDraft, sending, providers }) {
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [intelOpen, setIntelOpen] = useState(true)
  const bodyRef = useRef(null)

  const set = (k) => (e) => setEmail((s) => ({ ...s, [k]: e.target.value }))

  // rich-text ops on the plain textarea via selection wrap/insert
  const surround = (pre, post = pre, placeholder = '') => {
    const ta = bodyRef.current; if (!ta) return
    const { selectionStart: a, selectionEnd: b, value } = ta
    const sel = value.slice(a, b) || placeholder
    const next = value.slice(0, a) + pre + sel + post + value.slice(b)
    setEmail((s) => ({ ...s, body: next }))
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = a + pre.length; ta.selectionEnd = a + pre.length + sel.length })
  }
  const insertLine = (text) => {
    const ta = bodyRef.current; if (!ta) return
    const { selectionStart: a, value } = ta
    const atLineStart = a === 0 || value[a - 1] === '\n'
    const next = value.slice(0, a) + (atLineStart ? '' : '\n') + text + value.slice(a)
    setEmail((s) => ({ ...s, body: next }))
    requestAnimationFrame(() => ta.focus())
  }
  const addLink = () => { const url = window.prompt('Link URL', 'https://'); if (url) surround('[', `](${url})`, 'link text') }

  const TOOLS = [
    { icon: 'Bold', label: 'Bold', on: () => surround('**', '**', 'bold') },
    { icon: 'Italic', label: 'Italic', on: () => surround('*', '*', 'italic') },
    { icon: 'Underline', label: 'Underline', on: () => surround('__', '__', 'underline') },
    { icon: 'Highlight', label: 'Highlight', on: () => surround('==', '==', 'highlight') },
    { icon: 'Heading', label: 'Heading', on: () => insertLine('## ') },
    { icon: 'ListBullet', label: 'Bulleted list', on: () => insertLine('• ') },
    { icon: 'ListNumber', label: 'Numbered list', on: () => insertLine('1. ') },
    { icon: 'LinkIcon', label: 'Link', on: addLink },
    { icon: 'Emoji', label: 'Emoji', on: () => setEmojiOpen((o) => !o) },
    { icon: 'Signature', label: 'Insert signature', on: () => insertLine('\n' + DS.signature) },
  ]
  const EMOJIS = ['👍', '🙏', '🚀', '✅', '🔥', '⭐', '📈', '💡', '🎯', '👋', '📎', '🤝', '💬', '🏆', '⚡', '✨']

  return (
    <GlassCard className="overflow-visible p-0">
      {/* recipient + contact intelligence */}
      {contact && intelOpen && <ContactIntel contact={contact} onClose={() => setIntelOpen(false)} />}

      <div className="space-y-1 px-5 pt-4">
        <Field label="To" value={email.to} onChange={set('to')} placeholder="name@business.com" list="ds-contacts"
          right={<div className="flex gap-2 text-[11px] font-medium text-gray-500">
            {!showCc && <button onClick={() => setShowCc(true)} className="hover:text-gold-200">Cc</button>}
            {!showBcc && <button onClick={() => setShowBcc(true)} className="hover:text-gold-200">Bcc</button>}
          </div>} />
        <datalist id="ds-contacts">
          {contacts.map((c) => <option key={c.id} value={c.email}>{c.business}</option>)}
        </datalist>
        {showCc && <Field label="Cc" value={email.cc} onChange={set('cc')} placeholder="cc@business.com" />}
        {showBcc && <Field label="Bcc" value={email.bcc} onChange={set('bcc')} placeholder="bcc@business.com" />}
        <Field label="Subject" value={email.subject} onChange={set('subject')} placeholder="Subject" bold />
      </div>

      {/* toolbar */}
      <div className="mt-2 flex flex-wrap items-center gap-1 border-y border-white/[0.06] px-3 py-2">
        {TOOLS.map((t) => (
          <button key={t.label} onClick={t.on} title={t.label} aria-label={t.label}
            className="ds-tool flex h-8 w-8 items-center justify-center rounded-lg text-gray-400"><Ic name={t.icon} className="h-4 w-4" /></button>
        ))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        <div className="relative">
          <button onClick={() => setAttachOpen((o) => !o)} title="Attach"
            className={`ds-tool flex h-8 items-center gap-1.5 rounded-lg px-2 text-gray-400 ${attachOpen ? 'bg-gold-400/10 text-gold-200' : ''}`}>
            <I.Paperclip className="h-4 w-4" /><span className="text-xs">Attach</span>
          </button>
          {attachOpen && <SmartAttachMenu onPick={(a) => { onAttachAsset(a); setAttachOpen(false) }} onUpload={(f) => { onUpload(f); setAttachOpen(false) }} onClose={() => setAttachOpen(false)} />}
        </div>
        {emojiOpen && (
          <div className="ds-pop absolute z-30 mt-10 grid grid-cols-8 gap-1 rounded-xl border border-white/10 bg-ink-950/95 p-2 shadow-card">
            {EMOJIS.map((em) => <button key={em} onClick={() => { insertLine(em); setEmojiOpen(false) }} className="rounded-md p-1 text-lg hover:bg-white/10">{em}</button>)}
          </div>
        )}
      </div>

      {/* editor + drop zone */}
      <div
        className={`relative px-5 py-4 transition-colors ${dragOver ? 'bg-gold-400/[0.04]' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files) }}
      >
        <textarea
          ref={bodyRef} value={email.body} onChange={set('body')} rows={13}
          placeholder="Write your message…  ✨ Tip: ask the assistant on the right to draft or refine this."
          className="w-full resize-y bg-transparent text-[15px] leading-relaxed text-gray-200 placeholder:text-gray-600 focus:outline-none"
        />
        {dragOver && (
          <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border-2 border-dashed border-gold-400/50 bg-ink-950/60">
            <span className="font-display text-sm text-gold-200">Drop files to attach</span>
          </div>
        )}
        {undoBuf && (
          <button onClick={onUndo} className="ds-pop mt-1 inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/[0.06] px-3 py-1 text-[11px] text-gold-200 hover:border-gold-400/60">
            <I.Reply className="h-3 w-3" /> Undo assistant edit
          </button>
        )}
      </div>

      {/* reply thread history — clean by default, included only on opt-in */}
      {email.quoted && (
        <div className="px-5 pb-3">
          <button
            onClick={() => setEmail((e) => ({ ...e, includeHistory: !e.includeHistory }))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition-colors ${email.includeHistory ? 'border-gold-400/50 bg-gold-400/10 text-gold-100' : 'border-white/10 bg-white/[0.02] text-gray-400 hover:text-gray-200'}`}>
            <span className="font-mono">···</span>
            {email.includeHistory ? 'Original message included' : 'Include original message'}
          </button>
          {email.includeHistory && (
            <pre className="ds-scroll mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-2 font-sans text-[11px] leading-relaxed text-gray-500">{email.quoted}</pre>
          )}
        </div>
      )}

      {/* attachment previews */}
      {email.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {email.attachments.map((a) => <AttachChip key={a.id} a={a} onRemove={() => onRemoveAttachment(a.id)} />)}
        </div>
      )}

      {/* action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onSend} disabled={sending}
            className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 font-display text-sm font-semibold text-ink-950 shadow-gold transition-transform hover:brightness-110 active:scale-[.98] disabled:opacity-60">
            {sending ? <><span className="ds-typing"><span /><span /><span /></span> Sending</> : <><I.Send className="h-4 w-4" /> {email.scheduledFor ? 'Schedule' : 'Send'}</>}
          </button>
          <button onClick={onSaveDraft} disabled={sending} className="ds-tool flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-gray-400" title="Save draft">
            <I.Draft className="h-4 w-4" /><span className="text-xs">Save draft</span>
          </button>
          <label className="ds-tool flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400" title="Upload">
            <I.Paperclip className="h-4 w-4" />
            <input type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.target.value = '' }} />
          </label>
          <button onClick={() => onAssist('write a follow-up email')} className="ds-tool flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-gray-400" title="Ask assistant">
            <I.Robot className="h-4 w-4" /><span className="text-xs">Draft with AI</span>
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {email.scheduledFor && <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-1 text-blue-200"><I.Clock className="h-3 w-3" /> {email.scheduledFor}</span>}
          {providers && !providers.canSend && <span className="text-amber-300/80">preview · configure Resend to send</span>}
          <span className="font-mono">{wordCount(email.body)} words</span>
        </div>
      </div>
    </GlassCard>
  )
}

function Field({ label, value, onChange, placeholder, bold, right, list }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.05] py-1.5">
      <span className="w-14 shrink-0 font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <input
        value={value} onChange={onChange} placeholder={placeholder} list={list}
        className={`min-w-0 flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none ${bold ? 'font-display font-semibold text-base' : ''}`}
      />
      {right}
    </div>
  )
}

function AttachChip({ a, onRemove }) {
  const failed = a.failed
  const uploading = a.uploading
  const hostedVideo = a.kind === 'video' && a.url
  const border = failed ? 'border-rose-400/40' : hostedVideo ? 'border-blue-400/30' : 'border-white/10'
  return (
    <div className={`ds-pop group flex items-center gap-2.5 rounded-xl border ${border} bg-white/[0.03] py-2 pl-2.5 pr-2`}>
      <span className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border ${failed ? 'border-rose-400/30 text-rose-300' : 'border-gold-400/25 bg-gold-400/[0.06] text-gold-300'}`}>
        {a.kind === 'image' && a.url
          ? <img src={a.url} alt="" className="h-full w-full object-cover" />
          : <Ic name={a.icon} className="h-4 w-4" />}
        {a.kind === 'video' && <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white"><I.Play className="h-3.5 w-3.5" /></span>}
      </span>
      <div className="min-w-0">
        <div className="max-w-[170px] truncate text-xs font-medium text-gray-200">{a.label}</div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {uploading ? (
            <span className="inline-flex items-center gap-1 text-blue-300"><span className="ds-typing"><span /><span /><span /></span> uploading…</span>
          ) : failed ? (
            <span className="text-rose-300" title={a.error}>upload failed — remove &amp; retry</span>
          ) : hostedVideo ? (
            <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 rounded bg-blue-400/10 px-1 text-blue-300 hover:text-blue-200"><I.LinkIcon className="h-2.5 w-2.5" /> hosted video link</a>
          ) : a.url ? (
            <span className="text-gray-500">{a.size} · <a href={a.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gold-200">preview</a></span>
          ) : (
            <span className="text-gray-500">{a.size}</span>
          )}
        </div>
      </div>
      <button onClick={onRemove} className="ml-1 text-gray-600 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100">✕</button>
    </div>
  )
}

function SmartAttachMenu({ onPick, onUpload, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="ds-pop absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-card backdrop-blur-xl">
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Smart attachments</span>
          <p className="mt-0.5 text-[11px] text-gray-500">Attach existing project assets — with previews.</p>
        </div>
        <div className="max-h-64 overflow-y-auto ds-scroll p-2">
          {SMART_ASSETS.map((a) => (
            <button key={a.id} onClick={() => onPick(a)} className="ds-row flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-400/25 bg-gold-400/[0.06] text-gold-300"><Ic name={a.icon} className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-gray-200">{a.label}</div>
                <div className="truncate font-mono text-[10px] text-gray-500">{a.hint} · {a.size}</div>
              </div>
              <I.Plus className="h-4 w-4 text-gray-600" />
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 border-t border-white/[0.06] py-2.5 text-xs text-gold-200 hover:bg-gold-400/[0.06]">
          <I.Paperclip className="h-4 w-4" /> Upload from device
          <input type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files) }} />
        </label>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════ CONTACT INTELLIGENCE ════ */
function ContactIntel({ contact, onClose }) {
  const rows = [
    ['Website', contact.website ? 'Live' : 'No website', contact.website ? 'text-emerald-300' : 'text-amber-300'],
    ['Pipeline', contact.stage || '—'],
    ['Project', contact.projectStage || (contact.kind === 'Client' ? 'Active' : '—')],
    ['Consultation', contact.stage?.includes('Consultation') ? contact.stage : 'Not booked'],
    ['Phone', contact.phone || '—'],
    ['Google', contact.rating ? `${contact.rating}★` : '—'],
    ['Last email', '—', 'text-gray-500'],
    ['Last opened', 'Not tracked yet', 'text-gray-500'],
    ['Last reply', 'Not tracked yet', 'text-gray-500'],
  ]
  const hue = avatarHue(contact.business)
  return (
    <div className="ds-slidel rounded-t-[1.25rem] border-b border-gold-400/15 bg-gradient-to-b from-gold-400/[0.06] to-transparent px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-ink-950" style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 70%), #d4af37)` }}>{initialsOf(contact.business)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-base font-bold text-gray-50">{contact.business}</h4>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${contact.kind === 'Client' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-sky-400/40 bg-sky-400/10 text-sky-200'}`}>{contact.kind}</span>
          </div>
          <p className="truncate text-xs text-gray-500">{contact.name}{contact.name && contact.email ? ' · ' : ''}{contact.email}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200">✕</button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {rows.map(([k, v, cls]) => (
          <div key={k} className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-wider text-gray-600">{k}</div>
            <div className={`truncate text-xs ${cls || 'text-gray-200'}`}>{v}</div>
          </div>
        ))}
      </div>

      {(contact.tags?.length > 0 || contact.notes) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(contact.tags || []).slice(0, 4).map((t) => <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-gray-400">{t}</span>)}
          {contact.notes && <span className="truncate text-[11px] text-gray-500">📝 {contact.notes.split('\n')[0].slice(0, 70)}</span>}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold-400/15 bg-gold-400/[0.04] px-3 py-2">
        <I.Robot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300" />
        <p className="text-[11px] leading-relaxed text-gray-400">
          <span className="text-gold-200">AI read:</span> {aiRead(contact)}
        </p>
      </div>
    </div>
  )
}
function aiRead(c) {
  if (c.kind === 'Client') return `Existing client${c.projectRef ? ` (${c.projectRef})` : ''}. Keep it warm — a project update or thank-you fits best.`
  if (!c.website) return 'No website — lead with getting them online and owning 100% of it. Strong opportunity.'
  if (c.rating && Number(c.rating) >= 4.5) return `Great ${c.rating}★ reputation. Reference their reviews and offer a faster site to convert more of that traffic.`
  return 'Warm prospect. A short preview + free consultation offer is the highest-converting angle.'
}

/* ═══════════════════════════════════════════════════ MESSAGE LIST ════════ */
function MessageList({ folder, threads, live, onOpen, onReply, onCompose }) {
  if (!threads.length) return <EmptyState folder={folder} onCompose={onCompose} />
  return (
    <div>
    {!live && (
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-1.5 text-[11px] text-gray-500">
        <I.Sparkle className="h-3 w-3 text-gold-300/70" /> Demo preview — {folder === 'inbox' ? 'connect Gmail for a live inbox' : 'sent mail appears here once you send live'}.
      </div>
    )}
    <GlassCard className="divide-y divide-white/[0.05] p-0">
      {threads.map((t, i) => (
        <button key={t.id} onClick={() => onOpen(t)} style={{ animation: `dsFadeUp .4s ${i * 0.04}s both` }}
          className="ds-row flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-3.5 text-left hover:border-l-gold-400/60">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold text-ink-950"
            style={{ background: `linear-gradient(135deg, hsl(${avatarHue(t.business)} 60% 70%), #d4af37)` }}>{initialsOf(t.from === 'You' ? t.business : t.from)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`truncate text-sm ${t.unread ? 'font-semibold text-gray-50' : 'text-gray-300'}`}>{folder === 'sent' || folder === 'drafts' || folder === 'scheduled' ? `To: ${t.business}` : t.from}</span>
              {t.starred && <I.Star className="h-3 w-3 shrink-0 text-gold-300" />}
              <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-500">{t.sendAt || relTime(t.at)}</span>
            </div>
            <div className={`truncate text-sm ${t.unread ? 'text-gray-200' : 'text-gray-400'}`}>{t.subject}</div>
            <div className="truncate text-xs text-gray-500">{t.preview}</div>
          </div>
          {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-400 shadow-[0_0_8px_2px_rgba(212,175,55,.5)]" />}
          {folder === 'sent' && (
            <span className="hidden shrink-0 items-center gap-1 sm:flex">
              {t.opened && <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-300">opened</span>}
              {t.clicked && <span className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[9px] text-sky-300">clicked</span>}
            </span>
          )}
        </button>
      ))}
    </GlassCard>
    </div>
  )
}

function EmptyState({ folder, onCompose }) {
  const copy = {
    inbox: ['Inbox zero.', 'No new messages. When replies land, they’ll appear here in real time.'],
    sent: ['Nothing sent yet.', 'Your outgoing emails and their open/click activity will show up here.'],
    drafts: ['No drafts.', 'Start writing and your work-in-progress saves here automatically.'],
    scheduled: ['Nothing scheduled.', 'Queue an email for the perfect moment — it’ll wait right here.'],
    archive: ['Archive is empty.', 'Tucked-away threads live here, one search away.'],
  }[folder] || ['Nothing here yet.', '']
  return (
    <GlassCard className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] text-gold-300"><I.Inbox className="h-7 w-7" /></span>
      <h3 className="mt-4 font-display text-lg font-semibold text-gray-100">{copy[0]}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{copy[1]}</p>
      <button onClick={onCompose} className="btn-gold mt-5 px-5 py-2.5 text-sm"><I.Plus className="h-4 w-4" /> Compose a message</button>
    </GlassCard>
  )
}

/* ═══════════════════════════════════════════════════ READER ══════════════ */
function Reader({ thread, onReply, onBack }) {
  return (
    <GlassCard className="p-0">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <h3 className="font-display text-xl font-bold text-gray-50">{thread.subject}</h3>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl font-display text-xs font-bold text-ink-950" style={{ background: `linear-gradient(135deg, hsl(${avatarHue(thread.business)} 60% 70%), #d4af37)` }}>{initialsOf(thread.from)}</span>
          <div>
            <div className="text-sm font-medium text-gray-100">{thread.from} <span className="text-gray-500">· {thread.business}</span></div>
            <div className="font-mono text-[11px] text-gray-500">{thread.email} · {new Date(thread.at).toLocaleString()}</div>
          </div>
        </div>
      </div>
      <div className="px-6 py-6">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-300">{thread.body}</p>
      </div>
      <div className="flex items-center gap-2 border-t border-white/[0.06] px-6 py-3">
        <button onClick={onReply} className="btn-gold px-4 py-2 text-xs"><I.Reply className="h-4 w-4" /> Reply</button>
        <button onClick={onBack} className="btn-ghost px-4 py-2 text-xs">Back</button>
      </div>
    </GlassCard>
  )
}

/* ═══════════════════════════════════════════════════ TEMPLATES ═══════════ */
function TemplatesGallery({ onUse }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TEMPLATES.map((t, i) => (
        <GlassCard key={t.id} hover className="p-4" style={{ animation: `dsFadeUp .4s ${i * 0.05}s both` }} onClick={() => onUse(t)}>
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-gold-400/25 bg-gold-400/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold-200">{t.tag}</span>
            <I.Send className="h-3.5 w-3.5 text-gray-600" />
          </div>
          <h4 className="mt-2.5 font-display text-sm font-semibold text-gray-50">{t.name}</h4>
          <p className="mt-1 text-xs text-gray-500">{t.subject}</p>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-400">{t.body.replace(/\{\{\w+\}\}/g, '…')}</p>
        </GlassCard>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════ CONTACT LIST ════════ */
function ContactList({ contacts, kind, onCompose, onSelect, active }) {
  const [q, setQ] = useState('')
  const list = contacts.filter((c) => !q || c.business.toLowerCase().includes(q.toLowerCase()) || (c.name || '').toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2">
        <I.Search className="h-4 w-4 text-gray-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${kind}…`} className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none" />
        <span className="font-mono text-[10px] text-gray-500">{list.length}</span>
      </div>
      {!list.length ? (
        <GlassCard className="px-6 py-12 text-center text-sm text-gray-500">No {kind} yet. Add them in the Sales module and they’ll appear here.</GlassCard>
      ) : (
        <GlassCard className="divide-y divide-white/[0.05] p-0">
          {list.map((c) => (
            <div key={c.id} className={`ds-row flex items-center gap-3 border-l-2 px-4 py-3 ${active?.id === c.id ? 'border-l-gold-400/60 bg-gold-400/[0.04]' : 'border-transparent'}`}>
              <button onClick={() => onSelect(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold text-ink-950" style={{ background: `linear-gradient(135deg, hsl(${avatarHue(c.business)} 60% 70%), #d4af37)` }}>{initialsOf(c.business)}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-100">{c.business}</div>
                  <div className="truncate text-xs text-gray-500">{c.name || c.email || '—'} · {c.stage}</div>
                </div>
              </button>
              {c.rating && <span className="hidden shrink-0 font-mono text-[11px] text-gold-200 sm:block">{c.rating}★</span>}
              <button onClick={() => onCompose(c)} className="shrink-0 rounded-full border border-gold-400/30 bg-gold-400/[0.06] px-3 py-1.5 text-[11px] font-medium text-gold-200 hover:border-gold-400/60"><I.Send className="h-3 w-3" /> Email</button>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════ ASSISTANT SPLASH ════ */
function AssistantSplash({ onCompose }) {
  return (
    <GlassCard className="flex flex-col items-center px-6 py-14 text-center">
      <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-400/30 bg-gold-400/[0.08] text-gold-300">
        <I.Robot className="h-8 w-8" />
        <span className="absolute inset-0 rounded-2xl border border-gold-400/30 animate-pulse-ring" />
      </span>
      <h3 className="mt-5 font-display text-xl font-bold text-gray-50">Your Digital Skyline Assistant</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">Not a generic chatbot — a business assistant that knows Digital Skyline, your services, your pricing and your voice. It drafts, edits and refines the email you’re working on, live.</p>
      <button onClick={onCompose} className="btn-gold mt-6 px-5 py-2.5 text-sm"><I.Plus className="h-4 w-4" /> Start a message</button>
    </GlassCard>
  )
}

/* ═══════════════════════════════════════════════════ AI ASSISTANT PANEL ══ */
const Assistant = forwardRef(function Assistant({ contact, email, providers, aiContext, contextOpen, onToggleContext, onRun, onClose, onUseSubject, onUndo, canUndo }, ref) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hi Pernell 👋 I’m your Digital Skyline assistant. I can draft, rewrite, shorten, add your consultation link, reference reviews${contact ? ` — I’ve got ${contact.business}’s context loaded` : ''}. What are we sending?` },
  ])
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  // Parent orchestrates the live call; we just render the turns. pushUser adds
  // the prompt + starts the typing indicator, pushAI resolves it with the reply.
  useImperativeHandle(ref, () => ({
    pushUser(instruction) {
      setMessages((m) => [...m, { role: 'user', text: instruction }])
      setBusy(true)
    },
    pushAI(res) {
      setBusy(false)
      setMessages((m) => [...m, { role: 'ai', text: res.reply || 'Done.', chips: res.chips, undo: res.undo, remote: res.remote }])
    },
  }), [])

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [messages, busy])

  const submit = (text) => {
    const t = (text ?? val).trim(); if (!t) return
    setVal(''); onRun(t)
  }

  return (
    <aside className="w-full shrink-0 lg:w-80">
      <GlassCard className="flex h-[680px] flex-col p-0">
        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.08] text-gold-300"><I.Robot className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-display text-sm font-bold text-gray-50">Assistant <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,.5)]" /></div>
            <div className="truncate font-mono text-[10px] text-gray-500">{contact ? `context · ${contact.business}` : 'Digital Skyline OS'}</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">✕</button>
        </div>

        {/* AI CONTEXT drawer — everything the AI knows about this contact */}
        <ContextDrawer contact={contact} ctx={aiContext} open={contextOpen} onToggle={onToggleContext} />

        {/* chat */}
        <div ref={scrollRef} className="ds-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`ds-pop flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-gold-gradient text-ink-950' : 'border border-white/10 bg-white/[0.03] text-gray-200'}`}>
                {m.text}
                {m.chips && (
                  <div className="mt-2 space-y-1.5">
                    {m.chips.map((c) => (
                      <button key={c} onClick={() => onUseSubject(c)} className="ds-row block w-full rounded-lg border border-gold-400/20 bg-gold-400/[0.06] px-2.5 py-1.5 text-left text-[12px] text-gold-100 hover:border-gold-400/50">{c}</button>
                    ))}
                  </div>
                )}
                {m.undo && canUndo && (
                  <button onClick={onUndo} className="mt-1.5 text-[11px] text-ink-800 underline decoration-dotted opacity-80 hover:opacity-100">undo</button>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start"><div className="ds-typing rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"><span /><span /><span /></div></div>
          )}
        </div>

        {/* suggestion chips */}
        <div className="border-t border-white/[0.06] px-3 py-2">
          <div className="ds-scroll flex gap-1.5 overflow-x-auto pb-1">
            {ASSISTANT_SUGGESTIONS.slice(0, 8).map((s) => (
              <button key={s} onClick={() => submit(s)} className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:border-gold-400/40 hover:text-gold-100">{s}</button>
            ))}
          </div>
        </div>

        {/* input */}
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex items-center gap-2 border-t border-white/[0.06] p-3">
          <button type="button" title="Voice dictation (soon)" className="ds-tool flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500"><I.Mic className="h-4 w-4" /></button>
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Ask your assistant…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
          <button type="submit" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-gradient text-ink-950 transition-transform hover:brightness-110 active:scale-95"><I.Send className="h-4 w-4" /></button>
        </form>
      </GlassCard>
    </aside>
  )
})

/* ═══════════════════════════════════════════════════ AI CONTEXT DRAWER ═══ */
// The panel that opens above the chat showing everything the assistant already
// knows about the person being emailed — pulled from the CRM, audits, consults,
// projects and the message log. This is what makes the assistant feel like it
// "knows" the contact rather than starting cold.
function ContextDrawer({ contact, ctx, open, onToggle }) {
  const c = ctx || {}
  const conv = c.conversations || 0
  const rows = [
    { icon: 'Users', label: 'Contact', value: contact?.name || '—' },
    { icon: 'Target', label: 'Company', value: contact?.business || '—' },
    { icon: 'Layers', label: 'Website package', value: c.package || (contact?.website ? 'Website (details TBD)' : 'No site yet') },
    { icon: 'Reply', label: 'Conversations', value: conv ? `${conv} on file` : 'None yet' },
    { icon: 'Draft', label: 'Consultation notes', value: c.consultationNotes || 'None recorded', wrap: true, muted: !c.consultationNotes },
    { icon: 'Sparkle', label: 'AI website analysis', value: c.aiAnalysis || 'No audit yet', wrap: true, muted: !c.aiAnalysis },
    { icon: 'FileContract', label: 'Proposal', value: c.proposal || 'Not sent', muted: !c.proposal },
    { icon: 'FilePdf', label: 'Invoice status', value: c.invoiceStatus || 'No invoice', muted: !c.invoiceStatus },
    { icon: 'Send', label: 'Last email sent', value: c.lastEmail ? `${trunc(c.lastEmail.subject, 34)} · ${relTime(c.lastEmail.at)}` : 'None yet', muted: !c.lastEmail },
    { icon: 'Inbox', label: 'Last reply', value: c.lastReply ? `${trunc(c.lastReply.subject, 34)} · ${relTime(c.lastReply.at)}` : 'None yet', muted: !c.lastReply },
  ]
  return (
    <div className="border-b border-white/[0.06]">
      <button onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${open ? 'border-gold-400/40 bg-gold-400/[0.1] text-gold-300' : 'border-white/10 bg-white/[0.03] text-gray-400'}`}>
          <I.Brain className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xs font-semibold text-gray-100">AI Context</div>
          <div className="truncate font-mono text-[10px] text-gray-500">{contact ? `what the AI knows · ${contact.business}` : 'select a contact to load'}</div>
        </div>
        <I.ChevronLeft className={`h-4 w-4 text-gray-500 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open && (
        <div className="ds-slidel max-h-[300px] overflow-y-auto ds-scroll border-t border-white/[0.06] bg-ink-950/40 px-4 py-3">
          {!contact ? (
            <p className="py-6 text-center text-xs text-gray-500">Pick a prospect or client (or start an email) and everything the AI knows about them appears here.</p>
          ) : (
            <>
              {c.progress != null && (
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="font-mono uppercase tracking-wider text-gray-500">Project progress</span>
                    <span className="text-gold-200">{c.projectStage || contact.stage} · {c.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gold-gradient transition-all duration-700" style={{ width: `${c.progress}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-2.5">
                {rows.map((r) => (
                  <div key={r.label} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-gray-500"><Ic name={r.icon} className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-gray-600">{r.label}</div>
                      <div className={`text-[12px] leading-snug ${r.muted ? 'text-gray-500' : 'text-gray-200'} ${r.wrap ? '' : 'truncate'}`}>{r.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-gold-400/15 bg-gold-400/[0.04] px-2.5 py-1.5">
                <I.Robot className="h-3 w-3 shrink-0 text-gold-300" />
                <span className="text-[10px] text-gray-500">The assistant uses all of this automatically when it writes.</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
const trunc = (s = '', n = 30) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/* ═══════════════════════════════════════════════════ FUTURE STRIP ════════ */
function FutureStrip() {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2 px-1">
        <I.Layers className="h-3.5 w-3.5 text-gold-300" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">On the roadmap</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FUTURE_FEATURES.map((f) => (
          <div key={f.label} className="ds-row flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-400"><Ic name={f.icon} className="h-4 w-4" /></span>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-gray-300">{f.label}</div>
              <div className="truncate text-[10px] text-gray-600">{f.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════ TOAST ═══════════════ */
function Toast({ msg, tone }) {
  const tones = { gold: 'border-gold-400/40 bg-gold-400/10 text-gold-100', blue: 'border-blue-400/40 bg-blue-400/10 text-blue-100' }
  return (
    <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 ds-pop">
      <div className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm shadow-card backdrop-blur-xl ${tones[tone] || tones.gold}`}>
        <I.Sparkle className="h-4 w-4" /> {msg}
      </div>
    </div>
  )
}
function wordCount(t = '') { return t.trim() ? t.trim().split(/\s+/).length : 0 }
