import { describe, expect, it } from 'vitest'
import { computeGameMoney, type GameMoney } from './money'
import type { PlayerId } from './scoring'
import { applyTransfers, pairwiseDebts, settle, settleMinimal, settleReal } from './settlement'

const P = ['a', 'b', 'c']
const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0)
const allZero = (r: Record<string, number>) => Object.values(r).every((v) => v === 0)

function finishedGame(
  playerIds: PlayerId[],
  stakeCents: number,
  rounds: Record<string, number>[],
  winnerSharePct?: number,
  limit = 1,
): GameMoney {
  const g = computeGameMoney({ playerIds, rounds: rounds.map((scores) => ({ scores })), stakeCents, limit, winnerSharePct })
  expect(g.finished).toBe(true)
  return g
}

describe('settleMinimal', () => {
  it('matches the largest debtor with the largest creditor', () => {
    const t = settleMinimal(P, { a: 300, b: -100, c: -200 })
    expect(t).toEqual([
      { from: 'c', to: 'a', cents: 200 },
      { from: 'b', to: 'a', cents: 100 },
    ])
  })
  it('uses at most N-1 transfers and settles everything', () => {
    const balances = { a: 500, b: -120, c: -380, d: 250, e: -250 }
    const t = settleMinimal(['a', 'b', 'c', 'd', 'e'], balances)
    expect(t.length).toBeLessThanOrEqual(4)
    expect(allZero(applyTransfers(balances, t))).toBe(true)
  })
  it('returns nothing when everybody is at 0', () => {
    expect(settleMinimal(P, { a: 0, b: 0, c: 0 })).toEqual([])
  })
  it('rejects balances that do not sum to 0', () => {
    expect(() => settleMinimal(P, { a: 10, b: 0, c: 0 })).toThrow(RangeError)
  })
  it('is deterministic on ties', () => {
    const t = settleMinimal(P, { a: -100, b: 50, c: 50 })
    expect(t).toEqual([
      { from: 'a', to: 'b', cents: 50 },
      { from: 'a', to: 'c', cents: 50 },
    ])
  })
})

describe('settleReal', () => {
  it('nets reciprocal debts per pair (a wins everything, 3 players, 1 EUR)', () => {
    const g = finishedGame(P, 100, [{ a: 10, b: 0, c: 0 }])
    // a received 150 + pot 150 = 300; paid 100 -> +200
    expect(g.balances).toEqual({ a: 200, b: -100, c: -100 })
    expect(settleReal(P, g)).toEqual([
      { from: 'b', to: 'a', cents: 100 },
      { from: 'c', to: 'a', cents: 100 },
    ])
  })
  it('keeps pairwise structure: b and c owe a, but b also won a round', () => {
    const g = finishedGame(P, 100, [{ a: 90, b: 0, c: 0 }, { a: 0, b: 80, c: 0 }, { a: 100, b: 0, c: 0 }])
    const transfers = settleReal(P, g)
    expect(allZero(applyTransfers(g.balances, transfers))).toBe(true)
    // real mode may use more transfers than minimal but never fewer than needed
    expect(transfers.length).toBeGreaterThanOrEqual(settleMinimal(P, g.balances).length)
    // no pair appears twice and nobody pays themselves
    const pairs = transfers.map((t) => [t.from, t.to].sort().join('|'))
    expect(new Set(pairs).size).toBe(pairs.length)
    expect(transfers.every((t) => t.from !== t.to && t.cents > 0)).toBe(true)
  })
  it('refuses unfinished games', () => {
    const g = computeGameMoney({ playerIds: P, rounds: [{ scores: { a: 5 } }], stakeCents: 100, limit: 200 })
    expect(() => settleReal(P, g)).toThrow()
  })
  it('pairwise debts give each payer exactly what they staked', () => {
    const g = finishedGame(['a', 'b', 'c', 'd'], 101, [{ a: 5, b: 5, c: 1, d: 0 }, { a: 0, b: 0, c: 9, d: 0 }])
    const debts = pairwiseDebts(['a', 'b', 'c', 'd'], g.received)
    for (const payer of ['a', 'b', 'c', 'd']) expect(sum(debts[payer])).toBe(g.paid[payer])
  })
})

