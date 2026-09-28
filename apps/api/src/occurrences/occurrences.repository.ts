import {
  MAX_SEVERITY,
  MIN_SEVERITY,
  OCCURRENCE_TYPES,
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

/** A chave do alerta já está numa ocorrência: é reenvio, não alerta novo. */
export class DuplicateAlertError extends Error {}

/** Prioridade desc; empate → detecção mais recente; por fim `_id`, para a ordem ser estável. */
const LIST_ORDER = { priority: -1, detectedAt: -1, _id: -1 } as const

function listFilter(filter: OccurrenceFilter): FilterQuery<OccurrenceDocument> {
  return {
    ...(filter.status ? { status: { $in: filter.status } } : {}),
    ...(filter.siteId ? { siteId: filter.siteId } : {}),
  }
}

const SEVERITIES = Array.from(
  { length: MAX_SEVERITY - MIN_SEVERITY + 1 },
  (_, offset) => MIN_SEVERITY + offset,
)

// O Mongo consulta uma tabela montada com computePriority, uma linha por tipo e severidade, e a
// fórmula fica só no shared. Combinação sem linha (tipo de uma versão revertida) mantém a gravada.
const PRIORITY_EXPRESSION = {
  $switch: {
    branches: OCCURRENCE_TYPES.flatMap((type) =>
      SEVERITIES.map((severity) => ({
        case: { $and: [{ $eq: ['$type', type] }, { $eq: ['$severity', severity] }] },
        then: computePriority(severity, type),
      })),
    ),
    default: '$priority',
  },
}

@Injectable()
export class OccurrencesRepository implements OnModuleInit {
  constructor(@InjectModel(OCCURRENCE_MODEL) private readonly model: Model<OccurrenceDocument>) {}

  // O índice único de versão é parte da corretude do dedup: precisa existir antes da 1ª requisição
  async onModuleInit(): Promise<void> {
    await this.model.syncIndexes()
    await this.reconcilePriorities()
  }

  /**
   * `priority` é denormalizado: se a fórmula ou os pesos mudarem, recalcula só as ocorrências
   * divergentes. É manutenção, não um evento da ocorrência, então não mexe no `updatedAt`. Um tipo
   * que o código não conhece (gravado por uma versão revertida) fica como está: não tem linha na
   * tabela, e o `default` devolve a prioridade gravada.
   */
  private async reconcilePriorities(): Promise<void> {
    await this.model.updateMany(
      { $expr: { $ne: ['$priority', PRIORITY_EXPRESSION] } },
      [{ $set: { priority: PRIORITY_EXPRESSION } }],
      { timestamps: false },
    )
  }

  /** Versão das criações do site+tipo: o `seq` da última ocorrência criada, ou 0 se nenhuma. */
  async creationVersion(alert: CreateOccurrenceInput): Promise<number> {
    const last = await this.model
      .findOne({ siteId: alert.siteId, type: alert.type }, { seq: 1 })
      .sort({ seq: -1 })
      .lean<Pick<OccurrenceDocument, 'seq'>>()
    return last?.seq ?? 0
  }

  /**
   * Agrupa, de forma atômica, na ocorrência mais antiga do site+tipo dentro da janela do alerta:
   * aberta, ou já reconhecida se o alerta foi detectado antes do reconhecimento (chegou atrasado)
   * por um drone que já estava nela. Lança DuplicateAlertError se a chave do alerta já está em
   * outra ocorrência.
   */
  async groupIntoOccurrence(alert: CreateOccurrenceInput, key: string): Promise<Occurrence | null> {
    const { from, to } = dedupWindow(alert.detectedAt)
    const isOpen = { $eq: ['$status', 'open'] }
    try {
      const doc = await this.model
        .findOneAndUpdate(
          {
            siteId: alert.siteId,
            type: alert.type,
            detectedAt: { $gte: from, $lte: to },
            alertKeys: { $ne: key },
            $or: [
              { status: 'open' },
              // Já tratada: só entra o alerta atrasado de um drone que o gestor viu nela ao
              // reconhecer. Drone novo pode ser outro incidente no mesmo site, e vai para a fila.
              { acknowledgedAt: { $gte: alert.detectedAt }, droneIds: alert.droneId },
            ],
          },
          // Update em pipeline: o banco calcula a partir do valor atual, sem ler-e-escrever
          [
            {
              $set: {
                count: { $add: ['$count', 1] },
                // Ocorrência já reconhecida só registra o alerta: não volta para a fila da triagem
                severity: {
                  $cond: [
                    isOpen,
                    { $min: [{ $add: ['$severity', 1] }, MAX_SEVERITY] },
                    '$severity',
                  ],
                },
                lastDetectedAt: { $max: ['$lastDetectedAt', alert.detectedAt] },
                droneIds: {
                  $sortArray: { input: { $setUnion: ['$droneIds', [alert.droneId]] }, sortBy: 1 },
                },
                alertKeys: { $concatArrays: ['$alertKeys', [key]] },
              },
            },
            { $set: { priority: PRIORITY_EXPRESSION } },
          ],
          { new: true, sort: { detectedAt: 1 } },
        )
        .lean<LeanOccurrence>()

      return doc && toOccurrence(doc)
    } catch (error) {
      // O único índice único que este update pode violar é o das chaves de alerta
      if (isDuplicateKeyError(error)) throw new DuplicateAlertError()
      throw error
    }
  }

  /**
   * Cria com `seq = version + 1`. Devolve null se outra requisição já criou nessa versão; lança
   * DuplicateAlertError se a chave do alerta já está em outra ocorrência.
   */
  async insertAtVersion(
    alert: CreateOccurrenceInput,
    version: number,
    key: string,
  ): Promise<Occurrence | null> {
    try {
      const doc = await this.model.create({
        siteId: alert.siteId,
        droneId: alert.droneId,
        droneIds: [alert.droneId],
        type: alert.type,
        severity: alert.severity,
        priority: computePriority(alert.severity, alert.type),
        status: 'open',
        count: 1,
        note: null,
        detectedAt: alert.detectedAt,
        lastDetectedAt: alert.detectedAt,
        seq: version + 1,
        alertKeys: [key],
        acknowledgedAt: null,
      })
      return toOccurrence(doc.toObject())
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error
      if ('alertKeys' in (error.keyPattern ?? {})) throw new DuplicateAlertError()
      return null
    }
  }

  async findByAlertKey(key: string): Promise<Occurrence> {
    const doc = await this.model.findOne({ alertKeys: key }).orFail().lean<LeanOccurrence>()
    return toOccurrence(doc)
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
    now: Date,
  ): Promise<Occurrence | null> {
    if (!isObjectIdOrHexString(id)) return null

    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, status: { $in: from } },
        {
          $set: {
            status: change.status,
            ...(change.status === 'acknowledged' ? { acknowledgedAt: now } : {}),
            ...(change.status === 'resolved' ? { note: change.note } : {}),
          },
        },
        { new: true },
      )
      .lean<LeanOccurrence>()

    return doc && toOccurrence(doc)
  }
}

function isDuplicateKeyError(
  error: unknown,
): error is { code: 11000; keyPattern?: Record<string, unknown> } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}

function toOccurrence({
  _id,
  seq,
  alertKeys,
  acknowledgedAt,
  ...fields
}: LeanOccurrence): Occurrence {
  return { id: _id.toHexString(), ...fields }
}
