import { useState } from 'react'
import SectionHeading from './SectionHeading.jsx'
import { Plus } from './Icons.jsx'

const QA = [
  {
    q: 'How long does it take to build a website or app?',
    a: "Every project is different, but most websites are completed within 1–6 weeks. More advanced applications, dashboards, and custom systems may take longer depending on complexity. We'll provide a clear timeline before any work begins.",
  },
  {
    q: 'Can you redesign my existing website?',
    a: 'Absolutely. Whether your current website needs a visual refresh, improved functionality, or a complete rebuild, we can transform it into a modern digital experience tailored to your business.',
  },
  {
    q: 'Do you only work with large companies?',
    a: 'Not at all. We build websites, applications, and business systems for companies of every size—from local businesses and startups to established organizations and enterprise clients.',
  },
  {
    q: "What if I don't know exactly what I need?",
    a: "That's what the free consultation is for. We'll learn about your business, understand your goals, and recommend the best digital solution based on your needs and budget.",
  },
  {
    q: "Will I be able to update my website after it's finished?",
    a: "Yes. We can build your project so you can easily make updates yourself, or we can provide ongoing support and maintenance if you'd rather have us handle everything for you.",
  },
  {
    q: 'How much does a custom website or app cost?',
    a: "Pricing depends on the scope of your project. During your free consultation, we'll discuss your goals and provide a transparent estimate with no hidden fees or obligations.",
  },
]

function Item({ item, open, onToggle }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-300 ${
        open
          ? 'border-gold-400/40 bg-gold-400/[0.05] shadow-gold-soft'
          : 'border-white/[0.08] bg-white/[0.02] hover:border-gold-400/25'
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-display text-base font-medium text-gray-100 sm:text-lg">
          {item.q}
        </span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-400/30 text-gold-300 transition-transform duration-300 ${
            open ? 'rotate-45 bg-gold-400/10' : ''
          }`}
        >
          <Plus className="h-4 w-4" />
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm leading-relaxed text-gray-400">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0)

  return (
    <section id="faq" className="relative scroll-mt-24 py-24">
      <div className="container-max">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently Asked"
          accent="Questions"
          subtitle="Everything you need to know before starting your project with Digital Skyline Co."
        />

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {QA.map((item, i) => (
            <Item
              key={item.q}
              item={item}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
