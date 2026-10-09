import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_WINNER_SHARE_PCT } from '../domain/money'
import type { PlayerId, Scores } from '../domain/scoring'

export interface PlayerRecord {
  id: PlayerId
  name: string
}

export type GameStatus = 'in_progress' | 'finished'

export interface GameRecord {
  id: string
  createdAt: number
  limit: number
  stakeCents: number
  /** Percentage (0..100) of each round's pool for the round winner(s); the pot gets the rest. */
  winnerSharePct: number
  status: GameStatus
  playerIds: PlayerId[]
}

export interface RoundRecord {
  id: string
  gameId: string
  index: number
  scores: Scores
}

export class Flip7Db extends Dexie {
  players!: EntityTable<PlayerRecord, 'id'>
  games!: EntityTable<GameRecord, 'id'>
  rounds!: EntityTable<RoundRecord, 'id'>

  constructor(name = 'flip7-tracker') {
    super(name)
    this.version(1).stores({
      players: 'id, name',
      games: 'id, createdAt, status',
      rounds: 'id, gameId, [gameId+index]',
    })
    // v2: configurable winner/pot split. Games created before it used 50/50.
    this.version(2)
      .stores({
        players: 'id, name',
        games: 'id, createdAt, status',
        rounds: 'id, gameId, [gameId+index]',
      })
      .upgrade((tx) =>
        tx
          .table('games')
          .toCollection()
          .modify((game: Partial<GameRecord>) => {
            if (game.winnerSharePct === undefined) game.winnerSharePct = DEFAULT_WINNER_SHARE_PCT
          }),
      )
  }
}

export const db = new Flip7Db()
