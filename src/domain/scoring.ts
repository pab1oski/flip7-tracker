export type PlayerId = string

/** Points per player for one round. A missing entry counts as 0 (bust). */
export type Scores = Record<PlayerId, number>

export interface Round {
  scores: Scores
}

export function pointsOf(scores: Scores, playerId: PlayerId): number {
  return scores[playerId] ?? 0
}

/** Players holding the highest value, in player order. Empty input gives an empty list. */
function topPlayers(playerIds: readonly PlayerId[], valueOf: (id: PlayerId) => number): PlayerId[] {
  if (playerIds.length === 0) return []
  const max = Math.max(...playerIds.map(valueOf))
  return playerIds.filter((id) => valueOf(id) === max)
}

/**
 * Round winners: everyone with the maximum points (ties share), in player order.
 * If everybody busts (all 0) everybody ties for the win.
 */
export function roundWinners(playerIds: readonly PlayerId[], scores: Scores): PlayerId[] {
  return topPlayers(playerIds, (id) => pointsOf(scores, id))
}

/** Accumulated points per player over the given rounds. */
export function totalPoints(playerIds: readonly PlayerId[], rounds: readonly Round[]): Record<PlayerId, number> {
  const totals: Record<PlayerId, number> = {}
  for (const id of playerIds) totals[id] = 0
  for (const round of rounds) {
    for (const id of playerIds) totals[id] += pointsOf(round.scores, id)
  }
  return totals
}

/** The game is over as soon as any total reaches or passes the limit. */
export function isGameOver(totals: Record<PlayerId, number>, limit: number): boolean {
  return Object.values(totals).some((t) => t >= limit)
}

/** Final winners: highest total points (ties share), in player order. */
export function finalWinners(playerIds: readonly PlayerId[], totals: Record<PlayerId, number>): PlayerId[] {
  return topPlayers(playerIds, (id) => totals[id] ?? 0)
}

/** Number of rounds each player won. */
export function roundsWonCount(playerIds: readonly PlayerId[], rounds: readonly Round[]): Record<PlayerId, number> {
  const wins: Record<PlayerId, number> = {}
  for (const id of playerIds) wins[id] = 0
  for (const round of rounds) {
    for (const id of roundWinners(playerIds, round.scores)) wins[id] += 1
  }
  return wins
}
