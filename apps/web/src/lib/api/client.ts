import { isErrorResponse, type ErrorCode } from '@aeroscan/shared'
import { API_URL } from './config'

type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ClientErrorCode,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'PATCH'
  body?: unknown
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Não foi possível conectar à API.', 0, 'NETWORK_ERROR')
  }

  const payload: unknown = await response.json().catch(() => null)
  if (response.ok) return payload as T

  if (isErrorResponse(payload)) {
    const { code, message, details } = payload.error
    throw new ApiError(message, response.status, code, details)
  }
  throw new ApiError(
    `Resposta inesperada da API (HTTP ${response.status}).`,
    response.status,
    'UNEXPECTED_RESPONSE',
  )
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Erro inesperado.'
}
