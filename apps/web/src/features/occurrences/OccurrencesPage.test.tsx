import type { OccurrenceResponse } from '@aeroscan/shared'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui/toast/ToastProvider'
import { listOccurrences, updateOccurrenceStatus } from '../../lib/api/occurrences'
import { deferred, occurrence } from '../../test/fixtures'
import { OccurrencesPage } from './OccurrencesPage'

vi.mock('../../lib/api/occurrences')

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
  window.history.replaceState(null, '', '/')
})

describe('OccurrencesPage', () => {
  it('abre filtrando as abertas; "Todas" consulta sem filtro', async () => {
    vi.mocked(listOccurrences).mockResolvedValue([])
    const user = renderPage()

    expect(await screen.findByText('Nenhuma ocorrência em "abertas".')).toBeInTheDocument()
    expect(listOccurrences).toHaveBeenLastCalledWith('open')

    await user.click(screen.getByRole('button', { name: 'Todas' }))

    expect(await screen.findByText('Nenhuma ocorrência registrada.')).toBeInTheDocument()
    expect(listOccurrences).toHaveBeenLastCalledWith(undefined)
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
})
