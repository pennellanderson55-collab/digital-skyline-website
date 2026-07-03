// DEV-ONLY visual verification harness — renders the REAL Sales components
// with seeded mock data so the admin UI can be screenshotted without live
// Supabase auth. Not included in the production build (see verify.html).
import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Activity, Chart, User, Shield, Cube, Bolt, Scan, Arrow } from './components/Icons.jsx'
import SalesDashboard from './admin/sales/SalesDashboard.jsx'
import Prospects from './admin/sales/Prospects.jsx'
import Communications from './admin/comms/Communications.jsx'
import { Inbox as CommsIcon } from './admin/comms/icons.jsx'

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString()
const dateIn = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

// ── Seed data (shape matches the real Supabase rows) ───────────────────────
const SEED = [
  { id: '1', business_name: 'Valley Plumbing Co.', owner_name: 'Mike Reyes', industry: 'Plumbers', source: 'Google Maps', phone: '(480) 555-0142', email: 'mike@valleyplumb.com', website: 'valleyplumbingaz.com', address: '120 W Main St', city: 'Mesa', state: 'AZ', google_reviews: 87, google_rating: 4.7, website_score: 32, status: 'New Lead', deal_value: 3000, probability: 70, notes: 'Outdated site, no booking. Strong reviews — great candidate.', last_contacted: null, next_follow_up: dateIn(2), created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: '2', business_name: 'Sonoran Dental', owner_name: 'Dr. Patel', industry: 'Dental', source: 'Referral', phone: '(602) 555-0199', email: 'front@sonorandental.com', website: 'sonorandental.com', address: '88 N 7th Ave', city: 'Phoenix', state: 'AZ', google_reviews: 210, google_rating: 4.9, website_score: 64, status: 'Contacted', deal_value: 4500, probability: 50, notes: 'Spoke with office manager. Wants online intake forms.', last_contacted: daysAgo(0), next_follow_up: dateIn(-1), created_at: daysAgo(4), updated_at: daysAgo(0) },
  { id: '3', business_name: 'Desert Bloom Landscaping', owner_name: 'Tara Nguyen', industry: 'Landscaping', source: 'Instagram', phone: '(480) 555-0110', email: 'hello@desertbloom.co', website: 'desertbloom.co', address: '4501 E Ray Rd', city: 'Gilbert', state: 'AZ', google_reviews: 54, google_rating: 4.6, website_score: 41, status: 'Follow-up Scheduled', notes: 'Sent portfolio link. Following up after the holiday.', last_contacted: daysAgo(3), next_follow_up: dateIn(0), created_at: daysAgo(9), updated_at: daysAgo(3) },
  { id: '4', business_name: 'Copper State HVAC', owner_name: 'Jordan Blake', industry: 'HVAC', source: 'Cold Outreach', phone: '(623) 555-0188', email: 'jordan@copperstatehvac.com', website: 'copperstatehvac.com', address: '900 S Stapley Dr', city: 'Chandler', state: 'AZ', google_reviews: 132, google_rating: 4.8, website_score: 55, status: 'Consultation Booked', deal_value: 6000, probability: 60, notes: 'Booked a discovery call for Friday.', last_contacted: daysAgo(1), next_follow_up: dateIn(3), created_at: daysAgo(14), updated_at: daysAgo(1) },
  { id: '5', business_name: 'Agave Salon & Spa', owner_name: 'Bianca Ortiz', industry: 'Salons & Spas', source: 'Networking Event', phone: '(480) 555-0173', email: 'bianca@agavesalon.com', website: 'agavesalonspa.com', address: '17 E University Dr', city: 'Tempe', state: 'AZ', google_reviews: 96, google_rating: 4.5, website_score: 38, status: 'Proposal Sent', deal_value: 5000, probability: 80, notes: 'Proposal sent — Business Website + booking integration.', last_contacted: daysAgo(2), next_follow_up: dateIn(5), created_at: daysAgo(20), updated_at: daysAgo(2) },
  { id: '6', business_name: 'Red Rock Roofing', owner_name: 'Sam Carter', industry: 'Roofing', source: 'Google Search', phone: '(928) 555-0150', email: 'sam@redrockroofs.com', website: '', address: '210 N Hwy 89A', city: 'Sedona', state: 'AZ', google_reviews: 71, google_rating: 4.4, website_score: 47, status: 'Website Audited', notes: '', last_contacted: null, next_follow_up: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: '7', business_name: 'Cactus Auto Detailing', owner_name: 'Luis Gomez', industry: 'Automotive', source: 'Google Maps', phone: '(480) 555-0166', email: 'luis@cactusdetail.com', website: 'cactusdetailing.com', address: '3300 W Bell Rd', city: 'Glendale', state: 'AZ', google_reviews: 38, google_rating: 4.3, website_score: 29, status: 'Won', deal_value: 4200, probability: 100, notes: 'Signed! Business Website, launched last month.', last_contacted: daysAgo(7), next_follow_up: null, created_at: daysAgo(35), updated_at: daysAgo(7) },
  { id: '8', business_name: 'Summit Legal Group', owner_name: 'Dana White', industry: 'Legal', source: 'Referral', phone: '(602) 555-0121', email: 'dana@summitlegal.com', website: 'summitlegalaz.com', address: '2 N Central Ave', city: 'Phoenix', state: 'AZ', google_reviews: 145, google_rating: 4.9, website_score: 72, status: 'Lost', notes: 'Went with an in-house hire. Revisit in 6 months.', last_contacted: daysAgo(40), next_follow_up: null, created_at: daysAgo(60), updated_at: daysAgo(40) },
]

