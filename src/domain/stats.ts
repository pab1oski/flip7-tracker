import { computeGameMoney, type Cents } from './money'
import { roundWinners, totalPoints, pointsOf, type PlayerId, type Round } from './scoring'

export interface GameRecord {
  id: string
  /** Players in seat order. */
  playerIds: readonly PlayerId[]
  rounds: readonly Round[]
  stakeCents: Cents
  limit: number
  /** Percentage (0..100) of each round's pool for the round winner(s). */
  winnerSharePct: number
}

export interface BalanceByGamePoint {
  gameId: string
  /** Net balance of that single game. */
  gameNetCents: Cents
  /** Cumulative net balance up to and including this game. */
  cumulativeCents: Cents
}

export interface PlayerStats {
  playerId: PlayerId
  gamesPlayed: number
  gamesWon: number
  roundsPlayed: number
  roundsWon: number
  totalPoints: number
  /** Average points per round, 0 when no rounds were played. */
  averagePointsPerRound: number
  /** Rounds with 0 points. */
  busts: number
  /** Highest points in a single round (0 when no rounds were played). */
  bestRound: number
  netCents: Cents
  balanceByGame: BalanceByGamePoint[]
}

function emptyStats(playerId: PlayerId): PlayerStats {
  return {
    playerId,
    gamesPlayed: 0,
    gamesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    totalPoints: 0,
    averagePointsPerRound: 0,
    busts: 0,
    bestRound: 0,
    netCents: 0,
    balanceByGame: [],
  }
}

/**
 * Per-player statistics over finished games only (unfinished games are skipped).
 * Games must be given in chronological order; that order drives `balanceByGame`.
 */
export function computePlayerStats(games: readonly GameRecord[]): Record<PlayerId, PlayerStats> {
  const stats: Record<PlayerId, PlayerStats> = {}

  for (const game of games) {
    const money = computeGameMoney(game)
    if (!money.finished) continue
    const totals = totalPoints(game.playerIds, game.rounds)

    for (const id of game.playerIds) {
      const s = (stats[id] ??= emptyStats(id))
      s.gamesPlayed += 1
      if (money.finalWinners.includes(id)) s.gamesWon += 1
      s.totalPoints += totals[id]
      s.netCents += money.balances[id]
      s.balanceByGame.push({
        gameId: game.id,
        gameNetCents: money.balances[id],
        cumulativeCents: s.netCents,
      })
      for (const round of game.rounds) {
        const points = pointsOf(round.scores, id)
        s.roundsPlayed += 1
        if (points === 0) s.busts += 1
        if (points > s.bestRound) s.bestRound = points
        if (roundWinners(game.playerIds, round.scores).includes(id)) s.roundsWon += 1
      }
    }
  }

  for (const s of Object.values(stats)) {
    s.averagePointsPerRound = s.roundsPlayed === 0 ? 0 : s.totalPoints / s.roundsPlayed
  }
  return stats
}

export interface CumulativeRow {
  /** 1-based game number in chronological order (0 is the starting point). */
  game: number
  gameId: string | null
  /** Cumulative net cents per player id; players who have not played yet stay at 0. */
  balances: Record<PlayerId, Cents>
}

/**
 * Cumulative balance across games for the given players, one row per finished
 * game (plus a leading zero row). Players absent from a game carry their balance forward.
 */
export function cumulativeSeries(
  games: readonly GameRecord[],
  playerIds: readonly PlayerId[],
): CumulativeRow[] {
  const running: Record<PlayerId, Cents> = Object.fromEntries(playerIds.map((id) => [id, 0]))
  const rows: CumulativeRow[] = [{ game: 0, gameId: null, balances: { ...running } }]
  for (const game of games) {
    const money = computeGameMoney(game)
    if (!money.finished) continue
    for (const id of game.playerIds) {
      if (id in running) running[id] += money.balances[id]
    }
    rows.push({ game: rows.length, gameId: game.id, balances: { ...running } })
  }
  return rows
}
