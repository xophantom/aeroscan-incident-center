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
    site_id: ' site-a ',
    drone_id: 'drone-1',
    type: 'intrusion',
    severity: 3,
    detected_at: '2026-09-25T14:00:00-03:00',
  }

  it('converte snake_case em camelCase, faz trim e transforma a data', () => {
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
      site_id: 'site_id é obrigatório',
      drone_id: 'drone_id é obrigatório',
      type: 'type deve ser um de: intrusion, perimeter_breach, low_battery, signal_loss',
      severity: 'severity é obrigatório',
      detected_at: 'detected_at é obrigatório',
    })
  })

  it.each([
    [{ site_id: '   ' }, 'site_id', 'site_id é obrigatório'],
    [{ site_id: 'x'.repeat(101) }, 'site_id', 'site_id deve ter no máximo 100 caracteres'],
    [{ drone_id: 42 }, 'drone_id', 'drone_id deve ser um texto'],
    [
      { type: 'fire' },
      'type',
      'type deve ser um de: intrusion, perimeter_breach, low_battery, signal_loss',
    ],
    [{ severity: 0 }, 'severity', 'severity deve estar entre 1 e 5'],
    [{ severity: 6 }, 'severity', 'severity deve estar entre 1 e 5'],
    [{ severity: 2.5 }, 'severity', 'severity deve ser um número inteiro'],
    [{ severity: '3' }, 'severity', 'severity deve ser um número'],
    [{ detected_at: 'ontem' }, 'detected_at', expect.stringContaining('ISO 8601')],
    [{ detected_at: 1700000000 }, 'detected_at', 'detected_at deve ser um texto'],
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

  it('aceita status e site_id', () => {
    expect(listOccurrencesQuerySchema.parse({ status: 'open', site_id: 'site-a' })).toEqual({
      status: 'open',
      siteId: 'site-a',
    })
  })

  it('aceita siteId (grafia do enunciado), com site_id tendo precedência', () => {
    expect(listOccurrencesQuerySchema.parse({ siteId: 'site-b' }).siteId).toBe('site-b')
    expect(listOccurrencesQuerySchema.parse({ site_id: 'a', siteId: 'b' }).siteId).toBe('a')
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

  it('rejeita site_id longo demais', () => {
    const result = listOccurrencesQuerySchema.safeParse({ site_id: 'x'.repeat(101) })

    expect(messages(result.error)).toEqual({
      site_id: 'site_id deve ter no máximo 100 caracteres',
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
