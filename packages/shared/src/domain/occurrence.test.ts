import { describe, expect, it } from 'vitest'
import {
  MAX_ALERT_AGE_MS,
  MAX_FUTURE_SKEW_MS,
  isOccurrenceStatus,
  isTooFarInFuture,
  isTooOld,
} from './occurrence.js'

describe('isOccurrenceStatus', () => {
  it.each(['open', 'acknowledged', 'resolved'])('aceita %s', (value) => {
    expect(isOccurrenceStatus(value)).toBe(true)
  })

  it.each(['closed', '', null, undefined, 1])('rejeita %s', (value) => {
    expect(isOccurrenceStatus(value)).toBe(false)
  })
})

describe('limites de detectedAt', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')
  const plus = (ms: number) => new Date(now.getTime() + ms)

  it('isTooFarInFuture aceita passado, presente e até 1 min à frente', () => {
    expect(isTooFarInFuture(plus(-3_600_000), now)).toBe(false)
    expect(isTooFarInFuture(now, now)).toBe(false)
    expect(isTooFarInFuture(plus(MAX_FUTURE_SKEW_MS), now)).toBe(false)
  })

  it('isTooFarInFuture rejeita além da tolerância', () => {
    expect(isTooFarInFuture(plus(MAX_FUTURE_SKEW_MS + 1), now)).toBe(true)
  })

  it('isTooOld aceita até 24 h de atraso', () => {
    expect(isTooOld(now, now)).toBe(false)
    expect(isTooOld(plus(-MAX_ALERT_AGE_MS), now)).toBe(false)
  })

  it('isTooOld rejeita além de 24 h', () => {
    expect(isTooOld(plus(-MAX_ALERT_AGE_MS - 1), now)).toBe(true)
  })
})
