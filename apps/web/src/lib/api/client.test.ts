import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client'

function stubFetch(result: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result))),
  )
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function apiError(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.catch((caught: unknown) => caught)
  if (error instanceof ApiError) return error
  throw new Error('esperava ApiError')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('devolve o JSON de respostas 2xx', async () => {
    stubFetch(json([{ id: 'a' }], 200))

    await expect(apiRequest('/occurrences')).resolves.toEqual([{ id: 'a' }])
  })

  it('converte o envelope de erro da API em ApiError', async () => {
    const details = { from: 'open', to: 'resolved' }
    stubFetch(json({ error: { code: 'INVALID_STATUS_TRANSITION', message: 'x', details } }, 409))

    const error = await apiError(apiRequest('/occurrences/1/status', { method: 'PATCH', body: {} }))

    expect(error).toMatchObject({
      status: 409,
      code: 'INVALID_STATUS_TRANSITION',
      message: 'x',
      details,
    })
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    stubFetch(new TypeError('Failed to fetch'))

    const error = await apiError(apiRequest('/occurrences'))

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('erro fora do envelope vira UNEXPECTED_RESPONSE', async () => {
    stubFetch(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const error = await apiError(apiRequest('/occurrences'))

    expect(error).toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE' })
  })
})
