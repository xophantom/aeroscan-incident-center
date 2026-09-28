import type { ErrorCode } from '@aeroscan/shared'
import { HttpException, type HttpStatus } from '@nestjs/common'

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
