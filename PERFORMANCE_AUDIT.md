# Digital Skyline Co. — Production Performance Audit

**Date:** 2026-06-26
**Goal:** Faster, lighter, more polished before client outreach — **without changing the design or breaking functionality.**
**Status:** Changes applied to the working tree; production build + route smoke tests passing. **Not committed yet** (showing you this report first, per your rule).

---

## Summary of what changed (all design-preserving)

| # | Change | File(s) | Effect |
|---|--------|---------|--------|
| 1 | Stop the "In Motion" video auto-downloading | `ScrollScrubShowcase.jsx` | 17 MB video no longer loads until you scroll to it |
| 2 | Code-split admin + secondary routes | `App.jsx` | **Homepage JS 570 KB → 469 KB**; admin (51 KB) & pages load on demand |
| 3 | Lazy/async images | `Footer.jsx`, `Navbar.jsx`, `Loader.jsx`, `Portfolio.jsx` | Defers/parallelizes image decode; footer logo lazy-loads |

Plus confirmations (no code needed): Supabase is clean (no storage URLs, no repeated requests, no realtime/polling leaks), and the build is healthy.

---

## 1. Hero videos & animated media

### `ScrollScrubShowcase.jsx` — FIXED ✅
- **Before:** `<video autoPlay preload="auto">` → the 17 MB `/ds-city-1.mp4` started downloading on page load, even though this section sits well below the fold.
- **After:** `preload="none"` and `autoPlay` removed. The component already had an `IntersectionObserver` that plays on enter / pauses on exit — so playback (and the download) now begins **only when the section scrolls into view**, and pauses off-screen. Visual behavior is identical.
- **Win:** visitors who don't scroll that far pull **0 bytes** of this clip.

### `Hero.jsx` — intentionally left as-is (with reason)
- The hero is a **scroll-scrubbed** video: it drives `video.currentTime` from scroll position to create the cinematic rewind effect. Smooth scrubbing **requires the frames to be available**, which is exactly what `preload="auto"` + the explicit `video.load()` provide.
- It is also **above the fold** (the first thing every visitor sees), so deferring it would only delay the hero, not save bandwidth.
- Switching it to `preload="metadata"`/`none` or lazy-loading would make the scrub **janky or broken** — a functionality/polish regression. So it was kept.
- ✅ It already pauses correctly: the video isn't "playing" (it's seek-driven), and the scroll handler stops updating once you leave the hero runway. Nothing to pause.
- **Recommendation (needs tooling, not done):** the real Hero win is **file size** — `/ds-city.mp4` is **18 MB**. Re-encoding to ~720p/CRF 28 H.264 (or AV1/WebM) would likely cut it 50–70% with no visible quality loss at hero scale. Requires `ffmpeg` (not available in this environment). Optionally add a `poster` first-frame image for instant paint while it loads.

---

## 2. Images

