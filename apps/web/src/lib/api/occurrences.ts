import type { OccurrenceResponse, OccurrenceStatus, UpdateStatusBody } from '@aeroscan/shared'
import { apiRequest } from './client'

export function listOccurrences(status?: OccurrenceStatus): Promise<OccurrenceResponse[]> {
  const query = status ? `?${new URLSearchParams({ status }).toString()}` : ''
  return apiRequest(`/occurrences${query}`)
}

export function updateOccurrenceStatus(
  id: string,
  body: UpdateStatusBody,
): Promise<OccurrenceResponse> {
  return apiRequest(`/occurrences/${encodeURIComponent(id)}/status`, { method: 'PATCH', body })
}
