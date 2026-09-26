import type { OccurrenceResponse } from '@aeroscan/shared'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui/toast/ToastProvider'
import { ApiError } from '../../lib/api/client'
import { subscribeToChanges } from '../../lib/api/events'
import { listOccurrences, updateOccurrenceStatus } from '../../lib/api/occurrences'
import { deferred, occurrence } from '../../test/fixtures'
import { OccurrencesPage } from './OccurrencesPage'

vi.mock('../../lib/api/occurrences')
vi.mock('../../lib/api/events')

function renderPage() {
  render(
    <ToastProvider>
      <OccurrencesPage />
    </ToastProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(subscribeToChanges).mockReturnValue(() => undefined)
  window.history.replaceState(null, '', '/')
})

// O que a página passou ao assinar os avisos da API
const subscription = () => {
  const options = vi.mocked(subscribeToChanges).mock.calls.at(-1)?.[0]
  if (!options) throw new Error('a página não assinou os avisos')
  return options
}

describe('OccurrencesPage', () => {
  it('mostra se a conexão com os avisos está ao vivo', async () => {
    vi.mocked(listOccurrences).mockResolvedValue([])
    renderPage()
    await screen.findByText('Nenhuma ocorrência aberta ou reconhecida.')

    act(() => subscription().onStatus('live'))
    expect(screen.getByRole('status')).toHaveTextContent('Ao vivo')

    act(() => subscription().onStatus('offline'))
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando…')
  })

  it('aviso de mudança recarrega a lista; uma rajada vira uma recarga só', async () => {
    vi.mocked(listOccurrences).mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(listOccurrences).toHaveBeenCalledTimes(1))

    act(() => {
      for (let i = 0; i < 5; i++) subscription().onChange()
    })

    await waitFor(() => expect(listOccurrences).toHaveBeenCalledTimes(2))
    expect(listOccurrences).toHaveBeenLastCalledWith(['open', 'acknowledged'])
  })

  it('abre em "Ativas"; "Abertas" consulta só as abertas', async () => {
    vi.mocked(listOccurrences).mockResolvedValue([])
    const user = renderPage()

    expect(await screen.findByText('Nenhuma ocorrência aberta ou reconhecida.')).toBeInTheDocument()
    expect(listOccurrences).toHaveBeenLastCalledWith(['open', 'acknowledged'])

    await user.click(screen.getByRole('button', { name: 'Abertas' }))

    expect(await screen.findByText('Nenhuma ocorrência aberta.')).toBeInTheDocument()
    expect(listOccurrences).toHaveBeenLastCalledWith(['open'])
  })

  it('ações em itens diferentes não liberam o botão uma da outra', async () => {
    const items = [occurrence({ id: 'a' }), occurrence({ id: 'b', siteId: 'site-b' })]
    vi.mocked(listOccurrences).mockResolvedValue(items)
    const pending = { a: deferred<OccurrenceResponse>(), b: deferred<OccurrenceResponse>() }
    vi.mocked(updateOccurrenceStatus).mockImplementation((id) =>
      id === 'a' ? pending.a.promise : pending.b.promise,
    )
    const user = renderPage()
    const [acknowledgeA, acknowledgeB] = await screen.findAllByRole('button', {
      name: 'Reconhecer',
    })

    await user.click(acknowledgeA!)
    await user.click(acknowledgeB!)
    pending.b.resolve(occurrence({ id: 'b', status: 'acknowledged' }))

    await waitFor(() => expect(acknowledgeB).toBeEnabled())
    expect(acknowledgeA).toBeDisabled()
  })

  it('a lista recarregada após uma ação respeita o filtro trocado no meio dela', async () => {
    const open = occurrence({ id: 'a' })
    vi.mocked(listOccurrences).mockResolvedValue([open])
    const acknowledge = deferred<OccurrenceResponse>()
    vi.mocked(updateOccurrenceStatus).mockReturnValue(acknowledge.promise)
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Reconhecer' }))
    await user.click(screen.getByRole('button', { name: 'Abertas' }))
    await waitFor(() => expect(listOccurrences).toHaveBeenLastCalledWith(['open']))
    acknowledge.resolve({ ...open, status: 'acknowledged' })

    await waitFor(() => expect(listOccurrences).toHaveBeenCalledTimes(3))
    expect(listOccurrences).toHaveBeenLastCalledWith(['open'])
  })

  it('falha de rede ao resolver mantém a lista e a nota digitada', async () => {
    const offline = new ApiError('Não foi possível conectar à API.', 'NETWORK_ERROR')
    vi.mocked(listOccurrences)
      .mockResolvedValueOnce([occurrence({ status: 'acknowledged' })])
      .mockRejectedValue(offline)
    vi.mocked(updateOccurrenceStatus).mockRejectedValue(offline)
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Resolver' }))
    await user.type(screen.getByLabelText('Nota de resolução'), 'equipe verificou')
    await user.click(screen.getByRole('button', { name: 'Confirmar resolução' }))

    expect(await screen.findByText(/Não foi possível atualizar a lista/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nota de resolução')).toHaveValue('equipe verificou')
  })

  it('"Atualizar" mostra que está atualizando', async () => {
    const refresh = deferred<OccurrenceResponse[]>()
    vi.mocked(listOccurrences).mockResolvedValueOnce([]).mockReturnValueOnce(refresh.promise)
    const user = renderPage()
    await screen.findByText('Nenhuma ocorrência aberta ou reconhecida.')

    await user.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(screen.getByRole('button', { name: 'Atualizando…' })).toBeDisabled()
    refresh.resolve([])
    expect(await screen.findByRole('button', { name: 'Atualizar' })).toBeEnabled()
  })

  it('409 de transição vira a situação atual da ocorrência (outro gestor agiu antes)', async () => {
    vi.mocked(listOccurrences).mockResolvedValue([occurrence()])
    vi.mocked(updateOccurrenceStatus).mockRejectedValue(
      new ApiError('Transição inválida', 'INVALID_STATUS_TRANSITION', {
        from: 'acknowledged',
        to: 'acknowledged',
      }),
    )
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Reconhecer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível: a ocorrência já está reconhecida.',
    )
  })
})
