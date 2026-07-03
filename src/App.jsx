import { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import Services from './components/Services.jsx'
import Portfolio from './components/Portfolio.jsx'
import Pricing from './components/Pricing.jsx'
import FAQ from './components/FAQ.jsx'
import Consultation from './components/Consultation.jsx'
import Footer from './components/Footer.jsx'
import CustomCursor from './components/CustomCursor.jsx'
import AmbientCanvas from './components/AmbientCanvas.jsx'
import SmoothScroll from './components/SmoothScroll.jsx'
import Loader from './components/Loader.jsx'
import Marquee from './components/Marquee.jsx'
import EasterEgg from './components/EasterEgg.jsx'
import SoundToggle from './components/SoundToggle.jsx'
import ScrollScrubShowcase from './components/ScrollScrubShowcase.jsx'

// Secondary routes are code-split: the homepage no longer ships the admin
// dashboard or legal/portal pages in its bundle — each loads on demand.
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))
const Status = lazy(() => import('./pages/Status.jsx'))
const ThankYou = lazy(() => import('./pages/ThankYou.jsx'))
const ConsultationConfirmed = lazy(() => import('./pages/ConsultationConfirmed.jsx'))
const ConsultationPage = lazy(() => import('./pages/ConsultationPage.jsx'))
const Book = lazy(() => import('./pages/Book.jsx'))
const ClientPortal = lazy(() => import('./pages/ClientPortal.jsx'))
const Support = lazy(() => import('./pages/Support.jsx'))
const Admin = lazy(() => import('./admin/Admin.jsx'))
const Preview = lazy(() => import('./pages/Preview.jsx'))

function Home() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950">
      <AmbientCanvas />
      <CustomCursor />
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Portfolio />
        <ScrollScrubShowcase />
        <Pricing />
        <Marquee />
        <FAQ />
        <Consultation />
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  // The internal admin dashboard and the post-conversion pages are standalone
  // experiences — keep the marketing-site chrome (loader intro, easter egg,
  // sound, smooth-scroll) off of them.
  const bareRoutes = ['/admin', '/thank-you', '/consultation-confirmed', '/book', '/preview']
  const isBare = bareRoutes.some((r) => pathname.startsWith(r))

  return (
    <>
      {!isBare && (
        <>
          <Loader />
          <EasterEgg />
          <SoundToggle />
          <SmoothScroll />
        </>
      )}
      <Suspense fallback={<div className="min-h-screen bg-ink-950" aria-hidden="true" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/status" element={<Status />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/consultation" element={<ConsultationPage />} />
          <Route path="/consultation-confirmed" element={<ConsultationConfirmed />} />
          <Route path="/book" element={<Book />} />
          <Route path="/client-portal" element={<ClientPortal />} />
          <Route path="/support" element={<Support />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/preview/:token" element={<Preview />} />
        </Routes>
      </Suspense>
    </>
  )
}
