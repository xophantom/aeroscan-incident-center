import { z } from 'zod'
import { OCCURRENCE_STATUSES, OCCURRENCE_TYPES } from '../domain/occurrence.js'

export const occurrenceResponseSchema = z.object({
  id: z.string(),
  site_id: z.string(),
  drone_id: z.string(),
  type: z.enum(OCCURRENCE_TYPES),
  severity: z.number().int(),
  priority: z.number().int(),
  status: z.enum(OCCURRENCE_STATUSES),
  count: z.number().int(),
  note: z.string().nullable(),
  detected_at: z.string().datetime(),
  last_detected_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type OccurrenceResponse = z.infer<typeof occurrenceResponseSchema>
