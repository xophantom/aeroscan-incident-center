import type { OccurrenceResponse } from '@aeroscan/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api/client'
import { listOccurrences } from '../../lib/api/occurrences'
import { deferred, occurrence } from '../../test/fixtures'
import { useOccurrences } from './use-occurrences'
import type { StatusFilterValue } from './use-status-filter'

vi.mock('../../lib/api/occurrences')

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useOccurrences', () => {
  it('ignora a resposta atrasada de um filtro anterior', async () => {
    const openList = deferred<OccurrenceResponse[]>()
    const resolvedList = deferred<OccurrenceResponse[]>()
    vi.mocked(listOccurrences)
      .mockReturnValueOnce(openList.promise)
      .mockReturnValueOnce(resolvedList.promise)
    const resolvedItem = occurrence({ id: 'r', status: 'resolved' })

    const { result, rerender } = renderHook(({ filter }) => useOccurrences(filter), {
      initialProps: { filter: 'open' as StatusFilterValue },
    })
    rerender({ filter: 'resolved' })

    resolvedList.resolve([resolvedItem])
    await waitFor(() => expect(result.current.state).toMatchObject({ items: [resolvedItem] }))

    await act(async () => {
      openList.resolve([occurrence({ id: 'o' })])
      await openList.promise
    })

    expect(result.current.state).toMatchObject({ items: [resolvedItem] })
  })

  it.each([
    ['active', ['open', 'acknowledged']],
    ['open', ['open']],
    ['all', []],
  ] as const)('filtro %s pede à API os status %j', async (filter, statuses) => {
    vi.mocked(listOccurrences).mockResolvedValue([])

    renderHook(() => useOccurrences(filter))

    await waitFor(() => expect(listOccurrences).toHaveBeenCalledWith(statuses))
  })

  it('falha ao atualizar mantém a lista na tela e avisa', async () => {
    const items = [occurrence()]
    vi.mocked(listOccurrences)
      .mockResolvedValueOnce(items)
      .mockRejectedValueOnce(new ApiError('Não foi possível conectar à API.', 'NETWORK_ERROR'))
    const { result } = renderHook(() => useOccurrences('all'))
    await waitFor(() => expect(result.current.state.kind).toBe('success'))

    await act(() => result.current.refetch())

    expect(result.current.state).toEqual({
      kind: 'success',
      items,
      refreshError: 'Não foi possível conectar à API.',
    })
    expect(result.current.refreshing).toBe(false)
  })
})
