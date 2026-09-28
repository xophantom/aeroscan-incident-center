import { canTransition, type OccurrenceResponse, type OccurrenceStatus } from '@aeroscan/shared'
import { useId, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DroneList, type Reporter } from './DroneList'
import { STATUS_LABEL, TYPE_LABEL, formatClock, formatDateTime, formatElapsed } from './labels'
import { ResolveForm } from './ResolveForm'
import { STRIP_COLUMNS, severityBg } from './severity'
import { SeverityMeter } from './SeverityMeter'

const STATUS_CLASS: Record<OccurrenceStatus, string> = {
  open: 'border-accent/50 text-accent',
  acknowledged: 'border-muted/50 text-ink',
  resolved: 'border-rule text-muted',
}

// Na ordem em que cada drone reportou pela primeira vez, com quantos alertas mandou
function reportersOf(alerts: OccurrenceResponse['alerts']): Reporter[] {
  const counts = new Map<string, number>()
  for (const { droneId } of alerts) counts.set(droneId, (counts.get(droneId) ?? 0) + 1)
  return [...counts].map(([droneId, total]) => ({ droneId, alerts: total }))
}

interface OccurrenceItemProps {
  occurrence: OccurrenceResponse
  now: number
  busy: boolean
  onAcknowledge: (id: string) => void
  /** Resolve e diz se deu certo (para fechar o formulário). */
  onResolve: (id: string, note: string) => Promise<boolean>
}

export function OccurrenceItem({
  occurrence,
  now,
  busy,
  onAcknowledge,
  onResolve,
}: OccurrenceItemProps) {
  const [resolving, setResolving] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const baseId = useId()
  const alertsId = `${baseId}-alerts`
  // Os botões se repetem na lista: tipo e site dizem ao leitor de tela de qual ocorrência são
  const describedBy = `${baseId}-type ${baseId}-site`
  const canAcknowledge = canTransition(occurrence.status, 'acknowledged')
  const canResolve = canTransition(occurrence.status, 'resolved')
  const resolved = occurrence.status === 'resolved'
  const repeated = occurrence.count > 1
  const reporters = reportersOf(occurrence.alerts)
  const toggleAlerts = () => setAlertsOpen((open) => !open)

  async function resolve(note: string) {
    if (await onResolve(occurrence.id, note)) setResolving(false)
  }

  return (
    <li className="relative rounded-sm border border-rule bg-strip">
      {/* A cor da borda chama atenção só para o que ainda pede ação */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 rounded-l-sm ${resolved ? 'bg-rule' : severityBg(occurrence.severity)}`}
      />

      <div
        className={`grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 py-3 pr-3 pl-5 md:items-center ${STRIP_COLUMNS}`}
      >
        <div className="row-span-5 md:row-span-1" title="Prioridade = severidade × peso do tipo">
          <span
            className={`block font-data text-2xl leading-none font-bold tabular-nums ${resolved ? 'text-muted' : 'text-ink'}`}
          >
            {occurrence.priority}
          </span>
          <span className="mt-1 block text-xs text-muted md:sr-only">Prioridade</span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id={`${baseId}-type`} className="font-semibold text-ink">
              {TYPE_LABEL[occurrence.type]}
            </h2>
            <Badge className={STATUS_CLASS[occurrence.status]}>
              {STATUS_LABEL[occurrence.status]}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SeverityMeter severity={occurrence.severity} muted={resolved} />
            {repeated && (
              <button
                type="button"
                onClick={toggleAlerts}
                aria-expanded={alertsOpen}
                aria-controls={alertsId}
                title={`Alerta recebido ${occurrence.count} vezes`}
                className="font-data text-xs text-ink underline decoration-muted decoration-dotted underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                {occurrence.count} alertas
              </button>
            )}
          </div>
        </div>

        <div id={`${baseId}-site`} className="col-start-2 min-w-0 md:col-start-auto">
          <span className="text-xs text-muted md:sr-only">Site</span>{' '}
          <span className="font-data text-sm break-all text-ink">{occurrence.siteId}</span>
        </div>

        <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 md:col-start-auto">
          <DroneList
            reporters={reporters}
            onToggleAlerts={toggleAlerts}
            alertsOpen={alertsOpen}
            alertsId={alertsId}
          />
        </div>

        <div
          className="col-start-2 flex items-baseline gap-2 md:col-start-auto md:block"
          title={
            `Detectada em ${formatDateTime(occurrence.detectedAt)}` +
            (repeated ? `\nÚltimo alerta em ${formatDateTime(occurrence.lastDetectedAt)}` : '')
          }
        >
          <span className="sr-only">Detectada às</span>
          <span className="font-data text-sm">{formatClock(occurrence.detectedAt, now)}</span>
          <span className="block text-xs text-muted">
            {repeated
              ? `último alerta ${formatElapsed(occurrence.lastDetectedAt, now)}`
              : formatElapsed(occurrence.detectedAt, now)}
          </span>
        </div>

        <div className="col-start-2 md:col-start-auto md:justify-self-end">
          {canAcknowledge && (
            <Button
              onClick={() => onAcknowledge(occurrence.id)}
              disabled={busy}
              aria-describedby={describedBy}
            >
              Reconhecer
            </Button>
          )}
          {canResolve && !resolving && (
            <Button
              variant="secondary"
              onClick={() => setResolving(true)}
              disabled={busy}
              aria-describedby={describedBy}
            >
              Resolver
            </Button>
          )}
        </div>
      </div>

      {alertsOpen && (
        <div id={alertsId} className="border-t border-rule py-2.5 pr-3 pl-5">
          <p id={`${alertsId}-title`} className="text-xs text-muted">
            Alertas, do primeiro ao último
          </p>
          {/* Focável: com muitos alertas a lista rola, e o teclado também precisa rolar */}
          <ol
            aria-labelledby={`${alertsId}-title`}
            tabIndex={0}
            className="mt-1.5 max-h-52 max-w-md list-decimal overflow-y-auto pl-7 font-data text-sm marker:text-xs marker:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          >
            {occurrence.alerts.map((alert) => (
              <li key={`${alert.droneId}-${alert.detectedAt}`} className="py-0.5 pl-1">
                <span className="inline-block min-w-28">{formatClock(alert.detectedAt, now)}</span>
                <span className="text-xs text-muted">{alert.droneId}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {occurrence.note && (
        <p className="border-t border-rule py-2 pr-3 pl-5 text-sm text-muted">
          <span className="text-ink">Resolução:</span> {occurrence.note}
        </p>
      )}

      {resolving && canResolve && (
        <ResolveForm
          describedBy={describedBy}
          onSubmit={resolve}
          onCancel={() => setResolving(false)}
        />
      )}
    </li>
  )
}
