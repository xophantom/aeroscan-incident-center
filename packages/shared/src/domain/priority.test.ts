import { describe, expect, it } from 'vitest'
import { TYPE_WEIGHT, comparePriority, computePriority, type Prioritized } from './priority.js'

describe('computePriority', () => {
  it('usa os pesos do enunciado', () => {
    expect(TYPE_WEIGHT).toEqual({
      intrusion: 3,
      perimeter_breach: 2,
      low_battery: 1,
      signal_loss: 1,
    })
  })

  it.each([
    [4, 'perimeter_breach', 8],
    [5, 'low_battery', 5],
    [3, 'intrusion', 9],
    [2, 'signal_loss', 2],
  ] as const)('severity %i × %s = %i', (severity, type, expected) => {
    expect(computePriority(severity, type)).toBe(expected)
  })
})

describe('comparePriority', () => {
  const at = (iso: string) => new Date(iso)

  it('ordena o exemplo do enunciado: intrusion(9) > perimeter_breach(8) > low_battery(5)', () => {
    const items = [
      { name: 'low_battery', priority: 5, detectedAt: at('2026-01-01T10:00:00Z') },
      { name: 'intrusion', priority: 9, detectedAt: at('2026-01-01T09:00:00Z') },
      { name: 'perimeter_breach', priority: 8, detectedAt: at('2026-01-01T11:00:00Z') },
    ]

    expect(items.sort(comparePriority).map((i) => i.name)).toEqual([
      'intrusion',
      'perimeter_breach',
      'low_battery',
    ])
  })

  it('no empate de prioridade, a detecção mais recente vem primeiro', () => {
    const older: Prioritized = { priority: 6, detectedAt: at('2026-01-01T10:00:00Z') }
    const newer: Prioritized = { priority: 6, detectedAt: at('2026-01-01T10:05:00Z') }

    expect([older, newer].sort(comparePriority)).toEqual([newer, older])
  })

  it('prioridade maior vence mesmo sendo mais antiga', () => {
    const oldHigh: Prioritized = { priority: 10, detectedAt: at('2026-01-01T08:00:00Z') }
    const newLow: Prioritized = { priority: 9, detectedAt: at('2026-01-01T12:00:00Z') }

    expect([newLow, oldHigh].sort(comparePriority)).toEqual([oldHigh, newLow])
  })
})
