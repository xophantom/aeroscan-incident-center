import {
  isTooFarInFuture,
  isTooOld,
  previousStatus,
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
   * Agrupa o alerta na ocorrência aberta do mesmo site+tipo (janela de 10 min) ou cria uma nova.
   * "Buscar e depois inserir" tem corrida; quem garante uma única janela é o índice único parcial.
   * Perder a corrida no insert significa que a janela agora existe: basta tentar agrupar de novo.
   */
  async register(alert: CreateOccurrenceInput): Promise<RegisterResult> {
    const now = this.clock.now()
    if (isTooFarInFuture(alert.detectedAt, now)) throw detectedAtInFuture()
    if (isTooOld(alert.detectedAt, now)) throw detectedAtTooOld()

    for (let attempt = 1; attempt <= MAX_DEDUP_ATTEMPTS; attempt++) {
      const grouped = await this.repository.groupIntoActiveWindow(alert)
      if (grouped) return { occurrence: grouped, created: false }

      await this.repository.closeStaleWindows(alert)
      const created = await this.repository.insertActive(alert)
      if (created) return { occurrence: created, created: true }
    }

    throw writeConflict()
  }

  list(filter: OccurrenceFilter): Promise<Occurrence[]> {
    return this.repository.list(filter)
  }

  async changeStatus(id: string, change: UpdateStatusInput): Promise<Occurrence> {
    // Cada status tem um único antecessor válido; o update só aplica se o atual for ele
    const from = previousStatus(change.status)
    const updated = from ? await this.repository.changeStatus(id, from, change) : null
    if (updated) return updated

    // Não aplicou: o id não existe ou o status atual não permite a transição
    const current = await this.repository.findById(id)
    if (!current) throw occurrenceNotFound(id)
    throw invalidStatusTransition(current.status, change.status)
  }
}
