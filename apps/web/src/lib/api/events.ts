export type LiveStatus = 'connecting' | 'live' | 'offline'

interface ChangeSubscription {
  url: string
  /** A cada aviso de mudança e a cada conexão (avisos de quando estava fora se perderam) */
  onChange: () => void
  onStatus: (status: LiveStatus) => void
  /** Os testes trocam o WebSocket do navegador por um falso */
  createSocket?: (url: string) => WebSocket
}

const FIRST_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

/**
 * Assina os avisos de mudança da API. O WebSocket do navegador não reconecta sozinho: aqui ele volta
 * com espera crescente (1 s, 2 s, 4 s... até 30 s). Devolve a função que encerra a assinatura.
 */
export function subscribeToChanges({
  url,
  onChange,
  onStatus,
  createSocket = (target) => new WebSocket(target),
}: ChangeSubscription): () => void {
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let delay = FIRST_RETRY_MS
  let stopped = false

  const connect = () => {
    socket = createSocket(url)
    socket.onopen = () => {
      delay = FIRST_RETRY_MS
      onStatus('live')
      onChange()
    }
    socket.onmessage = (event: MessageEvent) => {
      if (isChange(event.data)) onChange()
    }
    socket.onclose = () => {
      if (stopped) return
      onStatus('offline')
      retry = setTimeout(connect, delay)
      delay = Math.min(delay * 2, MAX_RETRY_MS)
    }
  }

  onStatus('connecting')
  connect()
  return () => {
    stopped = true
    clearTimeout(retry)
    socket?.close()
  }
}

function isChange(data: unknown): boolean {
  if (typeof data !== 'string') return false
  try {
    return (JSON.parse(data) as { type?: unknown }).type === 'occurrences.changed'
  } catch {
    return false
  }
}