### Applied ✅
- **Footer logo** (`Footer.jsx`): added `loading="lazy"` + `decoding="async"` — it's below the fold, so it no longer competes with above-the-fold work.
- **Navbar & Loader logos** (`Navbar.jsx`, `Loader.jsx`): added `decoding="async"` (kept **eager** — they're visible immediately, so lazy-loading would be wrong).
- **Portfolio lightbox image** (`Portfolio.jsx`): added `decoding="async"`.
- **Portfolio card images** already carry `loading="lazy"` + `decoding="async"` (from the prior egress pass).

### Oversized files — recommendations (need image tooling, not done)
No `ffmpeg`/`cwebp`/sharp available here, so these are flagged for you to run locally or in CI:

| File | Size | Used as | Recommendation |
|------|------|---------|----------------|
| `orb-header.png` | **7.6 MB** | `og:image` / `twitter:image` only (social previews) | Resize to ~1200×630, < 1 MB. **Some platforms refuse images this large**, so your link previews may currently be broken. High-value, zero on-page risk (not loaded by the site). |
| `logo.png` | **1.4 MB** | favicon + Navbar/Loader/Footer logo (rendered at ~56–80 px) | Generate a small favicon set (32/180 px) and a ~256 px logo. A 1.4 MB favicon downloads on **every** page. |
| `fario.png` | 5.8 MB | portfolio card | Convert to WebP (~80% smaller) — lazy-loaded already, so low urgency. |
| `knightsoul.png` | 3.8 MB | portfolio card + video poster | Convert to WebP. |
| `legacy-quest-full.jpg` | 1.1 MB | lightbox | Fine; optional WebP. |

> WebP is safe for all current browsers; keep the PNG/JPG as fallback only if you support very old clients (not needed here). Quality at `cwebp -q 82` is visually lossless for these.

### Heavy videos (Vercel-served, recommendations)
`fario.mov` **77 MB**, `legacy-quest-video.mov` **22 MB**, `ds-city.mp4` 18 MB, `ds-city-1.mp4` 17 MB. The `.mov` files especially should be re-encoded to web-optimized **MP4 (H.264)** — `.mov` is not a web delivery format and `fario.mov` at 77 MB is by far the largest asset on the site. All are now lazy/visibility-gated, so they don't hurt initial load, but they're heavy when reached.

---

## 3. JavaScript performance

- **Code-splitting (applied):** all non-home routes converted to `React.lazy()` behind a `<Suspense>` boundary. The homepage (the critical path) stays fully eager; admin and secondary pages now load on demand. See §5 for the measured bundle drop.
- **Unused imports:** scanned the home-critical components (`App`, `Hero`, `Portfolio`, `Consultation`, `ScrollScrubShowcase`) — none found. `App.jsx` imports (`Marquee`, `EasterEgg`, `SoundToggle`, etc.) are all used.
- **Re-renders:** the admin dashboard already uses `useMemo` for derived KPIs/analytics and optimistic local state updates (no refetch-on-every-edit). `LiveStatus` re-renders once per second — but it **displays seconds** by design, so the interval is required and the re-render is isolated to that one tiny component. Left as-is (changing it would freeze the visible clock = a design change).
- **useEffect / duplicate fetches:** verified — admin `load()` runs once on mount (`[]` deps); the booking RPC fires only on user gestures and is **per-date cached** (from the prior pass) with the submit-time check kept fresh. No effect-driven request loops anywhere.

---

## 4. Supabase / API usage — all confirmed clean ✅

- **No Supabase Storage media URLs remain** in `src/` or `index.html` (`grep supabase.co/storage` → 0 matches). The portfolio assets are served from Vercel `/public`.
- **No repeated Supabase requests:** admin loads once; booking RPC is gesture-driven + cached.
- **No polling / realtime leaks / background loops:** no `.channel()`, `.subscribe()`, or `postgres_changes`; the only `setInterval` is the UI clock (no DB). The one auth listener (`onAuthStateChange`) is cleaned up on unmount.
- Booking and admin functionality untouched.

---

## 5. Build size

**Before** (single bundle):
```
index.js   570.57 KB  (gzip 157.79 KB)
```
**After** (code-split):
```
index.js (homepage)        469.13 KB  (gzip 135.62 KB)   ← initial load
Admin.js                    51.09 KB  (gzip  12.07 KB)   ← only on /admin
Support.js                  11.05 KB  (gzip   3.64 KB)
ClientPortal.js             10.21 KB  (gzip   3.29 KB)
Terms / Privacy / Status / ThankYou / ConsultationConfirmed   3–5.6 KB each
usePageMeta.js (shared)      0.38 KB
css                         50.07 KB  (gzip   9.77 KB)
```
- **Homepage initial JS down ~101 KB (~22 KB gzip).** Public visitors no longer download the admin dashboard or legal/portal page code up front.
- **Further safe option (not done):** the remaining 469 KB main chunk is dominated by React + react-router + the animation-heavy home components. Could be trimmed by lazy-mounting below-the-fold home sections, but that risks layout shift / scroll-trigger timing on the carefully-tuned homepage, so I left it. The route-split was the safe, high-value cut.

---

## 6. SEO / accessibility

- **Meta tags:** already excellent — title, description, keywords, canonical, full Open Graph, Twitter `summary_large_image`, locale, `viewport`. **Left unchanged** (no improvement needed). ⚠️ Only issue: the `og:image` (`orb-header.png`) is 7.6 MB / 3072×2048 — resize it (see §2) so social previews render reliably.
- **Alt text:** all `<img>` have meaningful `alt` (logos = "Digital Skyline Co.", portfolio = project title); decorative layers correctly use `aria-hidden`. ✅
- **Button labels:** icon-only buttons have `aria-label` (close buttons, logo home links); text buttons are self-labeled. ✅
- **Mobile:** responsive Tailwind breakpoints (`sm:`/`lg:`/`xl:`) throughout; `viewport` meta present; `prefers-reduced-motion` is honored in Hero/Portfolio/ScrollScrub. No layout changes made, so mobile is unaffected. ✅

---

## Verification done
- `npm run build` ✅ — clean, code-split chunks emitted as above.
- `npm run preview` smoke test ✅ — `/`, `/support`, `/client-portal`, `/admin`, `/privacy`, `/status` all return 200.
- `grep supabase.co/storage src index.html` → 0 ✅.

### Recommended manual test before merge
1. **Homepage:** loads; Hero scrub still rewinds smoothly on scroll; scroll down to **"In Motion"** globe → it starts spinning when it enters view, pauses when you scroll away.
2. **Portfolio:** rail scrolls; KnightSoul card plays on view; lightbox opens/plays.
3. **Consultation form:** pick date → times load; submit a test booking → confirmation page; delete the test row in admin.
4. **Support form:** submit → appears in admin.
5. **Admin:** `/admin` loads (now a separate chunk), tabs work.
6. **Client portal:** "Proceed to Secure Payment" button works (redirect or fallback).

---

## Not done (need tooling or out of scope)
- Image/video compression & WebP conversion (no `ffmpeg`/`cwebp` here) — **highest remaining win**, especially `fario.mov` (77 MB), `orb-header.png` (7.6 MB → og:image), and `logo.png` (1.4 MB favicon).
- `public/Screenshot 2026-02-23 at 8.44.17 PM.png` (3 MB) is an orphaned, untracked file — not referenced or deployed, but worth deleting from disk as housekeeping.

## Files changed
```
M src/App.jsx                            (route code-splitting + Suspense)
M src/components/ScrollScrubShowcase.jsx (preload="none", drop autoPlay; IO already gates play/pause)
M src/components/Footer.jsx              (logo: loading=lazy + decoding=async)
M src/components/Navbar.jsx              (logo: decoding=async)
M src/components/Loader.jsx              (logo: decoding=async)
M src/components/Portfolio.jsx           (lightbox img: decoding=async)
```
