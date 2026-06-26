# Digital Skyline Co. — Supabase Cached Egress Fix

**Date:** 2026-06-26
**Goal:** Reduce bandwidth coming from Supabase without breaking the live site.
**Status:** Changes applied to the working tree, build + smoke-test passing. **Not committed yet** (per your instruction to review the report first).

---

## 1. Where the Supabase egress was coming from

I scanned `src/`, `index.html`, and `api/` for `supabase.co/storage`, hardcoded public Supabase URLs, and `.mp4/.mov/.png/.jpg/.webp`. **Every byte of Supabase media egress traced to exactly two assets**, both referenced in `src/components/Portfolio.jsx` and rendered on the **homepage** (`/` → `Home` → `<Portfolio/>`):

| Asset | Size | Cache header (before) | How it loaded |
|-------|------|------------------------|---------------|
| `Portfolio/KnightSoulCompressed.mp4` | **6.4 MB** | `cache-control: no-cache` | `<video autoPlay loop>` → **downloaded on homepage load** |
| `Portfolio/Knightsoul2.png` | **3.9 MB** | `cache-control: no-cache` | portfolio image + the video's poster |

**Two compounding problems:**
1. **`autoPlay` forced the 6.4 MB video to download on (essentially) every homepage visit** — `preload="metadata"` is ignored when `autoPlay` is set.
2. **`cache-control: no-cache`** meant the CDN/browser revalidated every time, so even repeat visitors re-pulled the full files. That is the worst possible profile for "Cached Egress" — nothing was actually being served from cache.

➡️ **~10.3 MB of Supabase egress per homepage view**, repeated on every visit.

**No other Supabase media exists.** All other portfolio/hero media (`fario.*`, `hayes-dashboard.*`, `legacy-quest*`) is already local in `/public` (served by Vercel). Admin, client portal, and all other routes load **no** Supabase media.

### Asset map by route
| Route | Supabase media | Notes |
|-------|----------------|-------|
| `/` (homepage → Portfolio) | KnightSoul mp4 + png (**before**) → **none after** | the entire problem lived here |
| `/admin` | none | DB JSON only (admin-only, single user) |
| `/client-portal` | none | Stripe redirect, no Supabase calls |
| `/support`, `/status`, `/privacy`, `/terms`, `/thank-you`, `/consultation-confirmed` | none | — |

---

## 2. What changed

