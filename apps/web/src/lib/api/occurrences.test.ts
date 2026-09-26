import { afterEach, describe, expect, it, vi } from 'vitest'
import { listOccurrences } from './occurrences'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listOccurrences', () => {
  it.each([
    [[], '/occurrences'],
    [['open'], '/occurrences?status=open'],
    [['open', 'acknowledged'], '/occurrences?status=open&status=acknowledged'],
  ] as const)('%j → %s', async (statuses, url) => {
    const fetch = vi.fn(() => Promise.resolve(new Response('[]', { status: 200 })))
    vi.stubGlobal('fetch', fetch)

    await listOccurrences(statuses)

    expect(fetch).toHaveBeenCalledWith(url, expect.anything())
  })
})
