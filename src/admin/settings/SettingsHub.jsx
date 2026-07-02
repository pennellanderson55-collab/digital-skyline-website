// ============================================================================
// Settings control center — SaaS-style settings for the whole business.
// Left section nav + searchable header + sticky save bar + toasts. Field-driven
// sections load/save to their own Supabase tables (jsonb `data`); custom
// sections (Email, Pricing, Stripe, Templates, Portfolio, Security, Analytics,
// Storage) live below. Only this Settings page changed — nothing else.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Shield, Chart, Code, Image, Lock, Activity, Cube, Brain, Sparkle, Cog } from '../../components/Icons.jsx'
import { IconMail, IconMoney, IconCalendar, IconInvoice, IconGlobe, IconBell, useDashboardStyles } from '../dashboard/primitives.jsx'
import { useSettings } from './useSettings.js'
import {
  SettingCard, FieldGrid, Field, TextArea, SelectField, Toggle, ColorField, TagsField,
  SkeletonForm, SaveBar, ToastStack, StatusPill,
} from './primitives.jsx'
import { GENERIC, EMAIL_DEFAULTS, PRICING_DEFAULTS, STRIPE_DEFAULTS, TEMPLATE_SEEDS, CURRENCIES } from './schema.js'
import PortfolioManager from './PortfolioManager.jsx'
import Settings from '../Settings.jsx' // existing testing-cleanup, preserved

const SECTIONS = [
  { id: 'business', label: 'Business', icon: <Shield className="h-4 w-4" />, kind: 'generic', cfg: GENERIC.business, title: 'Business Settings', desc: 'Everything about your company.' },
  { id: 'email', label: 'Email', icon: <IconMail className="h-4 w-4" />, kind: 'email', title: 'Email Settings', desc: 'Sender identity, notifications and provider status.' },
  { id: 'pricing', label: 'Pricing', icon: <IconMoney className="h-4 w-4" />, kind: 'pricing', title: 'Pricing Settings', desc: 'Edit package pricing from the dashboard — no code.' },
  { id: 'consultations', label: 'Consultations', icon: <IconCalendar className="h-4 w-4" />, kind: 'generic', cfg: GENERIC.consultations, title: 'Consultation Settings', desc: 'Availability, appointment rules and automation.' },
  { id: 'stripe', label: 'Stripe', icon: <IconInvoice className="h-4 w-4" />, kind: 'stripe', title: 'Stripe Settings', desc: 'Payment links, currency and connection status.' },
  { id: 'crm', label: 'CRM', icon: <Chart className="h-4 w-4" />, kind: 'generic', cfg: GENERIC.crm, title: 'CRM Settings', desc: 'Pipeline stages, tags and automation.' },
  { id: 'notifications', label: 'Notifications', icon: <IconBell className="h-4 w-4" />, kind: 'generic', cfg: GENERIC.notifications, title: 'Notifications', desc: 'How and when you get alerted.' },
  { id: 'templates', label: 'Templates', icon: <Code className="h-4 w-4" />, kind: 'templates', title: 'Email Templates', desc: 'Reusable emails that power the platform.' },
  { id: 'portfolio', label: 'Portfolio', icon: <Image className="h-4 w-4" />, kind: 'portfolio', title: 'Portfolio Manager', desc: 'Manage portfolio items — no more editing code.' },
  { id: 'website', label: 'Website', icon: <IconGlobe className="h-4 w-4" />, kind: 'generic', cfg: GENERIC.website, title: 'Website Settings', desc: 'Homepage copy, SEO and integrations.' },
  { id: 'security', label: 'Security', icon: <Lock className="h-4 w-4" />, kind: 'security', title: 'Security', desc: 'Password, sessions and access.' },
  { id: 'analytics', label: 'Analytics', icon: <Activity className="h-4 w-4" />, kind: 'analytics', title: 'Analytics', desc: 'Connection status across your stack.' },
  { id: 'storage', label: 'Storage', icon: <Cube className="h-4 w-4" />, kind: 'storage', title: 'Storage', desc: 'Media and document usage.' },
  { id: 'ai', label: 'AI', icon: <Brain className="h-4 w-4" />, kind: 'generic', cfg: GENERIC.ai, title: 'AI Settings', desc: 'The AI brain — tone and generator defaults.' },
  { id: 'branding', label: 'Branding', icon: <Sparkle className="h-4 w-4" />, kind: 'generic', cfg: GENERIC.branding, title: 'Branding', desc: 'Colors, type and logos.', preview: true },
]

