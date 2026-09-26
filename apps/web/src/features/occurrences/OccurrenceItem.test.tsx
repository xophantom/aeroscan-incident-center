import type { OccurrenceResponse } from '@aeroscan/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { occurrence } from '../../test/fixtures'
import { OccurrenceItem } from './OccurrenceItem'

function renderItem(overrides: Partial<OccurrenceResponse> = {}) {
  const onAcknowledge = vi.fn()
  const onResolve = vi.fn().mockResolvedValue(true)
  const item = (changes: Partial<OccurrenceResponse>) => (
    <ul>
      <OccurrenceItem
        occurrence={occurrence({ ...overrides, ...changes })}
        busy={false}
        onAcknowledge={onAcknowledge}
        onResolve={onResolve}
      />
    </ul>
  )
  const { rerender } = render(item({}))
  return {
    onAcknowledge,
    onResolve,
    user: userEvent.setup(),
    rerenderWith: (changes: Partial<OccurrenceResponse>) => rerender(item(changes)),
  }
}

const button = (name: string) => screen.queryByRole('button', { name })

describe('OccurrenceItem: botões por status', () => {
  it('open: só "Reconhecer"', () => {
    renderItem({ status: 'open' })

    expect(button('Reconhecer')).toBeInTheDocument()
    expect(button('Resolver')).not.toBeInTheDocument()
  })

  it('acknowledged: só "Resolver"', () => {
    renderItem({ status: 'acknowledged' })

    expect(button('Resolver')).toBeInTheDocument()
    expect(button('Reconhecer')).not.toBeInTheDocument()
  })

  it('resolved: nenhuma ação, e a nota aparece', () => {
    renderItem({ status: 'resolved', note: 'falso positivo' })

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('falso positivo')).toBeInTheDocument()
  })

  it('"Reconhecer" dispara com o id da ocorrência', async () => {
    const { onAcknowledge, user } = renderItem({ status: 'open' })

    await user.click(button('Reconhecer')!)

    expect(onAcknowledge).toHaveBeenCalledWith('66f4a1c2e4b0a1b2c3d4e5f6')
  })

  it('"Resolver" abre o campo de nota e envia a nota', async () => {
    const { onResolve, user } = renderItem({ status: 'acknowledged' })

    await user.click(button('Resolver')!)
    await user.type(screen.getByLabelText('Nota de resolução'), 'equipe verificou')
    await user.click(button('Confirmar resolução')!)

    expect(onResolve).toHaveBeenCalledWith('66f4a1c2e4b0a1b2c3d4e5f6', 'equipe verificou')
    expect(screen.queryByLabelText('Nota de resolução')).not.toBeInTheDocument()
  })

  it('o campo de nota some se a ocorrência deixa de ser resolvível (outro gestor resolveu)', async () => {
    const { user, rerenderWith } = renderItem({ status: 'acknowledged' })
    await user.click(button('Resolver')!)

    rerenderWith({ status: 'resolved', note: 'resolvida por outro gestor' })

    expect(screen.queryByLabelText('Nota de resolução')).not.toBeInTheDocument()
  })
})

describe('OccurrenceItem: dados exibidos', () => {
  it('mostra ×N quando o alerta se repetiu', () => {
    renderItem({ count: 4 })

    expect(screen.getByText('×4')).toHaveAttribute('title', 'Alerta recebido 4 vezes')
  })

  it('não mostra contador quando count = 1', () => {
    renderItem({ count: 1 })

    expect(screen.queryByText(/^×/)).not.toBeInTheDocument()
  })

  it('mostra badge de severidade e prioridade', () => {
    renderItem({ severity: 4, priority: 12 })

    expect(screen.getByText('Severidade 4')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})
