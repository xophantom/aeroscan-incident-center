import { HttpStatus } from '@nestjs/common'
import type { ValidationIssue } from '@aeroscan/shared'
import { AppException } from './app.exception'

interface ZodErrorLike {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>
}

// O shared (ESM) e a API (CJS) carregam builds diferentes do zod: instanceof ZodError não é confiável
function isZodErrorLike(error: unknown): error is ZodErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ZodError' &&
    'issues' in error &&
    Array.isArray(error.issues)
  )
}

export function validationException(error: unknown): AppException {
  const issues: ValidationIssue[] = isZodErrorLike(error)
    ? error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      }))
    : []

  return new AppException(
    'VALIDATION_ERROR',
    issues[0]?.message ?? 'Dados inválidos',
    HttpStatus.UNPROCESSABLE_ENTITY,
    issues,
  )
}
