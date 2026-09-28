import type { OccurrenceResponse } from '@aeroscan/shared'
import type { Occurrence } from './occurrence'

export function toOccurrenceResponse(occurrence: Occurrence): OccurrenceResponse {
  return {
    id: occurrence.id,
    siteId: occurrence.siteId,
    droneId: occurrence.droneId,
    droneIds: occurrence.droneIds,
    alerts: occurrence.alerts.map((alert) => ({
      droneId: alert.droneId,
      detectedAt: alert.detectedAt.toISOString(),
    })),
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
