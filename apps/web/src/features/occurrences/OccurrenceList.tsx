import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { OccurrenceItem } from './OccurrenceItem'
import type { OccurrencesState } from './use-occurrences'

interface OccurrenceListProps {
  state: OccurrencesState
  pendingIds: ReadonlySet<string>
  emptyMessage: string
  onRetry: () => void
  onAcknowledge: (id: string) => void
  onResolve: (id: string, note: string) => Promise<boolean>
}

export function OccurrenceList({
  state,
  pendingIds,
  emptyMessage,
  onRetry,
  onAcknowledge,
  onResolve,
}: OccurrenceListProps) {
  if (state.kind === 'loading') {
    return (
      <div className="py-12 text-center">
        <Spinner label="Carregando ocorrências" />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-800">{state.message}</p>
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (state.items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    )
  }

  // Já vem ordenada pela API (prioridade desc; empate → mais recente)
  return (
    <ul className="space-y-3">
      {state.items.map((occurrence) => (
        <OccurrenceItem
          key={occurrence.id}
          occurrence={occurrence}
          busy={pendingIds.has(occurrence.id)}
          onAcknowledge={onAcknowledge}
          onResolve={onResolve}
        />
      ))}
    </ul>
  )
}
