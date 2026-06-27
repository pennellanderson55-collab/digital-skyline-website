# Digital Skyline OS — Sprint 2 Deliverables

**Feature:** AI Website Intelligence Engine — a sales tool that audits a prospect's homepage and produces plain-English material to help close the sale. Built inside each Prospect, in the existing authenticated `/admin` area. No design changes; all prior performance work intact.

**Status:** Complete. Production build passes; deterministic analyzer verified against live sites. **Not committed** (showing this report first, per the established review-before-commit flow).

---

## 1. Database migration(s)

**`supabase/sprint2_website_intelligence.sql`** (idempotent, additive — touches no existing data):

- **`prospects` new columns:** `website_audit_status text` (`null | 'analyzing' | 'complete' | 'error'`), `last_analyzed_at timestamptz`. `website_score` already existed (Sprint 1) and is now reused as **the latest overall audit score (0–100, higher = better site)**.
- **`website_audits` table** (full history, one row per analysis):
  | Column | Type | Notes |
  |---|---|---|
  | `id` | uuid PK | |
  | `prospect_id` | uuid → prospects (cascade) | |
  | `url` / `final_url` | text | requested vs post-redirect |
  | `overall_score` | int (0–100 CHECK) | |
  | `category_scores` | jsonb | performance/seo/conversion/trust/branding/mobile_ux |
  | `signals` | jsonb | all collected raw signals |
  | `ai` | jsonb | the 8 AI outputs (null if AI not configured) |
  | `ai_model` | text | e.g. `claude-opus-4-8` |
  | `status` / `error` | text | |
  | `created_at` | timestamptz | |
- **Indexes:** `prospect_id`, `created_at desc`, and `(url, created_at desc)` — the last powers the "don't re-fetch" cache.
- **RLS:** enabled with the same `"auth full access"` (authenticated) policy as every other OS table.

➡️ **Run it once** in the Supabase SQL Editor. The app degrades gracefully until then (shows a "run the migration" message).

---

## 2. New API route(s)

**`api/analyze-website.js`** (Vercel serverless, `POST { url, businessName?, industry? }`) — plus two helper modules:

- **`api/_website-signals.js`** — homepage fetch (12s timeout, redirects, bot UA) + deterministic signal collection + 6-category scoring + optional PageSpeed.
- **`api/_ai-analysis.js`** — the Claude call (prompt + schema).

**Flow:** fetch homepage → collect signals → (optional Lighthouse via PageSpeed) → score 6 categories + weighted overall → AI sales brief → return JSON. **The frontend persists** the result to Supabase under the user's session (RLS), so the route holds **no DB credentials**.

**Collected signals** (homepage-only, no crawling): HTTPS, title + length, meta description + length, H1 (text + count), H2 count, viewport, `lang`, canonical, robots.txt, sitemap (robots directive or `/sitemap.xml`), Open Graph count + og:image, Twitter card, JSON-LD count, favicon, forms, mailto/tel/contact/booking links, CTA buttons, FAQ detection, testimonial detection, social links (FB/IG/X/LinkedIn/YT/TikTok), images + alt coverage, video/embeds, page bytes, script/stylesheet/inline-style counts, render-blocking head scripts.

**Scoring:** Performance, SEO, Conversion, Trust, Branding, Mobile UX (each 0–100). **Overall** is weighted (Conversion 22%, Performance 20%, SEO 20%, Trust 16%, Mobile 12%, Branding 10%) — tuned to "selling websites," not generic SEO.

**Lighthouse/PageSpeed ("if practical"):** integrated as **optional** — set `PAGESPEED_API_KEY` to use the real Lighthouse mobile performance score; otherwise a homepage heuristic (page weight, render-blocking scripts, asset counts) stands in. Kept optional to respect the serverless timeout and avoid a required key.

**Resilience:** `maxDuration: 60`. If the homepage can't be fetched → 502 with a clear message. **The AI step is best-effort** — if `ANTHROPIC_API_KEY` is unset or the call fails, the technical audit (signals + scores) is still returned and saved; only the narrative is skipped (`aiSkipped` explains why). Same graceful-degradation contract as `send-email.js`.

---

## 3. AI prompt design

- **Model:** `claude-opus-4-8` (most capable; overridable via `ANTHROPIC_MODEL`).
- **SDK:** official `@anthropic-ai/sdk` (server-only; not in the browser bundle).
- **Params:** `thinking: {type:'adaptive'}` + `output_config.effort: 'medium'` (balanced quality/latency) + **structured outputs** (`output_config.format` = `json_schema`) so the 8 fields come back guaranteed-parseable. **Streamed** with `.finalMessage()` so a longer thinking turn can't hit an HTTP timeout. Refusals handled (`stop_reason === 'refusal'`).
- **System prompt:** frames Claude as Digital Skyline's **Sales Intelligence engine** — briefing the *salesperson* (not the prospect) in plain English they can paste into an email/call/consultation. Rules: be specific to this business + this audit, translate technical gaps into business consequences, be honest (pitch maintenance if the site is already good), **never invent hard statistics**, keep talking points human.
- **User message:** business name + industry + overall score + category scores + the full signals JSON.
- **Structured output schema (the 8 required deliverables):**
  1. `executive_summary` · 2. `biggest_strength` · 3. `biggest_weakness` · 4. `highest_roi_improvement` · 5. `sales_talking_points` (array) · 6. `estimated_business_impact` · 7. `suggested_package` (enum: Starter Website / Business Website / Custom Solutions / Maintenance) + `suggested_package_reason` · 8. `follow_up_questions` (array).

