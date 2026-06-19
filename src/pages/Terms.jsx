import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    heading: 'Use of This Website',
    body: `By accessing and using the Digital Skyline Co. website, you agree to use it for lawful purposes only. You may not use this website to engage in any activity that is harmful, deceptive, or in violation of applicable laws. We reserve the right to restrict access to this website at our discretion.`,
  },
  {
    heading: 'Consultations',
    body: `Booking a free consultation through this website does not constitute a contract, agreement, or guarantee of services. Consultations are provided as an opportunity to discuss your business needs and explore potential solutions. No work will begin and no commitment is made by either party until a formal project agreement is signed.`,
  },
  {
    heading: 'Project Estimates',
    body: `Any pricing discussed during a consultation or provided in a written estimate is an approximation based on information available at that time. Final pricing is determined after a thorough review of project requirements and is outlined in a formal proposal. Estimates are not binding until agreed upon in writing.`,
  },
  {
    heading: 'Payments & Project Agreements',
    body: `All projects require a signed agreement and deposit before work begins. Payment terms, milestones, and deliverables are outlined in individual project contracts. Digital Skyline Co. reserves the right to pause or terminate work if payment obligations are not met according to the agreed schedule.`,
  },
  {
    heading: 'Intellectual Property',
    body: `Upon receipt of final payment, clients receive full ownership of the custom design and code created specifically for their project. Digital Skyline Co. retains the right to display completed work in its portfolio unless otherwise agreed in writing. Third-party tools, libraries, and assets used in projects are subject to their own respective licenses.`,
  },
  {
    heading: 'Limitation of Liability',
    body: `Digital Skyline Co. is not liable for any indirect, incidental, or consequential damages arising from the use of this website or from services rendered. Our total liability in any matter related to services provided shall not exceed the amount paid by the client for the specific project in question.`,
  },
  {
    heading: 'Accuracy of Information',
    body: `We strive to keep the content on this website accurate and up to date. However, we make no warranties regarding the completeness, accuracy, or timeliness of the information presented. Content is subject to change without notice.`,
  },
  {
    heading: 'Changes to These Terms',
    body: `We may update these Terms of Service at any time. Updates will be reflected on this page. Your continued use of the website after changes are posted constitutes your acceptance of the revised terms.`,
  },
]

export default function Terms() {
  return (
    <div className="min-h-screen bg-ink-950 text-gray-200 font-sans">
      {/* Header bar */}
      <div className="border-b border-white/[0.06] bg-ink-900/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-max flex items-center justify-between h-16">
          <Link to="/" className="font-display text-sm font-semibold text-gold-300 tracking-wider uppercase hover:text-gold-200 transition-colors">
            ← Digital Skyline Co.
          </Link>
          <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">Terms of Service</span>
        </div>
      </div>

      <div className="container-max py-20 max-w-3xl">
        {/* Page title */}
        <div className="mb-14">
          <p className="font-mono text-xs text-gold-400 uppercase tracking-widest mb-4">Legal</p>
          <h1 className="font-display text-4xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            These terms govern your use of the Digital Skyline Co. website and the services we provide.
            Please read them carefully before engaging with our team.
          </p>
          <p className="text-gray-500 text-sm mt-4">Last updated: June 2026</p>
          <div className="mt-6 h-px bg-gradient-to-r from-gold-600/60 via-gold-400/30 to-transparent" />
        </div>

        {/* Disclaimer */}
        <div className="mb-10 rounded-lg border border-gold-700/30 bg-gold-400/5 px-6 py-4">
          <p className="text-xs text-gold-300/80 leading-relaxed">
            <strong className="text-gold-300">Disclaimer:</strong> This page is for informational purposes and does not replace legal advice. If you have specific legal concerns, please consult a qualified attorney.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map((s, i) => (
            <div key={i}>
              <h2 className="font-display text-lg font-semibold text-white mb-3">{s.heading}</h2>
              <p className="text-gray-400 text-sm leading-7">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <h2 className="font-display text-lg font-semibold text-white mb-3">Contact Us</h2>
          <p className="text-gray-400 text-sm leading-7">
            For any questions about these Terms of Service, please contact us at{' '}
            <a
              href="mailto:hello@digitalskylineco.com"
              className="text-gold-300 hover:text-gold-200 transition-colors"
            >
              hello@digitalskylineco.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
