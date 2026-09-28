import { isOccurrenceStatus, type UpdateStatusBody } from '@aeroscan/shared'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toast/toast-context'
import { ApiError, errorMessage } from '../../lib/api/client'
import type { LiveStatus } from '../../lib/api/events'
import { updateOccurrenceStatus } from '../../lib/api/occurrences'
import { STATUS_LABEL } from './labels'
import { OccurrenceList } from './OccurrenceList'
import { StatusFilter } from './StatusFilter'
import { useLiveUpdates } from './use-live-updates'
import { useOccurrences } from './use-occurrences'
import { useStatusFilter, type StatusFilterValue } from './use-status-filter'

// O 409 da API cita os status em inglês; na tela, vira a situação que o gestor enxerga
function statusChangeError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'INVALID_STATUS_TRANSITION') {
    const from = (error.details as { from?: unknown } | undefined)?.from
    if (isOccurrenceStatus(from)) {
      return `Não foi possível: a ocorrência já está ${STATUS_LABEL[from].toLowerCase()}.`
    }
  }
  return errorMessage(error)
}

const LIVE_LABEL: Record<LiveStatus, string> = {
  connecting: 'Conectando…',
  live: 'Ao vivo',
  offline: 'Reconectando…',
}

function LiveBadge({ status }: { status: LiveStatus }) {
  const live = status === 'live'
  return (
    <span
      role="status"
      title={live ? 'A lista atualiza sozinha quando chegam mudanças' : undefined}
      className={`inline-flex items-center gap-2 text-sm font-medium ${live ? 'text-live' : 'text-accent'}`}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${live ? 'bg-live motion-safe:animate-pulse' : 'bg-accent'}`}
      />
      {LIVE_LABEL[status]}
    </span>
  )
}

function emptyMessage(filter: StatusFilterValue): string {
  if (filter === 'active') return 'Nada pendente. Alertas novos aparecem aqui assim que chegam.'
  if (filter === 'all') return 'Nenhuma ocorrência registrada ainda.'
  return `Nenhuma ocorrência ${STATUS_LABEL[filter].toLowerCase()}.`
}

export function OccurrencesPage() {
  const [filter, setFilter] = useStatusFilter()
  const { state, refreshing, refetch, refetchQuietly } = useOccurrences(filter)
  const live = useLiveUpdates(refetchQuietly)
  const toast = useToast()
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set())

  async function changeStatus(id: string, body: UpdateStatusBody, success: string) {
    setPendingIds((ids) => new Set(ids).add(id))
    try {
      await updateOccurrenceStatus(id, body)
      toast.show(success, 'success')
      return true
    } catch (error) {
      toast.show(statusChangeError(error))
      return false
    } finally {
      // Com sucesso ou erro (ex.: 409 porque outro gestor já agiu), a lista volta a refletir o
      // servidor antes de liberar os botões do item
      await refetch()
      setPendingIds((ids) => {
        const remaining = new Set(ids)
        remaining.delete(id)
        return remaining
      })
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule pb-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-data text-sm font-bold text-accent">AeroScan</span>
          <h1 className="text-xl font-semibold text-ink">Triagem de ocorrências</h1>
        </div>
        <div className="flex items-center gap-4">
          <LiveBadge status={live} />
          <Button variant="secondary" onClick={() => void refetch()} disabled={refreshing}>
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </Button>
        </div>
      </header>

      <div className="mt-4 mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <StatusFilter value={filter} onChange={setFilter} />
        <p className="text-sm text-muted">
          Mais urgentes no topo: prioridade = severidade × peso do tipo.
        </p>
      </div>

      <OccurrenceList
        state={state}
        pendingIds={pendingIds}
        emptyMessage={emptyMessage(filter)}
        onRetry={() => void refetch()}
        onAcknowledge={(id) =>
          void changeStatus(id, { status: 'acknowledged' }, 'Ocorrência reconhecida.')
        }
        onResolve={(id, note) =>
          changeStatus(id, { status: 'resolved', note }, 'Ocorrência resolvida.')
        }
      />
    </main>
  )
}
