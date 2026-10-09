import type { CSSProperties } from 'react'
import { chartTheme, moneyColors } from '../colors'
import { initials, useSvgId } from './visualUtils'

export function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  return (
    <span className="avatar" style={{ '--c': color, '--size': `${size}px` } as CSSProperties} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

/** Tiny line of a cumulative money series (values in cents), colored by its final sign. */
export function Sparkline({ values, width = 84, height = 30 }: { values: readonly number[]; width?: number; height?: number }) {
  const gradId = useSvgId('spark')
  if (values.length < 2) return null
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  const pad = 2
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1)
  const y = (v: number) => pad + ((max - v) * (height - pad * 2)) / span
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const last = values[values.length - 1]
  const color = last > 0 ? moneyColors.pos : last < 0 ? moneyColors.neg : chartTheme.axis
  const zeroY = y(0)
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.35} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1={pad} x2={width - pad} y1={zeroY} y2={zeroY} stroke={chartTheme.zero} strokeDasharray="2 3" strokeWidth={1} />
      <polygon points={`${x(0)},${zeroY} ${pts.join(' ')} ${x(values.length - 1)},${zeroY}`} fill={`url(#${gradId})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r={2.4} fill={color} />
    </svg>
  )
}

/** Circular progress ring for a 0..1 ratio, with a centered label. */
export function Ring({ ratio, color, label, size = 76 }: { ratio: number; color: string; label: string; size?: number }) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, ratio))
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chartTheme.grid} strokeWidth={stroke} />
      <circle
        className="ring-value"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * clamped} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-label">
        {label}
      </text>
    </svg>
  )
}
