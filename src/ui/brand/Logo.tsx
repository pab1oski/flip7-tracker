import { useId } from 'react'

/**
 * Original app mark: two fanned playing cards, the front one carrying a bold
 * geometric "7". Pure inline SVG (no fonts, no images) so it renders the same
 * offline and at any size. Mirrored in public/icon.svg and public/favicon.svg.
 */
export default function Logo({ size = 56, className }: { size?: number; className?: string }) {
  const id = useId()
  const warm = `${id}-warm`
  const ink = `${id}-ink`
  return (
    <svg
      className={className ? `logo-mark ${className}` : 'logo-mark'}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={warm} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc145" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
        <linearGradient id={ink} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#e2483a" />
        </linearGradient>
      </defs>
      {/* Back card */}
      <rect x="12" y="9" width="30" height="44" rx="6" fill={`url(#${warm})`} transform="rotate(-14 27 31)" />
      <rect x="15.5" y="12.5" width="23" height="37" rx="3.5" fill="none" stroke="#1a0f08" strokeOpacity="0.22" strokeDasharray="2 2" transform="rotate(-14 27 31)" />
      {/* Front card */}
      <g transform="rotate(8 36 33)">
        <rect x="20" y="10" width="32" height="46" rx="6" fill="#1a0f08" fillOpacity="0.35" transform="translate(1.2 1.6)" />
        <rect x="20" y="10" width="32" height="46" rx="6" fill="#fff7ea" />
        <rect x="23" y="13" width="26" height="40" rx="3.5" fill="none" stroke={`url(#${ink})`} strokeOpacity="0.45" strokeWidth="1" />
        <path d="M27.5 19.5H46V25.2L38 48.5H30.6L38 25.5H27.5Z" fill="#1a0f08" fillOpacity="0.2" transform="translate(1.1 1.1)" />
        <path d="M27.5 19.5H46V25.2L38 48.5H30.6L38 25.5H27.5Z" fill={`url(#${ink})`} />
        <circle cx="25.6" cy="16" r="1.4" fill="#ff8a3d" />
        <circle cx="46.4" cy="50" r="1.4" fill="#ff8a3d" />
      </g>
    </svg>
  )
}
