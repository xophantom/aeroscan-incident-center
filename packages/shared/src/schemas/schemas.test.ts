import { describe, expect, it } from 'vitest'
import type { ZodError } from 'zod'
import { createOccurrenceBodySchema } from './create-occurrence.schema.js'
import { listOccurrencesQuerySchema } from './list-occurrences.schema.js'
import {
  NOTE_MAX_LENGTH,
  resolveFormSchema,
  updateStatusBodySchema,
} from './update-status.schema.js'

function messages(error: ZodError | undefined): Record<string, string> {
  return Object.fromEntries((error?.issues ?? []).map((i) => [i.path.join('.'), i.message]))
}

describe('createOccurrenceBodySchema', () => {
  const valid = {
    siteId: ' site-a ',
    droneId: 'drone-1',
    type: 'intrusion',
    severity: 3,
    detectedAt: '2026-09-25T14:00:00-03:00',
  }

  it('faz trim dos textos e transforma detectedAt em Date', () => {
    expect(createOccurrenceBodySchema.parse(valid)).toEqual({
      siteId: 'site-a',
      droneId: 'drone-1',
      type: 'intrusion',
      severity: 3,
      detectedAt: new Date('2026-09-25T17:00:00.000Z'),
    })
  })

  it('exige todos os campos, com mensagens em PT-BR', () => {
    const result = createOccurrenceBodySchema.safeParse({})

    expect(messages(result.error)).toEqual({
      siteId: 'siteId é obrigatório',
      droneId: 'droneId é obrigatório',
      type: 'type deve ser um de: intrusion, perimeter_breach, low_battery, signal_loss',
      severity: 'severity é obrigatório',
      detectedAt: 'detectedAt é obrigatório',
    })
  })

  it.each([
    [{ siteId: '   ' }, 'siteId', 'siteId é obrigatório'],
    [{ siteId: 'x'.repeat(101) }, 'siteId', 'siteId deve ter no máximo 100 caracteres'],
    [{ droneId: 42 }, 'droneId', 'droneId deve ser um texto'],
    [
      { type: 'fire' },
      'type',
      'type deve ser um de: intrusion, perimeter_breach, low_battery, signal_loss',
    ],
    [{ severity: 0 }, 'severity', 'severity deve estar entre 1 e 5'],
    [{ severity: 6 }, 'severity', 'severity deve estar entre 1 e 5'],
    [{ severity: 2.5 }, 'severity', 'severity deve ser um número inteiro'],
    [{ severity: '3' }, 'severity', 'severity deve ser um número'],
    [{ detectedAt: 'ontem' }, 'detectedAt', expect.stringContaining('ISO 8601')],
    [{ detectedAt: 1700000000 }, 'detectedAt', 'detectedAt deve ser um texto'],
  ])('rejeita %j', (override, path, message) => {
    const result = createOccurrenceBodySchema.safeParse({ ...valid, ...override })

    expect(result.success).toBe(false)
    expect(messages(result.error)[path]).toEqual(message)
  })
})

describe('listOccurrencesQuerySchema', () => {
  it('filtros são opcionais', () => {
    expect(listOccurrencesQuerySchema.parse({})).toEqual({ status: undefined, siteId: undefined })
  })

  it('aceita status e siteId', () => {
    expect(listOccurrencesQuerySchema.parse({ status: 'open', siteId: ' site-a ' })).toEqual({
      status: 'open',
      siteId: 'site-a',
    })
  })

  it('trata valores vazios como filtro ausente (?status=&siteId=)', () => {
    expect(listOccurrencesQuerySchema.parse({ status: '', siteId: ' ' })).toEqual({
      status: undefined,
      siteId: undefined,
    })
  })

  it('rejeita status desconhecido', () => {
    const result = listOccurrencesQuerySchema.safeParse({ status: 'closed' })

    expect(messages(result.error)).toEqual({
      status: 'status deve ser um de: open, acknowledged, resolved',
    })
  })

  it('rejeita siteId longo demais', () => {
    const result = listOccurrencesQuerySchema.safeParse({ siteId: 'x'.repeat(101) })

    expect(messages(result.error)).toEqual({
      siteId: 'siteId deve ter no máximo 100 caracteres',
    })
  })
})

describe('updateStatusBodySchema', () => {
  it('acknowledged não exige nota (e descarta campos extras)', () => {
    expect(updateStatusBodySchema.parse({ status: 'acknowledged', note: 'x' })).toEqual({
      status: 'acknowledged',
    })
  })

  it('open passa na validação: a regra de transição (409) decide depois', () => {
    expect(updateStatusBodySchema.parse({ status: 'open' })).toEqual({ status: 'open' })
  })

  it('resolved exige nota e faz trim', () => {
    expect(updateStatusBodySchema.parse({ status: 'resolved', note: '  falso positivo ' })).toEqual(
      {
        status: 'resolved',
        note: 'falso positivo',
      },
    )
  })

  it.each([
    [{ status: 'resolved' }, 'A nota é obrigatória para resolver a ocorrência'],
    [{ status: 'resolved', note: '   ' }, 'A nota é obrigatória para resolver a ocorrência'],
    [{ status: 'resolved', note: 7 }, 'note deve ser um texto'],
    [
      { status: 'resolved', note: 'x'.repeat(NOTE_MAX_LENGTH + 1) },
      `A nota deve ter no máximo ${NOTE_MAX_LENGTH} caracteres`,
    ],
  ])('rejeita %j', (body, message) => {
    const result = updateStatusBodySchema.safeParse(body)

    expect(messages(result.error)).toEqual({ note: message })
  })

  it.each([{}, { status: 'closed' }])('rejeita status inválido %j', (body) => {
    const result = updateStatusBodySchema.safeParse(body)

    expect(messages(result.error)).toEqual({
      status: 'status deve ser um de: open, acknowledged, resolved',
    })
  })

  it('rejeita body que não é objeto', () => {
    const result = updateStatusBodySchema.safeParse('resolved')

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.code).toBe('invalid_type')
  })
})

describe('resolveFormSchema', () => {
  it('usa a mesma regra de nota do PATCH', () => {
    expect(resolveFormSchema.safeParse({ note: ' ok ' })).toEqual({
      success: true,
      data: { note: 'ok' },
    })
    expect(messages(resolveFormSchema.safeParse({ note: '' }).error)).toEqual({
      note: 'A nota é obrigatória para resolver a ocorrência',
    })
  })
})
