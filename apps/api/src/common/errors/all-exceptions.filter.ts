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

// Banco fora: o driver do Mongo falha ao achar o servidor ou na rede
const DATABASE_DOWN_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
])

/** Toda exceção vira resposta no envelope `{ error: { code, message, details? } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toErrorReply(exception)
    const transient = TRANSIENT_CODES.has(body.error.code)
    // Passageiro (banco fora, conflito de escrita) cabe numa linha; os demais 5xx vão com o stack
    if (transient) this.logger.warn(`${body.error.code}: ${messageOf(exception)}`)
    else if (status >= 500) this.logger.error(exception)

    const response = host.switchToHttp().getResponse<Response>()
    if (transient) response.setHeader('Retry-After', '1')
    response.status(status).json(body)
  }
}

function toErrorReply(exception: unknown): ErrorReply {
  if (exception instanceof AppException) {
    return reply(exception.getStatus(), exception.code, exception.message, exception.details)
  }
  if (exception instanceof Error && DATABASE_DOWN_ERRORS.has(exception.name)) {
    return reply(
      HttpStatus.SERVICE_UNAVAILABLE,
      'SERVICE_UNAVAILABLE',
      'Banco de dados indisponível',
    )
  }

  const status = httpStatusOf(exception)
  const known = HTTP_ERRORS[status]
  if (known) return reply(status, known.code, known.message)
  // Outros 4xx do framework não ocorrem nestas rotas; se ocorrerem, saem como 400
  if (status < 500) return reply(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'Requisição inválida')
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

function messageOf(exception: unknown): string {
  return exception instanceof Error ? exception.message : String(exception)
}

function reply(status: number, code: ErrorCode, message: string, details?: unknown): ErrorReply {
  return {
    status,
    body: { error: { code, message, ...(details === undefined ? {} : { details }) } },
  }
}
