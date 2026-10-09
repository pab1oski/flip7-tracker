import type { CSSProperties } from 'react'

export type HorseState = 'idle' | 'gallop' | 'celebrate'

/** Polyline points for the four legs of one pose: far hind, near hind, far fore, near fore. */
type Pose = readonly [string, string, string, string]

// Hips sit around (20-23, 33) and shoulders around (41-44, 33); the ground is y = 46.
const STAND: Pose = ['20,33 19,40 20,46', '23,33 23,40 24,46', '41,33 42,40 41,46', '44,33 44,40 45,46']
// Four-frame gallop: stretched, landing, gathered, push-off.
const GALLOP: readonly Pose[] = [
  ['20,33 14,39 9,42', '23,33 17,40 12,44', '41,33 48,37 54,40', '44,33 50,38 57,42'],
  ['20,33 18,40 14,45', '23,33 24,40 22,46', '41,33 45,40 47,46', '44,33 49,38 52,44'],
  ['20,33 25,38 28,44', '23,33 28,37 31,42', '41,33 37,39 33,43', '44,33 40,40 37,45'],
  ['20,33 20,40 23,46', '23,33 22,40 19,46', '41,33 40,39 44,42', '44,33 41,40 46,44'],
]
// Rearing: hind legs planted, forelegs tucked up.
const REAR: Pose = ['20,33 21,40 25,46', '23,33 24,40 28,46', '41,33 46,35 45,40', '44,33 49,36 48,41']

function Legs({ pose, className }: { pose: Pose; className: string }) {
  return (
    <g className={`horse-legs ${className}`}>
      <polyline className="leg far" points={pose[0]} />
      <polyline className="leg far" points={pose[2]} />
      <polyline className="leg" points={pose[1]} />
      <polyline className="leg" points={pose[3]} />
    </g>
  )
}

const CONFETTI = [0, 1, 2, 3, 4, 5, 6, 7]

/**
 * Original side-view racehorse with jockey, facing right. Silks and saddle cloth
 * take the player's color. Pure SVG + CSS: legs swap between pose groups with
 * stepped keyframes while galloping; reduced motion shows a static pose.
 */
export default function Horse({
  color,
  state,
  leader = false,
  height = 40,
}: {
  color: string
  state: HorseState
  leader?: boolean
  height?: number
}) {
  return (
    <span className={`horse is-${state}`} style={{ '--c': color, height, width: (height * 64) / 48 } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 64 48" width="100%" height="100%" overflow="visible">
        <g className="horse-figure">
          <g className="horse-legs-wrap">
            <Legs pose={STAND} className="stand" />
            {GALLOP.map((pose, i) => (
              <Legs key={i} pose={pose} className={`gallop f${i + 1}`} />
            ))}
            <Legs pose={REAR} className="rear" />
          </g>
          <g className="horse-body">
            <path className="horse-tail" d="M17 25 Q8 23 5 34 Q7 37 9 33 Q11 29 17 29 Z" />
            <ellipse className="horse-coat" cx="31" cy="28" rx="15" ry="7.5" />
            <path className="horse-coat" d="M39 23 L47 11 L53 13 L47 31 Z" />
            <path className="horse-coat" d="M47 9.5 Q52 6.5 56 11 L61.5 17.5 Q62.5 21 59 21 L52 18.5 Z" />
            <path className="horse-coat" d="M48.5 9.5 L49.5 4.5 L51.5 9 Z" />
            <path className="horse-mane" d="M40.5 22.5 L47.5 10.5" />
            <circle className="horse-eye" cx="53.5" cy="12" r="0.9" />
            <path className="horse-rein" d="M45 17 L57 16" />
            <path className="saddle-cloth" d="M25 21.5 H37 L36 30 H26 Z" />
            <path className="saddle" d="M27 21 Q31 18.5 35.5 21 Z" />
            <g className="jockey">
              <path className="jockey-pants" d="M29 19 L36 21 L32.5 25.5" />
              <path className="jockey-boot" d="M33.5 24.2 L31.6 26.6" />
              <path className="silks" d="M27.5 18.5 Q30 12 38 10.5 L40 13 Q34 15 31.5 20 Z" />
              <path className="silks-stripe" d="M30 15.5 L37.5 12.3" />
              <path className="jockey-arm" d="M37 12.5 L43 16 L46 16.5" />
              <circle className="jockey-face" cx="41" cy="8.6" r="2.4" />
              <path className="silks" d="M38.4 8.2 Q38.8 4.8 42 5 Q44.6 5.4 44.2 7.8 L45.4 8.4 Z" />
            </g>
            {leader && <path className="horse-crown" d="M37.5 3 L38.5 -2.5 L40.5 0.5 L42 -3.5 L43.5 0.5 L45.5 -2.5 L46.5 3 Z" />}
          </g>
        </g>
      </svg>
      {state === 'celebrate' && (
        <span className="confetti">
          {CONFETTI.map((i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </span>
      )}
    </span>
  )
}
