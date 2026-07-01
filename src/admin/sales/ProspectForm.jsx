import { useState } from 'react'
import {
  PROSPECT_STATUSES, INDUSTRIES, PROSPECT_SOURCES, US_STATES, toISODate,
} from './prospects.js'

// Shared add/edit form for a prospect. Used by the Add modal and the detail
// panel's Edit mode. Controlled, validated, never throws — onSubmit receives a
// clean patch object (nulls for empty optional fields).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const blank = {
  business_name: '', owner_name: '', industry: '', source: 'Manual Entry',
  phone: '', email: '', website: '',
  address: '', city: '', state: '',
  google_reviews: '', google_rating: '', website_score: '',
  status: 'New Lead', deal_value: '', probability: '', next_follow_up: '', last_contacted: '', notes: '',
}

const fromRow = (row) => ({
  ...blank,
  ...Object.fromEntries(Object.keys(blank).map((k) => {
    let v = row?.[k]
    if (k === 'next_follow_up') v = row?.next_follow_up || ''
    if (k === 'last_contacted') v = row?.last_contacted ? toISODate(row.last_contacted) : ''
    return [k, v == null ? '' : v]
  })),
})

export default function ProspectForm({ initial, onSubmit, onCancel, submitLabel = 'Save', busy }) {
  const [form, setForm] = useState(() => (initial ? fromRow(initial) : blank))
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  const validate = () => {
    const er = {}
    if (!form.business_name.trim()) er.business_name = 'Business name is required'
    if (form.email && !EMAIL_RE.test(form.email)) er.email = 'Enter a valid email'
    if (form.google_rating !== '' && (Number(form.google_rating) < 0 || Number(form.google_rating) > 5))
      er.google_rating = '0–5'
    if (form.website_score !== '' && (Number(form.website_score) < 0 || Number(form.website_score) > 100))
      er.website_score = '0–100'
    if (form.google_reviews !== '' && Number(form.google_reviews) < 0) er.google_reviews = '≥ 0'
    if (form.probability !== '' && (Number(form.probability) < 0 || Number(form.probability) > 100))
      er.probability = '0–100'
    if (form.deal_value !== '' && (Number.isNaN(Number(form.deal_value)) || Number(form.deal_value) < 0))
      er.deal_value = 'Numeric ≥ 0'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const submit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const numOrNull = (v) => (v === '' || v == null ? null : Number(v))
    const strOrNull = (v) => {
      const t = (v ?? '').toString().trim()
      return t === '' ? null : t
    }
    onSubmit({
      business_name: form.business_name.trim(),
      owner_name: strOrNull(form.owner_name),
      industry: strOrNull(form.industry),
      source: strOrNull(form.source),
      phone: strOrNull(form.phone),
      email: strOrNull(form.email),
      website: strOrNull(form.website),
      address: strOrNull(form.address),
      city: strOrNull(form.city),
      state: strOrNull(form.state),
      google_reviews: numOrNull(form.google_reviews),
      google_rating: numOrNull(form.google_rating),
      website_score: numOrNull(form.website_score),
      status: form.status || 'New Lead',
      deal_value: numOrNull(form.deal_value),
      probability: form.probability === '' ? null : Math.round(Number(form.probability)),
      next_follow_up: form.next_follow_up || null,
      last_contacted: form.last_contacted ? `${form.last_contacted}T12:00:00Z` : null,
      notes: strOrNull(form.notes),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Business Information">
        <Field label="Business name" required value={form.business_name} onChange={set('business_name')} error={errors.business_name} placeholder="Acme Plumbing Co." />
        <Field label="Owner name" value={form.owner_name} onChange={set('owner_name')} placeholder="Jane Doe" />
        <DataListField label="Industry" value={form.industry} onChange={set('industry')} options={INDUSTRIES} placeholder="Plumbers" />
        <SelectField label="Source" value={form.source} onChange={set('source')} options={PROSPECT_SOURCES} />
      </Section>

      <Section title="Contact Information">
        <Field label="Phone" value={form.phone} onChange={set('phone')} placeholder="(480) 555-0134" />
        <Field label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="hello@acme.com" />
        <Field label="Website" value={form.website} onChange={set('website')} placeholder="acmeplumbing.com" />
      </Section>

      <Section title="Location">
        <Field label="Address" value={form.address} onChange={set('address')} placeholder="123 Main St" />
        <Field label="City" value={form.city} onChange={set('city')} placeholder="Mesa" />
        <SelectField label="State" value={form.state} onChange={set('state')} options={['', ...US_STATES]} placeholder="—" />
      </Section>

      <Section title="Signals">
        <Field label="Google reviews" type="number" min="0" value={form.google_reviews} onChange={set('google_reviews')} error={errors.google_reviews} placeholder="48" />
        <Field label="Google rating" type="number" min="0" max="5" step="0.1" value={form.google_rating} onChange={set('google_rating')} error={errors.google_rating} placeholder="4.6" />
        <Field label="Website score" type="number" min="0" max="100" value={form.website_score} onChange={set('website_score')} error={errors.website_score} placeholder="32" helper="Lower = bigger opportunity" />
      </Section>

      <Section title="Pipeline">
        <SelectField label="Status" value={form.status} onChange={set('status')} options={PROSPECT_STATUSES} />
        <Field label="Deal value ($)" type="number" min="0" step="100" value={form.deal_value} onChange={set('deal_value')} error={errors.deal_value} placeholder="3000" />
        <Field label="Probability (%)" type="number" min="0" max="100" value={form.probability} onChange={set('probability')} error={errors.probability} placeholder="70" />
        <Field label="Last contacted" type="date" value={form.last_contacted} onChange={set('last_contacted')} />
        <Field label="Next follow-up" type="date" value={form.next_follow_up} onChange={set('next_follow_up')} />
      </Section>

      <div>
        <label className="mb-2 block font-display text-sm text-gray-300">Notes</label>
        <textarea rows={3} value={form.notes} onChange={set('notes')}
          placeholder="Context, who to ask for, what they need…"
          className="w-full resize-y rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-5">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
        )}
        <button type="submit" disabled={busy} className="btn-gold px-5 py-2.5 text-sm disabled:opacity-60">
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-gold-300">{title}</h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({ label, error, helper, required, type = 'text', ...props }) {
  return (
    <div>
      <label className="mb-1.5 block font-display text-sm text-gray-300">
        {label}{required && <span className="text-gold-300"> *</span>}
      </label>
      <input
        type={type}
        {...props}
        className={`w-full rounded-xl border bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:outline-none ${
          error ? 'border-rose-400/60 focus:border-rose-400' : 'border-white/10 focus:border-gold-400/60'
        }`}
      />
      {error ? <p className="mt-1 text-xs text-rose-400">{error}</p>
        : helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="mb-1.5 block font-display text-sm text-gray-300">{label}</label>
      <select value={value} onChange={onChange}
        className="w-full appearance-none rounded-xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 focus:border-gold-400/60 focus:outline-none">
        {options.map((o) => (
          <option key={o || '_'} value={o} className="bg-ink-900 text-gray-100">{o === '' ? (placeholder || '—') : o}</option>
        ))}
      </select>
    </div>
  )
}

function DataListField({ label, value, onChange, options, placeholder }) {
  const id = `dl-${label.replace(/\s/g, '')}`
  return (
    <div>
      <label className="mb-1.5 block font-display text-sm text-gray-300">{label}</label>
      <input list={id} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
      <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  )
}
