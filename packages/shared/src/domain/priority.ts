import type { OccurrenceType } from './occurrence.js'

export const TYPE_WEIGHT: Readonly<Record<OccurrenceType, number>> = {
  intrusion: 3,
  perimeter_breach: 2,
  low_battery: 1,
  signal_loss: 1,
}

export function computePriority(severity: number, type: OccurrenceType): number {
  return severity * TYPE_WEIGHT[type]
}
