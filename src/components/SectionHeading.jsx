export default function SectionHeading({ eyebrow, title, accent, subtitle, center = true }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      {eyebrow && (
        <div className={`eyebrow ${center ? 'mx-auto' : ''}`}>{eyebrow}</div>
      )}
      <h2 className="mt-5 font-display text-4xl font-bold tracking-tight text-gray-50 sm:text-5xl">
        {title} {accent && <span className="text-gold-gradient">{accent}</span>}
      </h2>
      {subtitle && <p className="mt-4 text-gray-400">{subtitle}</p>}
    </div>
  )
}
