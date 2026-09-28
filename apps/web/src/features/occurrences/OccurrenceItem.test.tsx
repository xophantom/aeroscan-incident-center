import type { OccurrenceResponse } from '@aeroscan/shared'
import { render, screen, within } from '@testing-library/react'
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
        now={Date.parse('2026-09-25T14:05:00.000Z')}
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

const alertFrom = (droneId: string, minute: number) => ({
  droneId,
  detectedAt: new Date(Date.parse('2026-09-25T14:00:00.000Z') + minute * 60_000).toISOString(),
})

describe('OccurrenceItem: botões por status', () => {
  it('open: só "Reconhecer"', () => {
    renderItem({ status: 'open' })

    expect(button('Reconhecer')).toBeInTheDocument()
    expect(button('Resolver')).not.toBeInTheDocument()
  })

  it.each([
    ['open', 'Reconhecer'],
    ['acknowledged', 'Resolver'],
  ] as const)('%s: "%s" diz ao leitor de tela o tipo e o site', (status, action) => {
    renderItem({ status, type: 'intrusion', siteId: 'hangar-norte' })

    expect(button(action)).toHaveAccessibleDescription(/Intrusão.*Site hangar-norte/)
  })

  it('o formulário "Resolver" também diz de qual ocorrência é', async () => {
    const { user } = renderItem({
      status: 'acknowledged',
      type: 'intrusion',
      siteId: 'hangar-norte',
    })

    await user.click(button('Resolver')!)

    const context = /Intrusão.*Site hangar-norte/
    expect(screen.getByLabelText('Nota de resolução')).toHaveAccessibleDescription(context)
    expect(button('Confirmar resolução')).toHaveAccessibleDescription(context)
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
  it('mostra quantos alertas quando o alerta se repetiu', () => {
    renderItem({ count: 4 })

    expect(button('4 alertas')).toHaveAttribute('title', 'Alerta recebido 4 vezes')
  })

  it('lista os drones que reportaram, com quantos alertas cada um mandou', () => {
    renderItem({
      count: 3,
      alerts: [alertFrom('drone-1', 0), alertFrom('drone-2', 2), alertFrom('drone-2', 4)],
    })

    expect(screen.getByText('Drones')).toBeInTheDocument()
    expect(screen.getByText('drone-1')).toHaveAttribute('title', 'drone-1: 1 alerta')
    expect(screen.getByText('drone-2')).toHaveAttribute('title', 'drone-2: 2 alertas')
    expect(screen.getByText('×2')).toBeInTheDocument()
  })

  it('com mais de 3 drones, o resto vira "+N", que lista todos ao passar o mouse', () => {
    const drones = ['drone-1', 'drone-2', 'drone-3', 'drone-4', 'drone-5']
    renderItem({ count: 5, alerts: drones.map((drone, minute) => alertFrom(drone, minute)) })

    // drone-4 e drone-5 só aparecem no tooltip; os 3 primeiros, também na faixa
    expect(screen.getAllByText('drone-1')).toHaveLength(2)
    expect(screen.getAllByText('drone-4')).toHaveLength(1)
    expect(within(screen.getByRole('tooltip')).getByText('drone-4')).toBeInTheDocument()
    expect(button('Mais 2 drones')).toHaveAccessibleDescription(/drone-1.*drone-5/)
  })

  it('"N alertas" abre a lista de alertas, do primeiro ao último', async () => {
    const { user } = renderItem({
      count: 3,
      alerts: [alertFrom('drone-1', 0), alertFrom('drone-2', 2), alertFrom('drone-2', 4)],
    })

    await user.click(button('3 alertas')!)

    const items = within(
      screen.getByRole('list', { name: 'Alertas, do primeiro ao último' }),
    ).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('drone-1'),
      expect.stringContaining('drone-2'),
      expect.stringContaining('drone-2'),
    ])
    expect(button('3 alertas')).toHaveAttribute('aria-expanded', 'true')
  })

  it('não mostra contador quando count = 1', () => {
    renderItem({ count: 1 })

    expect(screen.queryByText(/alertas$/)).not.toBeInTheDocument()
  })

  it('mostra a hora da detecção e há quanto tempo foi', () => {
    renderItem({ detectedAt: '2026-09-25T14:00:00.000Z' })

    expect(screen.getByText('há 5 min')).toBeInTheDocument()
  })

  it('mostra badge de severidade e prioridade', () => {
    renderItem({ severity: 4, priority: 12 })

    expect(screen.getByText('Severidade 4')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})
