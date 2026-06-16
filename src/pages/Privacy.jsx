import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    heading: 'Information We Collect',
    body: `When you visit our website or submit a consultation request, we may collect basic information you provide voluntarily — such as your name, email address, business name, and a description of your project. We do not require account creation and we do not collect payment information through this website.`,
  },
  {
    heading: 'How We Use Your Information',
    body: `Information you submit is used solely to respond to your inquiry, schedule consultations, and communicate with you about potential or active projects. We do not sell, rent, or share your personal information with third parties for marketing purposes.`,
  },
  {
    heading: 'Contact Forms & Consultation Requests',
    body: `When you submit a consultation request, the information you provide is used to prepare for and follow up on your consultation. This includes your name, email address, business name, and any project details you choose to share. You are not obligated to provide any specific information.`,
  },
  {
    heading: 'Cookies & Analytics',
    body: `This website may use basic analytics tools to understand how visitors interact with our pages — such as which sections are viewed and how users navigate the site. This data is aggregated and anonymous. We do not use cookies to track individuals across other websites.`,
  },
  {
    heading: 'Third-Party Services',
    body: `We may use third-party tools to help operate this website, such as hosting providers or form processing services. These providers are selected for their reliability and are not authorized to use your data for any purpose beyond supporting our website's operation.`,
  },
  {
    heading: 'Data Security',
    body: `We take reasonable measures to protect the information you share with us. However, no method of transmission over the internet is completely secure. We encourage you to avoid sharing sensitive personal or financial information through general inquiry forms.`,
  },
  {
    heading: 'Your Rights',
    body: `You may request to review, update, or delete any personal information you have provided to us. To make such a request, contact us at the email address below. We will respond promptly and in good faith.`,
  },
  {
    heading: 'Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. Any changes will be reflected on this page. Continued use of the website after changes are posted constitutes your acceptance of the updated policy.`,
  },
]

export default function Privacy() {
  return (
    <div className="min-h-screen bg-ink-950 text-gray-200 font-sans">
      {/* Header bar */}
      <div className="border-b border-white/[0.06] bg-ink-900/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-max flex items-center justify-between h-16">
          <Link to="/" className="font-display text-sm font-semibold text-gold-300 tracking-wider uppercase hover:text-gold-200 transition-colors">
            ← Digital Skyline Co.
          </Link>
          <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">Privacy Policy</span>
        </div>
      </div>

      <div className="container-max py-20 max-w-3xl">
        {/* Page title */}
        <div className="mb-14">
          <p className="font-mono text-xs text-gold-400 uppercase tracking-widest mb-4">Legal</p>
          <h1 className="font-display text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Digital Skyline Co. is committed to handling your information with care and transparency.
            This policy explains what we collect, how we use it, and how we protect it.
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
            For any questions about this Privacy Policy, please contact us at{' '}
            <a
              href="mailto:digitalskyline@digitalskylineco.com"
              className="text-gold-300 hover:text-gold-200 transition-colors"
            >
              digitalskyline@digitalskylineco.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
