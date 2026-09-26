import { z } from 'zod'
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from '../domain/occurrence.js'
import { REQUEST_BODY_MESSAGE } from './fields.js'

export const NOTE_MAX_LENGTH = 1000
const noteRequired = 'A nota é obrigatória para resolver a ocorrência'

export const resolutionNoteSchema = z
  .string({ required_error: noteRequired, invalid_type_error: 'note deve ser um texto' })
  .trim()
  .min(1, noteRequired)
  .max(NOTE_MAX_LENGTH, `A nota deve ter no máximo ${NOTE_MAX_LENGTH} caracteres`)

/**
 * Body do PATCH /occurrences/:id/status, discriminado por `status`.
 * `open` é aceito aqui de propósito: voltar para open é transição inválida (409), não dado inválido (422).
 */
export const updateStatusBodySchema = z.discriminatedUnion(
  'status',
  [
    z.object({ status: z.literal('open' satisfies OccurrenceStatus) }),
    z.object({ status: z.literal('acknowledged' satisfies OccurrenceStatus) }),
    z.object({
      status: z.literal('resolved' satisfies OccurrenceStatus),
      note: resolutionNoteSchema,
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

/** Formulário "Resolver" do front: mesma regra de nota do PATCH. */
export const resolveFormSchema = z.object({ note: resolutionNoteSchema })

export type ResolveFormValues = z.input<typeof resolveFormSchema>
