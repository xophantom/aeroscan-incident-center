import {
  MAX_SEVERITY,
  OCCURRENCE_TYPES,
  TYPE_WEIGHT,
  computePriority,
  dedupWindow,
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

/** Prioridade desc; empate → detecção mais recente; por fim `_id`, para a ordem ser estável. */
export const LIST_ORDER = { priority: -1, detectedAt: -1, _id: -1 } as const

export function listFilter(filter: OccurrenceFilter): FilterQuery<OccurrenceDocument> {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.siteId ? { siteId: filter.siteId } : {}),
  }
}

// severity × peso do tipo calculado pelo Mongo (a mesma fórmula de computePriority)
export const PRIORITY_EXPRESSION = {
  $multiply: [
    '$severity',
    {
      $switch: {
        branches: OCCURRENCE_TYPES.map((type) => ({
          case: { $eq: ['$type', type] },
          then: TYPE_WEIGHT[type],
        })),
        default: 0, // tipo que saiu do enum não derruba o boot
      },
    },
  ],
}

@Injectable()
export class OccurrencesRepository implements OnModuleInit {
  constructor(@InjectModel(OCCURRENCE_MODEL) private readonly model: Model<OccurrenceDocument>) {}

  // O índice único de versão é parte da corretude do dedup: precisa existir antes da 1ª requisição
  async onModuleInit(): Promise<void> {
    await this.model.syncIndexes()
    await this.reconcilePriorities()
  }

  /** `priority` é denormalizado: se os pesos mudarem, recalcula só as ocorrências divergentes. */
  async reconcilePriorities(): Promise<void> {
    await this.model.updateMany({ $expr: { $ne: ['$priority', PRIORITY_EXPRESSION] } }, [
      { $set: { priority: PRIORITY_EXPRESSION } },
    ])
  }

  /** Versão das criações do site+tipo: o `seq` da última ocorrência criada, ou 0 se nenhuma. */
  async creationVersion(alert: CreateOccurrenceInput): Promise<number> {
    const last = await this.model
      .findOne({ siteId: alert.siteId, type: alert.type }, { seq: 1 })
      .sort({ seq: -1 })
      .lean<Pick<OccurrenceDocument, 'seq'>>()
    return last?.seq ?? 0
  }

  /** Agrupa, de forma atômica, na ocorrência aberta mais antiga do site+tipo dentro da janela do alerta. */
  async groupIntoOpenOccurrence(alert: CreateOccurrenceInput): Promise<Occurrence | null> {
    const { from, to } = dedupWindow(alert.detectedAt)
    const doc = await this.model
      .findOneAndUpdate(
        {
          siteId: alert.siteId,
          type: alert.type,
          status: 'open',
          detectedAt: { $gte: from, $lte: to },
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
          { $set: { priority: PRIORITY_EXPRESSION } },
        ],
        { new: true, sort: { detectedAt: 1 } },
      )
      .lean<LeanOccurrence>()

    return doc && toOccurrence(doc)
  }

  /**
   * Cria a ocorrência na versão seguinte à lida. Se outra requisição criou uma ocorrência do site+tipo
   * depois dessa leitura, a versão já existe (índice único → E11000) e retorna null.
   */
  async insertAtVersion(alert: CreateOccurrenceInput, version: number): Promise<Occurrence | null> {
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
        seq: version + 1,
      })
      return toOccurrence(doc.toObject())
    } catch (error) {
      if (isDuplicateKeyError(error)) return null
      throw error
    }
  }

  async list(filter: OccurrenceFilter): Promise<Occurrence[]> {
    const docs = await this.model.find(listFilter(filter)).sort(LIST_ORDER).lean<LeanOccurrence[]>()
    return docs.map(toOccurrence)
  }

  async findById(id: string): Promise<Occurrence | null> {
    if (!isObjectIdOrHexString(id)) return null
    const doc = await this.model.findById(id).lean<LeanOccurrence>()
    return doc && toOccurrence(doc)
  }

  /**
   * Update condicional: só aplica se o status atual for uma das origens `from`
   * (dois "Reconhecer" simultâneos não passam juntos).
   */
  async changeStatus(
    id: string,
    from: readonly OccurrenceStatus[],
    change: UpdateStatusInput,
  ): Promise<Occurrence | null> {
    if (!isObjectIdOrHexString(id)) return null

    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, status: { $in: from } },
        {
          $set: {
            status: change.status,
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

function toOccurrence({ _id, seq, ...fields }: LeanOccurrence): Occurrence {
  return { id: _id.toHexString(), ...fields }
}
