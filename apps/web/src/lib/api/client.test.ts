import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ApiError, apiRequest } from './client'

function stubFetch(result: Response | Error | DOMException) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (result instanceof Response ? Promise.resolve(result) : Promise.reject(result))),
  )
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const itemsSchema = z.array(z.object({ id: z.string() }))

async function apiError(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.catch((caught: unknown) => caught)
  if (error instanceof ApiError) return error
  throw new Error('esperava ApiError')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('apiRequest', () => {
  it('devolve a resposta 2xx validada pelo schema', async () => {
    stubFetch(json([{ id: 'a' }], 200))

    await expect(apiRequest('/occurrences', itemsSchema)).resolves.toEqual([{ id: 'a' }])
  })

  it('resposta 2xx fora do contrato vira UNEXPECTED_RESPONSE e registra o desvio', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(json(null, 200))

    const error = await apiError(apiRequest('/occurrences', itemsSchema))

    expect(error.code).toBe('UNEXPECTED_RESPONSE')
    expect(log).toHaveBeenCalledWith(
      'Resposta de /occurrences fora do contrato da API',
      expect.any(Array),
    )
  })

  it('converte o envelope de erro da API em ApiError', async () => {
    const details = { from: 'open', to: 'resolved' }
    stubFetch(json({ error: { code: 'INVALID_STATUS_TRANSITION', message: 'x', details } }, 409))

    const error = await apiError(
      apiRequest('/occurrences/1/status', itemsSchema, { method: 'PATCH', body: {} }),
    )

    expect(error).toMatchObject({ code: 'INVALID_STATUS_TRANSITION', message: 'x', details })
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    stubFetch(new TypeError('Failed to fetch'))

    const error = await apiError(apiRequest('/occurrences', itemsSchema))

    expect(error.code).toBe('NETWORK_ERROR')
  })

  it('API que não responde a tempo vira TIMEOUT', async () => {
    stubFetch(new DOMException('signal timed out', 'TimeoutError'))

    const error = await apiError(apiRequest('/occurrences', itemsSchema))

    expect(error.code).toBe('TIMEOUT')
  })

  it('erro fora do envelope vira UNEXPECTED_RESPONSE', async () => {
    stubFetch(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const error = await apiError(apiRequest('/occurrences', itemsSchema))

    expect(error).toMatchObject({
      code: 'UNEXPECTED_RESPONSE',
      message: 'Resposta inesperada da API (HTTP 502).',
    })
  })
})
