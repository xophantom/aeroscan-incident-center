import { z } from 'zod'
import { OCCURRENCE_STATUSES } from '../domain/occurrence.js'
import { TEXT_MAX_LENGTH, oneOf, optionalQueryParam } from './fields.js'

const siteIdFilter = z
  .string()
  .trim()
  .max(TEXT_MAX_LENGTH, `site_id deve ter no máximo ${TEXT_MAX_LENGTH} caracteres`)

/** Query do GET /occurrences: filtros opcionais. */
export const listOccurrencesQuerySchema = z
  .object({
    status: optionalQueryParam(oneOf('status', OCCURRENCE_STATUSES)),
    site_id: optionalQueryParam(siteIdFilter),
    // Grafia usada no enunciado (?siteId=); o contrato canônico é snake_case
    siteId: optionalQueryParam(siteIdFilter),
  })
  .transform((query) => ({
    status: query.status,
    siteId: query.site_id ?? query.siteId,
  }))

export type ListOccurrencesQuery = z.input<typeof listOccurrencesQuerySchema>
export type OccurrenceFilter = z.output<typeof listOccurrencesQuerySchema>
