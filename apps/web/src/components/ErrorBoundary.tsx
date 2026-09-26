import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

/** Erro de renderização vira uma mensagem, em vez de tela em branco. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <p
        role="alert"
        className="mx-auto mt-8 max-w-4xl rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800"
      >
        Algo deu errado ao exibir a tela. Recarregue a página.
      </p>
    )
  }
}
