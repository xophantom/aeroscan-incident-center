import { DAY_MS, MINUTE_MS } from './time.js'

export const OCCURRENCE_TYPES = [
  'intrusion',
  'perimeter_breach',
  'low_battery',
  'signal_loss',
] as const
export type OccurrenceType = (typeof OCCURRENCE_TYPES)[number]

export const OCCURRENCE_STATUSES = ['open', 'acknowledged', 'resolved'] as const
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number]

export const MIN_SEVERITY = 1
export const MAX_SEVERITY = 5

// Tolera pequena diferença de relógio entre drone e servidor
export const MAX_FUTURE_SKEW_MS = MINUTE_MS
// Aceita entrega atrasada (drone dias sem sinal), mas não um alerta arbitrariamente antigo
export const MAX_ALERT_AGE_MS = 7 * DAY_MS

export function isOccurrenceStatus(value: unknown): value is OccurrenceStatus {
  return OCCURRENCE_STATUSES.includes(value as OccurrenceStatus)
}

export function isTooFarInFuture(detectedAt: Date, now: Date): boolean {
  return detectedAt.getTime() - now.getTime() > MAX_FUTURE_SKEW_MS
}

export function isTooOld(detectedAt: Date, now: Date): boolean {
  return now.getTime() - detectedAt.getTime() > MAX_ALERT_AGE_MS
}
