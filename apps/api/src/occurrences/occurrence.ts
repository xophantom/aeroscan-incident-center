import type { OccurrenceStatus, OccurrenceType } from '@aeroscan/shared'

export interface Occurrence {
  id: string
  siteId: string
  /** Drone do alerta que abriu a ocorrência. */
  droneId: string
  /** Todos os drones que reportaram alertas agrupados nela. */
  droneIds: string[]
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
