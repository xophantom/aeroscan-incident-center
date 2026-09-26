import { type ArgumentsHost, HttpStatus, Logger } from '@nestjs/common'
import { AllExceptionsFilter } from './all-exceptions.filter'
import { AppException } from './app.exception'

function respond(exception: unknown) {
  const response = {
    headers: {} as Record<string, string>,
    statusCode: 0,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost
  new AllExceptionsFilter().catch(exception, host)
  return response
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
})

describe('AllExceptionsFilter', () => {
  it('erro passageiro (WRITE_CONFLICT) sai como 503 com Retry-After', () => {
    const response = respond(
      new AppException('WRITE_CONFLICT', 'tente de novo', HttpStatus.SERVICE_UNAVAILABLE),
    )

    expect(response.statusCode).toBe(503)
    expect(response.headers).toEqual({ 'Retry-After': '1' })
    expect(response.body).toEqual({ error: { code: 'WRITE_CONFLICT', message: 'tente de novo' } })
  })

  it('http-errors do body-parser mantêm o status 4xx', () => {
    const response = respond(Object.assign(new Error('request entity too large'), { status: 413 }))

    expect(response.statusCode).toBe(413)
    expect(response.body).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } })
  })

  it('erro desconhecido vira 500 sem expor a mensagem interna', () => {
    const response = respond(new Error('detalhe interno'))

    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  })
})
