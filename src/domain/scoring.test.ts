import { describe, expect, it } from 'vitest'
import { finalWinners, isGameOver, roundsWonCount, roundWinners, totalPoints } from './scoring'

const P = ['a', 'b', 'c']

describe('roundWinners', () => {
  it('picks the single highest score', () => {
    expect(roundWinners(P, { a: 10, b: 25, c: 0 })).toEqual(['b'])
  })
  it('shares ties in player order', () => {
    expect(roundWinners(P, { a: 30, b: 12, c: 30 })).toEqual(['a', 'c'])
  })
  it('treats missing scores as 0 and ties everybody when all bust', () => {
    expect(roundWinners(P, {})).toEqual(['a', 'b', 'c'])
    expect(roundWinners(P, { b: 5 })).toEqual(['b'])
  })
  it('returns nobody for no players', () => {
    expect(roundWinners([], {})).toEqual([])
  })
})

describe('totals and game over', () => {
  const rounds = [{ scores: { a: 50, b: 20, c: 0 } }, { scores: { a: 100, b: 90, c: 30 } }]
  it('accumulates points', () => {
    expect(totalPoints(P, rounds)).toEqual({ a: 150, b: 110, c: 30 })
  })
  it('ends when any total reaches the limit (inclusive)', () => {
    expect(isGameOver({ a: 199, b: 10 }, 200)).toBe(false)
    expect(isGameOver({ a: 200, b: 10 }, 200)).toBe(true)
    expect(isGameOver({ a: 250, b: 230 }, 200)).toBe(true)
  })
  it('final winner is the highest total even when several pass the limit', () => {
    expect(finalWinners(P, { a: 210, b: 240, c: 100 })).toEqual(['b'])
  })
  it('final tie keeps player order', () => {
    expect(finalWinners(P, { a: 210, b: 100, c: 210 })).toEqual(['a', 'c'])
  })
  it('counts rounds won', () => {
    expect(roundsWonCount(P, rounds)).toEqual({ a: 2, b: 0, c: 0 })
  })
})
