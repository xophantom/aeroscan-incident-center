import type { OccurrenceResponse } from '@aeroscan/shared'
import type { Occurrence } from './occurrence'

/** Entidade → contrato HTTP: datas viram ISO string e só os campos do contrato saem. */
export function toOccurrenceResponse(occurrence: Occurrence): OccurrenceResponse {
  return {
    id: occurrence.id,
    siteId: occurrence.siteId,
    droneId: occurrence.droneId,
    type: occurrence.type,
    severity: occurrence.severity,
    priority: occurrence.priority,
    status: occurrence.status,
    count: occurrence.count,
    note: occurrence.note,
    detectedAt: occurrence.detectedAt.toISOString(),
    lastDetectedAt: occurrence.lastDetectedAt.toISOString(),
    createdAt: occurrence.createdAt.toISOString(),
    updatedAt: occurrence.updatedAt.toISOString(),
  }
}
