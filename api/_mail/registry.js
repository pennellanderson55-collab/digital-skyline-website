// ============================================================================
// Mail provider registry — the single seam that keeps Communications
// provider-agnostic.
//
// Routes ask the registry for "an outbound provider" or "an inbox provider" and
// get back whichever adapter is configured, by capability + priority. Adding a
// provider later (Postmark, SES, another mailbox) means dropping a new adapter
// into ./providers and listing it here — no route or UI change.
//
// Priority: Resend is the PRIMARY outbound sender. Gmail is the optional inbox /
// reply / sync provider (and an outbound fallback if Resend is ever down).
// ============================================================================

import * as resend from './resend.js'
import * as gmail from './gmail.js'

// Order = preference. First configured provider with the capability wins.
const OUTBOUND = [resend, gmail]
const INBOX = [gmail]

const pick = (list, cap) => list.find((p) => p.capabilities?.[cap] && p.isConfigured()) || null

export const getOutboundProvider = () => pick(OUTBOUND, 'outbound')
export const getInboxProvider = () => pick(INBOX, 'inbox')

// Non-secret status for the UI banner (never leaks keys).
export function providerStatus() {
  const all = [resend, gmail]
  const providers = all.map((p) => ({
    id: p.id,
    configured: p.isConfigured(),
    capabilities: p.capabilities,
  }))
  const out = getOutboundProvider()
  const inbox = getInboxProvider()
  return {
    providers,
    outbound: out ? out.id : null,
    inbox: inbox ? inbox.id : null,
    canSend: !!out,
    canReceive: !!inbox,
  }
}
