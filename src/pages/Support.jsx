import { useState } from 'react'
import AmbientCanvas from '../components/AmbientCanvas.jsx'
import CustomCursor from '../components/CustomCursor.jsx'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import { supabase } from '../lib/supabase.js'
import { Activity, Lock, Code, Sparkle, Arrow, Check } from '../components/Icons.jsx'

// Where support requests are sent. FormSubmit.co relays to this inbox without a
// backend (the same approach used by the consultation form). A mailto fallback
// is offered if the network request fails.
const SUPPORT_EMAIL = 'pennellanderson55@gmail.com'

const CARDS = [
  {
    icon: Activity,
    title: 'Project Updates',
    desc: 'For clients who need changes, revisions, or new content added.',
  },
  {
    icon: Lock,
    title: 'Payment Help',
    desc: 'For invoice questions, payment issues, or billing support.',
  },
  {
    icon: Code,
    title: 'Website/App Issues',
    desc: 'For bugs, broken links, form problems, mobile issues, or performance concerns.',
  },
  {
    icon: Sparkle,
    title: 'General Support',
    desc: 'For anything else related to your Digital Skyline project.',
  },
]

const SUPPORT_TYPES = [
  'Project Update',
  'Payment Help',
  'Website/App Issue',
  'General Support',
]

const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  reference: '',
  type: SUPPORT_TYPES[0],
  message: '',
}

