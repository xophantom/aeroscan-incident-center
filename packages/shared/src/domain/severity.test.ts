import { describe, expect, it } from 'vitest'
import { bumpSeverity } from './severity.js'

describe('bumpSeverity', () => {
  it.each([
    [1, 2],
    [3, 4],
    [4, 5],
  ])('%i → %i', (from, to) => {
    expect(bumpSeverity(from)).toBe(to)
  })

  it('trava no teto 5', () => {
    expect(bumpSeverity(5)).toBe(5)
  })
})
