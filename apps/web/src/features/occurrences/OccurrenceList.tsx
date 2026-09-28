import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { OccurrenceItem } from './OccurrenceItem'
import { STRIP_COLUMNS } from './severity'
import type { OccurrencesState } from './use-occurrences'
import { useNow } from './use-now'

const ELAPSED_REFRESH_MS = 30_000

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
  const now = useNow(ELAPSED_REFRESH_MS)

  if (state.kind === 'loading') {
    return (
      <div className="py-16 text-center">
        <Spinner label="Carregando ocorrências" />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-sm border border-sev-5/50 bg-strip p-6 text-center">
        <p className="text-sm text-ink">{state.message}</p>
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <>
      {state.refreshError && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-l-4 border-rule border-l-accent bg-strip px-4 py-2 text-sm text-ink"
        >
          <span>Não foi possível atualizar a lista: {state.refreshError}</span>
          <Button variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
      {state.items.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-6 py-14 text-center text-sm text-muted">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div
            aria-hidden
            className={`hidden gap-x-4 border border-transparent pr-3 pb-2 pl-5 text-xs text-muted md:grid ${STRIP_COLUMNS}`}
          >
            <span title="Prioridade = severidade × peso do tipo">Prioridade</span>
            <span>Ocorrência</span>
            <span>Site</span>
            <span>Drones</span>
            <span>Horário</span>
          </div>
          {/* Já vem ordenada pela API (prioridade desc; empate → mais recente) */}
          <ul className="space-y-2">
            {state.items.map((occurrence) => (
              <OccurrenceItem
                key={occurrence.id}
                occurrence={occurrence}
                now={now}
                busy={pendingIds.has(occurrence.id)}
                onAcknowledge={onAcknowledge}
                onResolve={onResolve}
              />
            ))}
          </ul>
        </>
      )}
    </>
  )
}
