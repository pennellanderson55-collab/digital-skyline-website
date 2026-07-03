// ============================================================================
// GET /api/comms/providers — non-secret provider status for the UI.
// Tells the Communications hub which capabilities are live (send / receive) and
// which provider is handling each, without exposing any keys.
// ============================================================================
import { providerStatus } from '../_mail/registry.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true, ...providerStatus() })
}
