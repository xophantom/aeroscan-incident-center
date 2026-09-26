import { z } from 'zod'
import { OCCURRENCE_STATUSES } from '../domain/occurrence.js'
import { blankToUndefined, oneOf, optionalQueryParam, textField } from './fields.js'

const status = oneOf('status', OCCURRENCE_STATUSES)

// ?status=open ou o parâmetro repetido (?status=open&status=acknowledged); valor vazio não filtra
const statusList = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return typeof value === 'string' ? [value] : value
    const filled = value.filter((item) => blankToUndefined(item) !== undefined)
    return filled.length > 0 ? filled : undefined
  },
  z
    .array(status, { invalid_type_error: 'status deve ser um texto ou uma lista de textos' })
    .optional(),
)

export const listOccurrencesQuerySchema = z.object({
  status: optionalQueryParam(statusList),
  siteId: optionalQueryParam(textField('siteId')),
})

export type OccurrenceFilter = z.output<typeof listOccurrencesQuerySchema>
