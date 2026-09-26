import { canTransition, type OccurrenceResponse, type OccurrenceStatus } from '@aeroscan/shared'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { STATUS_LABEL, TYPE_LABEL, formatDateTime } from './labels'
import { ResolveForm } from './ResolveForm'
import { SeverityBadge } from './SeverityBadge'

const STATUS_CLASS: Record<OccurrenceStatus, string> = {
  open: 'bg-sky-100 text-sky-800',
  acknowledged: 'bg-violet-100 text-violet-800',
  resolved: 'bg-slate-100 text-slate-600',
}

interface OccurrenceItemProps {
  occurrence: OccurrenceResponse
  busy: boolean
  onAcknowledge: (id: string) => void
  /** Resolve e diz se deu certo (para fechar o formulário). */
  onResolve: (id: string, note: string) => Promise<boolean>
}

export function OccurrenceItem({
  occurrence,
  busy,
  onAcknowledge,
  onResolve,
}: OccurrenceItemProps) {
  const [resolving, setResolving] = useState(false)
  const canAcknowledge = canTransition(occurrence.status, 'acknowledged')
  const canResolve = canTransition(occurrence.status, 'resolved')
  const repeated = occurrence.count > 1

  async function resolve(note: string) {
    if (await onResolve(occurrence.id, note)) setResolving(false)
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-14 shrink-0 text-center" title="Prioridade = severidade × peso do tipo">
          <div className="text-2xl font-bold tabular-nums text-slate-900">
            {occurrence.priority}
          </div>
          <div className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            prioridade
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">{TYPE_LABEL[occurrence.type]}</h2>
            <SeverityBadge severity={occurrence.severity} />
            {repeated && (
              <Badge
                className="bg-slate-900 text-white"
                title={`Alerta recebido ${occurrence.count} vezes`}
              >
                ×{occurrence.count}
              </Badge>
            )}
            <Badge className={STATUS_CLASS[occurrence.status]}>
              {STATUS_LABEL[occurrence.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Site <strong className="font-medium text-slate-800">{occurrence.siteId}</strong> · Drone{' '}
            {occurrence.droneId}
          </p>
          <p className="text-xs text-slate-500">
            Detectada em {formatDateTime(occurrence.detectedAt)}
            {repeated && ` · último alerta em ${formatDateTime(occurrence.lastDetectedAt)}`}
          </p>
          {occurrence.note && (
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">Nota:</span> {occurrence.note}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {canAcknowledge && (
            <Button onClick={() => onAcknowledge(occurrence.id)} disabled={busy}>
              Reconhecer
            </Button>
          )}
          {canResolve && !resolving && (
            <Button onClick={() => setResolving(true)} disabled={busy}>
              Resolver
            </Button>
          )}
        </div>
      </div>

      {resolving && canResolve && (
        <ResolveForm onSubmit={resolve} onCancel={() => setResolving(false)} />
      )}
    </li>
  )
}
