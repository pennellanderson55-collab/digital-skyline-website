// ============================================================================
// Portfolio Manager — a CMS for portfolio items (replaces hand-editing
// Portfolio.jsx). CRUD against the `portfolio_items` table; the marketing site
// reads published rows (with a safe fallback to the built-in items). Media is
// referenced by URL/path for now (a /public path, external URL or a future
// Supabase Storage URL) — no uploads yet, which keeps heavy video off Supabase
// egress. An Upload button is the natural next step.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Plus, Arrow } from '../../components/Icons.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { Field, SelectField, TextArea, Toggle, SkeletonForm, StatusPill } from './primitives.jsx'

const CATEGORIES = ['Website', 'Dashboard', 'App', 'Automation', 'AI']
const BLANK = {
  title: '', description: '', category: 'Website', media_type: 'image',
  media_url: '', thumbnail_url: '', poster_url: '',
  featured: false, on_homepage: true, published: true, sort_order: 0,
}

export default function PortfolioManager({ toast }) {
  const [items, setItems] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // row or BLANK
  const [confirmDel, setConfirmDel] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setError('')
    if (!supabase) { setItems([]); return }
    const { data, error: e } = await supabase.from('portfolio_items').select('*').order('sort_order').order('created_at', { ascending: false })
    if (e) { setError(/does not exist|find the table/i.test(e.message) ? 'Run supabase/sprint8_settings.sql to enable the Portfolio Manager.' : e.message); setItems([]) }
    else setItems(data || [])
  }
  useEffect(() => { load() }, [])

  const save = async (row) => {
    setBusy(true)
    const payload = { ...row, sort_order: Number(row.sort_order) || 0 }
    delete payload.created_at; delete payload.updated_at
    const q = row.id
      ? supabase.from('portfolio_items').update(payload).eq('id', row.id).select().single()
      : supabase.from('portfolio_items').insert(payload).select().single()
    const { data, error: e } = await q
    setBusy(false)
    if (e) { toast?.(e.message, 'error'); return }
    setItems((its) => row.id ? its.map((i) => (i.id === data.id ? data : i)) : [data, ...(its || [])])
    setEditing(null)
    toast?.(row.id ? 'Portfolio item updated.' : 'Portfolio item added.')
  }

  const remove = async () => {
    const row = confirmDel; setConfirmDel(null); setBusy(true)
    const { error: e } = await supabase.from('portfolio_items').delete().eq('id', row.id)
    setBusy(false)
    if (e) { toast?.(e.message, 'error'); return }
    setItems((its) => its.filter((i) => i.id !== row.id))
    toast?.('Portfolio item deleted.')
  }

  const toggle = async (row, key) => {
    const next = !row[key]
    setItems((its) => its.map((i) => (i.id === row.id ? { ...i, [key]: next } : i)))
    const { error: e } = await supabase.from('portfolio_items').update({ [key]: next }).eq('id', row.id)
    if (e) { toast?.(e.message, 'error'); load() }
  }

  if (items === null) return <SkeletonForm />

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} item{items.length === 1 ? '' : 's'} · published items appear on the marketing site.</p>
        <button onClick={() => setEditing({ ...BLANK })} className="btn-gold px-4 py-2 text-xs"><Plus className="h-4 w-4" /> Add Project</button>
      </div>
      {error && <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</p>}

      {items.length === 0 && !error ? (
        <div className="card-surface p-10 text-center text-sm text-gray-500 shadow-card">No portfolio items yet. Click “Add Project” to create your first.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.id} className="card-surface flex gap-4 p-4 shadow-card">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-ink-950">
                {(it.thumbnail_url || it.poster_url || (it.media_type === 'image' && it.media_url))
                  ? <img src={it.thumbnail_url || it.poster_url || it.media_url} alt={it.title} className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center text-[10px] text-gray-600">{it.media_type}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-sm font-semibold text-gray-100">{it.title}</span>
                  {it.featured && <span className="rounded-full border border-gold-400/30 bg-gold-400/10 px-2 py-0.5 text-[9px] text-gold-200">Featured</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">{it.category} · {it.media_type}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={() => toggle(it, 'published')} className="text-[10px]"><StatusPill ok={it.published} label={it.published ? 'Published' : 'Draft'} /></button>
                  <button onClick={() => toggle(it, 'on_homepage')} className="text-[10px]"><StatusPill ok={it.on_homepage} label={it.on_homepage ? 'On homepage' : 'Hidden'} /></button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setEditing(it)} className="btn-ghost px-3 py-1 text-[11px]">Edit</button>
                  <button onClick={() => setConfirmDel(it)} className="rounded-full border border-rose-400/30 bg-rose-400/[0.06] px-3 py-1 text-[11px] text-rose-200 hover:border-rose-400/60">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <PortfolioForm initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} />}
      {confirmDel && (
        <ConfirmDialog
          title="Delete portfolio item?"
          description="This permanently removes it from the CMS and the marketing site."
          details={[['Title', confirmDel.title], ['Category', confirmDel.category]]}
          confirmLabel="Delete" busy={busy}
          onCancel={() => setConfirmDel(null)} onConfirm={remove}
        />
      )}
    </div>
  )
}

function PortfolioForm({ initial, onSave, onCancel, busy }) {
  const [f, setF] = useState(initial)
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.title.trim().length > 0
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4" onClick={onCancel}>
      <div className="card-surface relative my-8 w-full max-w-xl p-7 shadow-card" onClick={(e) => e.stopPropagation()}>
        <button onClick={onCancel} aria-label="Close" className="absolute right-5 top-5 text-gray-500 hover:text-gray-200">✕</button>
        <div className="eyebrow mb-1">{initial.id ? 'Edit' : 'New'} Project</div>
        <h3 className="mb-5 font-display text-2xl font-bold text-gray-50">{f.title || 'Portfolio item'}</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Project Title" value={f.title} onChange={set('title')} required full />
          <SelectField label="Category" value={f.category} onChange={set('category')} options={CATEGORIES} />
          <SelectField label="Media Type" value={f.media_type} onChange={set('media_type')} options={['image', 'video']} />
          <Field label="Media URL / path" value={f.media_url} onChange={set('media_url')} placeholder="/fario.png or https://…" full />
          <Field label="Thumbnail URL" value={f.thumbnail_url} onChange={set('thumbnail_url')} />
          <Field label="Poster URL (video)" value={f.poster_url} onChange={set('poster_url')} />
          <Field label="Sort Order" type="number" value={f.sort_order} onChange={set('sort_order')} />
          <TextArea label="Description" value={f.description} onChange={set('description')} full />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Toggle label="Featured" checked={f.featured} onChange={set('featured')} />
          <Toggle label="Show on Homepage" checked={f.on_homepage} onChange={set('on_homepage')} />
          <Toggle label="Published" checked={f.published} onChange={set('published')} help={f.published ? '' : 'Draft'} />
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-white/[0.08] pt-5">
          <button onClick={onCancel} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
          <button onClick={() => valid && onSave(f)} disabled={!valid || busy} className="btn-gold px-5 py-2.5 text-sm disabled:opacity-50">
            {busy ? 'Saving…' : (initial.id ? 'Save Changes' : 'Add Project')} <Arrow className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
