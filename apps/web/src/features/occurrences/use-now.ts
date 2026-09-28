import { useEffect, useState } from 'react'

/** "Agora" que avança sozinho, para o "há 5 min" da lista não ficar parado. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
