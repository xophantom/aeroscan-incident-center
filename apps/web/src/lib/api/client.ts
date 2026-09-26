import { isErrorResponse, type ErrorCode } from '@aeroscan/shared'
import type { ZodType } from 'zod'
import { API_URL } from './config'

const TIMEOUT_MS = 10_000

type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNEXPECTED_RESPONSE'

export class ApiError extends Error {
  constructor(
    message: string,
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

/** Chama a API e valida a resposta com o schema do contrato: formato inesperado vira ApiError. */
export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
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
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('A API demorou demais para responder.', 'TIMEOUT')
    }
    throw new ApiError('Não foi possível conectar à API.', 'NETWORK_ERROR')
  }

  const payload: unknown = await response.json().catch(() => null)
  if (response.ok) {
    const parsed = schema.safeParse(payload)
    if (parsed.success) return parsed.data
    console.error(`Resposta de ${path} fora do contrato da API`, parsed.error.issues)
  } else if (isErrorResponse(payload)) {
    const { code, message, details } = payload.error
    throw new ApiError(message, code, details)
  }
  throw new ApiError(`Resposta inesperada da API (HTTP ${response.status}).`, 'UNEXPECTED_RESPONSE')
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Erro inesperado.'
}
