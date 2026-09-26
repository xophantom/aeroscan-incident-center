import { z } from 'zod'
import { OCCURRENCE_STATUSES } from '../domain/occurrence.js'
import { oneOf, optionalQueryParam, textField } from './fields.js'

/** Query do GET /occurrences?status=&siteId=: filtros opcionais. */
export const listOccurrencesQuerySchema = z.object({
  status: optionalQueryParam(oneOf('status', OCCURRENCE_STATUSES)),
  siteId: optionalQueryParam(textField('siteId')),
})

export type ListOccurrencesQuery = z.input<typeof listOccurrencesQuerySchema>
export type OccurrenceFilter = z.output<typeof listOccurrencesQuerySchema>
