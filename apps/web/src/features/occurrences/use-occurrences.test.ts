import type { OccurrenceResponse, OccurrenceStatus } from '@aeroscan/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listOccurrences } from '../../lib/api/occurrences'
import { deferred, occurrence } from '../../test/fixtures'
import { useOccurrences } from './use-occurrences'

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

    const { result, rerender } = renderHook(({ status }) => useOccurrences(status), {
      initialProps: { status: 'open' as OccurrenceStatus | undefined },
    })
    rerender({ status: 'resolved' })

    resolvedList.resolve([resolvedItem])
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'success', items: [resolvedItem] }),
    )

    await act(async () => {
      openList.resolve([occurrence({ id: 'o' })])
      await openList.promise
    })

    expect(result.current.state).toEqual({ kind: 'success', items: [resolvedItem] })
  })
})
