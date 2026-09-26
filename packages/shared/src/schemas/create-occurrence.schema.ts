import { z } from 'zod'
import { MAX_SEVERITY, MIN_SEVERITY, OCCURRENCE_TYPES } from '../domain/occurrence.js'
import { oneOf, requestBody, requiredText } from './fields.js'

const severityRange = `severity deve estar entre ${MIN_SEVERITY} e ${MAX_SEVERITY}`
const isoDate = 'detectedAt deve ser uma data ISO 8601 com fuso, como AAAA-MM-DDThh:mm:ssZ'

export const createOccurrenceBodySchema = requestBody({
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
    .datetime({ offset: true, message: isoDate })
    // O formato aceita offsets como +24:00, que não viram data de verdade
    .transform((value, ctx) => {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return date
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: isoDate })
      return z.NEVER
    }),
})

export type CreateOccurrenceBody = z.input<typeof createOccurrenceBodySchema>
export type CreateOccurrenceInput = z.output<typeof createOccurrenceBodySchema>
