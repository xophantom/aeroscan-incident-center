import { z } from 'zod'
import { MAX_SEVERITY, MIN_SEVERITY, OCCURRENCE_TYPES } from '../domain/occurrence.js'
import { oneOf, requiredText } from './fields.js'

const severityRange = `severity deve estar entre ${MIN_SEVERITY} e ${MAX_SEVERITY}`

/** Body do POST /occurrences: snake_case no HTTP, camelCase depois de validado. */
export const createOccurrenceBodySchema = z
  .object({
    site_id: requiredText('site_id'),
    drone_id: requiredText('drone_id'),
    type: oneOf('type', OCCURRENCE_TYPES),
    severity: z
      .number({
        required_error: 'severity é obrigatório',
        invalid_type_error: 'severity deve ser um número',
      })
      .int('severity deve ser um número inteiro')
      .min(MIN_SEVERITY, severityRange)
      .max(MAX_SEVERITY, severityRange),
    detected_at: z
      .string({
        required_error: 'detected_at é obrigatório',
        invalid_type_error: 'detected_at deve ser um texto',
      })
      .datetime({
        offset: true,
        message: 'detected_at deve ser uma data ISO 8601 (ex.: 2026-09-25T14:00:00Z)',
      }),
  })
  .transform((body) => ({
    siteId: body.site_id,
    droneId: body.drone_id,
    type: body.type,
    severity: body.severity,
    detectedAt: new Date(body.detected_at),
  }))

export type CreateOccurrenceBody = z.input<typeof createOccurrenceBodySchema>
export type CreateOccurrenceInput = z.output<typeof createOccurrenceBodySchema>
