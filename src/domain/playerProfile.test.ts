import { describe, expect, it } from 'vitest'
import {
  bestAndWorstGame,
  headToHead,
  leaderboard,
  longestRoundWinStreak,
  moneyHeadToHead,
  playerGameResults,
  playerMoneyTimeline,
  playerOrder,
  pointsHistogram,
} from './playerProfile'
import { computePlayerStats, type GameRecord, type PlayerStats } from './stats'

// game1: a wins both rounds and the 300 pot -> a +400, b -200, c -200.
const game1: GameRecord = {
  id: 'g1',
  playerIds: ['a', 'b', 'c'],
  stakeCents: 100,
  winnerSharePct: 50,
  limit: 100,
  rounds: [{ scores: { a: 60, b: 0, c: 20 } }, { scores: { a: 50, b: 30, c: 0 } }],
}
// game2: b wins the only round and the 150 pot -> a -100, b +200, c -100.
const game2: GameRecord = {
  id: 'g2',
  playerIds: ['a', 'b', 'c'],
  stakeCents: 100,
  winnerSharePct: 50,
  limit: 100,
  rounds: [{ scores: { a: 0, b: 120, c: 40 } }],
}
const unfinished: GameRecord = { ...game1, id: 'g3', limit: 1000 }
// tie: a and b share the round and the final win -> a +50, b +50, d -100.
const tie: GameRecord = {
  id: 'g4',
  playerIds: ['a', 'b', 'd'],
  stakeCents: 100,
  winnerSharePct: 50,
  limit: 100,
  rounds: [{ scores: { a: 100, b: 100, d: 10 } }],
}
const games = [game1, unfinished, game2]

describe('playerOrder', () => {
  it('orders by first appearance, then non-players by name', () => {
    const players = [
      { id: 'z', name: 'Zoe' },
      { id: 'c', name: 'C' },
      { id: 'y', name: 'Ana' },
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]
    expect(playerOrder([game1], players)).toEqual(['a', 'b', 'c', 'y', 'z'])
  })
  it('ignores ids not in the registry', () => {
    expect(playerOrder([game1], [{ id: 'b', name: 'B' }])).toEqual(['b'])
  })
})

describe('playerGameResults', () => {
  it('returns one row per finished game with position, points and net', () => {
    const results = playerGameResults(games, 'a')
    expect(results).toEqual([
      { gameId: 'g1', index: 1, playerCount: 3, rounds: 2, points: 110, position: 1, tied: false, won: true, roundsWon: 2, netCents: 400 },
      { gameId: 'g2', index: 2, playerCount: 3, rounds: 1, points: 0, position: 3, tied: false, won: false, roundsWon: 0, netCents: -100 },
    ])
  })
  it('shares the position on ties', () => {
    const [a] = playerGameResults([tie], 'a')
    const [b] = playerGameResults([tie], 'b')
    const [d] = playerGameResults([tie], 'd')
    expect(a).toMatchObject({ position: 1, tied: true, won: true })
    expect(b).toMatchObject({ position: 1, tied: true, won: true })
    expect(d).toMatchObject({ position: 3, tied: false, won: false })
  })
  it('is empty for a player with no games', () => {
    expect(playerGameResults(games, 'nobody')).toEqual([])
  })
})

describe('playerMoneyTimeline', () => {
  it('accumulates round by round across games including pot payouts', () => {
    const tl = playerMoneyTimeline(games, 'a')
    expect(tl.map((p) => p.balanceCents)).toEqual([0, 50, 100, 400, 300, 300])
    expect(tl.map((p) => p.kind)).toEqual(['start', 'round', 'round', 'payout', 'round', 'payout'])
    expect(tl.map((p) => p.game)).toEqual([0, 1, 1, 1, 2, 2])
    expect(tl.map((p) => p.round)).toEqual([0, 1, 2, 2, 1, 1])
    expect(tl.map((p) => p.step)).toEqual([0, 1, 2, 3, 4, 5])
  })
  it('ends at the net total from computePlayerStats', () => {
    const stats = computePlayerStats(games)
    for (const id of ['a', 'b', 'c']) expect(playerMoneyTimeline(games, id).at(-1)?.balanceCents).toBe(stats[id].netCents)
  })
  it('is just the starting point for a player with no games', () => {
    expect(playerMoneyTimeline(games, 'nobody')).toEqual([{ step: 0, game: 0, round: 0, kind: 'start', balanceCents: 0 }])
  })
})

