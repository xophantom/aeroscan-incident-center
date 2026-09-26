import {
  DEDUP_WINDOW_MS,
  MAX_ALERT_AGE_MS,
  MAX_FUTURE_SKEW_MS,
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
  resolutionNoteRequired,
  writeConflict,
} from './occurrence.errors'
import { OccurrencesRepository } from './occurrences.repository'

// Cada E11000 é uma ocorrência que outra requisição abriu no mesmo site+tipo, a mais de 10 min das
// outras abertas. Sem mudanças de status no meio, cabem no máximo estas no intervalo aceito de
// detectedAt, e a tentativa depois da última agrupa ou cria.
const MAX_CONCURRENT_CREATIONS =
  Math.floor((MAX_ALERT_AGE_MS + MAX_FUTURE_SKEW_MS) / DEDUP_WINDOW_MS) + 1
export const MAX_DEDUP_ATTEMPTS = MAX_CONCURRENT_CREATIONS + 1

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
    const complete = change.status !== 'resolved' || change.note !== undefined
    if (from.length > 0 && complete) {
      const updated = await this.repository.changeStatus(id, from, change)
      if (updated) return updated
    }

    // Sem update (destino sem origem ou nota ausente) ou update recusado: a leitura diz o porquê
    const current = await this.repository.findById(id)
    if (!current) throw occurrenceNotFound(id)
    if (!canTransition(current.status, change.status)) {
      throw invalidStatusTransition(current.status, change.status)
    }
    if (!complete) throw resolutionNoteRequired()

    // Outra requisição levou o status a uma origem válida entre o update e a leitura. O status só
    // avança, então isso não se repete indefinidamente.
    return this.changeStatus(id, change)
  }
}
