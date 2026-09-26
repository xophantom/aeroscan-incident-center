import { describe, expect, it } from 'vitest'
import { ERROR_CODES, isErrorResponse } from './error.js'
import { occurrenceResponseSchema } from './occurrence-response.js'

describe('isErrorResponse', () => {
  it('reconhece o envelope de erro', () => {
    expect(
      isErrorResponse({
        error: { code: 'INVALID_STATUS_TRANSITION', message: 'x', details: { from: 'open' } },
      }),
    ).toBe(true)
    expect(isErrorResponse({ error: { code: 'NOT_FOUND', message: 'x' } })).toBe(true)
  })

  it.each([
    null,
    'erro',
    { message: 'x' },
    { error: { code: 'NOPE', message: 'x' } },
    { error: { code: 'NOT_FOUND' } },
  ])('rejeita %j', (value) => {
    expect(isErrorResponse(value)).toBe(false)
  })

  it('lista os códigos usados pela API', () => {
    expect(ERROR_CODES).toContain('INVALID_STATUS_TRANSITION')
    expect(ERROR_CODES).toContain('VALIDATION_ERROR')
  })
})

describe('occurrenceResponseSchema', () => {
  it('descreve o contrato camelCase do enunciado', () => {
    const iso = '2026-09-25T14:00:00.000Z'
    const response = {
      id: '66f4a1c2e4b0a1b2c3d4e5f6',
      siteId: 'site-a',
      droneId: 'drone-1',
      type: 'intrusion',
      severity: 3,
      priority: 9,
      status: 'open',
      count: 1,
      note: null,
      detectedAt: iso,
      lastDetectedAt: iso,
      createdAt: iso,
      updatedAt: iso,
    }

    expect(occurrenceResponseSchema.parse(response)).toEqual(response)
  })
})