const MOCK_CONSULTATIONS = [
  { id: 'c1', name: 'Mike Reyes', business: 'Valley Plumbing Co.', date: dateIn(2), created_at: daysAgo(1), status: 'New' },
  { id: 'c2', name: 'Dr. Patel', business: 'Sonoran Dental', date: dateIn(4), created_at: daysAgo(4), status: 'Consultation Scheduled' },
  { id: 'c3', name: 'Jordan Blake', business: 'Copper State HVAC', date: dateIn(3), created_at: daysAgo(14), status: 'Closed Won' },
]
const MOCK_CLIENTS = [
  { id: 'cl1', company_name: 'Cactus Auto Detailing', contact_name: 'Luis Gomez', email: 'luis@cactusdetail.com', phone: '(480) 555-0166', website: 'cactusdetailing.com', industry: 'Automotive', google_rating: 4.3 },
  { id: 'cl2', company_name: 'Sunrise Dental', contact_name: 'Dr. Amara', email: 'office@sunrisedental.com', phone: '(602) 555-0233', website: 'sunrisedental.com', industry: 'Dental', google_rating: 4.8 },
]
const MOCK_PROJECTS = [
  { id: 'p1', client_id: 'cl1', project_reference: 'DS-2026-014', stage: 'Maintenance', amount_paid: 4200, total_price: 4200, paid_in_full: true },
  { id: 'p2', client_id: 'cl2', project_reference: 'DS-2026-021', stage: 'Launch', amount_paid: 1500, total_price: 6000 },
]

const OPS_NAV = [
  { key: 'Home', label: 'Home', icon: Activity },
  { key: 'comms', label: 'Communications', icon: CommsIcon },
  { key: 'Consultations', label: 'Consultations', icon: User },
  { key: 'Pipeline', label: 'Pipeline', icon: Chart },
  { key: 'Clients', label: 'Clients', icon: Shield },
  { key: 'Projects', label: 'Projects', icon: Cube },
  { key: 'Support', label: 'Support', icon: Bolt },
  { key: 'Analytics', label: 'Analytics', icon: Chart },
]
const SALES_NAV = [
  { key: 'sales:dashboard', label: 'Dashboard', icon: Activity },
  { key: 'sales:prospects', label: 'Prospects', icon: Scan },
  { key: 'sales:pipeline', label: 'Pipeline', icon: Chart },
  { key: 'sales:followups', label: 'Follow-ups', icon: Bolt },
  { key: 'sales:analytics', label: 'Analytics', icon: Chart },
]

function App() {
  const [nav, setNav] = useState('sales:dashboard')
  const [prospects, setProspects] = useState(SEED)

  const onAdd = (patch) => setProspects((ps) => [{ id: String(Date.now()), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch }, ...ps])
  const onUpdate = (id, patch) => setProspects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const onDelete = (id) => setProspects((ps) => ps.filter((p) => p.id !== id))

  return (
    <div className="admin-scope relative min-h-screen bg-ink-950 text-gray-200">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80" style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(212,175,55,0.06), transparent 70%)' }} aria-hidden="true" />
      <div className="container-max relative py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-50">Digital Skyline <span className="text-gold-gradient">OS</span></h1>
            <p className="text-xs text-gray-500">readirentals26@readirentalsaz.com</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost text-xs">Refresh</button>
            <button className="btn-ghost text-xs">Sign out</button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
          <aside className="lg:w-60 lg:shrink-0">
            <nav className="lg:sticky lg:top-6 space-y-6">
              <Group label="Operations">
                {OPS_NAV.map((i) => <Item key={i.key} item={i} active={nav === i.key} onClick={() => setNav(i.key)} />)}
              </Group>
              <Group label="Sales" badge={prospects.length}>
                {SALES_NAV.map((i) => <Item key={i.key} item={i} active={nav === i.key} onClick={() => setNav(i.key)} />)}
              </Group>
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {nav === 'comms' && (
              <Communications prospects={prospects} clients={MOCK_CLIENTS} projects={MOCK_PROJECTS} userEmail="pernell@digitalskyline.co" />
            )}
            {nav === 'sales:dashboard' && (
              <SalesDashboard prospects={prospects} consultations={MOCK_CONSULTATIONS} clients={MOCK_CLIENTS} projects={MOCK_PROJECTS} onGoToProspects={() => setNav('sales:prospects')} />
            )}
            {nav === 'sales:prospects' && (
              <Prospects prospects={prospects} loading={false} error={null} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} />
            )}
            {nav !== 'comms' && nav !== 'sales:dashboard' && nav !== 'sales:prospects' && (
              <div className="card-surface p-10 text-center text-gray-500 shadow-card">“{[...OPS_NAV, ...SALES_NAV].find((n) => n.key === nav)?.label}” module (rendered elsewhere in this harness).</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Group({ label, badge, children }) {
  return (
    <div>
      <div className="mb-2 flex w-full items-center justify-between px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500">
        <span className="flex items-center gap-2">{label}{badge != null && <span className="rounded-full bg-gold-400/10 px-1.5 py-0.5 text-[10px] text-gold-200">{badge}</span>}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}
function Item({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${active ? 'border-gold-400/60 bg-gold-400/10 text-gold-100' : 'border-transparent text-gray-400 hover:border-white/10 hover:bg-white/[0.03] hover:text-gray-200'}`}>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}{item.label}
    </button>
  )
}

createRoot(document.getElementById('verify-root')).render(<App />)
