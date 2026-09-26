import {
  MAX_SEVERITY,
  TYPE_WEIGHT,
  computePriority,
  dedupWindowStart,
  type CreateOccurrenceInput,
  type OccurrenceFilter,
  type OccurrenceStatus,
  type UpdateStatusInput,
} from '@aeroscan/shared'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { isObjectIdOrHexString, type FilterQuery, type Model } from 'mongoose'
import type { Occurrence } from './occurrence'
import { OCCURRENCE_MODEL, type LeanOccurrence, type OccurrenceDocument } from './occurrence.schema'

/** Prioridade desc; empate → detecção mais recente primeiro. */
export const LIST_ORDER = { priority: -1, detectedAt: -1 } as const

/** Único ponto que conhece Mongoose. */
@Injectable()
export class OccurrencesRepository implements OnModuleInit {
  constructor(@InjectModel(OCCURRENCE_MODEL) private readonly model: Model<OccurrenceDocument>) {}

  // O índice único parcial é parte da corretude do dedup: precisa existir antes da 1ª requisição
  async onModuleInit(): Promise<void> {
    await this.model.syncIndexes()
  }

  /**
   * Agrupa, de forma atômica, na ocorrência aberta mais antiga do site+tipo detectada a partir do
   * início da janela do alerta. Não exige a vaga ativa: um alerta fora de ordem acha a sua
   * ocorrência mesmo que outra requisição já tenha liberado a vaga dela.
   */
  async groupIntoOpenOccurrence(alert: CreateOccurrenceInput): Promise<Occurrence | null> {
    const doc = await this.model
      .findOneAndUpdate(
        {
          siteId: alert.siteId,
          type: alert.type,
          status: 'open',
          detectedAt: { $gte: dedupWindowStart(alert.detectedAt) },
        },
        // Update em pipeline: o banco calcula a partir do valor atual, sem ler-e-escrever
        [
          {
            $set: {
              count: { $add: ['$count', 1] },
              severity: { $min: [{ $add: ['$severity', 1] }, MAX_SEVERITY] },
              lastDetectedAt: { $max: ['$lastDetectedAt', alert.detectedAt] },
            },
          },
          { $set: { priority: { $multiply: ['$severity', TYPE_WEIGHT[alert.type]] } } },
        ],
        { new: true, sort: { detectedAt: 1 } },
      )
      .lean<LeanOccurrence>()

    return doc && toOccurrence(doc)
  }

  /**
   * Libera a vaga de janela ativa do site+tipo se ela venceu para este alerta. Fora de `open` a vaga
   * já foi liberada no changeStatus, e uma ocupante ainda válida nunca é tocada.
   */
  async closeStaleActiveWindow(alert: CreateOccurrenceInput): Promise<void> {
    await this.model.updateOne(
      {
        siteId: alert.siteId,
        type: alert.type,
        activeWindow: true,
        detectedAt: { $lt: dedupWindowStart(alert.detectedAt) },
      },
      { $set: { activeWindow: false } },
    )
  }

  /** Abre uma janela nova. Retorna null se outra requisição abriu antes (índice único → E11000). */
  async insertActive(alert: CreateOccurrenceInput): Promise<Occurrence | null> {
    try {
      const doc = await this.model.create({
        siteId: alert.siteId,
        droneId: alert.droneId,
        type: alert.type,
        severity: alert.severity,
        priority: computePriority(alert.severity, alert.type),
        status: 'open',
        count: 1,
        note: null,
        detectedAt: alert.detectedAt,
        lastDetectedAt: alert.detectedAt,
        activeWindow: true,
      })
      return toOccurrence(doc.toObject())
    } catch (error) {
      if (isDuplicateKeyError(error)) return null
      throw error
    }
  }

  async list(filter: OccurrenceFilter): Promise<Occurrence[]> {
    const query: FilterQuery<OccurrenceDocument> = {}
    if (filter.status) query.status = filter.status
    if (filter.siteId) query.siteId = filter.siteId

    const docs = await this.model.find(query).sort(LIST_ORDER).lean<LeanOccurrence[]>()

    return docs.map(toOccurrence)
  }

  async findById(id: string): Promise<Occurrence | null> {
    if (!isObjectIdOrHexString(id)) return null
    const doc = await this.model.findById(id).lean<LeanOccurrence>()
    return doc && toOccurrence(doc)
  }

  /** Update condicional: só aplica se o status ainda for `from` (dois "Reconhecer" não passam juntos). */
  async changeStatus(
    id: string,
    from: OccurrenceStatus,
    change: UpdateStatusInput,
  ): Promise<Occurrence | null> {
    if (!isObjectIdOrHexString(id)) return null

    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, status: from },
        {
          $set: {
            status: change.status,
            // Saiu de open: alertas novos do mesmo site+tipo abrem outra ocorrência
            activeWindow: false,
            ...(change.status === 'resolved' ? { note: change.note } : {}),
          },
        },
        { new: true },
      )
      .lean<LeanOccurrence>()

    return doc && toOccurrence(doc)
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}

function toOccurrence(doc: LeanOccurrence): Occurrence {
  return {
    id: doc._id.toHexString(),
    siteId: doc.siteId,
    droneId: doc.droneId,
    type: doc.type,
    severity: doc.severity,
    priority: doc.priority,
    status: doc.status,
    count: doc.count,
    note: doc.note,
    detectedAt: doc.detectedAt,
    lastDetectedAt: doc.lastDetectedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}
