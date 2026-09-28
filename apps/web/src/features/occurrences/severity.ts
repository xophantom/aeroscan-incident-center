import { MIN_SEVERITY } from '@aeroscan/shared'

const SEVERITY_BG: Record<number, string> = {
  1: 'bg-sev-1',
  2: 'bg-sev-2',
  3: 'bg-sev-3',
  4: 'bg-sev-4',
  5: 'bg-sev-5',
}

export function severityBg(severity: number): string {
  return SEVERITY_BG[severity] ?? SEVERITY_BG[MIN_SEVERITY]!
}

// Cabeçalho e faixas usam o mesmo grid para as colunas alinharem
export const STRIP_COLUMNS =
  'md:grid-cols-[4.5rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_8.5rem]'
