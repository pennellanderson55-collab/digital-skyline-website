// ============================================================================
// Declarative config for the field-driven settings sections. Each section maps
// to one Supabase table and a list of field descriptors the generic renderer
// turns into inputs. Adding a field = one line here (the jsonb column absorbs
// it — no migration). Custom sections (Email, Pricing, Stripe, Portfolio,
// Templates, Security, Analytics, Storage) are handled in SettingsHub.
// ============================================================================

export const TIMEZONES = [
  'America/Phoenix', 'America/Los_Angeles', 'America/Denver', 'America/Chicago',
  'America/New_York', 'America/Anchorage', 'Pacific/Honolulu', 'UTC',
]
export const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD']
export const AI_TONES = ['Professional', 'Friendly', 'Confident', 'Local Business Focus']
export const FONTS = ['Inter', 'Sora', 'Manrope', 'Satoshi', 'System UI']
export const RADII = ['Sharp', 'Rounded', 'Pill']
export const BUTTON_STYLES = ['Pill', 'Rounded', 'Square']

// ── Field-driven sections ────────────────────────────────────────────────────
export const GENERIC = {
  business: {
    table: 'business_settings',
    defaults: {
      company_name: 'Digital Skyline Co.', website: 'https://www.digitalskylineco.com',
      phone: '', support_email: 'support@digitalskylineco.com', timezone: 'America/Phoenix',
      logo_url: '', address: '', email_signature: '',
      instagram: '', linkedin: '', facebook: '', x: '', youtube: '',
    },
    fields: [
      { key: 'company_name', label: 'Company Name', type: 'text', required: true },
      { key: 'website', label: 'Website URL', type: 'url' },
      { key: 'phone', label: 'Business Phone', type: 'tel', placeholder: '(480) 555-0134' },
      { key: 'support_email', label: 'Support Email', type: 'email' },
      { key: 'timezone', label: 'Time Zone', type: 'select', options: TIMEZONES },
      { key: 'logo_url', label: 'Business Logo URL', type: 'url', help: 'Paste a hosted logo URL (Storage upload coming next).' },
      { key: 'address', label: 'Business Address', type: 'textarea' },
      { key: 'email_signature', label: 'Email Signature', type: 'textarea' },
      { type: 'heading', label: 'Social Media' },
      { key: 'instagram', label: 'Instagram', type: 'url' },
      { key: 'linkedin', label: 'LinkedIn', type: 'url' },
      { key: 'facebook', label: 'Facebook', type: 'url' },
      { key: 'x', label: 'X (Twitter)', type: 'url' },
      { key: 'youtube', label: 'YouTube', type: 'url' },
    ],
  },

  consultations: {
    table: 'consultation_settings',
    defaults: {
      working_hours_start: '09:00', working_hours_end: '17:00',
      days_available: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      appointment_length: 30, buffer_minutes: 15, max_per_day: 6,
      timezone: 'America/Phoenix', blackout_dates: '',
      auto_confirmation: true, reminder_emails: true,
    },
    fields: [
      { key: 'working_hours_start', label: 'Working Hours — Start', type: 'time' },
      { key: 'working_hours_end', label: 'Working Hours — End', type: 'time' },
      { key: 'days_available', label: 'Days Available', type: 'tags', placeholder: 'Mon, Tue, Wed…' },
      { key: 'timezone', label: 'Timezone', type: 'select', options: TIMEZONES },
      { key: 'appointment_length', label: 'Appointment Length (min)', type: 'number' },
      { key: 'buffer_minutes', label: 'Buffer Between Appointments (min)', type: 'number' },
      { key: 'max_per_day', label: 'Max Bookings Per Day', type: 'number' },
      { key: 'blackout_dates', label: 'Blackout / Holiday Dates', type: 'textarea', help: 'One date per line (YYYY-MM-DD).' },
      { type: 'heading', label: 'Automation' },
      { key: 'auto_confirmation', label: 'Auto Confirmation Emails', type: 'toggle' },
      { key: 'reminder_emails', label: 'Reminder Emails', type: 'toggle' },
    ],
  },

  crm: {
    table: 'crm_settings',
    defaults: {
      pipeline_stages: ['New Lead', 'Contacted', 'Consultation', 'Proposal Sent', 'Won', 'Lost'],
      default_tags: ['Warm', 'Cold', 'VIP'],
      auto_followup_days: 3, archive_days: 90,
      project_status_options: ['Discovery', 'Design', 'Development', 'Review', 'Launch', 'Completed'],
      support_status_options: ['New', 'In Progress', 'Waiting On Client', 'Resolved', 'Closed'],
    },
    fields: [
      { key: 'pipeline_stages', label: 'Pipeline Stages', type: 'tags' },
      { key: 'default_tags', label: 'Default Tags', type: 'tags' },
      { key: 'project_status_options', label: 'Project Status Options', type: 'tags' },
      { key: 'support_status_options', label: 'Support Status Options', type: 'tags' },
      { key: 'auto_followup_days', label: 'Auto Follow-up (days)', type: 'number' },
      { key: 'archive_days', label: 'Archive After (days)', type: 'number' },
    ],
  },

  notifications: {
    table: 'notification_settings',
    defaults: {
      email_notifications: true, desktop_notifications: false,
      project_alerts: true, consultation_alerts: true, support_alerts: true,
      slack: false, discord: false, sms: false,
    },
    fields: [
      { key: 'email_notifications', label: 'Email Notifications', type: 'toggle' },
      { key: 'desktop_notifications', label: 'Desktop Notifications', type: 'toggle' },
      { key: 'project_alerts', label: 'Project Alerts', type: 'toggle' },
      { key: 'consultation_alerts', label: 'Consultation Alerts', type: 'toggle' },
      { key: 'support_alerts', label: 'Support Alerts', type: 'toggle' },
      { type: 'heading', label: 'Coming Soon' },
      { key: 'slack', label: 'Slack', type: 'toggle', disabled: true },
      { key: 'discord', label: 'Discord', type: 'toggle', disabled: true },
      { key: 'sms', label: 'SMS', type: 'toggle', disabled: true },
    ],
  },

  website: {
    table: 'website_settings',
    defaults: {
      hero_title: 'Websites & Apps Built For Businesses Of Every Size.',
      hero_subtitle: 'From local businesses to growing companies, Digital Skyline Co. creates premium websites, applications, and digital experiences.',
      cta_text: 'Book a Free Consultation', announcement_banner: '', footer_text: '',
      seo_description: '', keywords: [], ga_id: '', search_console: '',
      background_video_url: '/ds-city.mp4', logo_url: '',
    },
    fields: [
      { key: 'hero_title', label: 'Homepage Hero Title', type: 'textarea', rows: 2 },
      { key: 'hero_subtitle', label: 'Hero Subtitle', type: 'textarea' },
      { key: 'cta_text', label: 'CTA Button Text', type: 'text' },
      { key: 'announcement_banner', label: 'Announcement Banner', type: 'text', help: 'Leave blank to hide.' },
      { key: 'footer_text', label: 'Footer Text', type: 'text' },
      { key: 'seo_description', label: 'SEO Description', type: 'textarea' },
      { key: 'keywords', label: 'Keywords', type: 'tags' },
      { key: 'background_video_url', label: 'Background Video URL', type: 'url' },
      { key: 'logo_url', label: 'Logo URL', type: 'url' },
      { type: 'heading', label: 'Integrations' },
      { key: 'ga_id', label: 'Google Analytics ID', type: 'text', placeholder: 'G-XXXXXXXXXX' },
      { key: 'search_console', label: 'Search Console Verification', type: 'text' },
    ],
  },

  ai: {
    table: 'ai_settings',
    defaults: {
      default_tone: 'Professional', local_business_focus: true, email_writing_style: '',
      proposal_style: '', cold_email_style: '', project_scope_style: '', support_reply_style: '',
    },
    fields: [
      { key: 'default_tone', label: 'Default AI Tone', type: 'select', options: AI_TONES },
      { key: 'local_business_focus', label: 'Local Business Focus', type: 'toggle' },
      { key: 'email_writing_style', label: 'Email Writing Style', type: 'textarea', help: 'Guidance the AI applies to every generated email.' },
      { key: 'proposal_style', label: 'Proposal Generator Style', type: 'textarea' },
      { key: 'cold_email_style', label: 'Cold Email Generator Style', type: 'textarea' },
      { key: 'project_scope_style', label: 'Project Scope Generator Style', type: 'textarea' },
      { key: 'support_reply_style', label: 'Support Reply Generator Style', type: 'textarea' },
    ],
  },

  branding: {
    table: 'branding_settings',
    defaults: {
      primary_color: '#d4af37', secondary_color: '#0b0b0f', accent_color: '#e6c350',
      font_family: 'Inter', border_radius: 'Rounded', button_style: 'Pill',
      logo_url: '', favicon_url: '',
    },
    fields: [
      { key: 'primary_color', label: 'Primary Color', type: 'color' },
      { key: 'secondary_color', label: 'Secondary Color', type: 'color' },
      { key: 'accent_color', label: 'Accent Color', type: 'color' },
      { key: 'font_family', label: 'Font Family', type: 'select', options: FONTS },
      { key: 'border_radius', label: 'Border Radius', type: 'select', options: RADII },
      { key: 'button_style', label: 'Button Style', type: 'select', options: BUTTON_STYLES },
      { key: 'logo_url', label: 'Logo URL', type: 'url' },
      { key: 'favicon_url', label: 'Favicon URL', type: 'url' },
    ],
  },
}

