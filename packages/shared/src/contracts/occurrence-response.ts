import { z } from 'zod'
import {
  MAX_SEVERITY,
  MIN_SEVERITY,
  OCCURRENCE_STATUSES,
  OCCURRENCE_TYPES,
} from '../domain/occurrence.js'

export const occurrenceResponseSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  droneId: z.string(),
  droneIds: z.array(z.string()),
  // Cada alerta contado na ocorrência, do mais antigo ao mais recente
  alerts: z.array(z.object({ droneId: z.string(), detectedAt: z.string().datetime() })),
  type: z.enum(OCCURRENCE_TYPES),
  severity: z.number().int().min(MIN_SEVERITY).max(MAX_SEVERITY),
  priority: z.number().int().min(1),
  status: z.enum(OCCURRENCE_STATUSES),
  count: z.number().int().min(1),
  note: z.string().nullable(),
  detectedAt: z.string().datetime(),
  lastDetectedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type OccurrenceResponse = z.infer<typeof occurrenceResponseSchema>