describe('pointsHistogram', () => {
  it('buckets points per round, skipping unfinished games', () => {
    expect(pointsHistogram(games, 'a').map((b) => b.count)).toEqual([1, 0, 0, 1, 1, 0])
    expect(pointsHistogram(games, 'b').map((b) => b.count)).toEqual([1, 0, 1, 0, 0, 1])
  })
  it('exposes bucket bounds and is all zeros with no games', () => {
    const h = pointsHistogram([], 'a')
    expect(h.map((b) => [b.min, b.max])).toEqual([[0, 0], [1, 19], [20, 39], [40, 59], [60, 79], [80, null]])
    expect(h.every((b) => b.count === 0)).toBe(true)
  })
})

describe('longestRoundWinStreak', () => {
  it('counts consecutive round wins across games', () => {
    expect(longestRoundWinStreak(games, 'a')).toBe(2)
    expect(longestRoundWinStreak(games, 'b')).toBe(1)
    expect(longestRoundWinStreak(games, 'c')).toBe(0)
  })
  it('continues across game boundaries and counts shared wins', () => {
    expect(longestRoundWinStreak([game1, tie], 'a')).toBe(3)
  })
  it('is 0 with no games', () => {
    expect(longestRoundWinStreak([], 'a')).toBe(0)
  })
})

describe('bestAndWorstGame', () => {
  it('picks highest and lowest net', () => {
    const { best, worst } = bestAndWorstGame(playerGameResults(games, 'a'))
    expect(best?.gameId).toBe('g1')
    expect(worst?.gameId).toBe('g2')
  })
  it('keeps the earliest on equal nets', () => {
    const results = playerGameResults([game2, { ...game2, id: 'g2b' }], 'a')
    expect(bestAndWorstGame(results)).toMatchObject({ best: { gameId: 'g2' }, worst: { gameId: 'g2' } })
  })
  it('is null with no games', () => {
    expect(bestAndWorstGame([])).toEqual({ best: null, worst: null })
  })
})

describe('headToHead', () => {
  it('aggregates shared games, wins and nets per opponent', () => {
    const rows = headToHead([...games, tie], 'a')
    expect(rows).toEqual([
      { opponentId: 'b', gamesTogether: 3, playerWins: 2, opponentWins: 2, playerNetCents: 300 + 50, opponentNetCents: 0 + 50 },
      { opponentId: 'c', gamesTogether: 2, playerWins: 1, opponentWins: 0, playerNetCents: 300, opponentNetCents: -300 },
      { opponentId: 'd', gamesTogether: 1, playerWins: 1, opponentWins: 0, playerNetCents: 50, opponentNetCents: -100 },
    ])
  })
  it('is empty for a player with no games', () => {
    expect(headToHead(games, 'nobody')).toEqual([])
  })
})

describe('leaderboard', () => {
  it('sorts by net balance with rank', () => {
    const board = leaderboard(computePlayerStats(games))
    expect(board.map((e) => [e.playerId, e.rank, e.netCents])).toEqual([
      ['a', 1, 300],
      ['b', 2, 0],
      ['c', 3, -300],
    ])
  })
  it('shares the rank on equal nets, more wins first', () => {
    const s = (playerId: string, netCents: number, gamesWon: number): PlayerStats => ({
      playerId,
      gamesPlayed: 3,
      gamesWon,
      roundsPlayed: 0,
      roundsWon: 0,
      totalPoints: 0,
      averagePointsPerRound: 0,
      busts: 0,
      bestRound: 0,
      netCents,
      balanceByGame: [],
    })
    const board = leaderboard({ x: s('x', 100, 0), y: s('y', 100, 2), z: s('z', -50, 1) })
    expect(board.map((e) => [e.playerId, e.rank])).toEqual([
      ['y', 1],
      ['x', 1],
      ['z', 3],
    ])
  })
  it('is empty with no games', () => {
    expect(leaderboard(computePlayerStats([]))).toEqual([])
  })
})

