import { describe, expect, it } from 'vitest'
import { alertKey, dedupWindow } from './dedup.js'

describe('dedupWindow', () => {
  it('vai de 10 minutos antes a 10 minutos depois da detecção recebida', () => {
    expect(dedupWindow(new Date('2026-01-01T12:10:00.000Z'))).toEqual({
      from: new Date('2026-01-01T12:00:00.000Z'),
      to: new Date('2026-01-01T12:20:00.000Z'),
    })
  })
})

describe('alertKey', () => {
  const alert = {
    siteId: 'site-a',
    droneId: 'dr-07',
    type: 'intrusion',
    detectedAt: new Date('2026-01-01T12:00:00.000Z'),
  } as const

  it('o mesmo instante escrito com outro fuso é o mesmo alerta', () => {
    const sameInstant = { ...alert, detectedAt: new Date('2026-01-01T09:00:00.000-03:00') }

    expect(alertKey(sameInstant)).toBe(alertKey(alert))
  })

  it.each([
    { siteId: 'site-b' },
    { droneId: 'dr-12' },
    { type: 'perimeter_breach' as const },
    { detectedAt: new Date('2026-01-01T12:00:00.001Z') },
  ])('outro alerta quando muda %j', (change) => {
    expect(alertKey({ ...alert, ...change })).not.toBe(alertKey(alert))
  })

  it('separador dentro de um campo não junta alertas diferentes', () => {
    expect(alertKey({ ...alert, siteId: 'a","b', droneId: 'c' })).not.toBe(
      alertKey({ ...alert, siteId: 'a', droneId: 'b","c' }),
    )
  })
})
