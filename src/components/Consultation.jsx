import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Arrow, Sparkle } from './Icons.jsx'
import { supabase } from '../lib/supabase.js'
import { sendEmail } from '../lib/email.js'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Hourly slots, 9 AM – 5 PM — spaced one hour apart, more options through the day.
const TIMES = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM',
  '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
]

const NEEDS = [
  'Website', 'Website Redesign', 'App', 'Portal', 'Dashboard', 'Automation', 'Not Sure Yet',
]
const CHALLENGES = [
  'Getting more leads', 'Outdated website', 'No website', 'Booking appointments',
  'Customer follow-up', 'Standing out from competitors', 'Other',
]
const SYSTEMS = [
  'Website', 'Google Business Profile', 'Social Media Accounts',
  'CRM or Customer Database', 'Online Booking System', 'None of the Above',
]
const BUDGETS = ['Under $1,000', '$1,000–$2,500', '$2,500–$5,000', '$5,000+', 'Not Sure Yet']
const HEARD = ['Google', 'Instagram', 'Referral', 'Networking Event', 'Returning Client', 'Other']

const MONTHS_AHEAD = 6

const WHAT_HAPPENS = [
  'Review your business goals',
  'Discuss the type of website or app you need',
  'Map out the best next step',
]

const SLOT_TAKEN_MSG = 'This time has already been reserved. Please choose another available time.'

const toISODate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', business: '', need: 'Website',
  challenge: '', challengeOther: '',
  success: '',
  systems: [],
  budget: '',
  heard: '', heardOther: '',
  notes: '',
}

