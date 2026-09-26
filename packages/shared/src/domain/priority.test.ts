import { describe, expect, it } from 'vitest'
import { computePriority } from './priority.js'

describe('computePriority', () => {
  it.each([
    [4, 'perimeter_breach', 8],
    [5, 'low_battery', 5],
    [3, 'intrusion', 9],
    [2, 'signal_loss', 2],
  ] as const)('severity %i × %s = %i', (severity, type, expected) => {
    expect(computePriority(severity, type)).toBe(expected)
  })
})
