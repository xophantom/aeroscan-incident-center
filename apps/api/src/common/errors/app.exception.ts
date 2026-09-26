import { HttpException, type HttpStatus } from '@nestjs/common'
import type { ErrorCode } from '@aeroscan/shared'

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
