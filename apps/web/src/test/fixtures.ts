import type { OccurrenceResponse } from '@aeroscan/shared'

export function occurrence(overrides: Partial<OccurrenceResponse> = {}): OccurrenceResponse {
  const iso = '2026-09-25T14:00:00.000Z'
  return {
    id: '66f4a1c2e4b0a1b2c3d4e5f6',
    siteId: 'site-a',
    droneId: 'drone-1',
    type: 'intrusion',
    severity: 3,
    priority: 9,
    status: 'open',
    count: 1,
    note: null,
    detectedAt: iso,
    lastDetectedAt: iso,
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
