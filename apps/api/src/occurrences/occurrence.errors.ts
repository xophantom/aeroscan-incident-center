import {
  HOUR_MS,
  MAX_ALERT_AGE_MS,
  MAX_FUTURE_SKEW_MS,
  MINUTE_MS,
  STATUS_TRANSITIONS,
  type OccurrenceStatus,
} from '@aeroscan/shared'
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
  const next = STATUS_TRANSITIONS[from]
  const hint =
    next.length > 0
      ? `De ${from} só é possível ir para ${next.join(' ou ')}.`
      : `${from} é um status final.`
  return new AppException(
    'INVALID_STATUS_TRANSITION',
    `Transição inválida: ${from} → ${to}. ${hint}`,
    HttpStatus.CONFLICT,
    { from, to },
  )
}

export function detectedAtInFuture(): AppException {
  return invalidDetectedAt(
    `detectedAt não pode estar mais de ${MAX_FUTURE_SKEW_MS / MINUTE_MS} min no futuro`,
  )
}

export function detectedAtTooOld(): AppException {
  return invalidDetectedAt(
    `detectedAt não pode ter mais de ${MAX_ALERT_AGE_MS / HOUR_MS} h de atraso`,
  )
}

function invalidDetectedAt(message: string): AppException {
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