export default function Consultation() {
  const today = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])

  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }))
  const [selected, setSelected] = useState(null)
  const [time, setTime] = useState(null)
  const [bookedTimes, setBookedTimes] = useState([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const clearErr = (k) => setErrors((e) => ({ ...e, [k]: undefined }))
  // Set a value directly (used by pill selectors that pass a value, not an event).
  const setField = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }))
    clearErr(k)
  }

  const toggleSystem = (opt) => {
    setForm((f) => {
      let next
      if (opt === 'None of the Above') {
        next = f.systems.includes(opt) ? [] : ['None of the Above']
      } else {
        const without = f.systems.filter((s) => s !== 'None of the Above')
        next = without.includes(opt) ? without.filter((s) => s !== opt) : [...without, opt]
      }
      return { ...f, systems: next }
    })
    clearErr('systems')
  }

  // month navigation bounds
  const currentIdx = today.getFullYear() * 12 + today.getMonth()
  const viewIdx = view.y * 12 + view.m
  const canPrev = viewIdx > currentIdx
  const canNext = viewIdx < currentIdx + MONTHS_AHEAD
  const shiftMonth = (delta) => {
    const idx = viewIdx + delta
    setView({ y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 })
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const dayState = (d) => {
    const date = new Date(view.y, view.m, d)
    const isPast = date < today
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    return {
      date,
      available: !isPast && !isWeekend,
      isToday: date.getTime() === today.getTime(),
      isSelected: selected && date.getTime() === selected.getTime(),
    }
  }

  // Per-date cache of booked times so browsing back and forth between dates
  // doesn't re-hit the RPC. `fresh: true` bypasses it for the authoritative
  // availability re-check at submit time (correctness must not be cached).
  const bookedCache = useRef(new Map())

  const fetchBooked = async (date, { fresh = false } = {}) => {
    if (!supabase || !date) return []
    const key = toISODate(date)
    if (!fresh && bookedCache.current.has(key)) return bookedCache.current.get(key)
    const { data, error } = await supabase.rpc('booked_times', { d: key })
    if (error) return bookedCache.current.get(key) || []
    const times = data || []
    bookedCache.current.set(key, times)
    return times
  }

  const pickDate = async (date) => {
    setSelected(date)
    setTime(null)
    setErrors((e) => ({ ...e, date: undefined, time: undefined }))
    setLoadingTimes(true)
    setBookedTimes(await fetchBooked(date))
    setLoadingTimes(false)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Please enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    if (!form.business.trim()) errs.business = 'Please tell us about your business'
    if (!form.challenge) errs.challenge = 'Please select an option'
    if (form.challenge === 'Other' && !form.challengeOther.trim())
      errs.challengeOther = 'Please describe your challenge'
    if (!form.success.trim()) errs.success = 'Please describe your goal'
    if (form.systems.length === 0) errs.systems = 'Please select at least one'
    if (!form.budget) errs.budget = 'Please select a budget range'
    if (!form.heard) errs.heard = 'Please select an option'
    if (form.heard === 'Other' && !form.heardOther.trim())
      errs.heardOther = 'Please let us know'
    if (!selected) errs.date = 'Please choose a date'
    if (!time) errs.time = 'Please choose a time'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    if (!supabase) {
      setErrors((er) => ({ ...er, submit: 'Booking is temporarily unavailable. Please try again later.' }))
      return
    }

    setSubmitting(true)
    setErrors((er) => ({ ...er, submit: undefined }))

    // Re-check availability right before confirming (always fresh, never cached).
    const taken = await fetchBooked(selected, { fresh: true })
    if (taken.includes(time)) {
      setBookedTimes(taken)
      setTime(null)
      setErrors((er) => ({ ...er, time: SLOT_TAKEN_MSG }))
      setSubmitting(false)
      return
    }

    const row = {
      // Explicit so the row satisfies the RLS policy: WITH CHECK (status = 'New').
      status: 'New',
      date: toISODate(selected),
      time,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      business: form.business.trim(),
      project_type: form.need,
      challenge: form.challenge,
      challenge_other: form.challenge === 'Other' ? form.challengeOther.trim() : null,
      success_outcome: form.success.trim(),
      current_systems: form.systems,
      budget: form.budget,
      heard_about: form.heard,
      heard_about_other: form.heard === 'Other' ? form.heardOther.trim() : null,
      notes: form.notes.trim() || null,
    }

    const { error } = await supabase.from('consultations').insert(row)

    if (error) {
      // Surface the exact reason — the booking save is what fails here, NOT email.
      console.error('[consultation] Supabase insert failed:', {
        message: error.message, code: error.code, details: error.details, hint: error.hint,
      })
      // 23505 = unique violation → slot was taken between check and insert.
      if (error.code === '23505') {
        setBookedTimes(await fetchBooked(selected, { fresh: true }))
        setTime(null)
        setErrors((er) => ({ ...er, time: SLOT_TAKEN_MSG }))
      } else {
        setErrors((er) => ({ ...er, submit: 'Something went wrong. Please try again.' }))
      }
      setSubmitting(false)
      return
    }

    // ✅ Booking saved. Redirect immediately. The confirmation + team-notification
    // email is fire-and-forget — it must NEVER block or fail the booking, and any
    // email error is logged only (the client never sees "Something went wrong").
    sendEmail('consultation', row).then((ok) => {
      if (!ok) console.error('[consultation] confirmation email did not send (booking still saved)')
    })

    setSubmitting(false)
    navigate('/consultation-confirmed', {
      state: { name: row.name, business: row.business, date: row.date, time: row.time },
    })
  }

  return (
    <section id="consultation" className="relative scroll-mt-24 py-24">
      <div
        className="absolute left-1/2 top-0 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-gold-400/[0.07] blur-[130px]"
        aria-hidden="true"
      />
      <div className="container-max relative">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow mx-auto">
            <Sparkle className="h-3.5 w-3.5" /> Free Consultation
          </div>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-tight text-gray-50 sm:text-5xl">
            Book Your <span className="text-gold-gradient">Free Consultation</span>
          </h2>
          <p className="mt-4 text-gray-400">
            Choose a time that works for you and let's talk about the website, app,
            dashboard, or digital system your business needs.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          {/* LEFT — what happens on the call */}
          <div className="lg:pt-6">
            <h3 className="font-display text-2xl font-semibold text-gray-50">
              What happens on the call
            </h3>
            <p className="mt-4 max-w-md text-gray-400">
              A relaxed, no-pressure conversation. In about 20 minutes we'll get
              clear on what your business actually needs — and the smartest way to
              get there.
            </p>

            <ul className="mt-8 space-y-4">
              {WHAT_HAPPENS.map((t) => (
                <li key={t} className="flex items-center gap-3 text-gray-200">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/10 text-gold-300">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="font-display">{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="font-display text-3xl font-bold text-gold-gradient">24h</div>
              <div className="text-sm text-gray-400">
                We'll confirm your consultation within 24 hours of booking.
              </div>
            </div>
          </div>

          {/* RIGHT — calendar booking card */}
          <div className="card-surface relative overflow-hidden p-6 shadow-card sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />

            <form onSubmit={onSubmit} className="relative" noValidate>
                {/* calendar */}
                <div className="rounded-2xl border border-white/10 bg-ink-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-base font-semibold text-gray-100">
                      {MONTHS[view.m]} {view.y}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => canPrev && shiftMonth(-1)}
                        disabled={!canPrev}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400/30 text-gold-200 transition-colors hover:border-gold-400/70 hover:bg-gold-400/10 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Previous month"
                      >
                        <Arrow className="h-4 w-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => canNext && shiftMonth(1)}
                        disabled={!canNext}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400/30 text-gold-200 transition-colors hover:border-gold-400/70 hover:bg-gold-400/10 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Next month"
                      >
                        <Arrow className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1 text-center">
                    {WEEKDAYS.map((w) => (
                      <div key={w} className="py-1 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                        {w}
                      </div>
                    ))}
                    {cells.map((d, i) => {
                      if (d === null) return <div key={`e${i}`} />
                      const s = dayState(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={!s.available}
                          onClick={() => pickDate(s.date)}
                          className={`flex aspect-square items-center justify-center rounded-lg text-sm transition-all ${
                            s.isSelected
                              ? 'bg-gold-gradient font-semibold text-ink-950 shadow-gold-soft'
                              : s.available
                                ? `text-gray-200 hover:bg-gold-400/15 ${s.isToday ? 'ring-1 ring-gold-400/50' : ''}`
                                : 'cursor-not-allowed text-gray-700'
                          }`}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {errors.date && <p className="mt-2 text-xs text-red-400">{errors.date}</p>}

                {/* time slots */}
                <div className="mt-5">
                  <label className="mb-2 block font-display text-sm text-gray-300">
                    Available times
                  </label>
                  {selected ? (
                    loadingTimes ? (
                      <p className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-center font-mono text-xs text-gray-500">
                        Checking availability…
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {TIMES.map((t) => {
                          const taken = bookedTimes.includes(t)
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={taken}
                              onClick={() => {
                                setTime(t)
                                setErrors((er) => ({ ...er, time: undefined }))
                              }}
                              className={`rounded-xl border px-3 py-2.5 font-mono text-xs transition-colors ${
                                taken
                                  ? 'cursor-not-allowed border-white/5 bg-white/[0.01] text-gray-700 line-through'
                                  : time === t
                                    ? 'border-gold-400/60 bg-gold-400/10 text-gold-100'
                                    : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-gold-400/40'
                              }`}
                            >
                              {t}
                            </button>
                          )
                        })}
                      </div>
                    )
                  ) : (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-center font-mono text-xs text-gray-500">
                      Select a date above to see available times
                    </p>
                  )}
                  {errors.time && <p className="mt-2 text-xs text-red-400">{errors.time}</p>}
                </div>

                {/* details */}
                <div className="mt-6 space-y-4 border-t border-white/[0.08] pt-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="name" label="Name" required value={form.name}
                      onChange={update('name')} placeholder="Ada Lovelace" error={errors.name} />
                    <Field name="email" label="Email" type="email" required value={form.email}
                      onChange={update('email')} placeholder="ada@company.com" error={errors.email} />
                  </div>

                  <Field name="phone" label="Phone" optional value={form.phone}
                    onChange={update('phone')} placeholder="(555) 123-4567" />

                  {/* Q1 */}
                  <Field
                    name="business"
                    label="What is the name of your business, and what products or services do you offer?"
                    required value={form.business} onChange={update('business')}
                    placeholder="e.g. Acme Co. — handcrafted furniture & interior design"
                    error={errors.business}
                  />

                  {/* existing project-type select (preserved) */}
                  <Select
                    label="What do you need help with?"
                    value={form.need} onChange={update('need')} options={NEEDS}
                  />

                  {/* Q2 — pill select */}
                  <PillSelect
                    label="What is the biggest challenge you're currently facing with your online presence?"
                    required value={form.challenge} onChange={setField('challenge')}
                    options={CHALLENGES} error={errors.challenge}
                  />
                  {form.challenge === 'Other' && (
                    <Field name="challengeOther" label="Tell us more" required
                      value={form.challengeOther} onChange={update('challengeOther')}
                      placeholder="Describe your challenge" error={errors.challengeOther} />
                  )}

                  {/* Q3 */}
                  <TextArea
                    label="What outcome would make this project a success for you over the next 6–12 months?"
                    required value={form.success} onChange={update('success')}
                    placeholder="e.g. Double inbound leads and book 10 new clients a month."
                    error={errors.success}
                  />

                  {/* Q4 */}
                  <CheckboxGroup
                    label="Do you currently have any of the following? (Select all that apply.)"
                    required options={SYSTEMS} selected={form.systems}
                    onToggle={toggleSystem} error={errors.systems}
                  />

                  {/* Q5 — pill select */}
                  <PillSelect
                    label="What is your estimated budget range for this project?"
                    required value={form.budget} onChange={setField('budget')}
                    options={BUDGETS} error={errors.budget}
                  />

                  {/* Q6 — pill select */}
                  <PillSelect
                    label="How did you hear about Digital Skyline Co.?"
                    required value={form.heard} onChange={setField('heard')}
                    options={HEARD} error={errors.heard}
                  />
                  {form.heard === 'Other' && (
                    <Field name="heardOther" label="Tell us more" required
                      value={form.heardOther} onChange={update('heardOther')}
                      placeholder="How did you find us?" error={errors.heardOther} />
                  )}

                  {/* Notes */}
                  <TextArea
                    label="Additional Notes" optional value={form.notes} onChange={update('notes')}
                    placeholder="Tell us anything else you'd like us to know about your business, goals, or project."
                  />
                </div>

                {errors.submit && <p className="mt-4 text-sm text-red-400">{errors.submit}</p>}

                <button type="submit" disabled={submitting} className="btn-gold mt-6 w-full text-base disabled:opacity-60">
                  {submitting ? 'Booking…' : (<>Book My Free Consultation <Arrow className="h-5 w-5" /></>)}
                </button>
                <p className="mt-3 text-center font-mono text-[11px] text-gray-600">
                  No charge · We respect your inbox, no spam ever.
                </p>
              </form>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, error, optional, required, type = 'text', ...props }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">
        {label}{' '}
        {required && <span className="text-gold-300">*</span>}
        {optional && <span className="text-gray-600">(optional)</span>}
      </label>
      <input
        type={type}
        {...props}
        className={`w-full rounded-xl border bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:outline-none ${
          error ? 'border-red-400/60 focus:border-red-400' : 'border-white/10 focus:border-gold-400/60'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function TextArea({ label, error, optional, required, ...props }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">
        {label}{' '}
        {required && <span className="text-gold-300">*</span>}
        {optional && <span className="text-gray-600">(optional)</span>}
      </label>
      <textarea
        rows={4}
        {...props}
        className={`w-full resize-y rounded-xl border bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:outline-none ${
          error ? 'border-red-400/60 focus:border-red-400' : 'border-white/10 focus:border-gold-400/60'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function Select({ label, value, onChange, options, placeholder, error, required }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">
        {label} {required && <span className="text-gold-300">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className={`w-full appearance-none rounded-xl border bg-ink-950/60 px-4 py-3 pr-10 text-sm transition-colors focus:outline-none ${
            error ? 'border-red-400/60 focus:border-red-400' : 'border-white/10 focus:border-gold-400/60'
          } ${value ? 'text-gray-100' : 'text-gray-500'}`}
        >
          {placeholder && (
            <option value="" disabled className="bg-ink-900 text-gray-500">
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o} value={o} className="bg-ink-900 text-gray-100">
              {o}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gold-300">
          <Arrow className="h-4 w-4 rotate-90" />
        </span>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function PillSelect({ label, value, onChange, options, error, required }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">
        {label} {required && <span className="text-gold-300">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                active
                  ? 'border-gold-400/60 bg-gold-400/10 text-gold-100'
                  : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-gold-400/40'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function CheckboxGroup({ label, options, selected, onToggle, error, required }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">
        {label} {required && <span className="text-gold-300">*</span>}
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const active = selected.includes(o)
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                active
                  ? 'border-gold-400/60 bg-gold-400/10 text-gold-100'
                  : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-gold-400/40'
              }`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                active ? 'border-gold-400/60 bg-gold-gradient text-ink-950' : 'border-white/20'
              }`}>
                {active && <Check className="h-3 w-3" />}
              </span>
              {o}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}
