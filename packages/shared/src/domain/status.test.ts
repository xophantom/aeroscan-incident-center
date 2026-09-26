import { describe, expect, it } from 'vitest'
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from './occurrence.js'
import { canTransition, nextStatus, previousStatus, requiresNote } from './status.js'

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

describe('requiresNote', () => {
  it.each([
    ['open', false],
    ['acknowledged', false],
    ['resolved', true],
  ] as const)('%s → %s', (to, expected) => {
    expect(requiresNote(to)).toBe(expected)
  })
})

describe('nextStatus / previousStatus', () => {
  it('segue o fluxo open → acknowledged → resolved', () => {
    expect(nextStatus('open')).toBe('acknowledged')
    expect(nextStatus('acknowledged')).toBe('resolved')
    expect(nextStatus('resolved')).toBeNull()
  })

  it('previousStatus é o inverso; nada leva de volta a open', () => {
    expect(previousStatus('acknowledged')).toBe('open')
    expect(previousStatus('resolved')).toBe('acknowledged')
    expect(previousStatus('open')).toBeNull()
  })
})