// ── Email + Pricing defaults (used by their custom sections) ─────────────────
export const EMAIL_DEFAULTS = {
  from_name: 'Digital Skyline Co.', from_email: 'hello@digitalskylineco.com',
  reply_to: 'hello@digitalskylineco.com', owner_notification_email: 'pernellanderson55@gmail.com',
  signature: 'Pernell Anderson\nFounder, Digital Skyline Co.\nhttps://www.digitalskylineco.com',
}

export const PRICING_DEFAULTS = {
  discount_enabled: true, tax_enabled: false, tax_rate: 0, deposit_percent: 50,
  packages: [
    { key: 'starter', name: 'Starter Website', regular: 2500, sale: 1500 },
    { key: 'business', name: 'Business Website', regular: 5000, sale: 2500 },
    { key: 'ecommerce', name: 'E-Commerce Website', regular: 8000, sale: 0 },
    { key: 'dashboard', name: 'Custom Dashboard', regular: 8000, sale: 0 },
    { key: 'webapp', name: 'Custom Web Application', regular: 12000, sale: 0 },
  ],
  maintenance_monthly: 150, maintenance_hourly: 95, maintenance_emergency: 150,
}

export const STRIPE_DEFAULTS = {
  mode: 'Live', client_portal_link: 'https://www.digitalskylineco.com/client-portal',
  invoice_link: '', success_url: 'https://www.digitalskylineco.com/thank-you',
  cancel_url: 'https://www.digitalskylineco.com/client-portal', currency: 'USD', tax_rate: 0,
}