export default function SettingsHub({ prospects = [], onDeleteProspect }) {
  useDashboardStyles()
  const [active, setActive] = useState('business')
  const [q, setQ] = useState('')
  const [toasts, setToasts] = useState([])
  let toastId = 0
  const toast = (msg, type = 'success') => setToasts((t) => [...t, { id: `${Date.now()}-${toastId++}`, msg, type }])
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id))

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return SECTIONS
    return SECTIONS.filter((s) =>
      s.label.toLowerCase().includes(term) || s.title.toLowerCase().includes(term) ||
      (s.cfg?.fields || []).some((f) => (f.label || '').toLowerCase().includes(term)))
  }, [q])

  const section = SECTIONS.find((s) => s.id === active) || SECTIONS[0]

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><Cog className="h-5 w-5 text-gold-300" />
            <h2 className="font-display text-2xl font-bold text-gray-50">Settings</h2></div>
          <p className="mt-1 text-sm text-gray-500">Manage every aspect of Digital Skyline Co.</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings…"
          className="w-full max-w-xs rounded-xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* section nav */}
        <nav className="lg:sticky lg:top-6 lg:h-max lg:w-52 lg:shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {(filtered.length ? filtered : SECTIONS).map((s) => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  active === s.id ? 'border-gold-400/60 bg-gold-400/10 text-gold-100' : 'border-transparent text-gray-400 hover:border-white/10 hover:bg-white/[0.03] hover:text-gray-200'
                }`}>
                {s.icon}<span>{s.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* active section */}
        <div className="min-w-0 flex-1 space-y-4">
          {section.kind === 'generic' && <GenericSection key={section.id} section={section} toast={toast} />}
          {section.kind === 'email' && <EmailSection toast={toast} />}
          {section.kind === 'pricing' && <PricingSection toast={toast} />}
          {section.kind === 'stripe' && <StripeSection toast={toast} />}
          {section.kind === 'templates' && <TemplatesSection toast={toast} />}
          {section.kind === 'portfolio' && <SettingCard title={section.title} description={section.desc} icon={section.icon}><PortfolioManager toast={toast} /></SettingCard>}
          {section.kind === 'security' && <SecuritySection toast={toast} />}
          {section.kind === 'analytics' && <AnalyticsSection />}
          {section.kind === 'storage' && <StorageSection />}

          {/* Preserve the existing developer/testing cleanup tools at the bottom */}
          {section.id === 'business' && (
            <details className="card-surface p-4 text-sm shadow-card">
              <summary className="cursor-pointer text-gray-400">Developer / Testing cleanup</summary>
              <div className="mt-4"><Settings prospects={prospects} onDeleteProspect={onDeleteProspect} /></div>
            </details>
          )}
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

/* ── generic field renderer ─────────────────────────────────────────────────*/
function renderField(f, draft, set) {
  if (f.type === 'heading') return <div key={f.label} className="mt-2 border-t border-white/[0.06] pt-4 font-mono text-[11px] uppercase tracking-wider text-gold-300 sm:col-span-2">{f.label}</div>
  const v = draft[f.key]; const on = (val) => set(f.key, val)
  switch (f.type) {
    case 'textarea': return <TextArea key={f.key} label={f.label} value={v} onChange={on} help={f.help} rows={f.rows} />
    case 'select': return <SelectField key={f.key} label={f.label} value={v} onChange={on} options={f.options} help={f.help} />
    case 'toggle': return <div key={f.key} className="sm:col-span-2"><Toggle label={f.label} checked={!!v} onChange={on} help={f.help} disabled={f.disabled} /></div>
    case 'color': return <ColorField key={f.key} label={f.label} value={v} onChange={on} help={f.help} />
    case 'tags': return <TagsField key={f.key} label={f.label} value={v} onChange={on} placeholder={f.placeholder} help={f.help} />
    default: return <Field key={f.key} label={f.label} type={f.type} value={v} onChange={on} placeholder={f.placeholder} required={f.required} help={f.help} />
  }
}

function GenericSection({ section, toast }) {
  const { cfg, title, desc, icon, preview } = section
  const s = useSettings(cfg.table, cfg.defaults)
  if (s.loading) return <SkeletonForm />
  const missing = cfg.fields.some((f) => f.required && !String(s.draft[f.key] || '').trim())
  const onSave = async () => {
    if (missing) { toast('Please fill the required fields.', 'error'); return }
    const ok = await s.save(); toast(ok ? `${title} saved.` : s.error || 'Save failed.', ok ? 'success' : 'error')
  }
  return (
    <>
      <SettingCard title={title} description={desc} icon={icon}>
        {s.error && <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{s.error}</p>}
        <FieldGrid>{cfg.fields.map((f) => renderField(f, s.draft, s.set))}</FieldGrid>
        {preview && <BrandingPreview d={s.draft} />}
      </SettingCard>
      <SaveBar dirty={s.dirty} saving={s.saving} lastSaved={s.lastSaved} onSave={onSave} onReset={s.reset} />
    </>
  )
}

function BrandingPreview({ d }) {
  const radius = d.border_radius === 'Sharp' ? '4px' : d.border_radius === 'Pill' ? '9999px' : '14px'
  return (
    <div className="mt-6 border-t border-white/[0.06] pt-5">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-gray-500">Preview</div>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 p-5" style={{ background: d.secondary_color || '#0b0b0f' }}>
        <span className="font-display text-lg font-bold" style={{ color: d.primary_color }}>{d.font_family || 'Inter'}</span>
        <button className="px-5 py-2.5 text-sm font-semibold text-ink-950" style={{ background: d.primary_color, borderRadius: radius }}>Primary Button</button>
        <button className="px-5 py-2.5 text-sm font-semibold" style={{ color: d.accent_color, border: `1px solid ${d.accent_color}`, borderRadius: radius }}>Accent</button>
        <div className="flex gap-2">
          {[d.primary_color, d.secondary_color, d.accent_color].map((c, i) => <span key={i} className="h-8 w-8 rounded-lg border border-white/20" style={{ background: c }} />)}
        </div>
      </div>
    </div>
  )
}

/* ── email ───────────────────────────────────────────────────────────────────*/
const EMAIL_FIELDS = [
  { key: 'from_name', label: 'From Name', type: 'text' },
  { key: 'from_email', label: 'From Email', type: 'email' },
  { key: 'reply_to', label: 'Reply-To Email', type: 'email' },
  { key: 'owner_notification_email', label: 'Owner Notification Email', type: 'email' },
]
function EmailSection({ toast }) {
  const s = useSettings('email_settings', EMAIL_DEFAULTS)
  const [status, setStatus] = useState(null)
  const [testing, setTesting] = useState(false)
  useEffect(() => { fetch('/api/email-config').then((r) => r.json()).then(setStatus).catch(() => setStatus(null)) }, [])

  const test = async () => {
    setTesting(true)
    try {
      const r = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'test', to: s.draft.owner_notification_email }) })
      const j = await r.json().catch(() => ({}))
      toast(r.ok ? `Test email sent to ${s.draft.owner_notification_email}.` : (j.error || 'Test email failed — check RESEND_API_KEY.'), r.ok ? 'success' : 'error')
    } catch (e) { toast('Test email failed to send.', 'error') }
    setTesting(false)
  }
  if (s.loading) return <SkeletonForm />
  return (
    <>
      <SettingCard title="Email Settings" description="Sender identity + owner notifications." icon={<IconMail className="h-4 w-4" />}>
        {s.error && <p className="mb-4 text-sm text-rose-300">{s.error}</p>}
        <FieldGrid>{EMAIL_FIELDS.map((f) => renderField(f, s.draft, s.set))}</FieldGrid>
        <div className="mt-5"><TextArea label="Email Signature" value={s.draft.signature} onChange={(v) => s.set('signature', v)} /></div>
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">Signature Preview</div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300">{s.draft.signature || '—'}</pre>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={test} disabled={testing} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">{testing ? 'Sending…' : 'Send Test Email'}</button>
          <span className="text-xs text-gray-500">Sends to your owner notification email.</span>
        </div>
      </SettingCard>

      <SettingCard title="Email Provider — Resend" description="Sending status (values come from server env)." icon={<IconMail className="h-4 w-4" />}
        aside={<StatusPill ok={status?.resendConfigured} label={status == null ? 'Checking…' : status.resendConfigured ? 'Connected' : 'Not configured'} />}>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Info label="From Address" value={status?.from || s.draft.from_email} />
          <Info label="Sandbox Mode" value={status == null ? '…' : status.sandbox ? 'ON (test inbox)' : 'OFF (live)'} />
          <Info label="Sandbox Inbox" value={status?.sandboxInbox || '—'} />
          <Info label="API Status" value={status == null ? '…' : status.resendConfigured ? 'RESEND_API_KEY set' : 'RESEND_API_KEY missing'} />
        </dl>
      </SettingCard>
      <SaveBar dirty={s.dirty} saving={s.saving} lastSaved={s.lastSaved} onSave={async () => { const ok = await s.save(); toast(ok ? 'Email settings saved.' : 'Save failed.', ok ? 'success' : 'error') }} onReset={s.reset} />
    </>
  )
}
const Info = ({ label, value }) => (<div><dt className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</dt><dd className="mt-0.5 text-sm text-gray-200">{value}</dd></div>)

/* ── pricing ─────────────────────────────────────────────────────────────────*/
function PricingSection({ toast }) {
  const s = useSettings('pricing_settings', PRICING_DEFAULTS)
  if (s.loading) return <SkeletonForm />
  const setPkg = (i, k, v) => s.setDraft((d) => ({ ...d, packages: d.packages.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }))
  const money = (k) => (v) => s.set(k, Number(v) || 0)
  return (
    <>
      <SettingCard title="Pricing Settings" description="Edit package pricing — the public pricing section can read these." icon={<IconMoney className="h-4 w-4" />}>
        {s.error && <p className="mb-4 text-sm text-rose-300">{s.error}</p>}
        <div className="space-y-3">
          {(s.draft.packages || []).map((p, i) => (
            <div key={p.key} className="grid items-end gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-[1.4fr_1fr_1fr]">
              <Field label="Package" value={p.name} onChange={(v) => setPkg(i, 'name', v)} />
              <Field label="Regular Price ($)" type="number" value={p.regular} onChange={(v) => setPkg(i, 'regular', Number(v) || 0)} />
              <Field label="Sale Price ($)" type="number" value={p.sale} onChange={(v) => setPkg(i, 'sale', Number(v) || 0)} help="0 = no sale" />
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-gold-300">Maintenance</div>
          <FieldGrid>
            <Field label="Monthly ($)" type="number" value={s.draft.maintenance_monthly} onChange={money('maintenance_monthly')} />
            <Field label="Hourly ($)" type="number" value={s.draft.maintenance_hourly} onChange={money('maintenance_hourly')} />
            <Field label="Emergency Rate ($/hr)" type="number" value={s.draft.maintenance_emergency} onChange={money('maintenance_emergency')} />
            <Field label="Deposit (%)" type="number" value={s.draft.deposit_percent} onChange={money('deposit_percent')} />
            <Field label="Tax Rate (%)" type="number" value={s.draft.tax_rate} onChange={money('tax_rate')} />
          </FieldGrid>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Toggle label="Show sale/discount pricing" checked={s.draft.discount_enabled} onChange={(v) => s.set('discount_enabled', v)} />
            <Toggle label="Apply tax to invoices" checked={s.draft.tax_enabled} onChange={(v) => s.set('tax_enabled', v)} />
          </div>
        </div>
      </SettingCard>
      <SaveBar dirty={s.dirty} saving={s.saving} lastSaved={s.lastSaved} onSave={async () => { const ok = await s.save(); toast(ok ? 'Pricing saved.' : 'Save failed.', ok ? 'success' : 'error') }} onReset={s.reset} />
    </>
  )
}

/* ── stripe ──────────────────────────────────────────────────────────────────*/
function StripeSection({ toast }) {
  const s = useSettings('stripe_settings', STRIPE_DEFAULTS)
  if (s.loading) return <SkeletonForm />
  const F = (key, label, type = 'url') => <Field key={key} label={label} type={type} value={s.draft[key]} onChange={(v) => s.set(key, type === 'number' ? Number(v) || 0 : v)} />
  return (
    <>
      <SettingCard title="Stripe Settings" description="Payment configuration. Secret keys stay in Vercel env — never here." icon={<IconInvoice className="h-4 w-4" />}
        aside={<StatusPill ok label="Webhook: /api/stripe-webhook" />}>
        {s.error && <p className="mb-4 text-sm text-rose-300">{s.error}</p>}
        <FieldGrid>
          <SelectField label="Mode" value={s.draft.mode} onChange={(v) => s.set('mode', v)} options={['Live', 'Test']} />
          <SelectField label="Currency" value={s.draft.currency} onChange={(v) => s.set('currency', v)} options={CURRENCIES} />
          {F('client_portal_link', 'Client Portal Link')}
          {F('invoice_link', 'Invoice Link')}
          {F('success_url', 'Payment Success URL')}
          {F('cancel_url', 'Payment Cancel URL')}
          {F('tax_rate', 'Tax Rate (%)', 'number')}
        </FieldGrid>
        <p className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-gray-500">
          Live payment status and recent payments sync automatically to each project via the webhook — see the Dashboard & project profiles. Set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET in Vercel.
        </p>
      </SettingCard>
      <SaveBar dirty={s.dirty} saving={s.saving} lastSaved={s.lastSaved} onSave={async () => { const ok = await s.save(); toast(ok ? 'Stripe settings saved.' : 'Save failed.', ok ? 'success' : 'error') }} onReset={s.reset} />
    </>
  )
}

/* ── templates ───────────────────────────────────────────────────────────────*/
function TemplatesSection({ toast }) {
  const [rows, setRows] = useState(null)
  const [sel, setSel] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { (async () => {
    if (!supabase) { setRows([]); return }
    let { data, error: e } = await supabase.from('email_templates').select('*').order('name')
    if (e) { setError(/does not exist|find the table/i.test(e.message) ? 'Run supabase/sprint8_settings.sql to enable Templates.' : e.message); setRows([]); return }
    if (!data || data.length === 0) {
      await supabase.from('email_templates').upsert(TEMPLATE_SEEDS).catch(() => {})
      const seeded = await supabase.from('email_templates').select('*').order('name')
      data = seeded.data || TEMPLATE_SEEDS
    }
    setRows(data); setSel(data[0]?.key); setDraft(data[0] || null)
  })() }, [])

  const pick = (k) => { const r = rows.find((x) => x.key === k); setSel(k); setDraft(r ? { ...r } : null) }
  const save = async () => {
    setSaving(true)
    const { error: e } = await supabase.from('email_templates').upsert({ key: draft.key, name: draft.name, subject: draft.subject, body: draft.body })
    setSaving(false)
    if (e) { toast(e.message, 'error'); return }
    setRows((rs) => rs.map((r) => (r.key === draft.key ? draft : r)))
    toast('Template saved.')
  }
  const preview = useMemo(() => (draft?.body || '').replace(/\{\{(\w+)\}\}/g, (_, v) => `[${v}]`), [draft])

  if (rows === null) return <SkeletonForm />
  return (
    <SettingCard title="Email Templates" description="Reusable emails. Variables like {{name}} are filled when sent." icon={<Code className="h-4 w-4" />}>
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {rows.length > 0 && draft && (
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {rows.map((r) => (
              <button key={r.key} onClick={() => pick(r.key)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${sel === r.key ? 'border-gold-400/50 bg-gold-400/10 text-gold-100' : 'border-white/10 text-gray-400 hover:text-gray-200'}`}>
                {r.name}
              </button>
            ))}
          </div>
          <div>
            <Field label="Subject" value={draft.subject} onChange={(v) => setDraft({ ...draft, subject: v })} full />
            <div className="mt-4"><TextArea label="Body" value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} rows={8} /></div>
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-ink-950/40 p-4">
              <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-gray-500">Live Preview</div>
              <div className="text-sm font-semibold text-gray-200">{(draft.subject || '').replace(/\{\{(\w+)\}\}/g, (_, v) => `[${v}]`)}</div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-gray-400">{preview}</pre>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => pick(sel)} className="btn-ghost px-4 py-2 text-xs">Reset</button>
              <button onClick={save} disabled={saving} className="btn-gold px-5 py-2 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save Template'}</button>
            </div>
          </div>
        </div>
      )}
    </SettingCard>
  )
}