Full text in `api/_ai-analysis.js` (`SYSTEM_PROMPT`, `SCHEMA`, `buildUserPrompt`).

---

## 4. Components created

| File | Purpose |
|---|---|
| `src/admin/sales/audit.js` | Client orchestration: `runAudit` (cache check → `/api/analyze-website` → persist), `loadAuditHistory`, `findCachedAudit`, score colors, category list, progress steps, 7-day cache TTL. |
| `src/admin/sales/WebsiteIntelligence.jsx` | The tab UI: URL input, Analyze/Re-analyze, **animated stepped progress indicator**, overall **score ring** + category bars, full **AI sales brief**, collapsible raw signals, and **audit history** (click any past audit). |

**Modified:** `src/admin/sales/ProspectPanel.jsx` — added the **three tabs** (Overview / Website Intelligence / Outreach AI). Overview = the existing detail/edit view; Website Intelligence = the analyzer; Outreach AI = a Sprint-3 placeholder that points back to the audit's talking points.

**Caching:** before calling the API, the client checks the prospect's audit history for the same URL within 7 days and reuses it (no re-fetch) unless **Re-analyze** is clicked.

---

## 5. Files changed

```
NEW  supabase/sprint2_website_intelligence.sql
NEW  api/analyze-website.js
NEW  api/_website-signals.js
NEW  api/_ai-analysis.js
NEW  src/admin/sales/audit.js
NEW  src/admin/sales/WebsiteIntelligence.jsx
MOD  src/admin/sales/ProspectPanel.jsx     (3 tabs + Outreach placeholder)
MOD  package.json / package-lock.json      (+ @anthropic-ai/sdk ^0.106.0)
MOD  .env.example                          (ANTHROPIC_API_KEY, ANTHROPIC_MODEL, PAGESPEED_API_KEY)
```

---

## 6. Smoke test results

| Check | Result |
|---|---|
| `node --check` on all 3 API files | ✅ Pass |
| `npm run build` | ✅ Pass — homepage `index` chunk **469 KB (unchanged)**; Sales/audit UI rides in the lazy `Admin` chunk (106 KB / 25 KB gzip, loads only on `/admin`). Zero homepage impact. |
| Deterministic analyzer vs **example.com** | ✅ overall **46** (performance 100, conversion 0 — correctly flags a bare page with no forms/CTAs) |
| Deterministic analyzer vs **wikipedia.org** | ✅ overall **69** (SEO 71, has form + sitemap) — sensible discrimination |
| Route `/`, `/admin` | ✅ Both 200 |
| Unused imports (new files) | ✅ None |
| Graceful degrade without `ANTHROPIC_API_KEY` | ✅ Audit + scores returned/saved; AI brief skipped with reason |

> The **AI brief** path requires a real `ANTHROPIC_API_KEY` and a logged-in session against your Supabase, so it wasn't exercised here (no key in this environment). The call is built to the current Claude API spec (Opus 4.8, adaptive thinking, structured outputs, streaming). Verify it after adding the key — see below.

### Manual verification (after running the migration + setting the key)
1. Vercel → Settings → Env: add `ANTHROPIC_API_KEY` (and optionally `PAGESPEED_API_KEY`). Deploy.
2. `/admin` → Sales → Prospects → open a prospect → **Website Intelligence** tab.
3. Paste a homepage URL → **Analyze Website** → watch the animated progress → confirm score ring, category bars, and the 8-section AI brief render; the prospect's score updates in the table.
4. Click **Re-analyze** (forces a fresh run); reopen the tab and confirm the cached result loads instantly and **Audit History** lists past runs.

---

## 7. Recommendations before Sprint 3

1. **Set `ANTHROPIC_API_KEY`** and do the manual AI verification above before relying on the brief in sales conversations.
2. **`website_score` semantics flipped.** Sprint 1's table coloring (`prospects.js` `scoreBand`) treats *low* scores as "opportunity" (green), but the Sprint 2 audit writes *overall site quality* (high = good). The number is correct everywhere; only the Sprint-1 table color hint now reads inverted. Quick Sprint-3 cleanup: align the table to the audit's higher-is-better coloring (the audit panel already uses `auditScore`).
3. **Outreach AI (the third tab)** is the natural Sprint 3: generate a personalized cold email + follow-up sequence + call script from the latest audit's weaknesses and talking points (reuse the same SDK + structured-output pattern).
4. **PageSpeed by default.** If performance accuracy matters for the pitch, add `PAGESPEED_API_KEY` (free tier) so the Performance score is real Lighthouse rather than the heuristic.
5. **Cost controls.** Each AI brief is one Opus 4.8 call (~small input, ~1–2K output). Consider a per-day cap or a cheaper model (`ANTHROPIC_MODEL=claude-sonnet-4-6`) for bulk auditing once you're enriching many prospects.
6. **Multi-page crawl (deferred deliberately).** Sprint 2 is homepage-only per spec. Sprint 3+ could add key-page sampling (services, contact) behind the same audit record.
7. **TypeScript** remains a whole-app migration recommendation (carried from Sprint 1) — still JSX for consistency.
```
