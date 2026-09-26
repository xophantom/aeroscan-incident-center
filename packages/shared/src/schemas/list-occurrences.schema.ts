import { z } from 'zod'
import { OCCURRENCE_STATUSES } from '../domain/occurrence.js'
import { oneOf, optionalQueryParam, textField } from './fields.js'

const status = oneOf('status', OCCURRENCE_STATUSES)

// ?status=open ou o parâmetro repetido (?status=open&status=acknowledged) para mais de um status
const statusList = z.preprocess(
  (value) => (typeof value === 'string' ? [value] : value),
  z.array(status, { invalid_type_error: 'status deve ser um texto ou uma lista de textos' }),
)

export const listOccurrencesQuerySchema = z.object({
  status: optionalQueryParam(statusList),
  siteId: optionalQueryParam(textField('siteId')),
})

export type OccurrenceFilter = z.output<typeof listOccurrencesQuerySchema>