export default function Support() {
  usePageMeta({
    title: 'Support Center | Digital Skyline Co.',
    description:
      'Get help with your Digital Skyline Co. project — updates, payments, website or app issues, and general support requests.',
  })

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Please enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    if (!form.message.trim()) errs.message = 'Please describe how we can help'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Compose a mailto fallback so the request is never lost.
  const mailtoHref = () => {
    const subject = `Support Request — ${form.type}`
    const body = [
      `Name: ${form.name}`,
      `Company: ${form.company || '—'}`,
      `Email: ${form.email}`,
      `Project Reference / Invoice #: ${form.reference || '—'}`,
      `Support Type: ${form.type}`,
      '',
      'Message:',
      form.message,
    ].join('\n')
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)

    // Store the request so it appears in the admin Support tab (Section 7).
    // Best-effort — never blocks the confirmation if Supabase isn't configured.
    if (supabase) {
      try {
        await supabase.from('support_requests').insert({
          project_reference: form.reference.trim() || null,
          client_name: form.name.trim(),
          company: form.company.trim() || null,
          email: form.email.trim(),
          support_type: form.type,
          message: form.message.trim(),
        })
      } catch {
        /* request storage is best-effort — FormSubmit + mailto still cover it */
      }
    }

    // Best-effort delivery via FormSubmit (no backend needed). Whether or not
    // this succeeds we still show the confirmation, with a mailto fallback link.
    try {
      await fetch(`https://formsubmit.co/ajax/${SUPPORT_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `New Support Request — ${form.type}`,
          Name: form.name.trim(),
          Company: form.company.trim() || '—',
          Email: form.email.trim(),
          'Project Reference / Invoice Number': form.reference.trim() || '—',
          'Support Type': form.type,
          Message: form.message.trim(),
        }),
      })
    } catch {
      /* email is best-effort — the confirmation + mailto fallback cover this */
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  const reset = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setSubmitted(false)
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950">
      <AmbientCanvas />
      <CustomCursor />
      <Navbar />

      <main className="font-sans">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative scroll-mt-24 pt-36 pb-14">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gold-400/[0.08] blur-[120px] animate-float-slow" />
            <div className="absolute inset-0 bg-radial-gold opacity-60" />
          </div>

          <div className="container-max relative text-center">
            <div className="eyebrow mx-auto ds-reveal">
              <Sparkle className="h-3.5 w-3.5" /> Support Center
            </div>
            <h1
              className="mt-6 font-display text-5xl font-bold tracking-tight text-gray-50 sm:text-6xl ds-reveal"
              style={{ animationDelay: '0.08s' }}
            >
              Support <span className="text-gold-gradient">Center</span>
            </h1>
            <p
              className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-400 ds-reveal"
              style={{ animationDelay: '0.16s' }}
            >
              Need help with your project, website, app, payment, or update
              request? Send us the details and our team will follow up.
            </p>
          </div>
        </section>

        {/* ── Support categories ───────────────────────────────── */}
        <section className="relative py-8">
          <div className="container-max">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {CARDS.map((c, i) => {
                const Icon = c.icon
                return (
                  <article
                    key={c.title}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/30 ds-reveal"
                    style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-400/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.07] text-gold-300 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="relative mt-5 font-display text-lg font-semibold text-gray-50">
                      {c.title}
                    </h3>
                    <p className="relative mt-2 text-sm leading-relaxed text-gray-400">
                      {c.desc}
                    </p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Support form ─────────────────────────────────────── */}
        <section className="relative py-16">
          <div
            className="pointer-events-none absolute left-1/2 top-10 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-gold-400/[0.07] blur-[130px]"
            aria-hidden="true"
          />
          <div className="container-max relative">
            <div className="mx-auto max-w-2xl">
              <div className="relative overflow-hidden rounded-3xl border border-gold-400/25 bg-gradient-to-b from-gold-400/[0.06] via-ink-900/60 to-ink-950/80 p-8 shadow-card backdrop-blur-xl sm:p-10">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gold-sheen [background-size:200%_100%] animate-sheen" />
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />

                {submitted ? (
                  <div className="relative flex min-h-[360px] flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-gradient text-ink-950 shadow-gold-soft">
                      <Check className="h-8 w-8" />
                    </div>
                    <h2 className="mt-6 font-display text-2xl font-bold text-gray-50">
                      Support request received
                    </h2>
                    <p className="mt-3 max-w-md text-gray-400">
                      Thank you, {form.name.split(' ')[0] || 'there'}. Your request
                      has been logged and our team will follow up by email as soon
                      as possible.
                    </p>
                    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                      <a href={mailtoHref()} className="btn-ghost text-sm">
                        Email us a copy
                      </a>
                      <button onClick={reset} className="btn-gold text-sm">
                        Submit another request
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={onSubmit} className="relative" noValidate>
                    <div className="text-center">
                      <h2 className="font-display text-3xl font-bold tracking-tight text-gray-50">
                        Submit a <span className="text-gold-gradient">Support Request</span>
                      </h2>
                    </div>

                    <div className="mt-8 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Full Name"
                          required
                          value={form.name}
                          onChange={update('name')}
                          placeholder="Ada Lovelace"
                          error={errors.name}
                        />
                        <Field
                          label="Company Name"
                          optional
                          value={form.company}
                          onChange={update('company')}
                          placeholder="Acme Co."
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Email Address"
                          type="email"
                          required
                          value={form.email}
                          onChange={update('email')}
                          placeholder="ada@company.com"
                          error={errors.email}
                        />
                        <Field
                          label="Project Reference / Invoice Number"
                          optional
                          value={form.reference}
                          onChange={update('reference')}
                          placeholder="DS-CLIENT-001 or INV-0001"
                          helper="If you have been given a project reference or invoice number, enter it here. Otherwise leave blank."
                        />
                      </div>

                      <Select
                        label="Support Type"
                        value={form.type}
                        onChange={update('type')}
                        options={SUPPORT_TYPES}
                      />

                      <TextArea
                        label="Message"
                        required
                        value={form.message}
                        onChange={update('message')}
                        placeholder="Describe what you need help with. Include links, screenshots, or invoice details where possible."
                        error={errors.message}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-gold mt-6 w-full text-base disabled:opacity-60"
                    >
                      {submitting ? 'Submitting…' : (<>Submit Support Request <Arrow className="h-5 w-5" /></>)}
                    </button>

                    <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-gray-500">
                      Support requests are reviewed by Digital Skyline Co. Please
                      include as much detail as possible so we can help faster.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style>{`
        @keyframes dsFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: none; }
        }
        .ds-reveal {
          opacity: 0;
          animation: dsFadeUp 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .ds-reveal { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function Field({ label, error, helper, optional, required, type = 'text', ...props }) {
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
      {error ? (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : (
        helper && <p className="mt-1.5 text-xs text-gray-500">{helper}</p>
      )}
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
        rows={5}
        {...props}
        className={`w-full resize-y rounded-xl border bg-ink-950/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:outline-none ${
          error ? 'border-red-400/60 focus:border-red-400' : 'border-white/10 focus:border-gold-400/60'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-2 block font-display text-sm text-gray-300">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 pr-10 text-sm text-gray-100 transition-colors focus:border-gold-400/60 focus:outline-none"
        >
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
    </div>
  )
}
