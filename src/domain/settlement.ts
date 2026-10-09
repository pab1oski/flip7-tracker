import type { Cents, GameMoney } from './money'
import type { PlayerId } from './scoring'

export type SettlementMode = 'real' | 'minimal'

export interface Transfer {
  from: PlayerId
  to: PlayerId
  cents: Cents
}

/** Applies transfers to balances; every balance is 0 when the settlement is complete. */
export function applyTransfers(
  balances: Record<PlayerId, Cents>,
  transfers: readonly Transfer[],
): Record<PlayerId, Cents> {
  const result = { ...balances }
  for (const t of transfers) {
    result[t.from] += t.cents
    result[t.to] -= t.cents
  }
  return result
}

/**
 * Minimal settlement: greedy matching of the largest debtor with the largest
 * creditor until everybody is at 0. Ties are broken by player order.
 */
export function settleMinimal(
  playerIds: readonly PlayerId[],
  balances: Record<PlayerId, Cents>,
): Transfer[] {
  const sum = playerIds.reduce((acc, id) => acc + (balances[id] ?? 0), 0)
  if (sum !== 0) throw new RangeError(`balances must sum to 0, got ${sum}`)

  const order = new Map(playerIds.map((id, i) => [id, i]))
  const byAmountDesc = (a: { id: PlayerId; amount: Cents }, b: { id: PlayerId; amount: Cents }) =>
    b.amount - a.amount || order.get(a.id)! - order.get(b.id)!

  const debtors = playerIds
    .filter((id) => balances[id] < 0)
    .map((id) => ({ id, amount: -balances[id] }))
  const creditors = playerIds
    .filter((id) => balances[id] > 0)
    .map((id) => ({ id, amount: balances[id] }))

  const transfers: Transfer[] = []
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmountDesc)
    creditors.sort(byAmountDesc)
    const debtor = debtors[0]
    const creditor = creditors[0]
    const cents = Math.min(debtor.amount, creditor.amount)
    transfers.push({ from: debtor.id, to: creditor.id, cents })
    debtor.amount -= cents
    creditor.amount -= cents
    if (debtor.amount === 0) debtors.shift()
    if (creditor.amount === 0) creditors.shift()
  }
  return transfers
}

/**
 * Pairwise debts matrix: debts[payer][recipient] = cents `payer` owes `recipient`
 * (the diagonal is the recipient's own share and cancels out).
 *
 * In exact arithmetic every player owes each recipient `received / N`, which is
 * what the per-round rule aggregates to for any winner/pot split `w`%: each
 * player owes `s*w/100/k` to each of the k round winners and `s*(100-w)/100/m`
 * to each of the m final pot winners. In cents, each recipient's total is split equally; the
 * remainder cents go to the payers who have paid least so far (ties by player
 * order), which keeps every payer's total at exactly what they staked.
 */
export function pairwiseDebts(
  playerIds: readonly PlayerId[],
  received: Record<PlayerId, Cents>,
): Record<PlayerId, Record<PlayerId, Cents>> {
  const n = playerIds.length
  const debts: Record<PlayerId, Record<PlayerId, Cents>> = {}
  const rowSum: Record<PlayerId, Cents> = {}
  for (const payer of playerIds) {
    debts[payer] = {}
    rowSum[payer] = 0
  }
  for (const recipient of playerIds) {
    const amount = received[recipient] ?? 0
    const base = Math.floor(amount / n)
    const remainder = amount - base * n
    const leastPaidFirst = [...playerIds]
      .map((id, index) => ({ id, index }))
      .sort((a, b) => rowSum[a.id] - rowSum[b.id] || a.index - b.index)
    const extra = new Set(leastPaidFirst.slice(0, remainder).map((p) => p.id))
    for (const payer of playerIds) {
      const cents = base + (extra.has(payer) ? 1 : 0)
      debts[payer][recipient] = cents
      rowSum[payer] += cents
    }
  }
  return debts
}

/**
 * Real settlement: pairwise debts aggregated over the whole game and netted per
 * pair. Requires a finished game (pot already paid out) so balances sum to 0.
 */
export function settleReal(playerIds: readonly PlayerId[], money: GameMoney): Transfer[] {
  if (!money.finished) throw new Error('cannot settle a game that is not finished')
  const debts = pairwiseDebts(playerIds, money.received)
  const transfers: Transfer[] = []
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const a = playerIds[i]
      const b = playerIds[j]
      const net = debts[a][b] - debts[b][a]
      if (net > 0) transfers.push({ from: a, to: b, cents: net })
      else if (net < 0) transfers.push({ from: b, to: a, cents: -net })
    }
  }
  return transfers
}

export function settle(
  mode: SettlementMode,
  playerIds: readonly PlayerId[],
  money: GameMoney,
): Transfer[] {
  return mode === 'real' ? settleReal(playerIds, money) : settleMinimal(playerIds, money.balances)
}
