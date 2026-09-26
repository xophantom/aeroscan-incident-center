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
import { MongoHealth } from '../../infra/mongo/mongo-health'
import { AppException } from './app.exception'

interface ErrorReply {
  status: number
  body: ErrorResponse
}

const HTTP_ERRORS: Partial<Record<number, { code: ErrorCode; message: string }>> = {
  [HttpStatus.BAD_REQUEST]: {
    code: 'BAD_REQUEST',
    message: 'Requisição malformada (JSON ou URL inválidos)',
  },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Rota não encontrada' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Corpo da requisição acima do limite permitido',
  },
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Codificação do corpo não suportada',
  },
}

// Erros passageiros: o cliente pode repetir o pedido
const TRANSIENT_CODES: ReadonlySet<ErrorCode> = new Set(['WRITE_CONFLICT', 'SERVICE_UNAVAILABLE'])

// Banco fora: o driver falha ao achar o servidor ou na rede; se o Mongoose já percebeu a queda, a
// conexão aparece como desconectada
const DATABASE_DOWN_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
])

/** Toda resposta de erro sai no envelope `{ error: { code, message, details? } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly mongo: MongoHealth) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = this.isDatabaseDown(exception)
      ? reply(HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 'Banco de dados indisponível')
      : toErrorReply(exception)
    if (status >= 500) this.logger.error(exception)

    const response = host.switchToHttp().getResponse<Response>()
    if (TRANSIENT_CODES.has(body.error.code)) response.setHeader('Retry-After', '1')
    response.status(status).json(body)
  }

  private isDatabaseDown(exception: unknown): boolean {
    if (exception instanceof HttpException) return false
    const driverError = exception instanceof Error && DATABASE_DOWN_ERRORS.has(exception.name)
    return driverError || !this.mongo.isConnected()
  }
}

function toErrorReply(exception: unknown): ErrorReply {
  if (exception instanceof AppException) {
    return reply(exception.getStatus(), exception.code, exception.message, exception.details)
  }

  const status = httpStatusOf(exception)
  const known = HTTP_ERRORS[status]
  if (known) return reply(status, known.code, known.message)
  if (status < 500) return reply(status, 'BAD_REQUEST', 'Requisição inválida')
  return reply(status, 'INTERNAL_ERROR', 'Erro interno do servidor')
}

// O Nest lança HttpException; o body-parser (413, 415...) lança http-errors, que só trazem `status`
function httpStatusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus()

  const status =
    typeof exception === 'object' && exception !== null && 'status' in exception
      ? exception.status
      : undefined
  return typeof status === 'number' && status >= 400 && status < 600
    ? status
    : HttpStatus.INTERNAL_SERVER_ERROR
}

function reply(status: number, code: ErrorCode, message: string, details?: unknown): ErrorReply {
  return {
    status,
    body: { error: { code, message, ...(details === undefined ? {} : { details }) } },
  }
}
