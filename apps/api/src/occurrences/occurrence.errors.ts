import type { OccurrenceStatus } from '@aeroscan/shared'
import { HttpStatus } from '@nestjs/common'
import { AppException } from '../common/errors/app.exception'

export function occurrenceNotFound(id: string): AppException {
  return new AppException(
    'OCCURRENCE_NOT_FOUND',
    `Ocorrência ${id} não encontrada`,
    HttpStatus.NOT_FOUND,
  )
}

export function invalidStatusTransition(
  from: OccurrenceStatus,
  to: OccurrenceStatus,
): AppException {
  return new AppException(
    'INVALID_STATUS_TRANSITION',
    `Transição inválida: ${from} → ${to}. O fluxo é open → acknowledged → resolved.`,
    HttpStatus.CONFLICT,
    { from, to },
  )
}

export function detectedAtInFuture(): AppException {
  const message = 'detectedAt não pode estar no futuro'
  return new AppException('VALIDATION_ERROR', message, HttpStatus.UNPROCESSABLE_ENTITY, [
    { path: 'detectedAt', message },
  ])
}

export function writeConflict(): AppException {
  return new AppException(
    'WRITE_CONFLICT',
    'Conflito de escrita concorrente. Tente novamente.',
    HttpStatus.CONFLICT,
  )
}
