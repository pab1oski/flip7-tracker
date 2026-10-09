import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { leaderboard, playerOrder } from '../../domain/playerProfile'
import { computePlayerStats } from '../../domain/stats'
import { profileColors } from '../colors'
import { formatCents } from '../format'
import Icon from '../icons'
import { Avatar, Sparkline } from '../players/visuals'
import { medalClass } from '../players/visualUtils'
import { strings } from '../strings'
import { useAllGames } from '../useAllGames'

const t = strings.playersStats
const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 })

export default function PlayerStats() {
  const data = useAllGames()

  const view = useMemo(() => {
    if (!data) return null
    const records = data.games.map((g) => g.record)
    const stats = computePlayerStats(records)
    const colorOf = profileColors(playerOrder(records, data.players))
    const nameOf = new Map(data.players.map((p) => [p.id, p.name]))
    const board = leaderboard(stats).filter((e) => nameOf.has(e.playerId))
    const idle = data.players.filter((p) => !stats[p.id]).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return { stats, colorOf, nameOf, board, idle }
  }, [data])

  return (
    <main className="page">
      <Link to="/" className="back"><Icon name="back" size={18} />{strings.back}</Link>
      <h1>{t.title}</h1>

      {view && view.board.length === 0 && view.idle.length === 0 && <p className="empty">{t.empty}</p>}
      {view && view.board.length === 0 && view.idle.length > 0 && <p className="empty">{t.noGames}</p>}

      {view && view.board.length > 0 && (
        <>
          <p className="note">{t.subtitle}</p>
          <ol className="leaderboard">
            {view.board.map((entry, i) => {
              const s = view.stats[entry.playerId]
              const name = view.nameOf.get(entry.playerId) ?? '?'
              const color = view.colorOf(entry.playerId)
              return (
                <li key={entry.playerId} style={{ '--c': color, '--i': i } as CSSProperties}>
                  <Link to={`/players/${entry.playerId}`} className={`player-card${medalClass(entry.rank)}`} aria-label={t.openProfile(name)}>
                    <span className="rank">{t.rank(entry.rank)}</span>
                    <Avatar name={name} color={color} />
                    <span className="player-card-text">
                      <strong>{name}</strong>
                      <span className="muted">
                        {t.gamesShort(s.gamesPlayed)} · {t.winRateShort(pct.format(s.gamesWon / s.gamesPlayed))}
                      </span>
                    </span>
                    <span className="player-card-money">
                      <strong className={entry.netCents > 0 ? 'pos' : entry.netCents < 0 ? 'neg' : ''}>{formatCents(entry.netCents)}</strong>
                      <Sparkline values={[0, ...s.balanceByGame.map((b) => b.cumulativeCents)]} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </>
      )}

      {view && view.idle.length > 0 && view.board.length > 0 && (
        <h2 className="section-title">{t.unranked}</h2>
      )}
      {view && view.idle.length > 0 && (
        <ul className="leaderboard idle">
          {view.idle.map((p) => (
            <li key={p.id} style={{ '--c': view.colorOf(p.id) } as CSSProperties}>
              <Link to={`/players/${p.id}`} className="player-card" aria-label={t.openProfile(p.name)}>
                <Avatar name={p.name} color={view.colorOf(p.id)} size={36} />
                <span className="player-card-text">
                  <strong>{p.name}</strong>
                  <span className="muted">{t.noGames}</span>
                </span>
                <Icon name="arrow" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
