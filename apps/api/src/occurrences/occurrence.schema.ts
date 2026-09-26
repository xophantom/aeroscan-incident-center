import { MAX_SEVERITY, MIN_SEVERITY, OCCURRENCE_STATUSES, OCCURRENCE_TYPES } from '@aeroscan/shared'
import { Schema, type Types } from 'mongoose'
import type { Occurrence } from './occurrence'

export const OCCURRENCE_MODEL = 'Occurrence'

export interface OccurrenceDocument extends Omit<Occurrence, 'id'> {
  /** Ordem de criação no site+tipo (1, 2, 3...): a versão do controle otimista do dedup. */
  seq: number
  /** Chaves (alertKey) dos alertas já contados aqui: o reenvio de um deles não conta de novo. */
  alertKeys: string[]
  /** Quando deixou de estar aberta: alerta detectado antes disso ainda entra, mesmo atrasado. */
  acknowledgedAt: Date | null
}

export type LeanOccurrence = OccurrenceDocument & { _id: Types.ObjectId }

export const OccurrenceSchema = new Schema<OccurrenceDocument>(
  {
    siteId: { type: String, required: true },
    droneId: { type: String, required: true },
    droneIds: { type: [String], required: true },
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
    // Cresce com o count; fica fora das leituras
    alertKeys: { type: [String], required: true, select: false },
    acknowledgedAt: { type: Date, default: null },
  },
  { collection: 'occurrences', timestamps: true, versionKey: false },
)

// Listagem: igualdade do filtro seguida da ordenação, para nenhuma combinação ordenar em memória
OccurrenceSchema.index({ priority: -1, detectedAt: -1, _id: -1 }) // sem filtro
OccurrenceSchema.index({ status: 1, priority: -1, detectedAt: -1, _id: -1 }) // ?status=
OccurrenceSchema.index({ siteId: 1, priority: -1, detectedAt: -1, _id: -1 }) // ?siteId= (com ou sem status)

// Busca do agrupamento: site e tipo por igualdade, detectedAt como faixa e ordenação. O status e o
// reconhecimento são conferidos depois, entre as poucas ocorrências da janela.
OccurrenceSchema.index({ siteId: 1, type: 1, detectedAt: 1 })

// Reenvio: a chave de um alerta só pode estar em uma ocorrência
OccurrenceSchema.index({ alertKeys: 1 }, { name: 'uniq_alert_key', unique: true })

// Controle otimista do dedup: duas criações do mesmo site+tipo não gravam a mesma versão
OccurrenceSchema.index(
  { siteId: 1, type: 1, seq: 1 },
  { name: 'uniq_creation_version', unique: true },
)
