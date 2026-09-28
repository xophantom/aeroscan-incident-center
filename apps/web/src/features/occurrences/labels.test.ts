import { describe, expect, it } from 'vitest'
import { formatClock, formatElapsed } from './labels'

const at = (hours: number, minutes: number, day = 25) =>
  new Date(2026, 8, day, hours, minutes).toISOString()

describe('formatClock', () => {
  const now = new Date(2026, 8, 25, 14, 30).getTime()

  it('do mesmo dia: só a hora', () => {
    expect(formatClock(at(14, 5), now)).toBe('14:05')
  })

  it('de outro dia: com a data na frente', () => {
    expect(formatClock(at(23, 45, 24), now)).toBe('24/09, 23:45')
  })
})

describe('formatElapsed', () => {
  const now = new Date(2026, 8, 25, 14, 30).getTime()

  it.each([
    [at(14, 30), 'agora'],
    [at(14, 31), 'agora'],
    [at(14, 25), 'há 5 min'],
    [at(12, 10), 'há 2 h'],
    [at(13, 30, 24), 'há 1 dia'],
    [at(14, 30, 22), 'há 3 dias'],
  ])('%s → %s', (iso, expected) => {
    expect(formatElapsed(iso, now)).toBe(expected)
  })
})
