// ============================================================================
// Standalone /consultation page — the landing target for the "Schedule Your
// Free 15-Minute Strategy Call" CTA in outreach emails.
//
// This intentionally REUSES the existing homepage <Consultation /> component
// (the same booking form, same Supabase flow, same /consultation-confirmed
// redirect) wrapped in the standard site chrome. It does not touch or fork the
// homepage behaviour — it just renders that component on its own route so the
// email link lands on a real page instead of an /api/book prospect lookup.
// ============================================================================

import AmbientCanvas from '../components/AmbientCanvas.jsx'
import CustomCursor from '../components/CustomCursor.jsx'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Consultation from '../components/Consultation.jsx'
import usePageMeta from '../lib/usePageMeta.js'

export default function ConsultationPage() {
  usePageMeta({
    title: 'Book Your Free Consultation | Digital Skyline Co.',
    description:
      'Schedule your free 15-minute strategy call with Digital Skyline Co. Pick a time and tell us about the website, app, or digital system your business needs.',
  })

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950">
      <AmbientCanvas />
      <CustomCursor />
      <Navbar />
      <main>
        <Consultation />
      </main>
      <Footer />
    </div>
  )
}