/* ── security ─────────────────────────────────────────────────────────────────*/
function SecuritySection({ toast }) {
  const [user, setUser] = useState(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { supabase?.auth.getUser().then(({ data }) => setUser(data?.user || null)) }, [])
  const changePw = async () => {
    if (pw.length < 8) { toast('Password must be at least 8 characters.', 'error'); return }
    setBusy(true); const { error: e } = await supabase.auth.updateUser({ password: pw }); setBusy(false)
    if (e) { toast(e.message, 'error'); return }
    setPw(''); toast('Password updated.')
  }
  const logoutAll = async () => { await supabase.auth.signOut({ scope: 'global' }) }
  return (
    <>
      <SettingCard title="Security" description="Account access and sessions." icon={<Lock className="h-4 w-4" />}>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Info label="Signed in as" value={user?.email || '—'} />
          <Info label="Last sign-in" value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—'} />
        </dl>
        <div className="mt-5 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Change Password" type="password" value={pw} onChange={setPw} placeholder="New password (min 8 chars)" />
          <button onClick={changePw} disabled={busy || !pw} className="btn-gold h-11 px-5 text-sm disabled:opacity-50">{busy ? 'Updating…' : 'Update'}</button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-5">
          <button onClick={logoutAll} className="rounded-full border border-rose-400/30 bg-rose-400/[0.06] px-4 py-2 text-xs font-medium text-rose-200 hover:border-rose-400/60">Log out all devices</button>
          <span className="text-xs text-gray-500">Two-factor authentication & login history are on the roadmap.</span>
        </div>
      </SettingCard>
    </>
  )
}

