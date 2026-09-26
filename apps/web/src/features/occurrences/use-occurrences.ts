import type { OccurrenceResponse, OccurrenceStatus } from '@aeroscan/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../lib/api/client'
import { listOccurrences } from '../../lib/api/occurrences'

export type OccurrencesState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; items: OccurrenceResponse[] }

export function useOccurrences(status: OccurrenceStatus | undefined) {
  const [state, setState] = useState<OccurrencesState>({ kind: 'loading' })
  // Só a resposta da requisição mais recente vale (troca rápida de filtro não mostra dado velho)
  const latestRequest = useRef(0)
  // Uma ação iniciada antes da troca de filtro recarrega o filtro que está na tela, não o antigo
  const currentStatus = useRef(status)

  const refetch = useCallback(async () => {
    const requestId = ++latestRequest.current
    try {
      const items = await listOccurrences(currentStatus.current)
      if (requestId === latestRequest.current) setState({ kind: 'success', items })
    } catch (error) {
      if (requestId === latestRequest.current)
        setState({ kind: 'error', message: errorMessage(error) })
    }
  }, [])

  useEffect(() => {
    currentStatus.current = status
    setState({ kind: 'loading' })
    void refetch()
  }, [status, refetch])

  return { state, refetch }
}
