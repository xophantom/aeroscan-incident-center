import { describe, expect, it } from 'vitest'
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from './occurrence.js'
import { allowedFrom, canTransition } from './status.js'

const VALID: ReadonlyArray<readonly [OccurrenceStatus, OccurrenceStatus]> = [
  ['open', 'acknowledged'],
  ['acknowledged', 'resolved'],
]

const allPairs = OCCURRENCE_STATUSES.flatMap((from) =>
  OCCURRENCE_STATUSES.map((to) => [from, to] as const),
)

describe('canTransition', () => {
  it.each(allPairs)('%s → %s', (from, to) => {
    const expected = VALID.some(([f, t]) => f === from && t === to)
    expect(canTransition(from, to)).toBe(expected)
  })

  it('só existem duas transições válidas em todo o espaço de pares', () => {
    expect(allPairs.filter(([from, to]) => canTransition(from, to))).toEqual(VALID)
  })
})

describe('allowedFrom', () => {
  it.each([
    ['open', []],
    ['acknowledged', ['open']],
    ['resolved', ['acknowledged']],
  ] as const)('%s é alcançado a partir de %j', (to, expected) => {
    expect(allowedFrom(to)).toEqual(expected)
  })
})
