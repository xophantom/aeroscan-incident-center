import { describe, expect, it } from 'vitest'
import { resolveApiUrl, resolveEventsUrl } from './config'

describe('resolveApiUrl', () => {
  it('VITE_API_URL tem prioridade (sem barra final)', () => {
    expect(resolveApiUrl('https://api.exemplo.com/', 'file:')).toBe('https://api.exemplo.com')
  })

  it('aberto via file:// usa a API local', () => {
    expect(resolveApiUrl(undefined, 'file:')).toBe('http://localhost:3000')
  })

  it('servido por http usa a mesma origem', () => {
    expect(resolveApiUrl(undefined, 'http:')).toBe('')
    expect(resolveApiUrl('', 'https:')).toBe('')
  })
})

describe('resolveEventsUrl', () => {
  it.each([
    ['aberto via file://', 'http://localhost:3000', 'ws://localhost:3000/events'],
    ['com VITE_API_URL em https', 'https://api.exemplo.com', 'wss://api.exemplo.com/events'],
  ])('%s usa o endereço da API', (_case, apiUrl, expected) => {
    expect(resolveEventsUrl(apiUrl, { protocol: 'file:', host: '' })).toBe(expected)
  })

  it.each([
    ['http:', 'localhost:3000', 'ws://localhost:3000/events'],
    ['https:', 'triagem.exemplo.com', 'wss://triagem.exemplo.com/events'],
  ])('mesma origem em %s usa o host da página', (protocol, host, expected) => {
    expect(resolveEventsUrl('', { protocol, host })).toBe(expected)
  })
})
