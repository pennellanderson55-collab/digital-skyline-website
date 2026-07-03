// ============================================================================
// Provider-agnostic mail service (frontend).
//
// The ONLY email surface the Communications UI touches. It never imports or
// mentions Resend, Gmail, or any provider — it just asks to send, list threads,
// or report capabilities, and the backend registry decides who handles it.
// Swapping or adding a provider is a server-side change; this interface and the
// UI stay identical.
//
// Every method is best-effort and never throws — email is interactive, so a
// missing backend (plain `vite dev`, unconfigured keys) degrades to a clear
// { ok:false } the UI can absorb (e.g. fall back to demo threads).
// ============================================================================

const json = async (res) => { try { return await res.json() } catch { return {} } }

/** Which capabilities are live (send/receive) and which provider handles each. */
export async function getProviders() {
  try {
    const r = await fetch('/api/comms/providers')
    if (!r.ok) return offlineProviders()
    const d = await json(r)
    return { ...d, offline: false }
  } catch {
    return offlineProviders()
  }
}
const offlineProviders = () => ({ ok: false, offline: true, providers: [], outbound: null, inbox: null, canSend: false, canReceive: false })

/**
 * List threads for a folder (inbox | sent | drafts | scheduled | archive).
 * Returns { ok, configured, source, threads }. `configured:false` means the UI
 * should fall back to its own empty/demo state.
 */
export async function listThreads(folder) {
  try {
    const r = await fetch(`/api/comms/threads?folder=${encodeURIComponent(folder)}`)
    if (!r.ok) return { ok: false, configured: false, threads: [] }
    const d = await json(r)
    return { ok: !!d.ok, configured: !!d.configured, source: d.source, threads: d.threads || [] }
  } catch {
    return { ok: false, configured: false, threads: [], offline: true }
  }
}

/**
 * Send / schedule / save-draft. `msg`:
 *   { action?, to, cc?, bcc?, subject, body, replyTo?, attachments?, scheduledFor?, crm? }
 * Returns { ok, ...serverResult } or { ok:false, error }.
 */
export async function send(msg) {
  try {
    const r = await fetch('/api/comms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    })
    const d = await json(r)
    if (!r.ok) return { ok: false, error: d?.error || `Send failed (${r.status})` }
    return { ok: true, ...d }
  } catch (e) {
    return { ok: false, error: 'No mail backend reachable (run on Vercel or `vercel dev`).', offline: true }
  }
}

export default { getProviders, listThreads, send }
