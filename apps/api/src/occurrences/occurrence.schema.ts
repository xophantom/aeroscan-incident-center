import {
  MAX_SEVERITY,
  MIN_SEVERITY,
  OCCURRENCE_STATUSES,
  OCCURRENCE_TYPES,
  type OccurrenceStatus,
  type OccurrenceType,
} from '@aeroscan/shared'
import { Schema, type Types } from 'mongoose'

export const OCCURRENCE_MODEL = 'Occurrence'

export interface OccurrenceDocument {
  siteId: string
  droneId: string
  type: OccurrenceType
  severity: number
  /** Denormalizado (severity × peso) para filtrar e ordenar no banco. */
  priority: number
  status: OccurrenceStatus
  count: number
  note: string | null
  detectedAt: Date
  lastDetectedAt: Date
  /** true enquanto a ocorrência pode receber alertas agrupados. */
  activeWindow: boolean
  createdAt: Date
  updatedAt: Date
}

export type LeanOccurrence = OccurrenceDocument & { _id: Types.ObjectId }

export const OccurrenceSchema = new Schema<OccurrenceDocument>(
  {
    siteId: { type: String, required: true },
    droneId: { type: String, required: true },
    type: { type: String, enum: OCCURRENCE_TYPES, required: true },
    severity: { type: Number, min: MIN_SEVERITY, max: MAX_SEVERITY, required: true },
    priority: { type: Number, required: true },
    status: { type: String, enum: OCCURRENCE_STATUSES, required: true },
    count: { type: Number, min: 1, required: true },
    note: { type: String, default: null },
    detectedAt: { type: Date, required: true },
    lastDetectedAt: { type: Date, required: true },
    activeWindow: { type: Boolean, required: true },
  },
  { collection: 'occurrences', timestamps: true, versionKey: false },
)

// Listagem: filtros por igualdade seguidos da ordenação, tudo no mesmo índice
OccurrenceSchema.index({ status: 1, siteId: 1, priority: -1, detectedAt: -1 })

// Garantia do dedup sob concorrência: no máximo uma janela ativa por site+tipo
OccurrenceSchema.index(
  { siteId: 1, type: 1 },
  { name: 'uniq_active_window', unique: true, partialFilterExpression: { activeWindow: true } },
)
