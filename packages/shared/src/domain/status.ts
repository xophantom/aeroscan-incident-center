import { OCCURRENCE_STATUSES, type OccurrenceStatus } from './occurrence.js'

// Fluxo linear: open → acknowledged → resolved, sem pular nem voltar
const NEXT_STATUS: Readonly<Record<OccurrenceStatus, OccurrenceStatus | null>> = {
  open: 'acknowledged',
  acknowledged: 'resolved',
  resolved: null,
}

export function canTransition(from: OccurrenceStatus, to: OccurrenceStatus): boolean {
  return NEXT_STATUS[from] === to
}

export function requiresNote(to: OccurrenceStatus): boolean {
  return to === 'resolved'
}

export function nextStatus(from: OccurrenceStatus): OccurrenceStatus | null {
  return NEXT_STATUS[from]
}

/** Único status a partir do qual se chega em `to`, ou null se nenhum leva até ele. */
export function previousStatus(to: OccurrenceStatus): OccurrenceStatus | null {
  return OCCURRENCE_STATUSES.find((from) => canTransition(from, to)) ?? null
}
