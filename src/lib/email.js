// Best-effort client for the /api/send-email serverless function (Resend).
// Never throws — email is a secondary action and must never block a form.
//
// type: 'consultation' | 'welcome' | 'support'
// In local `npm run dev` the /api route doesn't run (use `vercel dev` to test);
// the fetch simply fails and resolves to false, which callers ignore.
export async function sendEmail(type, data) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    })
    if (!res.ok) {
      // Temporary diagnostics — log the exact server-side reason.
      const detail = await res.text().catch(() => '')
      console.error(`[email] /api/send-email responded ${res.status} for "${type}":`, detail)
      return false
    }
    return true
  } catch (err) {
    // Network error / route missing (e.g. plain `vite dev`). Logged, never thrown.
    console.error(`[email] request to /api/send-email failed for "${type}":`, err)
    return false
  }
}
