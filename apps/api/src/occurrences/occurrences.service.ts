import {
  allowedFrom,
  isTooFarInFuture,
  isTooOld,
  type CreateOccurrenceInput,
  type OccurrenceFilter,
  type UpdateStatusInput,
} from '@aeroscan/shared'
import { Injectable } from '@nestjs/common'
import { ClockService } from '../infra/clock/clock.service'
import type { Occurrence } from './occurrence'
import {
  detectedAtInFuture,
  detectedAtTooOld,
  invalidStatusTransition,
  occurrenceNotFound,
  writeConflict,
} from './occurrence.errors'
import { OccurrencesRepository } from './occurrences.repository'

export const MAX_DEDUP_ATTEMPTS = 3

export interface RegisterResult {
  occurrence: Occurrence
  created: boolean
}

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly repository: OccurrencesRepository,
    private readonly clock: ClockService,
  ) {}

  /**
   * Agrupa o alerta numa ocorrência aberta do mesmo site+tipo dentro da janela ou cria uma nova.
   * "Buscar e depois inserir" tem corrida; quem garante uma única criação é o índice único parcial
   * (uma vaga ativa por site+tipo). Perder a corrida no insert significa que a janela agora existe:
   * basta tentar agrupar de novo.
   */
  async register(alert: CreateOccurrenceInput): Promise<RegisterResult> {
    const now = this.clock.now()
    if (isTooFarInFuture(alert.detectedAt, now)) throw detectedAtInFuture()
    if (isTooOld(alert.detectedAt, now)) throw detectedAtTooOld()

    for (let attempt = 1; attempt <= MAX_DEDUP_ATTEMPTS; attempt++) {
      const grouped = await this.repository.groupIntoOpenOccurrence(alert)
      if (grouped) return { occurrence: grouped, created: false }

      await this.repository.closeStaleActiveWindow(alert)
      const created = await this.repository.insertActive(alert)
      if (created) return { occurrence: created, created: true }
    }

    throw writeConflict()
  }

  list(filter: OccurrenceFilter): Promise<Occurrence[]> {
    return this.repository.list(filter)
  }

  async changeStatus(id: string, change: UpdateStatusInput): Promise<Occurrence> {
    const from = allowedFrom(change.status)
    const updated = from.length > 0 ? await this.repository.changeStatus(id, from, change) : null
    if (updated) return updated

    // O update condicional não diz por que falhou: 404 se o id não existe, senão 409
    const current = await this.repository.findById(id)
    if (!current) throw occurrenceNotFound(id)
    throw invalidStatusTransition(current.status, change.status)
  }
}
