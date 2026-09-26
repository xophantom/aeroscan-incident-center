import type { OccurrenceResponse } from '@aeroscan/shared'
import type { Occurrence } from './occurrence'

/** Entidade (camelCase, Date) → contrato HTTP (snake_case, ISO string). */
export function toOccurrenceResponse(occurrence: Occurrence): OccurrenceResponse {
  return {
    id: occurrence.id,
    site_id: occurrence.siteId,
    drone_id: occurrence.droneId,
    type: occurrence.type,
    severity: occurrence.severity,
    priority: occurrence.priority,
    status: occurrence.status,
    count: occurrence.count,
    note: occurrence.note,
    detected_at: occurrence.detectedAt.toISOString(),
    last_detected_at: occurrence.lastDetectedAt.toISOString(),
    created_at: occurrence.createdAt.toISOString(),
    updated_at: occurrence.updatedAt.toISOString(),
  }
}
