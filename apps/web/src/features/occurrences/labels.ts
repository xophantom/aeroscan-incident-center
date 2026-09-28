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
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayAndClock = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

export function formatClock(iso: string, now: number): string {
  const date = new Date(iso)
  const today = date.toDateString() === new Date(now).toDateString()
  return (today ? clock : dayAndClock).format(date)
}

// Relógio do drone pode estar até 1 min à frente: detecção "no futuro" também é "agora"
export function formatElapsed(iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}
