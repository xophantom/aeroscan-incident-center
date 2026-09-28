import type { OccurrenceType } from './occurrence.js'
import { MINUTE_MS } from './time.js'

export const DEDUP_WINDOW_MS = 10 * MINUTE_MS

/**
 * Faixa de `detectedAt` das ocorrências que agrupam o alerta, pelo tempo do evento (não do
 * servidor): detectadas até 10 min antes dele ou até 10 min depois (alerta que chegou atrasado).
 */
export function dedupWindow(detectedAt: Date): { from: Date; to: Date } {
  const time = detectedAt.getTime()
  return { from: new Date(time - DEDUP_WINDOW_MS), to: new Date(time + DEDUP_WINDOW_MS) }
}

/**
 * Identidade do alerta: um drone não detecta duas vezes o mesmo tipo no mesmo instante. O reenvio
 * do mesmo alerta (ex.: o drone repete o POST depois de um timeout) gera a mesma chave.
 */
export function alertKey(alert: {
  siteId: string
  droneId: string
  type: OccurrenceType
  detectedAt: Date
}): string {
  // Lista em JSON, não texto concatenado: um separador dentro do siteId não junta alertas diferentes
  return JSON.stringify([alert.siteId, alert.droneId, alert.type, alert.detectedAt.toISOString()])
}

/**
 * O caminho de volta do `alertKey`. As chaves guardadas numa ocorrência são a lista dos alertas
 * contados nela, com o drone e o horário de cada um.
 */
export function parseAlertKey(key: string): { droneId: string; detectedAt: Date } {
  const [, droneId, , detectedAt] = JSON.parse(key) as [string, string, OccurrenceType, string]
  return { droneId, detectedAt: new Date(detectedAt) }
}
