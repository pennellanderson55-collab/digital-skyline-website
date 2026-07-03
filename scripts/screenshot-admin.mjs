// ============================================================================
// End-of-sprint RUNTIME visual verification.
// Captures real browser screenshots of the admin UI so features are verified
// visually, not just by a passing build.
//
// Prereqs (one-time):
//   npm i -D playwright
//   node node_modules/playwright/cli.js install chromium
// Run (with the Vite dev server already up — `npm run dev`):
//   node scripts/screenshot-admin.mjs
//
// Captures:
//   0-admin-login.png   real /admin login screen (auth-gated)
//   1-dashboard.png     Sales dashboard (real components, mock data via /verify.html)
//   2-sales-menu.png    sidebar (Operations + Sales groups)
//   3-prospects.png     Prospects table
//   4-add-modal.png     Add Prospect modal
//   5-detail-panel.png  Prospect detail slide-over
//
// /verify.html renders the REAL Sales components with seeded mock data so the
// authenticated views can be screenshotted without production credentials. To
// screenshot the fully live /admin instead, set ADMIN_EMAIL / ADMIN_PASSWORD
// and BASE_URL to a deployed instance — the login step will sign in.
// ============================================================================
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = process.env.SHOTS_DIR || './verification-screenshots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const shot = async (name, opts = {}) => { await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log('captured', name) }

try {
  // 0) Real /admin — login (or sign in if creds provided)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await page.getByPlaceholder(/you@/).fill(process.env.ADMIN_EMAIL)
    await page.getByPlaceholder('••••••••').fill(process.env.ADMIN_PASSWORD)
    await page.getByRole('button', { name: /Sign In/i }).click()
    await page.waitForTimeout(2500)
  }
  await shot('0-admin-login')

  // Harness — real Sales components + seeded mock data
  await page.goto(`${BASE}/verify.html`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.waitForSelector('text=Total Prospects')
  await shot('1-dashboard', { fullPage: true })
  await page.locator('aside nav').screenshot({ path: `${OUT}/2-sales-menu.png` })
  console.log('captured 2-sales-menu')

  await page.getByRole('button', { name: 'Prospects' }).click()
  await page.getByLabel('Add prospect').waitFor({ state: 'visible' })
  await page.waitForSelector('table tbody tr')
  await page.waitForTimeout(400)
  await shot('3-prospects', { fullPage: true })

  await page.getByLabel('Add prospect').click()
  await page.waitForSelector('text=Add a business')
  await page.waitForTimeout(400)
  await shot('4-add-modal')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(300)

  await page.locator('table tbody tr').first().click()
  await page.waitForSelector('text=Business Information')
  await page.waitForTimeout(500)
  await shot('5-detail-panel')

  console.log(`\nDone — screenshots in ${OUT}`)
} finally {
  await browser.close()
}
