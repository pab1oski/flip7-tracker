import type { ReactNode } from 'react'

export type ActionName = 'freeze' | 'flipThree' | 'secondChance'

const ARMS = [0, 60, 120, 180, 240, 300]

const SHAPES: Record<ActionName, ReactNode> = {
  // Six-armed snowflake with a small chevron on each arm.
  freeze: (
    <>
      {ARMS.map((a) => (
        <path key={a} d="M12 12V2.8M9.6 5.1L12 7.4l2.4-2.3" transform={`rotate(${a} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="1.6" className="ai-fill" />
    </>
  ),
  // Three stacked cards with a "deal" arrow curling around them.
  flipThree: (
    <>
      <rect x="2.8" y="9" width="9" height="12.2" rx="1.6" className="ai-card" />
      <rect x="5.8" y="6" width="9" height="12.2" rx="1.6" className="ai-card" />
      <rect x="8.8" y="3" width="9" height="12.2" rx="1.6" className="ai-card" />
      <path d="M13.3 7.2v5.6" />
      <path d="M21 9.5v6a3.6 3.6 0 0 1-3.6 3.6H14.5M16.8 16.8l-2.3 2.3 2.3 2.3" />
    </>
  ),
  // A shield protecting a heart.
  secondChance: (
    <>
      <path d="M12 2.8l7.6 3v5.7c0 4.6-3.2 8.3-7.6 9.8-4.4-1.5-7.6-5.2-7.6-9.8V5.8z" />
      <path d="M12 16.2s-3.9-2.4-3.9-5.1a2.05 2.05 0 0 1 3.9-1 2.05 2.05 0 0 1 3.9 1c0 2.7-3.9 5.1-3.9 5.1z" className="ai-fill" />
    </>
  ),
}

/** Original stroke icons for the three action cards (decorative). */
export default function ActionIcon({ name, size = 22 }: { name: ActionName; size?: number }) {
  return (
    <svg
      className={`action-icon ai-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  )
}
