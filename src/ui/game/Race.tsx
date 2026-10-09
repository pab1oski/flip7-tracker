import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { playerColor } from '../colors'
import { strings } from '../strings'
import Horse, { type HorseState } from './Horse'

export interface RacePlayer {
  id: string
  name: string
  total: number
}

const t = strings.game
const TICKS = [25, 50, 75]
/** Matches the bar's width transition plus a little extra so the stride finishes. */
const GALLOP_MS = 1200
const HORSE_HEIGHT = 40
const HORSE_WIDTH = (HORSE_HEIGHT * 64) / 48

/** True for ~1.2s every time `total` goes up; previous value kept in a ref. */
function useGallop(total: number): boolean {
  const previous = useRef(total)
  const [galloping, setGalloping] = useState(false)
  useEffect(() => {
    const grew = total > previous.current
    previous.current = total
    if (!grew) {
      setGalloping(false)
      return
    }
    setGalloping(true)
    const id = window.setTimeout(() => setGalloping(false), GALLOP_MS)
    return () => window.clearTimeout(id)
  }, [total])
  return galloping
}

function RaceRow({ player, index, limit, leading }: { player: RacePlayer; index: number; limit: number; leading: boolean }) {
  const color = playerColor(index)
  const pct = Math.min(100, (player.total / limit) * 100)
  const left = Math.max(0, limit - player.total)
  const galloping = useGallop(player.total)
  const state: HorseState = left === 0 ? 'celebrate' : galloping ? 'gallop' : 'idle'
  return (
    <div className={`bar-row${leading ? ' leading' : ''}`} style={{ '--c': color } as CSSProperties}>
      <div className="bar-head">
        <span className="bar-name">
          <i className="dot" />
          {player.name}
          {leading && <span className="badge">{t.leader}</span>}
        </span>
        <span className="bar-score">
          <strong>{player.total}</strong>
          <span className="muted"> / {limit}</span>
        </span>
      </div>
      <div
        className="bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={player.total}
        aria-valuetext={`${t.points(player.total)} / ${limit}`}
        aria-label={player.name}
      >
        <div className="lane">
          {TICKS.map((tk) => (
            <span key={tk} className="tick" style={{ left: `${tk}%` }} aria-hidden="true" />
          ))}
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="finish-line" aria-hidden="true" />
        <span
          className="horse-slot"
          style={{ left: `clamp(0px, calc(${pct}% - ${HORSE_WIDTH}px), calc(100% - ${HORSE_WIDTH}px - var(--finish-w)))` }}
        >
          <Horse color={color} state={state} leader={leading} height={HORSE_HEIGHT} />
        </span>
      </div>
      <div className="bar-foot muted">{left === 0 ? t.reached : t.remaining(left)}</div>
    </div>
  )
}

/** One horizontal lane per player: the bar grows from the left axis toward the finish line while its horse races at the tip. */
export default function Race({ players, limit }: { players: RacePlayer[]; limit: number }) {
  const top = Math.max(0, ...players.map((p) => p.total))
  return (
    <section className="panel" aria-label={t.raceTitle}>
      <div className="panel-head">
        <h2>{t.raceTitle}</h2>
        <span className="flag-label">{t.limitFlag(limit)}</span>
      </div>
      <div className="bars">
        {players.map((p, i) => (
          <RaceRow key={p.id} player={p} index={i} limit={limit} leading={top > 0 && p.total === top} />
        ))}
      </div>
    </section>
  )
}
