import type { CSSProperties, ReactNode } from 'react'

/** Decorative values for the hero fan: numbers and modifiers from a push-your-luck deck. */
const FAN: { label: string; kind: 'num' | 'mod' }[] = [
  { label: '3', kind: 'num' },
  { label: '+4', kind: 'mod' },
  { label: '7', kind: 'num' },
  { label: 'x2', kind: 'mod' },
  { label: '12', kind: 'num' },
]

/** Small fanned hand of cards (pure CSS/HTML, decorative). */
export function CardFan() {
  const mid = (FAN.length - 1) / 2
  return (
    <div className="card-fan" aria-hidden="true">
      {FAN.map((c, i) => (
        <span
          key={c.label}
          className={`mini-card ${c.kind}${i === mid ? ' hero-card' : ''}`}
          style={{ '--i': i - mid } as CSSProperties}
        >
          <small>{c.label}</small>
          <b>{c.label}</b>
        </span>
      ))}
    </div>
  )
}

/** A number rendered as a tiny playing card; screen readers get the plain value plus `srSuffix`. */
export function CardChip({ children, srSuffix }: { children: ReactNode; srSuffix?: string }) {
  return (
    <span className="card-chip">
      {children}
      {srSuffix && <span className="sr-only"> {srSuffix}</span>}
    </span>
  )
}
