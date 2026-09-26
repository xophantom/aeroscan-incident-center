import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('quebrou')
}

describe('ErrorBoundary', () => {
  it('mostra uma mensagem no lugar da tela que quebrou', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado')
  })
})
