import { describe, expect, it } from 'vitest'
import { dedupWindowStart } from './dedup.js'

describe('dedupWindowStart', () => {
  it('começa 10 minutos antes da detecção recebida', () => {
    expect(dedupWindowStart(new Date('2026-01-01T12:10:00.000Z'))).toEqual(
      new Date('2026-01-01T12:00:00.000Z'),
    )
  })
})
