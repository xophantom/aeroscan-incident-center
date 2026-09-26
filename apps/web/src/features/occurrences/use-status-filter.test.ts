import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStatusFilter } from './use-status-filter'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('useStatusFilter', () => {
  it('abre em "open" sem parâmetro na URL', () => {
    const { result } = renderHook(() => useStatusFilter())

    expect(result.current[0]).toBe('open')
  })

  it.each([
    ['?status=resolved', 'resolved'],
    ['?status=all', 'all'],
    ['?status=qualquer', 'open'],
  ])('lê %s da URL como %s', (search, expected) => {
    window.history.replaceState(null, '', `/${search}`)

    const { result } = renderHook(() => useStatusFilter())

    expect(result.current[0]).toBe(expected)
  })

  it('grava na URL só o que difere do padrão', () => {
    const { result } = renderHook(() => useStatusFilter())

    act(() => result.current[1]('all'))
    expect(window.location.search).toBe('?status=all')

    act(() => result.current[1]('open'))
    expect(window.location.search).toBe('')
  })

  it('reaplicar o filtro ativo não empilha outra entrada no histórico', () => {
    const { result } = renderHook(() => useStatusFilter())
    const before = window.history.length

    act(() => result.current[1]('open'))

    expect(window.history.length).toBe(before)
  })
})
