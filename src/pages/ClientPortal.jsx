import { useEffect, useState } from 'react'
import AmbientCanvas from '../components/AmbientCanvas.jsx'
import CustomCursor from '../components/CustomCursor.jsx'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import { Activity, Shield, User, Chart, Arrow, Lock } from '../components/Icons.jsx'

const FEATURES = [
  {
    icon: Activity,
    title: 'Project Status',
    desc: 'Track where your project is in our development process.',
  },
  {
    icon: Shield,
    title: 'Secure Payments',
    desc: 'Submit invoice payments securely through Stripe.',
  },
  {
    icon: User,
    title: 'Support Requests',
    desc: 'Contact our team regarding updates, revisions, and support.',
  },
  {
    icon: Chart,
    title: 'Future Dashboard',
    desc: 'Coming soon: project tracking, invoices, files, and communication in one place.',
    soon: true,
  },
]

const EMPTY_FORM = {
  clientName: '',
  companyName: '',
  invoiceNumber: '',
  email: '',
  amount: '',
}

export default function ClientPortal() {
  usePageMeta({
    title: 'Client Portal | Digital Skyline Co.',
    description:
      'Manage your project, access resources, and securely submit invoice payments through the Digital Skyline Co. client portal.',
  })

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [processing, setProcessing] = useState(false)
  const [notice, setNotice] = useState('')

  // If the visitor lands on /client-portal#payment (e.g. from the footer's
  // "Pay Invoice" link), bring the payment card into view.
  useEffect(() => {
    if (window.location.hash === '#payment') {
      const el = document.getElementById('payment')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const update = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    setNotice('')
  }

  const validate = () => {
    const errs = {}
    if (!form.clientName.trim()) errs.clientName = 'Please enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    if (!form.invoiceNumber.trim()) errs.invoiceNumber = 'Please enter your invoice number'
    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0)
      errs.amount = 'Enter a valid payment amount'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    setProcessing(true)
    setNotice('')

    // The data a Stripe Checkout Session / Payment Link needs to bill the client.
    const payload = {
      clientName: form.clientName.trim(),
      companyName: form.companyName.trim() || null,
      invoiceNumber: form.invoiceNumber.trim(),
      email: form.email.trim(),
      amount: Number(form.amount),
    }

    // ─────────────────────────────────────────────────────────────────────
    // CONNECT STRIPE CHECKOUT HERE
    //
    // Option A — Stripe Payment Link (no backend required):
    //   1. Create a Payment Link in the Stripe Dashboard.
    //   2. Set VITE_STRIPE_PAYMENT_LINK in your env to that URL.
    //   The client's email + invoice are forwarded as prefill / reference values.
    //
    // Option B — Stripe Checkout Session (recommended for invoice amounts):
    //   Add a serverless endpoint (e.g. Vercel /api/create-checkout-session)
    //   that creates a Checkout Session from `payload`, then:
    //     const res = await fetch('/api/create-checkout-session', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify(payload),
    //     })
    //     const { url } = await res.json()
    //     window.location.href = url   // → Stripe-hosted secure checkout
    // ─────────────────────────────────────────────────────────────────────
    const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK
    if (paymentLink) {
      const url = new URL(paymentLink)
      url.searchParams.set('prefilled_email', payload.email)
      url.searchParams.set('client_reference_id', payload.invoiceNumber)
      window.location.href = url.toString()
      return
    }

    // Fallback shown until Stripe is connected — keeps the page functional.
    setProcessing(false)
    setNotice(
      'Secure online payments are being connected. Please contact support and we will send you a secure payment link right away.'
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950">
      <AmbientCanvas />
      <CustomCursor />
      <Navbar />

      <main className="font-sans">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative scroll-mt-24 pt-36 pb-20">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gold-400/[0.08] blur-[120px] animate-float-slow" />
            <div className="absolute inset-0 bg-radial-gold opacity-60" />
          </div>

          <div className="container-max relative text-center">
            <div className="eyebrow mx-auto ds-reveal">
              <Lock className="h-3.5 w-3.5" /> Client Portal
            </div>

            <h1
              className="mt-6 font-display text-5xl font-bold tracking-tight text-gray-50 sm:text-6xl ds-reveal"
              style={{ animationDelay: '0.08s' }}
            >
              Client <span className="text-gold-gradient">Portal</span>
            </h1>

            <p
              className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-400 ds-reveal"
              style={{ animationDelay: '0.16s' }}
            >
              Manage your project, access resources, and securely submit payments.
            </p>

            <div
              className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row ds-reveal"
              style={{ animationDelay: '0.24s' }}
            >
              <a href="#payment" className="btn-gold w-full sm:w-auto">
                Make a Payment <Arrow className="h-5 w-5" />
              </a>
              <a href="/#consultation" className="btn-ghost w-full sm:w-auto">
                Contact Support
              </a>
            </div>
          </div>
        </section>

        {/* ── Feature cards ────────────────────────────────────── */}
        <section className="relative py-12">
          <div className="container-max">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <article
                    key={f.title}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/30 ds-reveal"
                    style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-400/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.07] text-gold-300 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="relative mt-5 flex items-center gap-2 font-display text-lg font-semibold text-gray-50">
                      {f.title}
                      {f.soon && (
                        <span className="rounded-full border border-gold-400/30 bg-gold-400/[0.08] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gold-200">
                          Soon
                        </span>
                      )}
                    </h3>
                    <p className="relative mt-2 text-sm leading-relaxed text-gray-400">
                      {f.desc}
                    </p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Payment portal ───────────────────────────────────── */}
        <section id="payment" className="relative scroll-mt-24 py-20">
          <div
            className="pointer-events-none absolute left-1/2 top-10 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-gold-400/[0.07] blur-[130px]"
            aria-hidden="true"
          />
          <div className="container-max relative">
            <div className="mx-auto max-w-xl">
              {/* Premium black & gold payment card */}
              <div className="relative overflow-hidden rounded-3xl border border-gold-400/25 bg-gradient-to-b from-gold-400/[0.06] via-ink-900/60 to-ink-950/80 p-8 shadow-card backdrop-blur-xl sm:p-10">
                {/* Animated sheen edge + corner glow */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gold-sheen [background-size:200%_100%] animate-sheen" />
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />

                <div className="relative text-center">
                  <h2 className="font-display text-3xl font-bold tracking-tight text-gray-50">
                    Make a <span className="text-gold-gradient">Payment</span>
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
                    Use the secure payment portal below to submit payments for
                    active Digital Skyline projects.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="relative mt-8 space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Client Name"
                      required
                      value={form.clientName}
                      onChange={update('clientName')}
                      placeholder="Ada Lovelace"
                      error={errors.clientName}
                    />
                    <Field
                      label="Company Name"
                      optional
                      value={form.companyName}
                      onChange={update('companyName')}
                      placeholder="Acme Co."
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Invoice Number"
                      required
                      value={form.invoiceNumber}
                      onChange={update('invoiceNumber')}
                      placeholder="DS-1024"
                      error={errors.invoiceNumber}
                    />
                    <Field
                      label="Email Address"
                      type="email"
                      required
                      value={form.email}
                      onChange={update('email')}
                      placeholder="ada@company.com"
                      error={errors.email}
                    />
                  </div>

                  {/* Payment amount with $ prefix */}
                  <div>
                    <label className="mb-2 block font-display text-sm text-gray-300">
                      Payment Amount <span className="text-gold-300">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-gold-300">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={form.amount}
                        onChange={update('amount')}
                        placeholder="0.00"
                        className={`w-full rounded-xl border bg-ink-950/60 py-3 pl-8 pr-4 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:outline-none ${
                          errors.amount
                            ? 'border-red-400/60 focus:border-red-400'
                            : 'border-white/10 focus:border-gold-400/60'
                        }`}
                      />
                    </div>
                    {errors.amount && (
                      <p className="mt-1.5 text-xs text-red-400">{errors.amount}</p>
                    )}
                  </div>

                  {notice && (
                    <p className="rounded-xl border border-gold-400/25 bg-gold-400/[0.06] px-4 py-3 text-center text-sm text-gold-100">
                      {notice}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={processing}
                    className="btn-gold mt-2 w-full text-base disabled:opacity-60"
                  >
                    {processing ? (
                      'Redirecting…'
                    ) : (
                      <>
                        Proceed to Secure Payment <Arrow className="h-5 w-5" />
                      </>
                    )}
                  </button>

                  {/* Security notice */}
                  <div className="flex items-center justify-center gap-2 pt-1 text-center font-mono text-[11px] leading-relaxed text-gray-500">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-gold-400/70" />
                    <span>
                      Payments are processed securely through Stripe. Digital
                      Skyline Co does not store payment information.
                    </span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Local entrance animation */}
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
