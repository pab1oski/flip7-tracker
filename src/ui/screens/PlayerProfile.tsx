import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  bestAndWorstGame,
  headToHead,
  leaderboard,
  longestRoundWinStreak,
  moneyHeadToHead,
  playerGameResults,
  type MoneyHeadToHead,
  playerMoneyTimeline,
  playerOrder,
  pointsHistogram,
} from '../../domain/playerProfile'
import { computePlayerStats } from '../../domain/stats'
import { profileColors } from '../colors'
import { formatCents } from '../format'
import Icon from '../icons'
import { HistogramChart, MoneyTimelineChart, PerGameChart } from '../players/ProfileCharts'
import { Avatar, Ring } from '../players/visuals'
import { medalClass } from '../players/visualUtils'
import { strings } from '../strings'
import { useAllGames } from '../useAllGames'

const t = strings.profile
const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 })
const avg = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const dateFmt = { day: 'numeric', month: 'short', year: 'numeric' } as const
const sign = (cents: number) => (cents > 0 ? 'pos' : cents < 0 ? 'neg' : '')

function Kpi({ label, value, hint, className = '' }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <li className={`kpi ${className}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <span className="kpi-hint">{hint}</span>}
    </li>
  )
}

/** Diverging bars centred at zero: losses grow left in red, gains grow right in green. */
function MoneyRivals({
  rows,
  colorOf,
  nameOf,
}: {
  rows: readonly MoneyHeadToHead[]
  colorOf: (id: string) => string
  nameOf: (id: string) => string
}) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.netCents)))
  const first = rows[0]
  const nemesis = first && first.netCents < 0 ? first.opponentId : null
  const last = rows[rows.length - 1]
  const favorite = last && last.netCents > 0 ? last.opponentId : null
  return (
    <section className="panel" aria-label={t.h2hMoneyTitle}>
      <h2>{t.h2hMoneyTitle}</h2>
      <p className="panel-hint">{t.h2hMoneyHint}</p>
      <ul className="h2h">
        {rows.map((r) => {
          const oppColor = colorOf(r.opponentId)
          const name = nameOf(r.opponentId)
          const width = (Math.abs(r.netCents) / maxAbs) * 50
          const tag = r.opponentId === nemesis ? 'nemesis' : r.opponentId === favorite ? 'favorite' : null
          return (
            <li key={r.opponentId}>
              <Link
                to={`/players/${r.opponentId}`}
                className={`h2h-row money-row${tag ? ` ${tag}` : ''}`}
                aria-label={t.h2hMoneyAria(name, formatCents(r.netCents))}
              >
                <Avatar name={name} color={oppColor} size={36} />
                <span className="h2h-main">
                  <span className="h2h-top">
                    <strong>{name}</strong>
                    <strong className={`money-amount ${sign(r.netCents)}`}>{formatCents(r.netCents)}</strong>
                  </span>
                  <span className="diverging" aria-hidden="true">
                    <i
                      className={sign(r.netCents)}
                      style={r.netCents < 0 ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }}
                    />
                  </span>
                  <span className="h2h-foot">
                    <span className="muted">{t.h2hTogether(r.gamesTogether)}</span>
                    {tag && <span className={`money-tag ${tag}`}>{tag === 'nemesis' ? t.nemesis : t.favoriteClient}</span>}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function PlayerProfile() {
  const { id = '' } = useParams()
  const data = useAllGames()

  const view = useMemo(() => {
    if (!data) return null
    const player = data.players.find((p) => p.id === id)
    if (!player) return { player: null } as const
    const records = data.games.map((g) => g.record)
    const allStats = computePlayerStats(records)
    const board = leaderboard(allStats)
    const results = playerGameResults(records, id)
    return {
      player,
      stats: allStats[id],
      colorOf: profileColors(playerOrder(records, data.players)),
      nameOf: new Map(data.players.map((p) => [p.id, p.name])),
      storedOf: new Map(data.games.map((g) => [g.stored.id, g.stored])),
      entry: board.find((e) => e.playerId === id),
      boardSize: board.length,
      results,
      ...bestAndWorstGame(results),
      timeline: playerMoneyTimeline(records, id),
      histogram: pointsHistogram(records, id),
      streak: longestRoundWinStreak(records, id),
      rivals: headToHead(records, id),
      moneyRivals: moneyHeadToHead(records, id),
    }
  }, [data, id])

  const back = <Link to="/players" className="back"><Icon name="back" size={18} />{t.backToList}</Link>

  if (!view) return <main className="page">{back}</main>
  if (!view.player) {
    return (
      <main className="page">
        {back}
        <p className="empty">{t.notFound}</p>
      </main>
    )
  }

  const { player, stats, colorOf, entry } = view
  const color = colorOf(player.id)
  const nameOf = (pid: string) => view.nameOf.get(pid) ?? '?'

  return (
    <main className="page profile" style={{ '--c': color } as CSSProperties}>
      {back}

      <header className="profile-hero">
        <Avatar name={player.name} color={color} size={72} />
        <div className="profile-hero-text">
          <h1>{player.name}</h1>
          {entry && <span className={`rank-pill${medalClass(entry.rank)}`}><Icon name="trophy" size={14} />{t.rankOf(entry.rank, view.boardSize)}</span>}
        </div>
        {stats && (
          <div className="profile-net">
            <span className="kpi-label">{t.netBalance}</span>
            <strong className={sign(stats.netCents)}>{formatCents(stats.netCents)}</strong>
            <span className="muted">{t.summary(stats.gamesPlayed, stats.roundsPlayed)}</span>
          </div>
        )}
      </header>

      {!stats ? (
        <p className="empty">{t.noGames}</p>
      ) : (
        <>
          <section aria-label={t.kpisTitle}>
            <ul className="kpi-grid">
              <li className="kpi kpi-ring">
                <Ring ratio={stats.gamesWon / stats.gamesPlayed} color={color} label={pct.format(stats.gamesWon / stats.gamesPlayed)} />
                <span className="kpi-ring-text">
                  <span className="kpi-label">{t.winRate}</span>
                  <strong className="kpi-value">{t.gamesWonOf(stats.gamesWon, stats.gamesPlayed)}</strong>
                  <span className="kpi-hint">{t.gamesWon}</span>
                </span>
              </li>
              <Kpi label={t.roundsWon} value={stats.roundsWon} hint={t.roundsWonPct(pct.format(stats.roundsWon / stats.roundsPlayed))} />
              <Kpi label={t.average} value={avg.format(stats.averagePointsPerRound)} hint={t.points(stats.totalPoints)} />
              <Kpi label={t.bestRound} value={stats.bestRound} hint={t.pointsUnit} />
              <Kpi label={t.bustRate} value={pct.format(stats.busts / stats.roundsPlayed)} hint={t.bustCount(stats.busts)} />
              <Kpi label={t.streak} value={view.streak} hint={t.streakHint} />
              <Kpi
                label={t.bestGame}
                className={view.best && view.best.netCents > 0 ? 'pos' : ''}
                value={view.best && view.best.netCents > 0 ? formatCents(view.best.netCents) : t.none}
                hint={view.best && view.best.netCents > 0 ? t.inGame(view.best.index) : undefined}
              />
              <Kpi
                label={t.worstGame}
                className={view.worst && view.worst.netCents < 0 ? 'neg' : ''}
                value={view.worst && view.worst.netCents < 0 ? formatCents(view.worst.netCents) : t.none}
                hint={view.worst && view.worst.netCents < 0 ? t.inGame(view.worst.index) : undefined}
              />
            </ul>
          </section>

          <section className="panel star-panel" aria-label={t.moneyTitle}>
            <div className="panel-head">
              <h2>{t.moneyTitle}</h2>
              <span className={`pot-pill ${sign(stats.netCents)}`}>{formatCents(stats.netCents)}</span>
            </div>
            <p className="panel-hint">{t.moneyHint}</p>
            <MoneyTimelineChart timeline={view.timeline} color={color} />
          </section>

          <section className="panel" aria-label={t.perGameTitle}>
            <h2>{t.perGameTitle}</h2>
            <PerGameChart results={view.results} />
          </section>

          <section className="panel" aria-label={t.histogramTitle}>
            <h2>{t.histogramTitle}</h2>
            <HistogramChart buckets={view.histogram} color={color} />
          </section>

          {view.rivals.length > 0 && (
            <section className="panel" aria-label={t.h2hTitle}>
              <h2>{t.h2hTitle}</h2>
              <p className="panel-hint">{t.h2hHint}</p>
              <ul className="h2h">
                {view.rivals.map((r) => {
                  const oppColor = colorOf(r.opponentId)
                  const total = r.playerWins + r.opponentWins
                  const share = total === 0 ? 0.5 : r.playerWins / total
                  return (
                    <li key={r.opponentId}>
                      <Link to={`/players/${r.opponentId}`} className="h2h-row" style={{ '--o': oppColor } as CSSProperties}>
                        <Avatar name={nameOf(r.opponentId)} color={oppColor} size={36} />
                        <span className="h2h-main">
                          <span className="h2h-top">
                            <strong>{nameOf(r.opponentId)}</strong>
                            <span className="h2h-score">{t.h2hWins(r.playerWins, r.opponentWins)}</span>
                          </span>
                          <span className="h2h-bar" aria-hidden="true">
                            <i style={{ width: `${share * 100}%` }} />
                          </span>
                          <span className="h2h-foot">
                            <span className="muted">{t.h2hTogether(r.gamesTogether)}</span>
                            <strong className={sign(r.playerNetCents)}>{formatCents(r.playerNetCents)}</strong>
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {view.moneyRivals.length > 0 && (
            <MoneyRivals rows={view.moneyRivals} colorOf={colorOf} nameOf={nameOf} />
          )}

          <section aria-label={t.historyTitle} className="stack">
            <h2 className="section-title">{t.historyTitle}</h2>
            <ul className="stack game-history">
              {[...view.results].reverse().map((r) => {
                const stored = view.storedOf.get(r.gameId)
                return (
                  <li key={r.gameId}>
                    <Link to={`/game/${r.gameId}/settlement`} className={`card game-row${r.won ? ' won' : ''}`}>
                      <span className={`pos-badge${medalClass(r.position)}`}>{t.position(r.position)}</span>
                      <span className="card-text">
                        <strong>
                          {t.inGame(r.index)}
                          {stored && <span className="muted"> · {new Date(stored.createdAt).toLocaleDateString('es-ES', dateFmt)}</span>}
                        </strong>
                        <span className="muted">
                          {r.won ? `${t.winner} · ` : r.tied ? `${t.positionTied(r.position)} · ` : ''}
                          {t.points(r.points)} · {t.rounds(r.rounds)}
                        </span>
                      </span>
                      <strong className={sign(r.netCents)}>{formatCents(r.netCents)}</strong>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
