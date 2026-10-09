import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createRepositories } from './repositories'
import { Flip7Db, type GameRecord } from './schema'

let n = 0
let repos: ReturnType<typeof createRepositories>

beforeEach(() => {
  repos = createRepositories(new Flip7Db(`test-${n++}`))
})

async function setup() {
  const a = await repos.createPlayer('Ana')
  const b = await repos.createPlayer('Beto')
  const game = await repos.createGame({ playerIds: [a.id, b.id], limit: 200, stakeCents: 100 })
  return { a, b, game }
}

describe('repositories', () => {
  it('creates players, trims and dedupes by name', async () => {
    const a = await repos.createPlayer('  Ana ')
    const again = await repos.createPlayer('ana')
    expect(again.id).toBe(a.id)
    await repos.createPlayer('Beto')
    expect((await repos.listPlayers()).map((p) => p.name)).toEqual(['Ana', 'Beto'])
    await expect(repos.createPlayer('  ')).rejects.toThrow()
  })

  it('validates game creation', async () => {
    const a = await repos.createPlayer('Ana')
    await expect(repos.createGame({ playerIds: [a.id], limit: 200, stakeCents: 100 })).rejects.toThrow()
  })

  it('stores the winner share, defaulting to 50', async () => {
    const { a, b, game } = await setup()
    expect(game.winnerSharePct).toBe(50)
    const custom = await repos.createGame({ playerIds: [a.id, b.id], limit: 200, stakeCents: 100, winnerSharePct: 60 })
    expect((await repos.loadGame(custom.id))!.game.winnerSharePct).toBe(60)
    for (const pct of [0, 100]) {
      const g = await repos.createGame({ playerIds: [a.id, b.id], limit: 200, stakeCents: 100, winnerSharePct: pct })
      expect((await repos.loadGame(g.id))!.game.winnerSharePct).toBe(pct)
    }
  })

  it('rejects a winner share outside 0..100 or not an integer', async () => {
    const a = await repos.createPlayer('Ana')
    const b = await repos.createPlayer('Beto')
    for (const pct of [-5, 101, 12.5, Number.NaN]) {
      await expect(
        repos.createGame({ playerIds: [a.id, b.id], limit: 200, stakeCents: 100, winnerSharePct: pct }),
      ).rejects.toThrow()
    }
  })

  it('treats a missing winner share as 50 when reading', async () => {
    const db = new Flip7Db(`test-${n++}`)
    const local = createRepositories(db)
    const legacy = { id: 'legacy', createdAt: 1, limit: 200, stakeCents: 100, status: 'in_progress', playerIds: ['x', 'y'] }
    await db.games.add(legacy as unknown as GameRecord)
    expect((await local.loadGame('legacy'))!.game.winnerSharePct).toBe(50)
    expect((await local.getInProgressGame())!.winnerSharePct).toBe(50)
    expect((await local.listGames())[0].winnerSharePct).toBe(50)
  })

  it('adds, edits and deletes the last round', async () => {
    const { a, b, game } = await setup()
    await repos.addRound(game.id, { [a.id]: 10, [b.id]: 0 })
    await repos.addRound(game.id, { [a.id]: 5, [b.id]: 7 })
    await repos.editLastRound(game.id, { [a.id]: 6, [b.id]: 8 })
    let loaded = await repos.loadGame(game.id)
    expect(loaded!.rounds.map((r) => r.index)).toEqual([0, 1])
    expect(loaded!.rounds[1].scores[b.id]).toBe(8)
    await repos.deleteLastRound(game.id)
    loaded = await repos.loadGame(game.id)
    expect(loaded!.rounds).toHaveLength(1)
    await repos.addRound(game.id, { [a.id]: 1, [b.id]: 1 })
    expect((await repos.loadGame(game.id))!.rounds.map((r) => r.index)).toEqual([0, 1])
  })

  it('finishes games and finds the in-progress one', async () => {
    const { game } = await setup()
    expect((await repos.getInProgressGame())?.id).toBe(game.id)
    await repos.finishGame(game.id)
    expect(await repos.getInProgressGame()).toBeUndefined()
    await expect(repos.addRound(game.id, {})).rejects.toThrow()
    expect((await repos.listGames())[0].status).toBe('finished')
  })

  it('reopens a finished game when its last round is deleted', async () => {
    const { a, b, game } = await setup()
    await repos.addRound(game.id, { [a.id]: 250, [b.id]: 0 })
    await repos.finishGame(game.id)
    await repos.deleteLastRound(game.id)
    expect((await repos.loadGame(game.id))!.game.status).toBe('in_progress')
  })

  it('returns undefined for unknown games', async () => {
    expect(await repos.loadGame('nope')).toBeUndefined()
  })
})

describe('schema upgrade', () => {
  it('sets winnerSharePct = 50 on games created before version 2', async () => {
    const name = `upgrade-${n++}`
    const v1 = new Dexie(name)
    v1.version(1).stores({
      players: 'id, name',
      games: 'id, createdAt, status',
      rounds: 'id, gameId, [gameId+index]',
    })
    await v1.table('games').bulkAdd([
      { id: 'old-1', createdAt: 1, limit: 200, stakeCents: 100, status: 'finished', playerIds: ['a', 'b'] },
      { id: 'old-2', createdAt: 2, limit: 100, stakeCents: 50, status: 'in_progress', playerIds: ['a', 'b'] },
    ])
    v1.close()

    const db = new Flip7Db(name)
    const games = await db.games.toArray()
    expect(db.verno).toBe(2)
    expect(games.map((g) => [g.id, g.winnerSharePct])).toEqual([
      ['old-1', 50],
      ['old-2', 50],
    ])
    db.close()
  })
})
