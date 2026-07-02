// ============================================================================
// Settings primitives — reusable, brand-consistent form building blocks.
// Card shells, labelled fields (text / email / tel / url / number / textarea /
// select / color / toggle / tags), skeletons, a sticky save bar and a small
// toast system. Keeps the ink + gold language and mirrors the app's inputs.
// ============================================================================

import { useEffect, useState } from 'react'
import { Check, Close } from '../../components/Icons.jsx'

/* ── card ─────────────────────────────────────────────────────────────────── */
export function SettingCard({ title, description, icon, children, aside }) {
  return (
    <section className="card-surface p-6 shadow-card sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.08] text-gold-300">{icon}</span>}
          <div>
            <h3 className="font-display text-lg font-semibold text-gray-50">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export const FieldGrid = ({ children }) => <div className="grid gap-5 sm:grid-cols-2">{children}</div>

/* ── labelled field wrapper ───────────────────────────────────────────────── */
function Label({ label, required, help, error, children, full }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block font-display text-sm text-gray-300">
        {label}{required && <span className="text-gold-300"> *</span>}
      </span>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-400">{error}</p>
        : help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </label>
  )
}

const inputCls = (error) =>
  `w-full rounded-xl border bg-ink-950/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:outline-none ${
    error ? 'border-rose-400/60 focus:border-rose-400' : 'border-white/10 focus:border-gold-400/60'
  }`

export function Field({ label, value, onChange, type = 'text', placeholder, required, help, error, full, ...rest }) {
  return (
    <Label label={label} required={required} help={help} error={error} full={full}>
      <input
        type={type} value={value ?? ''} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className={inputCls(error)} {...rest}
      />
    </Label>
  )
}

export function TextArea({ label, value, onChange, placeholder, rows = 4, help, error, full = true }) {
  return (
    <Label label={label} help={help} error={error} full={full}>
      <textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className={`${inputCls(error)} resize-y`} />
    </Label>
  )
}

export function SelectField({ label, value, onChange, options = [], help, error, full }) {
  return (
    <Label label={label} help={help} error={error} full={full}>
      <div className="relative">
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          className={`${inputCls(error)} appearance-none pr-9`}>
          {options.map((o) => {
            const val = typeof o === 'string' ? o : o.value
            const lab = typeof o === 'string' ? o : o.label
            return <option key={val} value={val} className="bg-ink-900 text-gray-100">{lab}</option>
          })}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gold-300">▾</span>
      </div>
    </Label>
  )
}

export function Toggle({ label, checked, onChange, help, disabled }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <div className="text-sm text-gray-200">{label}</div>
        {help && <div className="text-xs text-gray-500">{help}</div>}
      </div>
      <button type="button" role="switch" aria-checked={!!checked} disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-gold-gradient' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

export function ColorField({ label, value, onChange, help }) {
  return (
    <Label label={label} help={help}>
      <div className="flex items-center gap-3">
        <input type="color" value={value || '#d4af37'} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="#d4af37"
          className={`${inputCls(false)} font-mono`} />
      </div>
    </Label>
  )
}

// Comma-separated tags <-> array
export function TagsField({ label, value = [], onChange, placeholder, help, full = true }) {
  const str = Array.isArray(value) ? value.join(', ') : (value || '')
  return (
    <Label label={label} help={help || 'Comma-separated.'} full={full}>
      <input value={str} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        className={inputCls(false)} />
      {Array.isArray(value) && value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((t) => <span key={t} className="rounded-full border border-gold-400/25 bg-gold-400/[0.06] px-2.5 py-0.5 text-[11px] text-gold-200">{t}</span>)}
        </div>
      )}
    </Label>
  )
}

/* ── skeleton ─────────────────────────────────────────────────────────────── */
export function SkeletonForm() {
  return (
    <div className="card-surface space-y-4 p-7 shadow-card">
      <div className="ds-shimmer h-6 w-48 rounded-lg" />
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ds-shimmer h-11 rounded-xl" />)}
      </div>
    </div>
  )
}

/* ── sticky save bar ──────────────────────────────────────────────────────── */
export function SaveBar({ dirty, saving, lastSaved, onSave, onReset }) {
  return (
    <div className="sticky bottom-4 z-30 mt-2 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-ink-950/85 px-5 py-3 shadow-card backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
        {dirty
          ? <span className="inline-flex items-center gap-1.5 text-amber-300"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" /> Unsaved changes</span>
          : <span className="inline-flex items-center gap-1.5 text-gray-500"><Check className="h-3.5 w-3.5 text-emerald-400" /> {lastSaved ? `Saved ${new Date(lastSaved).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'All changes saved'}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onReset} disabled={!dirty || saving} className="btn-ghost px-4 py-2 text-xs disabled:opacity-40">Reset</button>
        <button onClick={onSave} disabled={!dirty || saving} className="btn-gold px-5 py-2 text-xs disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

/* ── toasts ───────────────────────────────────────────────────────────────── */
export function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[90] flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}
function Toast({ toast, onDismiss }) {
  useEffect(() => { const id = setTimeout(onDismiss, 3600); return () => clearTimeout(id) }, [onDismiss])
  const tone = toast.type === 'error'
    ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
    : toast.type === 'info' ? 'border-sky-400/40 bg-sky-500/10 text-sky-100'
      : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
  return (
    <div className={`pointer-events-auto flex min-w-[240px] max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-card backdrop-blur-xl ${tone}`}
      style={{ animation: 'dsFadeUp .25s ease both' }}>
      <span className="mt-0.5">{toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
      <span className="flex-1 text-sm">{toast.msg}</span>
      <button onClick={onDismiss} className="text-current opacity-60 hover:opacity-100"><Close className="h-4 w-4" /></button>
    </div>
  )
}

/* ── status pill (Connected / etc.) ───────────────────────────────────────── */
export function StatusPill({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
      ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-gray-400/30 bg-gray-400/10 text-gray-400'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-gray-500'}`} />{label}
    </span>
  )
}
