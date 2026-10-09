import { useLiveQuery } from 'dexie-react-hooks'
import { normalizeGame } from '../db/repositories'
import { db, type GameRecord as StoredGame, type PlayerRecord } from '../db/schema'
import type { GameRecord } from '../domain/stats'

export interface StoredGameView {
  stored: StoredGame
  record: GameRecord
}

export interface AllGames {
  players: PlayerRecord[]
  /** Finished games, oldest first. */
  games: StoredGameView[]
}

/** Live view of every finished game with its rounds, oldest first. Undefined while loading. */
export function useAllGames(): AllGames | undefined {
  return useLiveQuery(async () => {
    const [players, games, rounds] = await Promise.all([
      db.players.toArray(),
      db.games.where('status').equals('finished').sortBy('createdAt'),
      db.rounds.toArray(),
    ])
    const byGame = new Map<string, typeof rounds>()
    for (const r of rounds) byGame.set(r.gameId, [...(byGame.get(r.gameId) ?? []), r])
    return {
      players,
      games: games.map(normalizeGame).map((stored) => ({
        stored,
        record: {
          id: stored.id,
          playerIds: stored.playerIds,
          stakeCents: stored.stakeCents,
          winnerSharePct: stored.winnerSharePct,
          limit: stored.limit,
          rounds: (byGame.get(stored.id) ?? [])
            .sort((a, b) => a.index - b.index)
            .map((r) => ({ scores: r.scores })),
        },
      })),
    }
  }, [])
}
