import { isOccurrenceStatus, type OccurrenceStatus } from '@aeroscan/shared'
import { useCallback, useEffect, useState } from 'react'

export type StatusFilterValue = OccurrenceStatus | 'all'

const PARAM = 'status'
// A triagem abre no que ainda pede ação; "Todas" fica a um clique
const DEFAULT_FILTER: StatusFilterValue = 'open'

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

    try {
      window.history.pushState(null, '', url)
    } catch {
      // Alguns navegadores recusam pushState em file://; o filtro segue funcionando em memória
    }
    setFilterState(next)
  }, [])

  return [filter, setFilter] as const
}
