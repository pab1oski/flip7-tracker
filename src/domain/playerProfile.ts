import { computeGameMoney, type Cents, type GameMoney } from './money'
import { pointsOf, roundWinners, type PlayerId } from './scoring'
import { settleReal } from './settlement'
import type { GameRecord, PlayerStats } from './stats'

interface FinishedGame {
  game: GameRecord
  money: GameMoney
}

/** Finished games only, in the given (chronological) order, with their money computed once. */
function finishedGames(games: readonly GameRecord[]): FinishedGame[] {
  const result: FinishedGame[] = []
  for (const game of games) {
    const money = computeGameMoney(game)
    if (money.finished) result.push({ game, money })
  }
  return result
}

/** Finished games the player took part in, chronological. */
function gamesOf(games: readonly GameRecord[], playerId: PlayerId): FinishedGame[] {
  return finishedGames(games).filter(({ game }) => game.playerIds.includes(playerId))
}

/**
 * Stable ordering of players for color assignment: order of first appearance in
 * the chronological list of games, then players who never played, by name.
 * Games are append-only, so existing players keep their slot.
 */
export function playerOrder(
  games: readonly GameRecord[],
  players: readonly { id: PlayerId; name: string }[],
): PlayerId[] {
  const known = new Set(players.map((p) => p.id))
  const order: PlayerId[] = []
  const seen = new Set<PlayerId>()
  for (const game of games) {
    for (const id of game.playerIds) {
      if (known.has(id) && !seen.has(id)) {
        seen.add(id)
        order.push(id)
      }
    }
  }
  const rest = players.filter((p) => !seen.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return [...order, ...rest.map((p) => p.id)]
}

export interface GameResult {
  gameId: string
  /** 1-based index among this player's finished games. */
  index: number
  playerCount: number
  rounds: number
  points: number
  /** Competition ranking by total points: 1 + number of players with strictly more points. */
  position: number
  /** True when another player has the same total points. */
  tied: boolean
  /** True when the player is among the final winners (ties share the win). */
  won: boolean
  roundsWon: number
  netCents: Cents
}

export function playerGameResults(games: readonly GameRecord[], playerId: PlayerId): GameResult[] {
  return gamesOf(games, playerId).map(({ game, money }, i) => {
    const points = money.totals[playerId]
    const others = game.playerIds.filter((id) => id !== playerId)
    return {
      gameId: game.id,
      index: i + 1,
      playerCount: game.playerIds.length,
      rounds: game.rounds.length,
      points,
      position: 1 + others.filter((id) => money.totals[id] > points).length,
      tied: others.some((id) => money.totals[id] === points),
      won: money.finalWinners.includes(playerId),
      roundsWon: game.rounds.filter((r) => roundWinners(game.playerIds, r.scores).includes(playerId)).length,
      netCents: money.balances[playerId],
    }
  })
}

export interface TimelinePoint {
  /** 0-based step over the whole timeline (0 is the starting point). */
  step: number
  /** 1-based index among the player's games (0 for the starting point). */
  game: number
  /** 1-based round within the game (0 for the starting point; last round for the payout). */
  round: number
  kind: 'start' | 'round' | 'payout'
  /** Cumulative net balance across all games up to this point. */
  balanceCents: Cents
}

/**
 * Round-by-round cumulative money of one player across their finished games,
 * including each game's final pot payout as its own point. Starts at a zero point.
 */
export function playerMoneyTimeline(games: readonly GameRecord[], playerId: PlayerId): TimelinePoint[] {
  const points: TimelinePoint[] = [{ step: 0, game: 0, round: 0, kind: 'start', balanceCents: 0 }]
  let offset: Cents = 0
  gamesOf(games, playerId).forEach(({ money }, i) => {
    for (const pt of money.series) {
      points.push({
        step: points.length,
        game: i + 1,
        round: pt.round,
        kind: pt.kind,
        balanceCents: offset + pt.balances[playerId],
      })
    }
    offset += money.balances[playerId]
  })
  return points
}

export interface HistogramBucket {
  min: number
  /** Inclusive upper bound; null means unbounded. */
  max: number | null
  count: number
}

const BUCKETS: readonly [number, number | null][] = [
  [0, 0],
  [1, 19],
  [20, 39],
  [40, 59],
  [60, 79],
  [80, null],
]

/** Distribution of the player's points per round: 0 (bust), 1-19, 20-39, 40-59, 60-79, 80+. */
export function pointsHistogram(games: readonly GameRecord[], playerId: PlayerId): HistogramBucket[] {
  const buckets = BUCKETS.map(([min, max]) => ({ min, max, count: 0 }))
  for (const { game } of gamesOf(games, playerId)) {
    for (const round of game.rounds) {
      const points = pointsOf(round.scores, playerId)
      const bucket = buckets.find((b) => points >= b.min && (b.max === null || points <= b.max))
      if (bucket) bucket.count += 1
    }
  }
  return buckets
}

/**
 * Longest run of consecutive rounds won (ties count as wins) over the player's
 * finished games in chronological order; the run continues across games.
 */
export function longestRoundWinStreak(games: readonly GameRecord[], playerId: PlayerId): number {
  let best = 0
  let current = 0
  for (const { game } of gamesOf(games, playerId)) {
    for (const round of game.rounds) {
      if (roundWinners(game.playerIds, round.scores).includes(playerId)) {
        current += 1
        if (current > best) best = current
      } else {
        current = 0
      }
    }
  }
  return best
}

/** Game with the highest and the lowest net; the earliest wins on ties. Null when there are no games. */
export function bestAndWorstGame(results: readonly GameResult[]): { best: GameResult | null; worst: GameResult | null } {
  let best: GameResult | null = null
  let worst: GameResult | null = null
  for (const r of results) {
    if (!best || r.netCents > best.netCents) best = r
    if (!worst || r.netCents < worst.netCents) worst = r
  }
  return { best, worst }
}

export interface HeadToHead {
  opponentId: PlayerId
  gamesTogether: number
  /** Shared games the player won (a shared win counts for both). */
  playerWins: number
  /** Shared games the opponent won. */
  opponentWins: number
  /** Player's total net over the shared games. */
  playerNetCents: Cents
  /** Opponent's total net over the shared games. */
  opponentNetCents: Cents
}

/** Record against every opponent the player shared a finished game with, most games together first. */
export function headToHead(games: readonly GameRecord[], playerId: PlayerId): HeadToHead[] {
  const rows = new Map<PlayerId, HeadToHead>()
  for (const { game, money } of gamesOf(games, playerId)) {
    const playerWon = money.finalWinners.includes(playerId)
    for (const id of game.playerIds) {
      if (id === playerId) continue
      let row = rows.get(id)
      if (!row) {
        row = { opponentId: id, gamesTogether: 0, playerWins: 0, opponentWins: 0, playerNetCents: 0, opponentNetCents: 0 }
        rows.set(id, row)
      }
      row.gamesTogether += 1
      if (playerWon) row.playerWins += 1
      if (money.finalWinners.includes(id)) row.opponentWins += 1
      row.playerNetCents += money.balances[playerId]
      row.opponentNetCents += money.balances[id]
    }
  }
  return [...rows.values()].sort((a, b) => b.gamesTogether - a.gamesTogether || b.playerWins - a.playerWins)
}

export interface LeaderboardEntry {
  playerId: PlayerId
  /** Competition ranking by net balance: equal nets share the rank. */
  rank: number
  netCents: Cents
  gamesPlayed: number
  gamesWon: number
}

/**
 * Players with at least one finished game, sorted by net balance (desc).
 * Equal nets share a rank; within a tie, more games won comes first.
 */
export function leaderboard(stats: Readonly<Record<PlayerId, PlayerStats>>): LeaderboardEntry[] {
  const sorted = Object.values(stats)
    .filter((s) => s.gamesPlayed > 0)
    .sort((a, b) => b.netCents - a.netCents || b.gamesWon - a.gamesWon || a.playerId.localeCompare(b.playerId))
  return sorted.map((s) => ({
    playerId: s.playerId,
    rank: 1 + sorted.filter((o) => o.netCents > s.netCents).length,
    netCents: s.netCents,
    gamesPlayed: s.gamesPlayed,
    gamesWon: s.gamesWon,
  }))
}

export interface MoneyHeadToHead {
  opponentId: PlayerId
  gamesTogether: number
  /**
   * Net money between the player and this opponent under the real (pairwise)
   * settlement, summed over shared finished games: positive means the opponent
   * paid the player, negative means the player paid the opponent.
   */
  netCents: Cents
}

/**
 * Money won or lost against every opponent, from the real pairwise settlement of
 * each shared finished game. Sorted from the biggest loss to the biggest win;
 * ties by more games together, then by opponent id.
 */
export function moneyHeadToHead(games: readonly GameRecord[], playerId: PlayerId): MoneyHeadToHead[] {
  const rows = new Map<PlayerId, MoneyHeadToHead>()
  for (const { game, money } of gamesOf(games, playerId)) {
    for (const id of game.playerIds) {
      if (id === playerId) continue
      const row = rows.get(id) ?? { opponentId: id, gamesTogether: 0, netCents: 0 }
      row.gamesTogether += 1
      rows.set(id, row)
    }
    for (const t of settleReal(game.playerIds, money)) {
      if (t.to === playerId) rows.get(t.from)!.netCents += t.cents
      else if (t.from === playerId) rows.get(t.to)!.netCents -= t.cents
    }
  }
  return [...rows.values()].sort(
    (a, b) => a.netCents - b.netCents || b.gamesTogether - a.gamesTogether || a.opponentId.localeCompare(b.opponentId),
  )
}
