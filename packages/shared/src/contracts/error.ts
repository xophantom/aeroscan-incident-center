import { z } from 'zod'

const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'NOT_FOUND',
  'OCCURRENCE_NOT_FOUND',
  'INVALID_STATUS_TRANSITION',
  'WRITE_CONFLICT',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/** Envelope de todo erro da API, exceto o 503 do /health, que responde { status, mongo }. */
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
