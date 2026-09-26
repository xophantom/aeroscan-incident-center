import { describe, expect, it } from 'vitest'
import { dedupWindow } from './dedup.js'

describe('dedupWindow', () => {
  it('vai de 10 minutos antes a 10 minutos depois da detecção recebida', () => {
    expect(dedupWindow(new Date('2026-01-01T12:10:00.000Z'))).toEqual({
      from: new Date('2026-01-01T12:00:00.000Z'),
      to: new Date('2026-01-01T12:20:00.000Z'),
    })
  })
})
