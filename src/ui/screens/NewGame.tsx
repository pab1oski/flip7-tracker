import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../../db/repositories'
import { DEFAULT_WINNER_SHARE_PCT, isValidWinnerSharePct, splitPool } from '../../domain/money'
import { formatCents, parseEurosToCents } from '../format'
import { playerColor } from '../colors'
import Icon from '../icons'
import { strings } from '../strings'

const t = strings.newGame
const SPLIT_PRESETS = [50, 60, 70] as const

export default function NewGame() {
  const navigate = useNavigate()
  const players = useLiveQuery(() => repos.listPlayers(), [])
  // Selection order = player order in the game (matters for remainder cents).
  const [selected, setSelected] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [limit, setLimit] = useState('200')
  const [stake, setStake] = useState('1')
  const [winnerSharePct, setWinnerSharePct] = useState<number>(DEFAULT_WINNER_SHARE_PCT)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function addPlayer(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return setError(t.errors.emptyName)
    const p = await repos.createPlayer(newName)
    setSelected((s) => (s.includes(p.id) ? s : [...s, p.id]))
    setNewName('')
    setError(null)
  }

  async function start(e: FormEvent) {
    e.preventDefault()
    const limitNum = /^\d+$/.test(limit.trim()) ? Number(limit) : 0
    const stakeCents = parseEurosToCents(stake)
    if (selected.length < 2) return setError(t.errors.minPlayers)
    if (limitNum <= 0) return setError(t.errors.limit)
    if (stakeCents === null) return setError(t.errors.stake)
    if (!isValidWinnerSharePct(winnerSharePct)) return setError(t.errors.split)
    try {
      const game = await repos.createGame({ playerIds: selected, limit: limitNum, stakeCents, winnerSharePct })
      navigate(`/game/${game.id}`)
    } catch {
      setError(t.errors.generic)
    }
  }

  return (
    <main className="page">
      <Link to="/" className="back"><Icon name="back" size={18} />{strings.back}</Link>
      <h1>{t.title}</h1>

      <form onSubmit={addPlayer} className="row add-player">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.addPlaceholder} aria-label={t.addPlaceholder} />
        <button type="submit" className="btn-secondary"><Icon name="plus" size={16} />{t.add}</button>
      </form>

      <h2>{t.playersTitle} <small className="muted">{t.selected(selected.length)}</small></h2>
      {players && players.length === 0 && <p className="empty">{t.noPlayers}</p>}
      <ul className="chips">
        {players?.map((p) => {
          const idx = selected.indexOf(p.id)
          const on = idx >= 0
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                className={on ? 'chip on' : 'chip'}
                style={on ? { background: playerColor(idx), borderColor: playerColor(idx) } : undefined}
                onClick={() => toggle(p.id)}
              >
                {p.name}
              </button>
            </li>
          )
        })}
      </ul>

      <form onSubmit={start} className="stack">
        <label>
          {t.limit}
          <input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <label>
          {t.stake}
          <input inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} />
        </label>
        <SplitControl
          value={winnerSharePct}
          onChange={setWinnerSharePct}
          players={Math.max(2, selected.length)}
          stakeCents={parseEurosToCents(stake)}
        />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="btn-primary">{t.start}<Icon name="arrow" size={18} /></button>
      </form>
    </main>
  )
}

interface SplitControlProps {
  value: number
  onChange: (pct: number) => void
  /** Players used for the live example (at least 2). */
  players: number
  /** Currently typed stake, or null when it is not a valid amount. */
  stakeCents: number | null
}

function SplitControl({ value, onChange, players, stakeCents }: SplitControlProps) {
  const pot = 100 - value
  const example = stakeCents === null ? null : splitPool(stakeCents * players, value)
  return (
    <fieldset className="split-field">
      <legend>{t.split.title}</legend>
      <p className="split-hint">{t.split.hint}</p>
      <div className="split-presets" role="group" aria-label={t.split.presets}>
        {SPLIT_PRESETS.map((w) => (
          <button
            key={w}
            type="button"
            className={value === w ? 'chip preset on' : 'chip preset'}
            aria-pressed={value === w}
            onClick={() => onChange(w)}
          >
            {t.split.preset(w, 100 - w)}
          </button>
        ))}
      </div>
      <div className="split-meter" aria-hidden="true">
        <span className="split-meter-winner" style={{ width: `${value}%` }} />
      </div>
      <div className="split-legend" aria-hidden="true">
        <span><i className="split-key winner" />{t.split.winner} <strong>{value} %</strong></span>
        <span><i className="split-key pot" />{t.split.pot} <strong>{pot} %</strong></span>
      </div>
      <input
        type="range"
        className="split-range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label={t.split.slider}
        aria-valuetext={t.split.summary(value, pot)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${value}%` } as React.CSSProperties}
      />
      <output className="split-summary">{t.split.summary(value, pot)}</output>
      {example && (
        <p className="split-example">
          {t.split.example(players, formatCents(stakeCents ?? 0), formatCents(example.winnersPool), formatCents(example.potShare))}
        </p>
      )}
    </fieldset>
  )
}
