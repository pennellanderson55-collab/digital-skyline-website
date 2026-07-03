// ============================================================================
// Client helper for the branded preview system.
// Turns uploaded media into a secure preview record and returns its branded URL.
// Never throws — returns { ok, url } or { ok:false, error }.
// ============================================================================

/**
 * Create a preview from hosted media assets.
 * @param {{assets:Array<{kind:string,path:string,label?:string}>, contact?:object, liveSite?:string}} input
 */
export async function createPreview({ assets, contact = {}, liveSite } = {}) {
  const clean = (assets || []).filter((a) => a?.path && (a.kind === 'image' || a.kind === 'video'))
  if (!clean.length) return { ok: false, error: 'No media to preview.' }
  try {
    const r = await fetch('/api/preview-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assets: clean.map((a) => ({ kind: a.kind, path: a.path, label: a.label })),
        contact, liveSite,
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.ok) return { ok: false, error: d?.error || `Preview failed (${r.status})`, offline: !r.ok && !d?.error }
    return { ok: true, token: d.token, url: d.url }
  } catch {
    return { ok: false, error: 'No backend reachable — deploy to Vercel or run `vercel dev`.', offline: true }
  }
}