/* ── analytics / storage status ───────────────────────────────────────────────*/
function AnalyticsSection() {
  const [status, setStatus] = useState(null)
  useEffect(() => { fetch('/api/email-config').then((r) => r.json()).then(setStatus).catch(() => setStatus(null)) }, [])
  const cards = [
    { name: 'Supabase', ok: Boolean(supabase), note: 'Database & auth' },
    { name: 'Resend', ok: status?.resendConfigured, note: 'Transactional email' },
    { name: 'Stripe', ok: true, note: 'Payments (via env + webhook)' },
    { name: 'Vercel', ok: true, note: 'Hosting & functions' },
    { name: 'Google Analytics', ok: false, note: 'Add a GA ID in Website settings' },
    { name: 'Search Console', ok: false, note: 'Add verification in Website settings' },
  ]
  return (
    <SettingCard title="Analytics & Integrations" description="Connection status across your stack." icon={<Activity className="h-4 w-4" />}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.name} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between"><span className="font-display text-sm font-semibold text-gray-100">{c.name}</span><StatusPill ok={c.ok} label={c.ok ? 'Connected' : 'Not set'} /></div>
            <p className="mt-1 text-[11px] text-gray-500">{c.note}</p>
          </div>
        ))}
      </div>
    </SettingCard>
  )
}
function StorageSection() {
  return (
    <SettingCard title="Storage" description="Media & document usage." icon={<Cube className="h-4 w-4" />}>
      <div className="rounded-xl border border-dashed border-white/12 p-6 text-center">
        <p className="text-sm text-gray-400">Storage metering activates once a Supabase Storage bucket is connected for uploads.</p>
        <p className="mt-1 text-xs text-gray-600">Portfolio & logos currently reference URLs/paths to keep Supabase egress low. Wiring a bucket is the next step.</p>
      </div>
    </SettingCard>
  )
}
