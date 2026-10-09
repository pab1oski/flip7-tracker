import { describe, expect, it } from 'vitest'
import { parseEurosToCents } from './format'

describe('parseEurosToCents', () => {
  it('parses valid amounts', () => {
    expect(parseEurosToCents('1')).toBe(100)
    expect(parseEurosToCents('0,50')).toBe(50)
    expect(parseEurosToCents('2.5')).toBe(250)
    expect(parseEurosToCents('0,05')).toBe(5)
  })
  it('rejects invalid amounts', () => {
    for (const v of ['', 'abc', '-1', '1,234', '1,']) expect(parseEurosToCents(v)).toBeNull()
  })
})
