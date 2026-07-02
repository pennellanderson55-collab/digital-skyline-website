// ============================================================================
// Vercel Serverless Function — Stripe → admin automatic payment sync.
//
// Stripe calls this endpoint on payment events. We verify the signature, then
// update the matching `projects` row (amount paid, deposit/final/paid-in-full
// flags, invoice + payment status, hosted invoice link, last payment time) so
// the admin dashboard reflects Stripe automatically — no manual entry.
//
// Mapping a Stripe event → a project:
//   • Checkout / Payment Link  → session.client_reference_id (or metadata
//                                 .project_reference) = the DS-YYYY-NNN ref.
//   • Invoice                  → invoice.metadata.project_reference, else the
//                                 project whose stripe_customer_id matches.
//
// Idempotency: every event id is recorded in `stripe_events` before we act; a
// re-delivered event is skipped. On failure we remove the record so Stripe's
// retry can reprocess. Requires supabase/sprint7_stripe_sync.sql.
//
// Secrets (server-only, set in Vercel — never VITE_):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================================

import Stripe from 'stripe'

// Stripe must verify against the RAW request body, so disable body parsing.
export const config = { api: { bodyParser: false } }

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null

// Supabase REST with the service role (bypasses RLS — same pattern as api/book.js).
function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const centsToUnits = (c) => round2((Number(c) || 0) / 100)

// Find the project this event belongs to.
async function findProject({ reference, customerId }) {
  const tryGet = async (query) => {
    const r = await sb(`projects?${query}&select=*&limit=1`)
    if (!r.ok) return null
    const rows = await r.json().catch(() => [])
    return rows[0] || null
  }
  if (reference) {
    const p = await tryGet(`project_reference=eq.${encodeURIComponent(reference)}`)
    if (p) return p
  }
  if (customerId) {
    const p = await tryGet(`stripe_customer_id=eq.${encodeURIComponent(customerId)}`)
    if (p) return p
  }
  return null
}

// Given the project and its new running total, derive the boolean flags.
function derivePaymentPatch(project, newAmountPaid) {
  const total = Number(project.total_price) || 0
  const deposit = Number(project.deposit_required) || 0
  const patch = { amount_paid: round2(newAmountPaid) }
  if (deposit > 0 && newAmountPaid >= deposit) patch.deposit_paid = true
  if (total > 0 && newAmountPaid >= total) {
    patch.paid_in_full = true
    patch.final_invoice_paid = true
  }
  return patch
}

async function patchProject(id, patch) {
  const r = await sb(`projects?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  if (!r.ok) throw new Error(`project update failed: ${r.status} ${await r.text().catch(() => '')}`)
}

// Apply a successful payment: bump the running total + refresh flags/status.
async function applyPayment(project, amountUnits, extra = {}) {
  const newTotal = round2((Number(project.amount_paid) || 0) + amountUnits)
  await patchProject(project.id, {
    ...derivePaymentPatch(project, newTotal),
    stripe_payment_status: 'succeeded',
    last_payment_at: new Date().toISOString(),
    ...extra,
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(502).json({ ok: false, error: 'Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET missing).' })
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(502).json({ ok: false, error: 'Supabase service role not configured (SUPABASE_SERVICE_ROLE_KEY missing).' })
  }

  // 1. Verify the signature against the raw body.
  let event
  try {
    const raw = await readRawBody(req)
    event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    return res.status(400).json({ ok: false, error: `Signature verification failed: ${e.message}` })
  }

  // 2. Idempotency — record the event id first; skip if already seen.
  const ins = await sb('stripe_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: event.id, type: event.type }),
  })
  if (ins.status === 409) return res.status(200).json({ ok: true, duplicate: true })
  if (!ins.ok && ins.status !== 201 && ins.status !== 200) {
    // Ledger write failed (likely migration not run) — let Stripe retry.
    return res.status(500).json({ ok: false, error: 'Could not record event (run sprint7_stripe_sync.sql).' })
  }

  // 3. Handle the event. On any error, remove the ledger row so Stripe retries.
  try {
    const obj = event.data.object

    switch (event.type) {
      case 'checkout.session.completed': {
        const reference = obj.client_reference_id || obj.metadata?.project_reference
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
        const project = await findProject({ reference, customerId })
        if (project) {
          await applyPayment(project, centsToUnits(obj.amount_total), {
            ...(customerId && !project.stripe_customer_id ? { stripe_customer_id: customerId } : {}),
          })
        }
        break
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const reference = obj.metadata?.project_reference
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
        const project = await findProject({ reference, customerId })
        if (project) {
          await applyPayment(project, centsToUnits(obj.amount_paid), {
            stripe_invoice_status: obj.status || 'paid',
            ...(obj.hosted_invoice_url ? { stripe_invoice_link: obj.hosted_invoice_url } : {}),
            ...(customerId && !project.stripe_customer_id ? { stripe_customer_id: customerId } : {}),
          })
        }
        break
      }

      case 'invoice.finalized':
      case 'invoice.sent': {
        const reference = obj.metadata?.project_reference
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
        const project = await findProject({ reference, customerId })
        if (project) {
          await patchProject(project.id, {
            final_invoice_sent: true,
            stripe_invoice_status: obj.status || 'open',
            ...(obj.hosted_invoice_url ? { stripe_invoice_link: obj.hosted_invoice_url } : {}),
            ...(customerId && !project.stripe_customer_id ? { stripe_customer_id: customerId } : {}),
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const reference = obj.metadata?.project_reference
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
        const project = await findProject({ reference, customerId })
        if (project) {
          await patchProject(project.id, {
            stripe_payment_status: 'failed',
            stripe_invoice_status: obj.status || 'open',
          })
        }
        break
      }

      default:
        // Unhandled event types are acknowledged (already recorded above).
        break
    }

    return res.status(200).json({ ok: true, type: event.type })
  } catch (e) {
    // Undo the idempotency record so the retry can reprocess this event.
    await sb(`stripe_events?id=eq.${encodeURIComponent(event.id)}`, { method: 'DELETE' }).catch(() => {})
    console.error('[stripe-webhook] failed:', e)
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
