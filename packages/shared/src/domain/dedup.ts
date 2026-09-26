import { MINUTE_MS } from './time.js'

export const DEDUP_WINDOW_MS = 10 * MINUTE_MS

/**
 * Faixa de `detectedAt` das ocorrências abertas que agrupam o alerta, pelo tempo do evento (não do
 * servidor): abertas até 10 min antes dele ou até 10 min depois (alerta que chegou atrasado).
 */
export function dedupWindow(detectedAt: Date): { from: Date; to: Date } {
  const time = detectedAt.getTime()
  return { from: new Date(time - DEDUP_WINDOW_MS), to: new Date(time + DEDUP_WINDOW_MS) }
}
