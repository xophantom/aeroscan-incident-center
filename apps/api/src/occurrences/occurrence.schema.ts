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
  /**
   * Vaga única de criação por site+tipo (índice único parcial). Sai de true quando a ocorrência
   * deixa `open` ou quando um alerta posterior a encontra vencida.
   */
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

// Listagem: igualdade do filtro seguida da ordenação, para nenhuma combinação ordenar em memória
OccurrenceSchema.index({ priority: -1, detectedAt: -1 }) // sem filtro
OccurrenceSchema.index({ status: 1, priority: -1, detectedAt: -1 }) // ?status=
OccurrenceSchema.index({ siteId: 1, priority: -1, detectedAt: -1 }) // ?siteId= (com ou sem status)

// Busca do agrupamento: site, tipo e status por igualdade; detectedAt como faixa e ordenação
OccurrenceSchema.index({ siteId: 1, type: 1, status: 1, detectedAt: 1 })

// Garantia do dedup sob concorrência: no máximo uma janela ativa por site+tipo
OccurrenceSchema.index(
  { siteId: 1, type: 1 },
  { name: 'uniq_active_window', unique: true, partialFilterExpression: { activeWindow: true } },
)
