import { DEFAULT_WINNER_SHARE_PCT, isValidWinnerSharePct, normalizeWinnerSharePct } from '../domain/money'
import type { PlayerId, Scores } from '../domain/scoring'
import { db as defaultDb, type Flip7Db, type GameRecord, type PlayerRecord, type RoundRecord } from './schema'

export interface NewGameInput {
  playerIds: PlayerId[]
  limit: number
  stakeCents: number
  /** Percentage (0..100) of each round's pool for the round winner(s). Defaults to 50. */
  winnerSharePct?: number
}

export interface LoadedGame {
  game: GameRecord
  rounds: RoundRecord[]
}

/** Defensive read: a missing or invalid split is treated as the historical 50/50. */
export function normalizeGame(game: GameRecord): GameRecord {
  return { ...game, winnerSharePct: normalizeWinnerSharePct(game.winnerSharePct) }
}

export function createRepositories(db: Flip7Db = defaultDb) {
  const newId = () => crypto.randomUUID()

  async function createPlayer(name: string): Promise<PlayerRecord> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Player name is required')
    const existing = await db.players.where('name').equalsIgnoreCase(trimmed).first()
    if (existing) return existing
    const player = { id: newId(), name: trimmed }
    await db.players.add(player)
    return player
  }

  async function listPlayers(): Promise<PlayerRecord[]> {
    const all = await db.players.toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  async function createGame(input: NewGameInput): Promise<GameRecord> {
    if (new Set(input.playerIds).size !== input.playerIds.length) throw new Error('Duplicate players')
    if (input.playerIds.length < 2) throw new Error('At least 2 players are required')
    if (!Number.isInteger(input.limit) || input.limit <= 0) throw new Error('Invalid limit')
    if (!Number.isInteger(input.stakeCents) || input.stakeCents < 0) throw new Error('Invalid stake')
    const winnerSharePct = input.winnerSharePct ?? DEFAULT_WINNER_SHARE_PCT
    if (!isValidWinnerSharePct(winnerSharePct)) throw new Error('Invalid winner share')
    const game: GameRecord = {
      id: newId(),
      createdAt: Date.now(),
      limit: input.limit,
      stakeCents: input.stakeCents,
      winnerSharePct,
      status: 'in_progress',
      playerIds: [...input.playerIds],
    }
    await db.games.add(game)
    return game
  }

  async function listRounds(gameId: string): Promise<RoundRecord[]> {
    const rounds = await db.rounds.where('gameId').equals(gameId).toArray()
    return rounds.sort((a, b) => a.index - b.index)
  }

  async function addRound(gameId: string, scores: Scores): Promise<RoundRecord> {
    return db.transaction('rw', db.games, db.rounds, async () => {
      const game = await db.games.get(gameId)
      if (!game) throw new Error('Game not found')
      if (game.status !== 'in_progress') throw new Error('Game is finished')
      const rounds = await listRounds(gameId)
      const round = { id: newId(), gameId, index: rounds.length, scores }
      await db.rounds.add(round)
      return round
    })
  }

  async function lastRound(gameId: string): Promise<RoundRecord | undefined> {
    const rounds = await listRounds(gameId)
    return rounds[rounds.length - 1]
  }

  async function editLastRound(gameId: string, scores: Scores): Promise<RoundRecord> {
    return db.transaction('rw', db.games, db.rounds, async () => {
      const game = await db.games.get(gameId)
      if (!game) throw new Error('Game not found')
      const last = await lastRound(gameId)
      if (!last) throw new Error('No rounds to edit')
      const updated = { ...last, scores }
      await db.rounds.put(updated)
      // Editing may change whether the game is over; the caller re-finishes if needed.
      if (game.status === 'finished') await db.games.update(gameId, { status: 'in_progress' })
      return updated
    })
  }

  async function deleteLastRound(gameId: string): Promise<void> {
    await db.transaction('rw', db.games, db.rounds, async () => {
      const last = await lastRound(gameId)
      if (!last) return
      await db.rounds.delete(last.id)
      await db.games.update(gameId, { status: 'in_progress' })
    })
  }

  async function finishGame(gameId: string): Promise<void> {
    const updated = await db.games.update(gameId, { status: 'finished' })
    if (!updated) throw new Error('Game not found')
  }

  async function listGames(): Promise<GameRecord[]> {
    const games = await db.games.orderBy('createdAt').reverse().toArray()
    return games.map(normalizeGame)
  }

  async function loadGame(gameId: string): Promise<LoadedGame | undefined> {
    const game = await db.games.get(gameId)
    if (!game) return undefined
    return { game: normalizeGame(game), rounds: await listRounds(gameId) }
  }

  async function getInProgressGame(): Promise<GameRecord | undefined> {
    const games = await db.games.where('status').equals('in_progress').toArray()
    const latest = games.sort((a, b) => b.createdAt - a.createdAt)[0]
    return latest && normalizeGame(latest)
  }

  return {
    createPlayer,
    listPlayers,
    createGame,
    addRound,
    editLastRound,
    deleteLastRound,
    finishGame,
    listGames,
    loadGame,
    getInProgressGame,
  }
}

export type Repositories = ReturnType<typeof createRepositories>
export const repos = createRepositories()
