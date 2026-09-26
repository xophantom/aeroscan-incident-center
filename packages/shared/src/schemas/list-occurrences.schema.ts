import { z } from 'zod'
import { OCCURRENCE_STATUSES } from '../domain/occurrence.js'
import { oneOf, optionalQueryParam, textField } from './fields.js'

export const listOccurrencesQuerySchema = z.object({
  status: optionalQueryParam(oneOf('status', OCCURRENCE_STATUSES)),
  siteId: optionalQueryParam(textField('siteId')),
})

export type OccurrenceFilter = z.output<typeof listOccurrencesQuerySchema>