describe('settlement with a non-50 split', () => {
  // a wins round 1, b wins round 2, a takes the pot.
  const rounds = [{ a: 60, b: 0, c: 20 }, { a: 0, b: 50, c: 0 }]

  it('60/40: each player owes 60 per won round and 40/m of each round to the pot winners', () => {
    const g = finishedGame(P, 100, rounds, 60, 50)
    // everyone owes a 60 (round 1) + 2 * 40 (pot) = 140 and b 60 (round 2)
    const debts = pairwiseDebts(P, g.received)
    for (const payer of P) {
      expect(debts[payer].a).toBe(140)
      expect(debts[payer].b).toBe(60)
      expect(debts[payer].c).toBe(0)
    }
    expect(settleReal(P, g)).toEqual([
      { from: 'b', to: 'a', cents: 80 },
      { from: 'c', to: 'a', cents: 140 },
      { from: 'c', to: 'b', cents: 60 },
    ])
  })

  it.each([60, 70, 100, 0])('%i%%: real and minimal settlements zero every balance', (pct) => {
    const g = finishedGame(P, 101, rounds, pct, 50)
    expect(sum(g.balances)).toBe(0)
    const debts = pairwiseDebts(P, g.received)
    for (const payer of P) expect(sum(debts[payer])).toBe(g.paid[payer])
    for (const mode of ['real', 'minimal'] as const) {
      expect(allZero(applyTransfers(g.balances, settle(mode, P, g)))).toBe(true)
    }
  })

  it('100/0 with no pot: settles only the round winnings', () => {
    const g = finishedGame(P, 100, rounds, 100, 50)
    expect(g.pot).toBe(0)
    expect(settleReal(P, g)).toEqual([
      { from: 'c', to: 'a', cents: 100 },
      { from: 'c', to: 'b', cents: 100 },
    ])
  })

  it('0/100 with ties on the final total: the pot is shared, odd cents included', () => {
    const g = finishedGame(P, 101, [{ a: 50, b: 50, c: 0 }], 0, 50)
    expect(g.potPayouts).toEqual({ a: 152, b: 151 })
    const transfers = settleReal(P, g)
    expect(allZero(applyTransfers(g.balances, transfers))).toBe(true)
    // c pays the tied winners; between them only a rounding cent may move.
    expect(transfers.filter((t) => t.from === 'c').reduce((acc, t) => acc + t.cents, 0)).toBe(101)
    expect(transfers.filter((t) => t.from !== 'c').every((t) => t.cents <= 1)).toBe(true)
  })
})

describe('settle (dispatcher) invariants', () => {
  it('both modes zero out the balances for many pseudo-random games', () => {
    let seed = 12345
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let iteration = 0; iteration < 300; iteration++) {
      const n = 2 + Math.floor(rand() * 5)
      const ids = Array.from({ length: n }, (_, i) => `p${i}`)
      const stake = 1 + Math.floor(rand() * 500)
      const roundCount = 1 + Math.floor(rand() * 8)
      const rounds = Array.from({ length: roundCount }, () => {
        const scores: Record<string, number> = {}
        for (const id of ids) scores[id] = rand() < 0.3 ? 0 : Math.floor(rand() * 4) * 10
        return { scores }
      })
      const winnerSharePct = 5 * Math.floor(rand() * 21)
      const g = computeGameMoney({ playerIds: ids, rounds, stakeCents: stake, limit: 1, winnerSharePct })
      if (!g.finished) continue // every player busted in every round
      expect(sum(g.balances)).toBe(0)
      const debts = pairwiseDebts(ids, g.received)
      for (const payer of ids) expect(sum(debts[payer])).toBe(g.paid[payer])
      expect(sum(g.received)).toBe(sum(g.paid))
      for (const mode of ['real', 'minimal'] as const) {
        const t = settle(mode, ids, g)
        expect(allZero(applyTransfers(g.balances, t))).toBe(true)
        expect(t.every((x) => Number.isInteger(x.cents) && x.cents > 0 && x.from !== x.to)).toBe(true)
      }
    }
  })
})
