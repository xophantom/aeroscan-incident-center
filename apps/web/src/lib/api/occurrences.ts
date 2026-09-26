import {
  occurrenceResponseSchema,
  type OccurrenceResponse,
  type OccurrenceStatus,
  type UpdateStatusBody,
} from '@aeroscan/shared'
import { z } from 'zod'
import { apiRequest } from './client'

const occurrenceListSchema = z.array(occurrenceResponseSchema)

export function listOccurrences(status?: OccurrenceStatus): Promise<OccurrenceResponse[]> {
  const query = status ? `?${new URLSearchParams({ status }).toString()}` : ''
  return apiRequest(`/occurrences${query}`, occurrenceListSchema)
}

export function updateOccurrenceStatus(
  id: string,
  body: UpdateStatusBody,
): Promise<OccurrenceResponse> {
  return apiRequest(`/occurrences/${encodeURIComponent(id)}/status`, occurrenceResponseSchema, {
    method: 'PATCH',
    body,
  })
}
