import { describe, expect, it } from 'vitest'
import { computePlayerStats, cumulativeSeries, type GameRecord } from './stats'

const game1: GameRecord = {
  id: 'g1',
  playerIds: ['a', 'b', 'c'],
  stakeCents: 100,
  winnerSharePct: 50,
  limit: 100,
  rounds: [{ scores: { a: 60, b: 0, c: 20 } }, { scores: { a: 50, b: 30, c: 0 } }],
}
const game2: GameRecord = {
  id: 'g2',
  playerIds: ['a', 'b', 'c'],
  stakeCents: 100,
  winnerSharePct: 50,
  limit: 100,
  rounds: [{ scores: { a: 0, b: 120, c: 40 } }],
}
const unfinished: GameRecord = { ...game1, id: 'g3', limit: 1000 }

describe('computePlayerStats', () => {
  const stats = computePlayerStats([game1, game2, unfinished])

  it('skips unfinished games', () => {
    expect(stats.a.gamesPlayed).toBe(2)
  })
  it('counts games, rounds, busts and best round', () => {
    expect(stats.a).toMatchObject({ gamesWon: 1, roundsPlayed: 3, roundsWon: 2, busts: 1, bestRound: 60, totalPoints: 110 })
    expect(stats.b).toMatchObject({ gamesWon: 1, roundsWon: 1, busts: 1, bestRound: 120 })
    expect(stats.c.gamesWon).toBe(0)
  })
  it('computes average points per round', () => {
    expect(stats.a.averagePointsPerRound).toBeCloseTo(110 / 3)
  })
  it('net money sums to 0 across players and balanceByGame is cumulative', () => {
    const total = stats.a.netCents + stats.b.netCents + stats.c.netCents
    expect(total).toBe(0)
    expect(stats.a.balanceByGame).toHaveLength(2)
    expect(stats.a.balanceByGame[1].cumulativeCents).toBe(stats.a.netCents)
    expect(stats.a.balanceByGame[0].cumulativeCents).toBe(stats.a.balanceByGame[0].gameNetCents)
  })
  it('returns an empty object for no games', () => {
    expect(computePlayerStats([])).toEqual({})
  })
})

describe('computePlayerStats with a non-50 split', () => {
  it('uses each game own split', () => {
    const rounds = [{ scores: { a: 60, b: 0, c: 20 } }, { scores: { a: 0, b: 50, c: 0 } }]
    const base: GameRecord = { id: 'x', playerIds: ['a', 'b', 'c'], stakeCents: 100, winnerSharePct: 50, limit: 50, rounds }
    const fifty = computePlayerStats([base])
    const seventy = computePlayerStats([{ ...base, winnerSharePct: 70 }])
    expect([fifty.a.netCents, fifty.b.netCents, fifty.c.netCents]).toEqual([250, -50, -200])
    expect([seventy.a.netCents, seventy.b.netCents, seventy.c.netCents]).toEqual([190, 10, -200])
  })
})

describe('cumulativeSeries', () => {
  it('starts at zero, skips unfinished games and ends at each net total', () => {
    const rows = cumulativeSeries([game1, unfinished, game2], ['a', 'b', 'c'])
    const stats = computePlayerStats([game1, game2])
    expect(rows).toHaveLength(3)
    expect(rows[0].balances).toEqual({ a: 0, b: 0, c: 0 })
    expect(rows.map((r) => r.gameId)).toEqual([null, 'g1', 'g2'])
    for (const id of ['a', 'b', 'c']) expect(rows[2].balances[id]).toBe(stats[id].netCents)
  })
  it('carries the balance forward for players absent from a game', () => {
    const solo: GameRecord = { ...game2, id: 'g4', playerIds: ['a', 'b'], rounds: [{ scores: { a: 100, b: 0 } }] }
    const rows = cumulativeSeries([game1, solo], ['a', 'b', 'c'])
    expect(rows[2].balances.c).toBe(rows[1].balances.c)
  })
  it('is empty-safe', () => {
    expect(cumulativeSeries([], ['a'])).toEqual([{ game: 0, gameId: null, balances: { a: 0 } }])
  })
})
