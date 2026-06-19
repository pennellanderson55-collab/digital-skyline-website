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
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import Status from './pages/Status.jsx'
import ThankYou from './pages/ThankYou.jsx'
import ConsultationConfirmed from './pages/ConsultationConfirmed.jsx'
import ClientPortal from './pages/ClientPortal.jsx'
import Admin from './admin/Admin.jsx'

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
  const bareRoutes = ['/admin', '/thank-you', '/consultation-confirmed']
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/status" element={<Status />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/consultation-confirmed" element={<ConsultationConfirmed />} />
        <Route path="/client-portal" element={<ClientPortal />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </>
  )
}
