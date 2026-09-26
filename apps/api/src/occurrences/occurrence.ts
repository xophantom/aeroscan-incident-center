import type { OccurrenceStatus, OccurrenceType } from '@aeroscan/shared'

export interface Occurrence {
  id: string
  siteId: string
  droneId: string
  type: OccurrenceType
  severity: number
  priority: number
  status: OccurrenceStatus
  count: number
  note: string | null
  detectedAt: Date
  lastDetectedAt: Date
  createdAt: Date
  updatedAt: Date
}
