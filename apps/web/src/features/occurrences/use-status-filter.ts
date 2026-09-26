import { isOccurrenceStatus, type OccurrenceStatus } from '@aeroscan/shared'
import { useCallback, useEffect, useState } from 'react'

const PARAM = 'status'

function readFromUrl(): OccurrenceStatus | undefined {
  const value = new URLSearchParams(window.location.search).get(PARAM)
  return isOccurrenceStatus(value) ? value : undefined
}

/** Filtro de status espelhado na querystring (?status=open): sobrevive a reload e ao voltar/avançar. */
export function useStatusFilter() {
  const [status, setStatusState] = useState(readFromUrl)

  useEffect(() => {
    const onPopState = () => setStatusState(readFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setStatus = useCallback((next: OccurrenceStatus | undefined) => {
    const url = new URL(window.location.href)
    if (next) url.searchParams.set(PARAM, next)
    else url.searchParams.delete(PARAM)

    try {
      window.history.pushState(null, '', url)
    } catch {
      // Alguns navegadores recusam pushState em file://; o filtro segue funcionando em memória
    }
    setStatusState(next)
  }, [])

  return [status, setStatus] as const
}
