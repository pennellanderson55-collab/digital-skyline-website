import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Arrow, Sparkle } from '../components/Icons.jsx'
import usePageMeta from '../lib/usePageMeta.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const TIMES = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']
const MONTHS_AHEAD = 6

const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * /book?prospect=<id> — the consultation scheduler opened from outreach emails.
 * Identifies the prospect server-side, then on submit creates the consultation
 * and advances the CRM (status → Consultation Scheduled) via /api/book.
 */
export default function Book() {
  const [params] = useSearchParams()
  const prospectId = params.get('prospect') || ''
  const navigate = useNavigate()

  usePageMeta({ title: 'Book Your Free Consultation | Digital Skyline Co.', description: 'Schedule your free 15-minute strategy call with Digital Skyline Co.' })

  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }, [])
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }))
  const [selected, setSelected] = useState(null)
  const [time, setTime] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', notes: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [biz, setBiz] = useState(null)
  const [linkError, setLinkError] = useState('')

  // Identify the prospect (personalize + prefill). Tolerates the API being
  // unavailable — the page still works, the server re-checks on submit.
  useEffect(() => {
    if (!prospectId) { setLinkError('This booking link is missing its prospect.'); return }
    fetch(`/api/book?prospect=${encodeURIComponent(prospectId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) { setBiz(d.prospect); setForm((f) => ({ ...f, name: f.name || d.prospect.owner_name || '', email: f.email || d.prospect.email || '' })) }
        else setLinkError(d?.error || '')
      })
      .catch(() => {})
  }, [prospectId])

  const currentIdx = today.getFullYear() * 12 + today.getMonth()
  const viewIdx = view.y * 12 + view.m
  const shiftMonth = (delta) => { const idx = viewIdx + delta; setView({ y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 }) }
  const canPrev = viewIdx > currentIdx
  const canNext = viewIdx < currentIdx + MONTHS_AHEAD

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const dayState = (d) => {
    const date = new Date(view.y, view.m, d)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    return { date, available: date >= today && !isWeekend, isToday: date.getTime() === today.getTime(), isSelected: selected && date.getTime() === selected.getTime() }
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Please enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    if (!selected) errs.date = 'Choose a date'
    if (!time) errs.time = 'Choose a time'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect: prospectId, name: form.name.trim(), email: form.email.trim(), meeting_date: toISODate(selected), meeting_time: time, notes: form.notes.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) { setErrors({ submit: data.error || 'Something went wrong. Please try again.' }); setSubmitting(false); return }
      navigate('/consultation-confirmed', { state: { name: form.name.trim(), business: data.business_name || biz?.business_name || '', date: toISODate(selected), time } })
    } catch {
      setErrors({ submit: 'Something went wrong. Please try again.' })
      setSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen bg-ink-950 py-16 text-gray-200">
      <div className="absolute left-1/2 top-0 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-gold-400/[0.07] blur-[130px]" aria-hidden="true" />
      <div className="container-max relative">
        {/* Logo / brand */}
        <div className="text-center">
          <span className="font-display text-2xl font-bold text-gray-50">Digital Skyline<span className="text-gold-400">.</span></span>
          <div className="eyebrow mx-auto mt-5"><Sparkle className="h-3.5 w-3.5" /> Free 15-Minute Strategy Call</div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-gray-50">
            Book Your <span className="text-gold-gradient">Free Consultation</span>
          </h1>
          {biz?.business_name && <p className="mt-3 text-gray-400">Reserved for <span className="text-gold-200">{biz.business_name}</span> — pick a time that works for you.</p>}
        </div>

        {linkError && !biz ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-rose-400/30 bg-rose-400/[0.06] p-6 text-center text-sm text-rose-200">{linkError}</div>
        ) : (
          <div className="mx-auto mt-10 max-w-xl">
            <form onSubmit={submit} className="card-surface relative overflow-hidden p-6 shadow-card sm:p-8" noValidate>
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />

              {/* Calendar */}
              <div className="rounded-2xl border border-white/10 bg-ink-950/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-display text-base font-semibold text-gray-100">{MONTHS[view.m]} {view.y}</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => canPrev && shiftMonth(-1)} disabled={!canPrev} aria-label="Previous month"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400/30 text-gold-200 transition-colors hover:border-gold-400/70 hover:bg-gold-400/10 disabled:opacity-30"><Arrow className="h-4 w-4 rotate-180" /></button>
                    <button type="button" onClick={() => canNext && shiftMonth(1)} disabled={!canNext} aria-label="Next month"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400/30 text-gold-200 transition-colors hover:border-gold-400/70 hover:bg-gold-400/10 disabled:opacity-30"><Arrow className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((w) => <div key={w} className="py-1 font-mono text-[10px] uppercase tracking-wider text-gray-500">{w}</div>)}
                  {cells.map((d, i) => {
                    if (d === null) return <div key={`e${i}`} />
                    const s = dayState(d)
                    return (
                      <button key={d} type="button" disabled={!s.available}
                        onClick={() => { setSelected(s.date); setTime(null); setErrors((e) => ({ ...e, date: undefined })) }}
                        className={`flex aspect-square items-center justify-center rounded-lg text-sm transition-all ${
                          s.isSelected ? 'bg-gold-gradient font-semibold text-ink-950 shadow-gold-soft'
                          : s.available ? `text-gray-200 hover:bg-gold-400/15 ${s.isToday ? 'ring-1 ring-gold-400/50' : ''}`
                          : 'cursor-not-allowed text-gray-700'}`}>{d}</button>
                    )
                  })}
                </div>
              </div>
              {errors.date && <p className="mt-2 text-xs text-rose-400">{errors.date}</p>}

              {/* Times */}
              <div className="mt-5">
                <label className="mb-2 block font-display text-sm text-gray-300">Available times</label>
                {selected ? (
                  <div className="grid grid-cols-3 gap-2">
                    {TIMES.map((t) => (
                      <button key={t} type="button" onClick={() => { setTime(t); setErrors((e) => ({ ...e, time: undefined })) }}
                        className={`rounded-xl border px-3 py-2.5 font-mono text-xs transition-colors ${time === t ? 'border-gold-400/60 bg-gold-400/10 text-gold-100' : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-gold-400/40'}`}>{t}</button>
                    ))}
                  </div>
                ) : <p className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-center font-mono text-xs text-gray-500">Select a date to see available times</p>}
                {errors.time && <p className="mt-2 text-xs text-rose-400">{errors.time}</p>}
              </div>

              {/* Details */}
              <div className="mt-6 space-y-4 border-t border-white/[0.08] pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name" error={errors.name} />
                  <Field label="Email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@business.com" error={errors.email} />
                </div>
                <div>
                  <label className="mb-2 block font-display text-sm text-gray-300">Anything you'd like us to know? <span className="text-gray-600">(optional)</span></label>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Goals, questions, what you're hoping to get out of the call…"
                    className="w-full resize-y rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
                </div>
              </div>

              {errors.submit && <p className="mt-4 text-sm text-rose-400">{errors.submit}</p>}
              <button type="submit" disabled={submitting} className="btn-gold mt-6 w-full text-base disabled:opacity-60">
                {submitting ? 'Booking…' : (<>Confirm My Free Consultation <Check className="h-5 w-5" /></>)}
              </button>
              <p className="mt-3 text-center font-mono text-[11px] text-gray-600">No charge · 15 minutes · hello@digitalskylineco.com</p>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}

function Field({ label, error, required, type = 'text', ...props }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">{label} {required && <span className="text-gold-300">*</span>}</label>
      <input type={type} {...props}
        className={`w-full rounded-xl border bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none ${error ? 'border-rose-400/60 focus:border-rose-400' : 'border-white/10 focus:border-gold-400/60'}`} />
      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
    </div>
  )
}
