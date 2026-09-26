import { useEffect, useState } from 'react'
import { EVENTS_URL } from '../../lib/api/config'
import { subscribeToChanges, type LiveStatus } from '../../lib/api/events'

// Uma rajada de avisos (ex.: 20 alertas juntos) vira uma recarga só
export const COALESCE_MS = 300

/** Recarrega a lista quando a API avisa que algo mudou e diz se a conexão está ao vivo. */
export function useLiveUpdates(reload: () => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting')

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (pending !== undefined) return
      pending = setTimeout(() => {
        pending = undefined
        reload()
      }, COALESCE_MS)
    }
    const stop = subscribeToChanges({ url: EVENTS_URL, onChange: schedule, onStatus: setStatus })
    return () => {
      stop()
      clearTimeout(pending)
    }
  }, [reload])

  return status
}
