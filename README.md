# Digital Skyline Co. — Premium AI Agency Website

A brand-new, immersive marketing site for **Digital Skyline Co.**, built with
React + Vite + Tailwind CSS. Luxury technology aesthetic: black background,
metallic gold accents, holographic dashboards, an interactive AI website
scanner, floating data cards, and an animated neural-network background.

## Stack

- **React 18** + **Vite 6**
- **Tailwind CSS 3**
- Zero runtime UI dependencies (custom canvas + inline SVG)

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Screenshots

### Homepage

![Homepage — hero with AI core product shot](public/screenshots/Homepage.png)

### Admin Dashboard

![Admin dashboard](public/screenshots/Dashboard.png)

### CRM

![CRM](public/screenshots/CRM.png)

### Communications Center

![Communications center](public/screenshots/Communications-center.png)

### AI Outreach

![AI outreach](public/screenshots/ai-outreach.png)

### Website Intelligence

![Website intelligence](public/screenshots/Website%20Intelligence.png)

## Sections

1. **Hero** — cinematic 40/60 split. Left (40%): eyebrow "Premium Software & Web Studio", headline "Websites & Apps Built For Businesses Of Every Size", subheadline, dual CTA, and the four capabilities (Custom Websites · Applications · Dashboards · Business Systems). Right (60%): a large **AI Core "product shot"** that sits low and bleeds off the edge — a full-bleed tilted financial-dashboard floor (charts run under the rings), layered glass holographic rings, traveling gold light streaks, volumetric glow, ambient shadow + reflection, depth-of-field, floating particles, and mouse parallax. Circular SVG logo badge; neural background. Knobs flagged with `◆` in `AICore.jsx`.
2. **Trust bar** — four capabilities (Custom Websites · Applications · Dashboards · Business Systems); no fake logos or statistics
3. **What We Do** — six-card services grid (Websites, Apps, Portals, Automation, Growth/SEO, Brand)
4. **Portfolio Gallery — "See What We've Built"** — featured case study (Family Dynasty App) with phone mockup, secondary case studies (Influencer Finder, Readi Rentals Dashboard) with browser mockups + hover animations, and a "future client projects" invitation card
5. **Pricing** — three-tier plans (Launch / Skyline / Enterprise)
6. **FAQ** — accordion
7. **Book Your Free Consultation** — premium calendar-booking section: left explains what happens on the call (3 bullets); right is a glassmorphism booking card with a month calendar (prev/next, gold selected date, weekday/past dates disabled), time-slot buttons, Name/Email/Business inputs, a "What do you need help with?" dropdown, and a success state. Front-end only — fake availability, no backend.

Primary CTA throughout: **Book a Free Consultation** (anchors to `#consultation`).

> Note: the consultation form is a front-end demo — no backend is wired up. The
> portfolio device mockups are pure CSS/SVG (no external image/video assets).

### Hero visual — image or code

The right side of the hero renders via [HeroVisual.jsx](src/components/HeroVisual.jsx):

- **With an image:** drop an isolated render of the core / right-side visual at
  `public/hero-core.png` (PNG/JPG/WebP — edit `IMG_SRC` in the component). It is
  layered with subtle animation on top — mouse parallax, breathing volumetric
  glow, a slow gold light-sweep, drifting particles, and vignettes. Use an
  isolated core render, **not** the full-page screenshot (that would duplicate
  the headline text). A dark/transparent background blends best.
- **Without an image:** it falls back automatically to the fully-coded, animated
  `AICore` — so the hero always renders.
