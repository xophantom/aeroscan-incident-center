import type { UpdateStatusBody } from '@aeroscan/shared'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toast/toast-context'
import { errorMessage } from '../../lib/api/client'
import { updateOccurrenceStatus } from '../../lib/api/occurrences'
import { STATUS_FILTERS } from './labels'
import { OccurrenceList } from './OccurrenceList'
import { StatusFilter } from './StatusFilter'
import { useOccurrences } from './use-occurrences'
import { useStatusFilter } from './use-status-filter'

export function OccurrencesPage() {
  const [status, setStatus] = useStatusFilter()
  const { state, refetch } = useOccurrences(status)
  const toast = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function changeStatus(id: string, body: UpdateStatusBody, success: string) {
    setPendingId(id)
    try {
      await updateOccurrenceStatus(id, body)
      toast.show(success, 'success')
      return true
    } catch (error) {
      toast.show(errorMessage(error))
      return false
    } finally {
      setPendingId(null)
      // Com sucesso ou erro (ex.: 409 porque outro gestor já agiu), a lista volta a refletir o servidor
      await refetch()
    }
  }

  const filterLabel = STATUS_FILTERS.find((f) => f.value === status)?.label.toLowerCase()

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">AeroScan</p>
          <h1 className="text-2xl font-bold text-slate-900">Triagem de Ocorrências</h1>
          <p className="text-sm text-slate-600">
            Mais urgentes primeiro: prioridade = severidade × peso do tipo.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refetch()}>
          Atualizar
        </Button>
      </header>

      <div className="mb-4">
        <StatusFilter value={status} onChange={setStatus} />
      </div>

      <OccurrenceList
        state={state}
        pendingId={pendingId}
        emptyMessage={
          status ? `Nenhuma ocorrência em "${filterLabel}".` : 'Nenhuma ocorrência registrada.'
        }
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
