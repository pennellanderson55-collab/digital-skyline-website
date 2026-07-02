import { useEffect, useMemo, useState } from 'react'
import { Arrow, Check } from '../components/Icons.jsx'
import {
  PROJECT_STAGES, PACKAGES, PROJECT_TYPES,
  PAYMENT_STATUS_STYLES, stageStyle, paymentStatus, balanceDue,
  fmtMoney, fmtDate, fmtDateTime, num,
} from './ops.js'

/**
 * Full Client / Project profile (Sections 3 + 4 + 6). Renders as a full panel
 * (back button) rather than a modal. The Project Reference is shown as the
 * master identifier connecting every section below.
 */
export default function ProjectProfile({ project, history = [], onClose, onSaveProject, onSaveClient, onStageChange, onRevert, onDelete }) {
  const client = project.client || {}

  const [clientForm, setClientForm] = useState(pickClient(client))
  const [projForm, setProjForm] = useState(pickProject(project))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [revertError, setRevertError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Re-initialise only when a *different* project is opened — not on every
  // optimistic patch (which would discard unsaved edits mid-session).
  useEffect(() => {
    setClientForm(pickClient(project.client || {}))
    setProjForm(pickProject(project))
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const setC = (k) => (e) => { setClientForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false) }
  const setP = (k) => (e) => { setProjForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false) }
  const setPBool = (k) => (e) => { setProjForm((f) => ({ ...f, [k]: e.target.checked })); setSaved(false) }

  const liveProject = { ...project, ...projForm }
  const payStatus = paymentStatus(liveProject)

  const save = async () => {
    setSaving(true)
    const projPatch = {
      ...projForm,
      total_price: num(projForm.total_price),
      deposit_required: num(projForm.deposit_required),
      amount_paid: num(projForm.amount_paid),
      launch_date: projForm.launch_date || null,
    }
    await onSaveClient?.(clientForm)
    await onSaveProject?.(projPatch)
    setSaving(false)
    setSaved(true)
  }

  const doRevert = async () => {
    setReverting(true); setRevertError('')
    try {
      await onRevert()   // on success the parent unmounts this profile
    } catch (e) {
      setRevertError(e.message || 'Revert failed. Please try again.')
      setReverting(false)
    }
  }

  const doDelete = async () => {
    setDeleting(true); setDeleteError('')
    try {
      await onDelete()   // on success the parent unmounts this profile
    } catch (e) {
      setDeleteError(e.message || 'Delete failed. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onClose} className="btn-ghost text-xs">
          <Arrow className="h-4 w-4 rotate-180" /> Back
        </button>
        <div className="flex items-center gap-2">
          {onRevert && (
            <button
              onClick={() => { setRevertError(''); setConfirmRevert(true) }}
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-400/[0.06] px-5 py-2.5 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/70 hover:bg-rose-400/10"
            >
              Revert To Lead
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { setDeleteError(''); setConfirmDelete(true) }}
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-400/[0.06] px-5 py-2.5 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/70 hover:bg-rose-400/10"
            >
              Delete
            </button>
          )}
          <button onClick={save} disabled={saving} className="btn-gold text-sm disabled:opacity-60">
            {saving ? 'Saving…' : saved ? (<>Saved <Check className="h-4 w-4" /></>) : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Revert confirmation */}
      {confirmRevert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => !reverting && setConfirmRevert(false)}
        >
          <div className="card-surface relative w-full max-w-md p-7 shadow-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-bold text-gray-50">Revert to lead?</h3>
            <p className="mt-3 text-sm text-gray-400">
              This permanently deletes the client and project records for{' '}
              <span className="font-mono text-gold-200">{project.project_reference}</span>, then returns the
              original consultation to the Leads / Consultations workflow with its status set back to “New”.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              The original consultation and all of its data are preserved. Use this for accidental conversions
              or testing — it cannot be undone.
            </p>
            {revertError && <p className="mt-3 text-xs text-rose-400">{revertError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmRevert(false)} disabled={reverting} className="btn-ghost text-sm disabled:opacity-60">
                Cancel
              </button>
              <button
                onClick={doRevert}
                disabled={reverting}
                className="inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-400/15 px-6 py-2.5 text-sm font-semibold text-rose-100 transition-colors hover:bg-rose-400/25 disabled:opacity-60"
              >
                {reverting ? 'Reverting…' : 'Revert To Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation (soft delete of the project + its client record) */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div className="card-surface relative w-full max-w-md p-7 shadow-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-bold text-gray-50">Delete this record?</h3>
            <p className="mt-3 text-sm text-gray-400">
              The project and client record for{' '}
              <span className="font-mono text-gold-200">{project.project_reference}</span>
              {' '}(<span className="text-gray-200">{clientForm.company_name || clientForm.contact_name || 'this client'}</span>)
              {' '}will be removed from your Projects and Clients lists.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              This is a soft delete — the record is retained in the database and can be restored. It does not
              affect the original consultation.
            </p>
            {deleteError && <p className="mt-3 text-xs text-rose-400">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="btn-ghost text-sm disabled:opacity-60">
                Cancel
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full bg-rose-500/90 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-gold-300">
            {project.project_reference}
          </span>
          <h2 className="font-display text-2xl font-bold text-gray-50">
            {clientForm.company_name || clientForm.contact_name || 'Untitled Client'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${stageStyle(projForm.stage)}`}>
            {projForm.stage}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${PAYMENT_STATUS_STYLES[payStatus]}`}>
            {payStatus}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* CLIENT INFORMATION */}
        <Card title="Client Information">
          <Grid>
            <Text label="Company Name" value={clientForm.company_name} onChange={setC('company_name')} />
            <Text label="Contact Name" value={clientForm.contact_name} onChange={setC('contact_name')} />
            <Text label="Email" value={clientForm.email} onChange={setC('email')} />
            <Text label="Phone" value={clientForm.phone} onChange={setC('phone')} />
            <Text label="Website URL" value={clientForm.website_url} onChange={setC('website_url')} placeholder="https://" />
            <Text label="Industry" value={clientForm.industry} onChange={setC('industry')} />
          </Grid>
        </Card>

        {/* PROJECT INFORMATION */}
        <Card title="Project Information">
          <Grid>
            <Text label="Package Purchased" value={projForm.package} onChange={setP('package')} list="ds-packages" />
            <Text label="Project Type" value={projForm.project_type} onChange={setP('project_type')} list="ds-types" />
            <Select label="Current Status (Stage)" value={projForm.stage}
              onChange={(e) => { setProjForm((f) => ({ ...f, stage: e.target.value })); onStageChange?.(e.target.value) }}
              options={PROJECT_STAGES} />
            <Text label="Launch Date" type="date" value={projForm.launch_date || ''} onChange={setP('launch_date')} />
            <Text label="Assigned Designer" value={projForm.assigned_designer} onChange={setP('assigned_designer')} />
            <Text label="Assigned Project Manager" value={projForm.assigned_project_manager} onChange={setP('assigned_project_manager')} />
            <Text label="Assigned Developer" value={projForm.assigned_developer} onChange={setP('assigned_developer')} />
            <Text label="Status Owner" value={projForm.status_owner} onChange={setP('status_owner')} />
          </Grid>
          <datalist id="ds-packages">{PACKAGES.map((o) => <option key={o} value={o} />)}</datalist>
          <datalist id="ds-types">{PROJECT_TYPES.map((o) => <option key={o} value={o} />)}</datalist>
        </Card>

        {/* PAYMENTS */}
        <Card title="Payments">
          <Grid>
            <Text label="Total Project Price" type="number" value={projForm.total_price} onChange={setP('total_price')} prefix="$" />
            <Text label="Deposit Required" type="number" value={projForm.deposit_required} onChange={setP('deposit_required')} prefix="$" />
            <Text label="Amount Paid" type="number" value={projForm.amount_paid} onChange={setP('amount_paid')} prefix="$" />
            <Readout label="Balance Remaining" value={fmtMoney(balanceDue(liveProject))} />
          </Grid>
          <div className="mt-4 flex flex-wrap gap-4">
            <Toggle label="Deposit Paid" checked={!!projForm.deposit_paid} onChange={setPBool('deposit_paid')} />
            <Toggle label="Final Invoice Sent" checked={!!projForm.final_invoice_sent} onChange={setPBool('final_invoice_sent')} />
            <Toggle label="Final Invoice Paid" checked={!!projForm.final_invoice_paid} onChange={setPBool('final_invoice_paid')} />
            <Toggle label="Paid In Full" checked={!!projForm.paid_in_full} onChange={setPBool('paid_in_full')} />
          </div>
          <div className="mt-5 border-t border-white/[0.08] pt-5">
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Stripe (manual entry)</h4>
            <div className="mt-3 space-y-3">
              <Text label="Stripe Invoice Link" value={projForm.stripe_invoice_link} onChange={setP('stripe_invoice_link')} placeholder="https://invoice.stripe.com/…" />
              <Text label="Stripe Payment Link" value={projForm.stripe_payment_link} onChange={setP('stripe_payment_link')} placeholder="https://buy.stripe.com/…" />
              <Text label="Stripe Customer ID" value={projForm.stripe_customer_id} onChange={setP('stripe_customer_id')} placeholder="cus_…" />
            </div>
          </div>
        </Card>

        {/* NOTES */}
        <Card title="Notes">
          <Area label="Internal Notes (private)" value={projForm.internal_notes} onChange={setP('internal_notes')}
            placeholder="Private notes — never shown to the client…" />
          <div className="mt-4">
            <Area label="Client Notes (shareable)" value={projForm.client_notes} onChange={setP('client_notes')}
              placeholder="Notes intended for the client / future client portal…" />
          </div>
        </Card>

        {/* FILES (placeholder) */}
        <Card title="Files">
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
            <p className="text-sm text-gray-400">File uploads coming soon.</p>
            <p className="mt-1 text-xs text-gray-600">
              Contracts, assets and deliverables for {project.project_reference} will live here.
            </p>
          </div>
        </Card>

        {/* TIMELINE */}
        <Card title="Timeline">
          <Timeline project={project} history={history} />
        </Card>
      </div>
    </div>
  )
}

function Timeline({ project, history }) {
  const events = useMemo(() => {
    const list = history.map((h) => ({ label: `Moved to ${h.stage}`, at: h.changed_at }))
    list.push({ label: 'Project created', at: project.created_at })
    return list.sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [history, project.created_at])

  if (events.length === 0) return <p className="text-sm text-gray-500">No history yet.</p>
  return (
    <ol className="relative space-y-4 border-l border-white/[0.12] pl-5">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full bg-gold-gradient" />
          <div className="text-sm text-gray-200">{e.label}</div>
          <div className="font-mono text-[11px] text-gray-500">{fmtDateTime(e.at)}</div>
        </li>
      ))}
    </ol>
  )
}

/* ----------------------------------------------------------------- pieces */

function Card({ title, children }) {
  return (
    <section className="card-surface p-6 shadow-card">
      <h3 className="font-display text-lg font-semibold text-gray-50">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

const Grid = ({ children }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>

function Text({ label, value, onChange, type = 'text', placeholder, prefix, list }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gold-300">{prefix}</span>}
        <input
          type={type}
          list={list}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-white/10 bg-ink-950/60 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none ${prefix ? 'pl-7 pr-3' : 'px-3'}`}
        />
      </div>
    </label>
  )
}

function Readout({ label, value }) {
  return (
    <div>
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <div className="rounded-lg border border-gold-400/25 bg-gold-400/[0.06] px-3 py-2.5 text-sm font-semibold text-gold-100">
        {value}
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <div className="relative">
        <select value={value} onChange={onChange}
          className="w-full appearance-none rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2.5 pr-9 text-sm text-gray-100 focus:border-gold-400/60 focus:outline-none">
          {options.map((o) => <option key={o} value={o} className="bg-ink-900 text-gray-100">{o}</option>)}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gold-300">
          <Arrow className="h-3.5 w-3.5 rotate-90" />
        </span>
      </div>
    </label>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
      <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'border-gold-400/60 bg-gold-gradient text-ink-950' : 'border-white/20'}`}>
        {checked && <Check className="h-3 w-3" />}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  )
}

function Area({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <textarea rows={4} value={value ?? ''} onChange={onChange} placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gold-400/60 focus:outline-none" />
    </label>
  )
}

/* --------------------------------------------------------------- helpers */

function pickClient(c) {
  return {
    company_name: c.company_name || '',
    contact_name: c.contact_name || '',
    email: c.email || '',
    phone: c.phone || '',
    website_url: c.website_url || '',
    industry: c.industry || '',
  }
}

function pickProject(p) {
  return {
    package: p.package || '',
    project_type: p.project_type || '',
    stage: p.stage || 'Lead',
    launch_date: p.launch_date || '',
    assigned_designer: p.assigned_designer || '',
    assigned_developer: p.assigned_developer || '',
    assigned_project_manager: p.assigned_project_manager || '',
    status_owner: p.status_owner || '',
    total_price: p.total_price ?? 0,
    deposit_required: p.deposit_required ?? 0,
    amount_paid: p.amount_paid ?? 0,
    deposit_paid: !!p.deposit_paid,
    final_invoice_sent: !!p.final_invoice_sent,
    final_invoice_paid: !!p.final_invoice_paid,
    paid_in_full: !!p.paid_in_full,
    stripe_invoice_link: p.stripe_invoice_link || '',
    stripe_payment_link: p.stripe_payment_link || '',
    stripe_customer_id: p.stripe_customer_id || '',
    internal_notes: p.internal_notes || '',
    client_notes: p.client_notes || '',
  }
}
