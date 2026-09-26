import { describe, expect, it } from 'vitest'
import { DEDUP_WINDOW_MS, dedupWindowStart } from './dedup.js'

describe('dedupWindowStart', () => {
  it('a janela é de 10 minutos', () => {
    expect(DEDUP_WINDOW_MS).toBe(10 * 60 * 1000)
  })

  it('começa 10 minutos antes da detecção recebida', () => {
    expect(dedupWindowStart(new Date('2026-01-01T12:10:00.000Z'))).toEqual(
      new Date('2026-01-01T12:00:00.000Z'),
    )
  })
})
