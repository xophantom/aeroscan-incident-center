import { z } from 'zod'
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from '../domain/occurrence.js'
import { REQUEST_BODY_MESSAGE, blankToUndefined } from './fields.js'

export const NOTE_MAX_LENGTH = 1000
export const NOTE_REQUIRED_MESSAGE = 'A nota é obrigatória para resolver a ocorrência'

const resolutionNoteSchema = z
  .string({ required_error: NOTE_REQUIRED_MESSAGE, invalid_type_error: 'note deve ser um texto' })
  .trim()
  .min(1, NOTE_REQUIRED_MESSAGE)
  .max(NOTE_MAX_LENGTH, `A nota deve ter no máximo ${NOTE_MAX_LENGTH} caracteres`)

/**
 * Body do PATCH /occurrences/:id/status, discriminado por `status`. Transição (409) e existência
 * (404) vêm antes da nota: por isso `open` é aceito aqui e a nota, se vazia, vale como ausente.
 */
export const updateStatusBodySchema = z.discriminatedUnion(
  'status',
  [
    z.object({ status: z.literal('open' satisfies OccurrenceStatus) }),
    z.object({ status: z.literal('acknowledged' satisfies OccurrenceStatus) }),
    z.object({
      status: z.literal('resolved' satisfies OccurrenceStatus),
      // null (como a API devolve "sem nota") ou texto em branco: nota ausente
      note: z.preprocess(
        (value) => (value === null ? undefined : blankToUndefined(value)),
        resolutionNoteSchema.optional(),
      ),
    }),
  ],
  {
    // No nível da union só há dois erros: status desconhecido ou corpo que não é objeto
    errorMap: (issue) => ({
      message:
        issue.code === 'invalid_union_discriminator'
          ? `status deve ser um de: ${OCCURRENCE_STATUSES.join(', ')}`
          : REQUEST_BODY_MESSAGE,
    }),
  },
)

export type UpdateStatusBody = z.input<typeof updateStatusBodySchema>
export type UpdateStatusInput = z.output<typeof updateStatusBodySchema>

/** Formulário "Resolver" do front: a nota é obrigatória e segue as mesmas regras do PATCH. */
export const resolveFormSchema = z.object({ note: resolutionNoteSchema })