### A. Moved both used assets off Supabase → Vercel `/public`  *(biggest win)*
- Downloaded the two assets (byte-for-byte verified: 6,415,462 and 3,936,161 bytes) into `public/knightsoul.mp4` and `public/knightsoul.png`.
- Repointed `Portfolio.jsx` from the `supabase.co/storage/...` URLs to `/knightsoul.mp4` and `/knightsoul.png`.
- **Result:** Supabase serves **0 bytes** of this media now. Vercel serves it from its global CDN with long-lived immutable caching (vs Supabase's `no-cache`), so repeat visits hit cache instead of re-downloading.
- The two assets are **not deleted from Supabase Storage** — they're safely replaced and still available there as a backup. (Step 5 of `SUPABASE_AUDIT.md` covers cleaning storage later, in the dashboard, only after you confirm.)

### B. Video no longer downloads unless actually visible
New `LazyCardVideo` component in `Portfolio.jsx`:
- `preload="none"` and **no `src` attached** until the card scrolls into view (poster shows in the meantime).
- An `IntersectionObserver` attaches the source + plays only when the card intersects the viewport, and **pauses when it scrolls away**. Because the gallery is a horizontal rail, off-to-the-side cards count as not-intersecting too, so parked cards stay dormant.
- Removed the unconditional `autoPlay`.
- **Result:** a visitor who never scrolls down to the gallery pulls **zero** video bytes — from Supabase *or* Vercel.

### C. Lazy/async images
- Card images keep `loading="lazy"` and now also `decoding="async"`.

### D. Client-side cache for the booking RPC
`Consultation.jsx`: `booked_times(date)` results are now cached per-date in a ref. Browsing back and forth between dates no longer re-hits the RPC. The **submit-time availability re-check still bypasses the cache** (`fresh: true`) so booking correctness is never compromised.

### E. Confirmed there were no repeated-request bugs
- Admin `load()` runs **once** on mount (`useEffect(..., [])`); mutations update local state optimistically and only refetch on error.
- The booking RPC fires **only on user gestures** (date click / submit) — never in an effect or render loop.
- `onAuthStateChange` is the only realtime-ish listener and it is properly cleaned up (`unsubscribe()`); there are **no** `.channel()`/`postgres_changes` subscriptions, no cron, no polling intervals hitting Supabase.
- *Note:* React `StrictMode` double-invokes effects in **dev only** (so admin `load()` runs twice under `npm run dev`). This does **not** happen in the production build, so it was left in place (it's a valuable dev safety net).

---

## 3. Estimated impact on Cached Egress (ranked)

| # | Change | Egress impact |
|---|--------|---------------|
| 1 | **Move mp4+png to Vercel** | **Eliminates ~100% of Supabase media egress.** This is the dominant lever — those 10.3 MB were the entire Supabase bandwidth bill. At e.g. 1,000 homepage views/mo that's ~**10 GB/mo of Supabase egress removed**; the `no-cache` header meant repeat visits counted too. |
| 2 | **Visibility-gated `preload="none"` video** | Cuts the *remaining* (now Vercel) video bytes for everyone who doesn't scroll to the gallery, and ends the autoplay-on-load download entirely. Big secondary saving + faster homepage. |
| 3 | **Immutable CDN caching (Vercel)** | Repeat visitors are served from cache instead of re-downloading 10 MB each time — the opposite of the old `no-cache`. |
| 4 | **Booking RPC per-date cache** | Tiny in bytes (RPC returns a few strings) but removes redundant round-trips while a visitor browses dates. |
| 5 | **`loading="lazy"` / `decoding="async"` images** | Minor; defers off-screen image bytes. |

**Net:** Supabase egress for public traffic drops from ~10.3 MB/visit to **≈0** (only small DB JSON for bookings/support remains). Supabase keeps doing what it should — database + admin data — and is no longer paying for hero/portfolio video bandwidth.

---

## 4. Verification done
- `npm run build` ✅ (101 modules, no errors).
- `npm run preview` smoke test ✅ — `/`, `/client-portal`, `/admin`, `/support` all return **200**.
- `/knightsoul.mp4` (video/mp4, 6,415,462 B) and `/knightsoul.png` (image/png, 3,936,161 B) serve locally ✅.
- `grep supabase.co/storage src index.html` → **no matches** (all media moved) ✅.

### Recommended manual test before merge (visual)
1. **Homepage** loads; scroll to the **Portfolio** rail → KnightSoul card shows poster, then plays when scrolled into view; scrolling past pauses it. "View Project" opens the lightbox and plays with controls.
2. **Consultation booking:** pick a date (times load), re-pick same date (no new network request), submit a test booking → confirmed; then delete the test row in admin.
3. **Admin dashboard:** login, tabs load.
4. **Stripe / client portal:** "Proceed to Secure Payment" button works (redirect or fallback notice).

---

## 5. Optional follow-ups (NOT done — out of this scope; Vercel egress, not Supabase)
- `Hero.jsx` video uses `preload="auto"` and `ScrollScrubShowcase.jsx` uses `preload="auto"` + `autoPlay`. These are **local `/public`** videos (Vercel egress, not Supabase), but switching them to visibility-gated / `preload="metadata"` would further cut overall bandwidth and speed up first load. Say the word and I'll apply the same `LazyCardVideo` pattern.
- After you've confirmed the site works on the moved assets, you can delete the now-unused objects from the Supabase `Portfolio` bucket in the dashboard (see `audit_diagnostics.sql` §7c) to reclaim storage.

---

## 6. Files changed
```
M src/components/Portfolio.jsx     (move URLs → /public, LazyCardVideo, lazy/async img)
M src/components/Consultation.jsx  (per-date booked_times cache; submit stays fresh)
A public/knightsoul.mp4            (6.4 MB — moved off Supabase)
A public/knightsoul.png            (3.9 MB — moved off Supabase)
```
