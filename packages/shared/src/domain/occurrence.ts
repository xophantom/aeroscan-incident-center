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
export const MAX_FUTURE_SKEW_MS = 60 * 1000

export function isOccurrenceStatus(value: unknown): value is OccurrenceStatus {
  return OCCURRENCE_STATUSES.includes(value as OccurrenceStatus)
}

export function isTooFarInFuture(detectedAt: Date, now: Date): boolean {
  return detectedAt.getTime() - now.getTime() > MAX_FUTURE_SKEW_MS
}
