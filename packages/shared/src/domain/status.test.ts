import { describe, expect, it } from 'vitest'
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from './occurrence.js'
import { allowedFrom, canTransition, requiresNote } from './status.js'

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

describe('requiresNote', () => {
  it.each([
    ['open', false],
    ['acknowledged', false],
    ['resolved', true],
  ] as const)('%s → %s', (to, expected) => {
    expect(requiresNote(to)).toBe(expected)
  })
})
