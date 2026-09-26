import { OCCURRENCE_STATUSES, type OccurrenceStatus } from './occurrence.js'

/** Única fonte das transições válidas: a API valida o PATCH e o front escolhe os botões por aqui. */
export const STATUS_TRANSITIONS: Readonly<Record<OccurrenceStatus, readonly OccurrenceStatus[]>> = {
  open: ['acknowledged'],
  acknowledged: ['resolved'],
  resolved: [],
}

export function canTransition(from: OccurrenceStatus, to: OccurrenceStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

export function requiresNote(to: OccurrenceStatus): boolean {
  return to === 'resolved'
}

/** Status a partir dos quais se chega em `to`. */
export function allowedFrom(to: OccurrenceStatus): OccurrenceStatus[] {
  return OCCURRENCE_STATUSES.filter((from) => canTransition(from, to))
}
