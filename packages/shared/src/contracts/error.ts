import { z } from 'zod'

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'NOT_FOUND',
  'OCCURRENCE_NOT_FOUND',
  'INVALID_STATUS_TRANSITION',
  'WRITE_CONFLICT',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/** Envelope único de erro da API. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

/** Item de `details` em VALIDATION_ERROR. */
export interface ValidationIssue {
  path: string
  message: string
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return errorResponseSchema.safeParse(value).success
}
