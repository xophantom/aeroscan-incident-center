import { z } from 'zod'
import { OCCURRENCE_STATUSES, OCCURRENCE_TYPES } from '../domain/occurrence.js'

export const occurrenceResponseSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  droneId: z.string(),
  type: z.enum(OCCURRENCE_TYPES),
  severity: z.number().int(),
  priority: z.number().int(),
  status: z.enum(OCCURRENCE_STATUSES),
  count: z.number().int(),
  note: z.string().nullable(),
  detectedAt: z.string().datetime(),
  lastDetectedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type OccurrenceResponse = z.infer<typeof occurrenceResponseSchema>
