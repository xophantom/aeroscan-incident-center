import {
  OCCURRENCE_STATUSES,
  allowedFrom,
  canTransition,
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

// Cada E11000 é uma criação de outra requisição no mesmo site+tipo: com N janelas novas surgindo ao
// mesmo tempo (ex.: drone despejando alertas atrasados), um alerta precisa de até N tentativas
export const MAX_DEDUP_ATTEMPTS = 10

interface RegisterResult {
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
   * "Buscar e depois inserir" tem corrida; o controle é otimista: a versão de criações do site+tipo
   * é lida antes da busca, e a criação grava a versão seguinte sob índice único. Se outra requisição
   * criar no meio, o insert falha (E11000) e o alerta volta a buscar, já enxergando a criação nova.
   */
  async register(alert: CreateOccurrenceInput): Promise<RegisterResult> {
    const now = this.clock.now()
    if (isTooFarInFuture(alert.detectedAt, now)) throw detectedAtInFuture()
    if (isTooOld(alert.detectedAt, now)) throw detectedAtTooOld()

    for (let attempt = 1; attempt <= MAX_DEDUP_ATTEMPTS; attempt++) {
      const version = await this.repository.creationVersion(alert)
      const grouped = await this.repository.groupIntoOpenOccurrence(alert)
      if (grouped) return { occurrence: grouped, created: false }

      const created = await this.repository.insertAtVersion(alert, version)
      if (created) return { occurrence: created, created: true }
    }

    throw writeConflict()
  }

  list(filter: OccurrenceFilter): Promise<Occurrence[]> {
    return this.repository.list(filter)
  }

  async changeStatus(id: string, change: UpdateStatusInput): Promise<Occurrence> {
    const from = allowedFrom(change.status)
    // Se outra requisição levou o status para uma origem válida entre o update e a leitura, tenta
    // de novo; o limite de uma volta por status garante o fim mesmo com transições em ciclo
    for (let attempt = 0; attempt < OCCURRENCE_STATUSES.length; attempt++) {
      const updated = from.length > 0 ? await this.repository.changeStatus(id, from, change) : null
      if (updated) return updated

      // O update condicional não diz por que falhou: 404 se o id não existe, 409 se o status não deixa
      const current = await this.repository.findById(id)
      if (!current) throw occurrenceNotFound(id)
      if (!canTransition(current.status, change.status)) {
        throw invalidStatusTransition(current.status, change.status)
      }
    }

    throw writeConflict()
  }
}
