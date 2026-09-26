import { z } from 'zod'
import { OCCURRENCE_STATUSES } from '../domain/occurrence.js'
import { blankToUndefined, oneOf, optionalQueryParam, textField } from './fields.js'

const statusList = z.array(oneOf('status', OCCURRENCE_STATUSES), {
  invalid_type_error: 'status deve ser um texto ou uma lista de textos',
})

// ?status=open ou repetido (?status=open&status=acknowledged); valores vazios não filtram
function statusValues(value: unknown): unknown {
  const values = typeof value === 'string' ? [value] : value
  if (!Array.isArray(values)) return values
  const filled = values.filter((item) => blankToUndefined(item) !== undefined)
  return filled.length > 0 ? filled : undefined
}

export const listOccurrencesQuerySchema = z.object({
  status: optionalQueryParam(statusList, statusValues),
  siteId: optionalQueryParam(textField('siteId')),
})

export type OccurrenceFilter = z.output<typeof listOccurrencesQuerySchema>
