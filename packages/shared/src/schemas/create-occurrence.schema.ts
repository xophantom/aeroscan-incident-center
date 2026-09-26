import { z } from 'zod'
import { MAX_SEVERITY, MIN_SEVERITY, OCCURRENCE_TYPES } from '../domain/occurrence.js'
import { oneOf, requiredText } from './fields.js'

const severityRange = `severity deve estar entre ${MIN_SEVERITY} e ${MAX_SEVERITY}`

/** Body do POST /occurrences, com os campos do modelo do enunciado. */
export const createOccurrenceBodySchema = z.object({
  siteId: requiredText('siteId'),
  droneId: requiredText('droneId'),
  type: oneOf('type', OCCURRENCE_TYPES),
  severity: z
    .number({
      required_error: 'severity é obrigatório',
      invalid_type_error: 'severity deve ser um número',
    })
    .int('severity deve ser um número inteiro')
    .min(MIN_SEVERITY, severityRange)
    .max(MAX_SEVERITY, severityRange),
  detectedAt: z
    .string({
      required_error: 'detectedAt é obrigatório',
      invalid_type_error: 'detectedAt deve ser um texto',
    })
    .datetime({
      offset: true,
      message: 'detectedAt deve ser uma data ISO 8601 (ex.: 2026-09-25T14:00:00Z)',
    })
    .transform((value) => new Date(value)),
})

export type CreateOccurrenceBody = z.input<typeof createOccurrenceBodySchema>
export type CreateOccurrenceInput = z.output<typeof createOccurrenceBodySchema>
