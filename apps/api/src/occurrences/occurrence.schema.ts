import { MAX_SEVERITY, MIN_SEVERITY, OCCURRENCE_STATUSES, OCCURRENCE_TYPES } from '@aeroscan/shared'
import { Schema, type Types } from 'mongoose'
import type { Occurrence } from './occurrence'

export const OCCURRENCE_MODEL = 'Occurrence'

export interface OccurrenceDocument extends Omit<Occurrence, 'id'> {
  /** Ordem de criação no site+tipo (1, 2, 3...): a versão do controle otimista do dedup. */
  seq: number
}

export type LeanOccurrence = OccurrenceDocument & { _id: Types.ObjectId }

export const OccurrenceSchema = new Schema<OccurrenceDocument>(
  {
    siteId: { type: String, required: true },
    droneId: { type: String, required: true },
    type: { type: String, enum: OCCURRENCE_TYPES, required: true },
    severity: { type: Number, min: MIN_SEVERITY, max: MAX_SEVERITY, required: true },
    // severity × peso do tipo, denormalizado para ordenar no banco
    priority: { type: Number, required: true },
    status: { type: String, enum: OCCURRENCE_STATUSES, required: true },
    count: { type: Number, min: 1, required: true },
    note: { type: String, default: null },
    detectedAt: { type: Date, required: true },
    lastDetectedAt: { type: Date, required: true },
    seq: { type: Number, min: 1, required: true },
  },
  { collection: 'occurrences', timestamps: true, versionKey: false },
)

// Listagem: igualdade do filtro seguida da ordenação, para nenhuma combinação ordenar em memória
OccurrenceSchema.index({ priority: -1, detectedAt: -1 }) // sem filtro
OccurrenceSchema.index({ status: 1, priority: -1, detectedAt: -1 }) // ?status=
OccurrenceSchema.index({ siteId: 1, priority: -1, detectedAt: -1 }) // ?siteId= (com ou sem status)

// Busca do agrupamento: site, tipo e status por igualdade; detectedAt como faixa e ordenação
OccurrenceSchema.index({ siteId: 1, type: 1, status: 1, detectedAt: 1 })

// Controle otimista do dedup: duas criações do mesmo site+tipo não gravam a mesma versão
OccurrenceSchema.index(
  { siteId: 1, type: 1, seq: 1 },
  { name: 'uniq_creation_version', unique: true },
)
