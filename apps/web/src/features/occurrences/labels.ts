import type { OccurrenceStatus, OccurrenceType } from '@aeroscan/shared'
import type { StatusFilterValue } from './use-status-filter'

export const TYPE_LABEL: Record<OccurrenceType, string> = {
  intrusion: 'Intrusão',
  perimeter_breach: 'Violação de perímetro',
  low_battery: 'Bateria baixa',
  signal_loss: 'Perda de sinal',
}

export const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  open: 'Aberta',
  acknowledged: 'Reconhecida',
  resolved: 'Resolvida',
}

export const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilterValue; label: string }> = [
  { value: 'active', label: 'Ativas' },
  { value: 'open', label: 'Abertas' },
  { value: 'acknowledged', label: 'Reconhecidas' },
  { value: 'resolved', label: 'Resolvidas' },
  { value: 'all', label: 'Todas' },
]

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}
