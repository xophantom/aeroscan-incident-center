import { MINUTE_MS } from './time.js'

export const DEDUP_WINDOW_MS = 10 * MINUTE_MS

/**
 * Uma ocorrência aberta agrupa o alerta se foi detectada a partir deste instante.
 * A janela é fixa: conta da primeira detecção, pelo tempo do evento (não do servidor).
 */
export function dedupWindowStart(detectedAt: Date): Date {
  return new Date(detectedAt.getTime() - DEDUP_WINDOW_MS)
}
