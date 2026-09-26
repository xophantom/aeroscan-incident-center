import { HttpException, type HttpStatus } from '@nestjs/common'
import type { ErrorCode } from '@aeroscan/shared'

/** Erro de negócio já no formato do envelope `{ error: { code, message, details? } }`. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super(message, status)
  }
}