export const TEMPLATE_SEEDS = [
  { key: 'consultation_confirmation', name: 'Consultation Confirmation', subject: 'Your consultation with Digital Skyline is booked', body: 'Hi {{name}},\n\nYour consultation is confirmed for {{date}} at {{time}}.\n\n— {{signature}}' },
  { key: 'owner_consultation_notification', name: 'Owner Consultation Notification', subject: 'New consultation booked — {{name}}', body: '{{name}} ({{business}}) booked a consultation for {{date}} {{time}}.' },
  { key: 'proposal', name: 'Proposal', subject: 'Your proposal from Digital Skyline Co.', body: 'Hi {{name}},\n\nHere is the proposal for {{project}}.\n\n— {{signature}}' },
  { key: 'invoice', name: 'Invoice', subject: 'Invoice {{invoice_number}} from Digital Skyline Co.', body: 'Hi {{name}},\n\nYour invoice for {{amount}} is attached.\n\n— {{signature}}' },
  { key: 'invoice_reminder', name: 'Invoice Reminder', subject: 'Friendly reminder: invoice {{invoice_number}}', body: 'Hi {{name}},\n\nA quick reminder that invoice {{invoice_number}} ({{amount}}) is due.\n\n— {{signature}}' },
  { key: 'project_started', name: 'Project Started', subject: 'We’ve started on {{project}}!', body: 'Hi {{name}},\n\nGreat news — we’ve kicked off {{project}}.\n\n— {{signature}}' },
  { key: 'project_complete', name: 'Project Complete', subject: '{{project}} is live! 🎉', body: 'Hi {{name}},\n\n{{project}} is complete and live.\n\n— {{signature}}' },
  { key: 'maintenance_reminder', name: 'Maintenance Reminder', subject: 'Your monthly maintenance summary', body: 'Hi {{name}},\n\nHere’s your maintenance summary for this month.\n\n— {{signature}}' },
  { key: 'support_reply', name: 'Support Reply', subject: 'Re: your support request', body: 'Hi {{name}},\n\nThanks for reaching out — {{reply}}\n\n— {{signature}}' },
]
