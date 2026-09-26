const LOCAL_API_URL = 'http://localhost:3000'

/**
 * VITE_API_URL tem prioridade. Sem ela: aberto do disco (file://) não há "mesma origem",
 * então usa a API local; servido pela API (ou pelo proxy do Vite em dev), usa a mesma origem.
 */
export function resolveApiUrl(envUrl: string | undefined, protocol: string): string {
  if (envUrl) return envUrl.replace(/\/+$/, '')
  return protocol === 'file:' ? LOCAL_API_URL : ''
}

export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, window.location.protocol)
