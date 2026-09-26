import {
  occurrenceResponseSchema,
  type OccurrenceResponse,
  type OccurrenceStatus,
  type UpdateStatusBody,
} from '@aeroscan/shared'
import { z } from 'zod'
import { apiRequest } from './client'

const occurrenceListSchema = z.array(occurrenceResponseSchema)

/** Sem status, lista todas; com vários, repete o parâmetro (?status=open&status=acknowledged). */
export function listOccurrences(
  statuses: readonly OccurrenceStatus[] = [],
): Promise<OccurrenceResponse[]> {
  const query = new URLSearchParams(statuses.map((status) => ['status', status])).toString()
  return apiRequest(`/occurrences${query ? `?${query}` : ''}`, occurrenceListSchema)
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
