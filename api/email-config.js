// ============================================================================
// Vercel Serverless Function — non-secret email config for the UI banner.
// GET → { sandbox, from, sandboxInbox }. Never returns the API key.
// ============================================================================
import { isSandbox } from './send-outreach.js'

export default async function handler(req, res) {
  return res.status(200).json({
    sandbox: isSandbox(),
    from: process.env.OUTREACH_FROM_EMAIL || 'hello@digitalskylineco.com',
    sandboxInbox: process.env.EMAIL_SANDBOX_TO || 'pernellanderson55@gmail.com',
    resendConfigured: !!process.env.RESEND_API_KEY,
  })
}
