import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

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
        className="mx-auto mt-8 max-w-4xl rounded-sm border border-sev-5/50 bg-strip p-6 text-center text-sm text-ink"
      >
        Algo deu errado ao exibir a tela. Recarregue a página.
      </p>
    )
  }
}
