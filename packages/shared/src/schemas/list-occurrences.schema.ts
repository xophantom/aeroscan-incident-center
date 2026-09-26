import { z } from 'zod'
import { OCCURRENCE_STATUSES } from '../domain/occurrence.js'
import { TEXT_MAX_LENGTH, oneOf, optionalQueryParam } from './fields.js'

/** Query do GET /occurrences?status=&siteId=: filtros opcionais. */
export const listOccurrencesQuerySchema = z.object({
  status: optionalQueryParam(oneOf('status', OCCURRENCE_STATUSES)),
  siteId: optionalQueryParam(
    z
      .string()
      .trim()
      .max(TEXT_MAX_LENGTH, `siteId deve ter no máximo ${TEXT_MAX_LENGTH} caracteres`),
  ),
})

export type ListOccurrencesQuery = z.input<typeof listOccurrencesQuerySchema>
export type OccurrenceFilter = z.output<typeof listOccurrencesQuerySchema>
