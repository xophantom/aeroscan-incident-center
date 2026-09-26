import { describe, expect, it } from 'vitest'
import { resolveApiUrl } from './config'

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
