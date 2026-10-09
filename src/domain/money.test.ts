import { describe, expect, it } from 'vitest'
import {
  computeGameMoney,
  DEFAULT_WINNER_SHARE_PCT,
  normalizeWinnerSharePct,
  roundMoney,
  splitEqually,
  splitPool,
} from './money'

const P = ['a', 'b', 'c']
const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0)

describe('splitEqually', () => {
  it('splits evenly', () => {
    expect(splitEqually(150, ['a', 'b'])).toEqual({ a: 75, b: 75 })
  })
  it('gives remainder cents to the first recipients', () => {
    expect(splitEqually(100, ['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 })
    expect(splitEqually(101, ['a', 'b', 'c'])).toEqual({ a: 34, b: 34, c: 33 })
  })
  it('handles zero and empty recipients', () => {
    expect(splitEqually(0, [])).toEqual({})
    expect(() => splitEqually(5, [])).toThrow(RangeError)
  })
  it('rejects non-integer or negative cents', () => {
    expect(() => splitEqually(1.5, ['a'])).toThrow(RangeError)
    expect(() => splitEqually(-1, ['a'])).toThrow(RangeError)
  })
})

describe('roundMoney', () => {
  it('3 players, 1 EUR: winner gets 150 cents and pot 150', () => {
    const m = roundMoney(P, { a: 40, b: 10, c: 0 }, 100)
    expect(m.pool).toBe(300)
    expect(m.payouts).toEqual({ a: 150, b: 0, c: 0 })
    expect(m.potShare).toBe(150)
    expect(m.nets).toEqual({ a: 50, b: -100, c: -100 })
  })
  it('tie of two splits the winners half: 75 each, pot 150', () => {
    const m = roundMoney(P, { a: 40, b: 40, c: 0 }, 100)
    expect(m.payouts).toEqual({ a: 75, b: 75, c: 0 })
    expect(m.potShare).toBe(150)
  })
  it('three-way tie: 50 each', () => {
    const m = roundMoney(P, { a: 7, b: 7, c: 7 }, 100)
    expect(m.payouts).toEqual({ a: 50, b: 50, c: 50 })
  })
  it('odd pool: pot gets the odd cent, remainder of the winners half goes to first tied player', () => {
    // pool 3*101 = 303 -> winners 151, pot 152
    const single = roundMoney(P, { a: 1, b: 0, c: 0 }, 101)
    expect(single.winnersPool).toBe(151)
    expect(single.potShare).toBe(152)
    // 4 players stake 1 cent... pool 5*1=5 -> winners 2 pot 3; tie of 2 => 1 each
    const five = roundMoney(['a', 'b', 'c', 'd', 'e'], { a: 3, b: 3 }, 1)
    expect(five.payouts).toEqual({ a: 1, b: 1, c: 0, d: 0, e: 0 })
    // tie of 3 on winnersPool 2 => remainder to first two
    const tie3 = roundMoney(['a', 'b', 'c', 'd', 'e'], { a: 3, b: 3, c: 3 }, 1)
    expect(tie3.payouts).toEqual({ a: 1, b: 1, c: 0, d: 0, e: 0 })
  })
  it('conserves money: nets + pot share = 0', () => {
    const m = roundMoney(P, { a: 9, b: 9, c: 1 }, 333)
    expect(sum(m.nets) + m.potShare).toBe(0)
  })
  it('rejects fractional stakes', () => {
    expect(() => roundMoney(P, {}, 0.5)).toThrow(RangeError)
  })
})

describe('computeGameMoney', () => {
  const rounds = [
    { scores: { a: 60, b: 20, c: 0 } },
    { scores: { a: 10, b: 70, c: 30 } },
    { scores: { a: 150, b: 40, c: 40 } },
  ]
  const game = computeGameMoney({ playerIds: P, rounds, stakeCents: 100, limit: 200 })

  it('detects the end and the final winner', () => {
    expect(game.totals).toEqual({ a: 220, b: 130, c: 70 })
    expect(game.finished).toBe(true)
    expect(game.finalWinners).toEqual(['a'])
  })
  it('accumulates the pot (150 per round) and pays it to the winner', () => {
    expect(game.pot).toBe(450)
    expect(game.potPayouts).toEqual({ a: 450 })
  })
  it('balances sum to exactly 0 and money is conserved', () => {
    expect(sum(game.balances)).toBe(0)
    expect(sum(game.received)).toBe(sum(game.paid))
    // a: wins rounds 1 and 3 (+150 each) -> 300 + pot 450 - 300 staked = 450
    expect(game.balances).toEqual({ a: 450, b: 150 - 300, c: -300 })
  })
  it('builds a series with one point per round plus a payout point', () => {
    expect(game.series).toHaveLength(4)
    expect(game.series.map((p) => p.kind)).toEqual(['round', 'round', 'round', 'payout'])
    expect(game.series[0].balances).toEqual({ a: 50, b: -100, c: -100 })
    // before the pot payout the balances sum to -pot
    expect(sum(game.series[2].balances)).toBe(-450)
    expect(game.series[3].balances).toEqual(game.balances)
    expect(sum(game.series[3].balances)).toBe(0)
  })
  it('final tie splits the pot with deterministic remainder', () => {
    const g = computeGameMoney({
      playerIds: P,
      rounds: [{ scores: { a: 100, b: 100, c: 0 } }],
      stakeCents: 101,
      limit: 100,
    })
    expect(g.finalWinners).toEqual(['a', 'b'])
    // pool 303: winners 151 (a 76, b 75), pot 152 split 76/76
    expect(g.potPayouts).toEqual({ a: 76, b: 76 })
    expect(g.balances).toEqual({ a: 76 + 76 - 101, b: 75 + 76 - 101, c: -101 })
    expect(sum(g.balances)).toBe(0)
  })
  it('unfinished game keeps the pot unpaid', () => {
    const g = computeGameMoney({ playerIds: P, rounds: rounds.slice(0, 1), stakeCents: 100, limit: 200 })
    expect(g.finished).toBe(false)
    expect(g.finalWinners).toEqual([])
    expect(g.pot).toBe(150)
    expect(sum(g.balances)).toBe(-150)
    expect(g.series).toHaveLength(1)
  })
  it('empty game', () => {
    const g = computeGameMoney({ playerIds: P, rounds: [], stakeCents: 100, limit: 200 })
    expect(g.finished).toBe(false)
    expect(g.series).toEqual([])
    expect(g.pot).toBe(0)
  })
  it('rejects negative points', () => {
    expect(() =>
      computeGameMoney({ playerIds: P, rounds: [{ scores: { a: -1 } }], stakeCents: 100, limit: 200 }),
    ).toThrow(RangeError)
  })
})

describe('splitPool (configurable winner / pot split)', () => {
  it('defaults to 50/50 with the odd cent going to the pot', () => {
    expect(DEFAULT_WINNER_SHARE_PCT).toBe(50)
    expect(splitPool(300)).toEqual({ winnersPool: 150, potShare: 150 })
    expect(splitPool(301)).toEqual({ winnersPool: 150, potShare: 151 })
  })
  it.each([
    [60, 180, 120],
    [70, 210, 90],
    [100, 300, 0],
    [0, 0, 300],
  ])('%i%% to the winner of a 300-cent pool', (pct, winners, pot) => {
    expect(splitPool(300, pct)).toEqual({ winnersPool: winners, potShare: pot })
  })
  it('rounds the winners part down so the pot takes the odd cents', () => {
    // 3 * 101 = 303; 60% = 181.8 -> 181 to the winners, 122 to the pot
    expect(splitPool(303, 60)).toEqual({ winnersPool: 181, potShare: 122 })
    expect(splitPool(303, 70)).toEqual({ winnersPool: 212, potShare: 91 })
  })
  it('always conserves the pool exactly', () => {
    for (let pct = 0; pct <= 100; pct += 5) {
      for (const pool of [0, 1, 7, 99, 303, 1001, 123457]) {
        const { winnersPool, potShare } = splitPool(pool, pct)
        expect(winnersPool + potShare).toBe(pool)
        expect(winnersPool).toBeGreaterThanOrEqual(0)
        expect(potShare).toBeGreaterThanOrEqual(0)
      }
    }
  })
  it('rejects percentages outside 0..100 or non-integers', () => {
    expect(() => splitPool(300, -5)).toThrow(RangeError)
    expect(() => splitPool(300, 101)).toThrow(RangeError)
    expect(() => splitPool(300, 50.5)).toThrow(RangeError)
    expect(() => splitPool(300, Number.NaN)).toThrow(RangeError)
  })
  it('normalizes missing or invalid stored values to 50', () => {
    expect(normalizeWinnerSharePct(undefined)).toBe(50)
    expect(normalizeWinnerSharePct(null)).toBe(50)
    expect(normalizeWinnerSharePct(150)).toBe(50)
    expect(normalizeWinnerSharePct('60')).toBe(50)
    expect(normalizeWinnerSharePct(60)).toBe(60)
    expect(normalizeWinnerSharePct(0)).toBe(0)
    expect(normalizeWinnerSharePct(100)).toBe(100)
  })
})

describe('roundMoney with a non-50 split', () => {
  it('60/40, 3 players, 1 EUR: winner 180, pot 120', () => {
    const m = roundMoney(P, { a: 40, b: 10, c: 0 }, 100, 60)
    expect(m.winnersPool).toBe(180)
    expect(m.potShare).toBe(120)
    expect(m.payouts).toEqual({ a: 180, b: 0, c: 0 })
    expect(m.nets).toEqual({ a: 80, b: -100, c: -100 })
  })
  it('70/30 tie with odd cents gives the remainder to the first tied player', () => {
    // pool 303, winners 212 -> 106 each; pot 91
    const m = roundMoney(P, { a: 40, b: 0, c: 40 }, 101, 70)
    expect(m.payouts).toEqual({ a: 106, b: 0, c: 106 })
    expect(m.potShare).toBe(91)
    // 60/40: winners 181 -> 91 + 90
    const m2 = roundMoney(P, { a: 40, b: 0, c: 40 }, 101, 60)
    expect(m2.payouts).toEqual({ a: 91, b: 0, c: 90 })
    expect(m2.potShare).toBe(122)
  })
  it('100/0 sends nothing to the pot, 0/100 everything', () => {
    expect(roundMoney(P, { a: 1 }, 100, 100)).toMatchObject({ potShare: 0, payouts: { a: 300, b: 0, c: 0 } })
    expect(roundMoney(P, { a: 1 }, 100, 0)).toMatchObject({ potShare: 300, payouts: { a: 0, b: 0, c: 0 } })
  })
  it('conserves the pool: payouts + pot = pool', () => {
    for (let pct = 0; pct <= 100; pct += 5) {
      const m = roundMoney(['a', 'b', 'c', 'd'], { a: 9, b: 9, c: 9, d: 0 }, 77, pct)
      expect(sum(m.payouts) + m.potShare).toBe(m.pool)
      expect(sum(m.nets) + m.potShare).toBe(0)
    }
  })
})

describe('computeGameMoney with a configurable split', () => {
  // a wins round 1, b wins round 2, a reaches the limit and takes the pot.
  const rounds = [{ scores: { a: 60, b: 0, c: 20 } }, { scores: { a: 0, b: 50, c: 0 } }]
  const game = (winnerSharePct: number) =>
    computeGameMoney({ playerIds: P, rounds, stakeCents: 100, limit: 50, winnerSharePct })

  it('defaults to 50 when the split is omitted', () => {
    const omitted = computeGameMoney({ playerIds: P, rounds, stakeCents: 100, limit: 50 })
    expect(omitted).toEqual(game(50))
  })
  it('60/40', () => {
    const g = game(60)
    expect(g.pot).toBe(240)
    expect(g.potPayouts).toEqual({ a: 240 })
    expect(g.balances).toEqual({ a: 220, b: -20, c: -200 })
  })
  it('70/30', () => {
    const g = game(70)
    expect(g.pot).toBe(180)
    expect(g.balances).toEqual({ a: 190, b: 10, c: -200 })
  })
  it('100/0: the pot stays empty and its final payout is 0', () => {
    const g = game(100)
    expect(g.pot).toBe(0)
    expect(g.potPayouts).toEqual({ a: 0 })
    expect(g.balances).toEqual({ a: 100, b: 100, c: -200 })
    const last = g.series[g.series.length - 1]
    expect(last.kind).toBe('payout')
    expect(last.balances).toEqual(g.series[g.series.length - 2].balances)
  })
  it('0/100: everything goes to the pot winner', () => {
    const g = game(0)
    expect(g.pot).toBe(600)
    expect(g.roundNets).toEqual([
      { a: -100, b: -100, c: -100 },
      { a: -100, b: -100, c: -100 },
    ])
    expect(g.balances).toEqual({ a: 400, b: -200, c: -200 })
  })
  it('splits the pot among tied final winners with odd cents', () => {
    // 60/40, stake 101: pool 303 -> pot 122 per round; a and b tie on the final total.
    const g = computeGameMoney({
      playerIds: P,
      rounds: [{ scores: { a: 50, b: 50, c: 0 } }],
      stakeCents: 101,
      limit: 50,
      winnerSharePct: 60,
    })
    expect(g.finalWinners).toEqual(['a', 'b'])
    expect(g.pot).toBe(122)
    expect(g.potPayouts).toEqual({ a: 61, b: 61 })
    expect(g.received).toEqual({ a: 91 + 61, b: 90 + 61, c: 0 })
    expect(sum(g.balances)).toBe(0)
  })
  it('conserves money for every split once finished', () => {
    for (let pct = 0; pct <= 100; pct += 5) {
      const g = computeGameMoney({
        playerIds: ['a', 'b', 'c', 'd'],
        rounds: [
          { scores: { a: 10, b: 10, c: 3, d: 0 } },
          { scores: { a: 0, b: 7, c: 7, d: 7 } },
          { scores: { a: 40, b: 0, c: 0, d: 1 } },
        ],
        stakeCents: 133,
        limit: 50,
        winnerSharePct: pct,
      })
      expect(g.finished).toBe(true)
      expect(sum(g.balances)).toBe(0)
      expect(sum(g.received)).toBe(sum(g.paid))
    }
  })
  it('rejects an invalid split', () => {
    expect(() => computeGameMoney({ playerIds: P, rounds, stakeCents: 100, limit: 50, winnerSharePct: 101 })).toThrow(
      RangeError,
    )
  })
})
