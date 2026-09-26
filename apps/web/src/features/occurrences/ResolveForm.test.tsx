import { NOTE_MAX_LENGTH } from '@aeroscan/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResolveForm } from './ResolveForm'

function renderForm() {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  render(<ResolveForm describedBy="ocorrencia" onSubmit={onSubmit} onCancel={onCancel} />)
  return { onSubmit, onCancel, user: userEvent.setup() }
}

const confirm = () => screen.getByRole('button', { name: 'Confirmar resolução' })
const noteField = () => screen.getByLabelText('Nota de resolução')

describe('ResolveForm', () => {
  it('bloqueia nota vazia com a mensagem do schema do shared', async () => {
    const { onSubmit, user } = renderForm()

    await user.click(confirm())

    expect(await screen.findByText('A nota é obrigatória para resolver a ocorrência')).toBeVisible()
    expect(noteField()).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('bloqueia nota só com espaços', async () => {
    const { onSubmit, user } = renderForm()

    await user.type(noteField(), '    ')
    await user.click(confirm())

    expect(await screen.findByText('A nota é obrigatória para resolver a ocorrência')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('envia a nota sem espaços nas pontas', async () => {
    const { onSubmit, user } = renderForm()

    await user.type(noteField(), '  falso positivo  ')
    await user.click(confirm())

    expect(onSubmit).toHaveBeenCalledWith('falso positivo')
  })

  it('limita a nota ao tamanho aceito pela API', () => {
    renderForm()

    expect(noteField()).toHaveAttribute('maxlength', String(NOTE_MAX_LENGTH))
  })

  it('"Cancelar" fecha sem enviar', async () => {
    const { onSubmit, onCancel, user } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
