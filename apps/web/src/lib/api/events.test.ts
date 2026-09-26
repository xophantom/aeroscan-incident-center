import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeToChanges } from './events'

class FakeSocket {
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  closed = false

  close() {
    this.closed = true
  }
}

function subscribe() {
  const sockets: FakeSocket[] = []
  const onChange = vi.fn()
  const onStatus = vi.fn()
  const stop = subscribeToChanges({
    url: 'ws://localhost:3000/events',
    onChange,
    onStatus,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
  })
  const last = () => sockets.at(-1) as FakeSocket
  return { sockets, last, onChange, onStatus, stop }
}

const change = JSON.stringify({ type: 'occurrences.changed', kind: 'created', id: 'x' })

afterEach(() => {
  vi.useRealTimers()
})

describe('subscribeToChanges', () => {
  it('ao conectar fica ao vivo e recarrega, para pegar o que mudou antes', () => {
    const { last, onChange, onStatus } = subscribe()
    expect(onStatus).toHaveBeenLastCalledWith('connecting')

    last().onopen?.()

    expect(onStatus).toHaveBeenLastCalledWith('live')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('recarrega a cada aviso de mudança e ignora o resto', () => {
    const { last, onChange } = subscribe()

    for (const data of [
      change,
      'não é JSON',
      JSON.stringify({ type: 'outro' }),
      new ArrayBuffer(1),
    ]) {
      last().onmessage?.({ data })
    }

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('reconecta com espera crescente, que volta ao início depois de conectar', () => {
    vi.useFakeTimers()
    const { sockets, last, onStatus } = subscribe()

    last().onclose?.()
    expect(onStatus).toHaveBeenLastCalledWith('offline')
    vi.advanceTimersByTime(999)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)

    last().onclose?.()
    vi.advanceTimersByTime(1_999)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)

    last().onopen?.()
    last().onclose?.()
    vi.advanceTimersByTime(1_000)
    expect(sockets).toHaveLength(4)
  })

  it('encerrar a assinatura fecha o socket e não reconecta', () => {
    vi.useFakeTimers()
    const { sockets, last, stop } = subscribe()

    stop()
    last().onclose?.()
    vi.advanceTimersByTime(60_000)

    expect(sockets).toHaveLength(1)
    expect(last().closed).toBe(true)
  })
})
