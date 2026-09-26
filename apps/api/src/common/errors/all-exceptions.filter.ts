import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { ErrorCode, ErrorResponse } from '@aeroscan/shared'
import type { Response } from 'express'
import { AppException } from './app.exception'
import { isZodErrorLike, validationException } from './validation'

interface ErrorReply {
  status: number
  body: ErrorResponse
}

/** Toda resposta de erro sai no envelope `{ error: { code, message, details? } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toErrorReply(exception)
    if (status >= 500) this.logger.error(exception)

    host.switchToHttp().getResponse<Response>().status(status).json(body)
  }
}

function toErrorReply(exception: unknown): ErrorReply {
  if (isZodErrorLike(exception)) return toErrorReply(validationException(exception))

  if (exception instanceof AppException) {
    return reply(exception.getStatus(), exception.code, exception.message, exception.details)
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    if (status === 404) return reply(status, 'NOT_FOUND', 'Rota não encontrada')
    if (status < 500) return reply(status, 'BAD_REQUEST', 'Requisição inválida')
  }

  return reply(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Erro interno do servidor')
}

function reply(status: number, code: ErrorCode, message: string, details?: unknown): ErrorReply {
  return {
    status,
    body: { error: { code, message, ...(details === undefined ? {} : { details }) } },
  }
}
