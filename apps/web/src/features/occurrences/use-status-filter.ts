import { isOccurrenceStatus, type OccurrenceStatus } from '@aeroscan/shared'
import { useCallback, useEffect, useState } from 'react'

export type StatusFilterValue = OccurrenceStatus | 'active' | 'all'

const PARAM = 'status'
// A triagem abre no que ainda pede ação: abertas (Reconhecer) e reconhecidas (Resolver)
const DEFAULT_FILTER: StatusFilterValue = 'active'

function readFromUrl(): StatusFilterValue {
  const value = new URLSearchParams(window.location.search).get(PARAM)
  return value === 'all' || isOccurrenceStatus(value) ? value : DEFAULT_FILTER
}

/** Filtro de status espelhado na querystring (?status=all): sobrevive a reload e ao voltar/avançar. */
export function useStatusFilter() {
  const [filter, setFilterState] = useState(readFromUrl)

  useEffect(() => {
    const onPopState = () => setFilterState(readFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setFilter = useCallback((next: StatusFilterValue) => {
    const url = new URL(window.location.href)
    if (next === DEFAULT_FILTER) url.searchParams.delete(PARAM)
    else url.searchParams.set(PARAM, next)

    // Clicar no filtro que já está ativo não empilha outra entrada no histórico
    if (url.href !== window.location.href) {
      try {
        window.history.pushState(null, '', url)
      } catch {
        // Alguns navegadores recusam pushState em file://; o filtro segue funcionando em memória
      }
    }
    setFilterState(next)
  }, [])

  return [filter, setFilter] as const
}
