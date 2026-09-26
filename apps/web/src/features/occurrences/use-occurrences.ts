import type { OccurrenceResponse, OccurrenceStatus } from '@aeroscan/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../lib/api/client'
import { listOccurrences } from '../../lib/api/occurrences'
import type { StatusFilterValue } from './use-status-filter'

export type OccurrencesState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; items: OccurrenceResponse[]; refreshError: string | null }

// Status pedidos à API por filtro da tela; "Todas" não filtra
const FILTER_STATUSES: Record<StatusFilterValue, readonly OccurrenceStatus[]> = {
  active: ['open', 'acknowledged'],
  open: ['open'],
  acknowledged: ['acknowledged'],
  resolved: ['resolved'],
  all: [],
}

export function useOccurrences(filter: StatusFilterValue) {
  const [state, setState] = useState<OccurrencesState>({ kind: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  // Só a resposta da requisição mais recente vale (troca rápida de filtro não mostra dado velho)
  const latestRequest = useRef(0)
  // Uma ação iniciada antes da troca de filtro recarrega o filtro que está na tela, não o antigo
  const currentFilter = useRef(filter)

  const load = useCallback(async ({ quiet }: { quiet: boolean }) => {
    const requestId = ++latestRequest.current
    // "Atualizando…" só quando o gestor pede; o aviso da API atualiza em silêncio
    if (!quiet) setRefreshing(true)
    setState((current) => (current.kind === 'error' ? { kind: 'loading' } : current))
    try {
      const items = await listOccurrences(FILTER_STATUSES[currentFilter.current])
      if (requestId === latestRequest.current) {
        setState({ kind: 'success', items, refreshError: null })
      }
    } catch (error) {
      if (requestId !== latestRequest.current) return
      const message = errorMessage(error)
      // Falha ao atualizar não apaga a lista na tela (nem uma nota sendo digitada): só avisa
      setState((current) =>
        current.kind === 'success'
          ? { ...current, refreshError: message }
          : { kind: 'error', message },
      )
    } finally {
      if (requestId === latestRequest.current) setRefreshing(false)
    }
  }, [])
  const refetch = useCallback(() => load({ quiet: false }), [load])
  const refetchQuietly = useCallback(() => void load({ quiet: true }), [load])

  useEffect(() => {
    currentFilter.current = filter
    setState({ kind: 'loading' })
    void refetch()
  }, [filter, refetch])

  return { state, refreshing, refetch, refetchQuietly }
}
