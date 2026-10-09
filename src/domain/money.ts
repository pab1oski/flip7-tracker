import {
  finalWinners,
  isGameOver,
  pointsOf,
  roundWinners,
  totalPoints,
  type PlayerId,
  type Round,
  type Scores,
} from './scoring'

/** All money values are integer cents. */
export type Cents = number

export function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of cents, got ${value}`)
  }
}

/**
 * Splits `total` cents equally among `recipients`. The indivisible remainder
 * goes, one cent each, to the first recipients in the given order.
 * Sum of the result is always exactly `total`.
 */
export function splitEqually(total: Cents, recipients: readonly PlayerId[]): Record<PlayerId, Cents> {
  assertCents(total, 'total')
  if (recipients.length === 0) {
    if (total !== 0) throw new RangeError('cannot split a non-zero amount among nobody')
    return {}
  }
  const base = Math.floor(total / recipients.length)
  const remainder = total - base * recipients.length
  const result: Record<PlayerId, Cents> = {}
  recipients.forEach((id, index) => {
    result[id] = base + (index < remainder ? 1 : 0)
  })
  return result
}

/** Default percentage of each round's pool that goes to the round winner(s). */
export const DEFAULT_WINNER_SHARE_PCT = 50

export function isValidWinnerSharePct(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
}

export function assertWinnerSharePct(value: number): void {
  if (!isValidWinnerSharePct(value)) {
    throw new RangeError(`winnerSharePct must be an integer between 0 and 100, got ${value}`)
  }
}

/** Defensive read of a stored setting: anything missing or invalid falls back to the default. */
export function normalizeWinnerSharePct(value: unknown): number {
  return isValidWinnerSharePct(value) ? value : DEFAULT_WINNER_SHARE_PCT
}

export interface PoolSplit {
  /** Part of the pool for the round winner(s): floor(pool * pct / 100). */
  winnersPool: Cents
  /** The rest goes to the common pot (it takes any rounding cent). */
  potShare: Cents
}

/** Splits a round pool between the round winner(s) and the pot. Sum is always exactly `pool`. */
export function splitPool(pool: Cents, winnerSharePct: number = DEFAULT_WINNER_SHARE_PCT): PoolSplit {
  assertCents(pool, 'pool')
  assertWinnerSharePct(winnerSharePct)
  const winnersPool = Math.floor((pool * winnerSharePct) / 100)
  return { winnersPool, potShare: pool - winnersPool }
}

export interface RoundMoney {
  winners: PlayerId[]
  /** Total staked this round (N * stake). */
  pool: Cents
  /** Winners' part of the pool (rounded down), split among the round winners. */
  winnersPool: Cents
  /** The rest of the pool (the pot takes any rounding cent). */
  potShare: Cents
  /** Gross amount each player receives (0 for non-winners). */
  payouts: Record<PlayerId, Cents>
  /** Net per player: payout minus stake. Sum of nets is `-potShare`. */
  nets: Record<PlayerId, Cents>
}

export function roundMoney(
  playerIds: readonly PlayerId[],
  scores: Scores,
  stake: Cents,
  winnerSharePct: number = DEFAULT_WINNER_SHARE_PCT,
): RoundMoney {
  assertCents(stake, 'stake')
  const winners = roundWinners(playerIds, scores)
  const pool = stake * playerIds.length
  const { winnersPool, potShare } = splitPool(pool, winnerSharePct)
  const split = splitEqually(winnersPool, winners)
  const payouts: Record<PlayerId, Cents> = {}
  const nets: Record<PlayerId, Cents> = {}
  for (const id of playerIds) {
    payouts[id] = split[id] ?? 0
    nets[id] = payouts[id] - stake
  }
  return { winners, pool, winnersPool, potShare, payouts, nets }
}

export interface BalancePoint {
  /** 1-based round number; for the final pot payout point it is the last round number. */
  round: number
  kind: 'round' | 'payout'
  /** Cumulative net balance per player at this point. */
  balances: Record<PlayerId, Cents>
}

export interface GameMoneyInput {
  playerIds: readonly PlayerId[]
  rounds: readonly Round[]
  stakeCents: Cents
  limit: number
  /** Percentage (0..100) of each round's pool for the round winner(s); the pot gets the rest. Defaults to 50. */
  winnerSharePct?: number
}

export interface GameMoney {
  totals: Record<PlayerId, number>
  finished: boolean
  /** Final winners (highest total); empty while the game is not finished. */
  finalWinners: PlayerId[]
  /** Pot accumulated over all rounds. */
  pot: Cents
  /** What each final winner takes from the pot (empty while not finished). */
  potPayouts: Record<PlayerId, Cents>
  /** Total each player staked (rounds * stake). */
  paid: Record<PlayerId, Cents>
  /** Gross amount each player received (round shares + pot payout). */
  received: Record<PlayerId, Cents>
  /** Net balance per player: received - paid. Sums to 0 once the game is finished. */
  balances: Record<PlayerId, Cents>
  /** Per-round nets (excluding pot payout). */
  roundNets: Record<PlayerId, Cents>[]
  /** Balances after each round, plus a final point after the pot payout when finished. */
  series: BalancePoint[]
}

function zeroed(playerIds: readonly PlayerId[]): Record<PlayerId, Cents> {
  const result: Record<PlayerId, Cents> = {}
  for (const id of playerIds) result[id] = 0
  return result
}

export function computeGameMoney(input: GameMoneyInput): GameMoney {
  const { playerIds, rounds, stakeCents, limit } = input
  const winnerSharePct = input.winnerSharePct ?? DEFAULT_WINNER_SHARE_PCT
  assertCents(stakeCents, 'stakeCents')
  assertWinnerSharePct(winnerSharePct)
  for (const round of rounds) {
    for (const id of playerIds) {
      const points = pointsOf(round.scores, id)
      if (!Number.isFinite(points) || points < 0) throw new RangeError(`invalid points for ${id}: ${points}`)
    }
  }

  const totals = totalPoints(playerIds, rounds)
  const finished = isGameOver(totals, limit)

  const paid = zeroed(playerIds)
  const received = zeroed(playerIds)
  const balances = zeroed(playerIds)
  const roundNets: Record<PlayerId, Cents>[] = []
  const series: BalancePoint[] = []
  let pot: Cents = 0

  rounds.forEach((round, index) => {
    const money = roundMoney(playerIds, round.scores, stakeCents, winnerSharePct)
    pot += money.potShare
    roundNets.push(money.nets)
    for (const id of playerIds) {
      paid[id] += stakeCents
      received[id] += money.payouts[id]
      balances[id] += money.nets[id]
    }
    series.push({ round: index + 1, kind: 'round', balances: { ...balances } })
  })

  const winners = finished ? finalWinners(playerIds, totals) : []
  const potPayouts = finished ? splitEqually(pot, winners) : {}
  if (finished) {
    for (const id of winners) {
      received[id] += potPayouts[id]
      balances[id] += potPayouts[id]
    }
    series.push({ round: rounds.length, kind: 'payout', balances: { ...balances } })
  }

  return { totals, finished, finalWinners: winners, pot, potPayouts, paid, received, balances, roundNets, series }
}