describe('moneyHeadToHead with a non-50 split', () => {
  it('follows the real pairwise settlement of that split', () => {
    const g: GameRecord = {
      id: 'g60',
      playerIds: ['a', 'b', 'c'],
      stakeCents: 100,
      winnerSharePct: 60,
      limit: 50,
      rounds: [{ scores: { a: 60, b: 0, c: 20 } }, { scores: { a: 0, b: 50, c: 0 } }],
    }
    expect(moneyHeadToHead([g], 'a')).toEqual([
      { opponentId: 'b', gamesTogether: 1, netCents: 80 },
      { opponentId: 'c', gamesTogether: 1, netCents: 140 },
    ])
    const stats = computePlayerStats([g])
    for (const p of ['a', 'b', 'c']) {
      expect(moneyHeadToHead([g], p).reduce((acc, r) => acc + r.netCents, 0)).toBe(stats[p].netCents)
    }
  })
})

describe('moneyHeadToHead', () => {
  const all = [game1, unfinished, game2, tie]
  const ids = ['a', 'b', 'c', 'd']
  const netOf = (player: string, opponent: string) =>
    moneyHeadToHead(all, player).find((r) => r.opponentId === opponent)?.netCents

  it('uses the real pairwise settlement per game, sorted from biggest loss to biggest win', () => {
    // game1: b and c each pay a 200. game2: a and c each pay b 100. tie: d pays a and b 50 each.
    expect(moneyHeadToHead([game1], 'a')).toEqual([
      { opponentId: 'b', gamesTogether: 1, netCents: 200 },
      { opponentId: 'c', gamesTogether: 1, netCents: 200 },
    ])
    expect(moneyHeadToHead(all, 'c')).toEqual([
      { opponentId: 'a', gamesTogether: 2, netCents: -200 },
      { opponentId: 'b', gamesTogether: 2, netCents: -100 },
    ])
  })

  it('is antisymmetric: A vs B is minus B vs A', () => {
    for (const p of ids) {
      for (const o of ids) {
        if (p === o) continue
        const pv = netOf(p, o)
        const ov = netOf(o, p)
        expect(pv === undefined).toBe(ov === undefined)
        if (pv !== undefined) expect(pv + (ov ?? 0)).toBe(0)
      }
    }
  })

  it('sums over all opponents to the player total net balance', () => {
    const stats = computePlayerStats(all)
    for (const p of ids) {
      const sum = moneyHeadToHead(all, p).reduce((acc, r) => acc + r.netCents, 0)
      expect(sum).toBe(stats[p].netCents)
    }
  })

  it('keeps zero rows and breaks ties by games together, then opponent id', () => {
    // tie: a and b split the pot evenly, so they owe each other nothing.
    expect(moneyHeadToHead([tie], 'a')).toEqual([
      { opponentId: 'b', gamesTogether: 1, netCents: 0 },
      { opponentId: 'd', gamesTogether: 1, netCents: 50 },
    ])
    expect(moneyHeadToHead([tie], 'd')).toEqual([
      { opponentId: 'a', gamesTogether: 1, netCents: -50 },
      { opponentId: 'b', gamesTogether: 1, netCents: -50 },
    ])
    // a vs b: game1 +200, game2 -100, tie 0 -> +100 over 3 games; a vs c: game1 +200, game2 0 -> +200 over 2 games.
    expect(moneyHeadToHead(all, 'a')).toEqual([
      { opponentId: 'd', gamesTogether: 1, netCents: 50 },
      { opponentId: 'b', gamesTogether: 3, netCents: 100 },
      { opponentId: 'c', gamesTogether: 2, netCents: 200 },
    ])
  })

  it('returns nothing for a player without finished games', () => {
    expect(moneyHeadToHead([unfinished], 'a')).toEqual([])
  })
})
