// ============================================================================
// GET /api/preview-asset?token=…&i=0            → stream asset #i (image/video)
// GET /api/preview-asset?token=…&file=proposal  → stream the proposal/contract
//
// The branded, storage-hiding proxy. The client's <img>/<video> src points here;
// this function resolves the token → internal Supabase Storage URL server-side
// and STREAMS the bytes back (with HTTP Range support so video seeks work). The
// Supabase location is never disclosed to the browser. Service role.
// ============================================================================
import { Readable } from 'node:stream'
import { sbConfigured } from './_sb.js'
import { getPreview, internalAssetUrl } from './_preview.js'

export const config = { maxDuration: 60 }

const PASS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end() }
  if (!sbConfigured()) return res.status(502).json({ ok: false, error: 'Previews not configured.' })

  const p = await getPreview(String(req.query?.token || ''))
  if (!p) return res.status(404).json({ ok: false, error: 'Not found.' })

  // Resolve which storage key to stream — an asset by index, or a doc.
  let path = null
  const file = String(req.query?.file || '')
  if (file === 'proposal') path = p.proposal_path
  else if (file === 'contract') path = p.contract_path
  else {
    const i = Math.max(0, parseInt(req.query?.i ?? '0', 10) || 0)
    path = (p.assets || [])[i]?.path
  }
  if (!path) return res.status(404).json({ ok: false, error: 'Asset not found.' })

  try {
    const range = req.headers.range
    const upstream = await fetch(internalAssetUrl(path), { headers: range ? { range } : {}, redirect: 'follow' })
    if (!upstream.ok && upstream.status !== 206) {
      console.error('[preview-asset] upstream', upstream.status, 'for', path)
      return res.status(502).json({ ok: false, error: 'Could not load the asset.' })
    }
    res.status(upstream.status)
    PASS.forEach((h) => { const v = upstream.headers.get(h); if (v) res.setHeader(h, v) })
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    if (req.method === 'HEAD' || !upstream.body) return res.end()
    Readable.fromWeb(upstream.body).pipe(res)
  } catch (e) {
    console.error('[preview-asset] failed:', e)
    return res.status(500).json({ ok: false, error: 'Stream failed.' })
  }
}
