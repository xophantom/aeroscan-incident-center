import { useId } from 'react'

// Mais que isso e a faixa cresce demais; o resto fica no "+N"
const VISIBLE_DRONES = 3

export interface Reporter {
  droneId: string
  alerts: number
}

interface DroneListProps {
  reporters: Reporter[]
  /** Mostra ou esconde a lista de alertas, que tem todos os drones. */
  onToggleAlerts: () => void
  alertsOpen: boolean
  alertsId: string
}

function DroneChip({ droneId, alerts }: Reporter) {
  return (
    <span
      className="rounded-sm bg-raised px-1.5 py-0.5 font-data text-xs whitespace-nowrap"
      title={`${droneId}: ${alerts} ${alerts > 1 ? 'alertas' : 'alerta'}`}
    >
      {droneId}
      {alerts > 1 && <span className="text-muted"> ×{alerts}</span>}
    </span>
  )
}

export function DroneList({ reporters, onToggleAlerts, alertsOpen, alertsId }: DroneListProps) {
  const tooltipId = useId()
  const hidden = reporters.length - VISIBLE_DRONES

  return (
    <>
      <span className="text-xs text-muted md:sr-only">
        {reporters.length > 1 ? 'Drones' : 'Drone'}
      </span>
      {reporters.slice(0, VISIBLE_DRONES).map((reporter) => (
        <DroneChip key={reporter.droneId} {...reporter} />
      ))}
      {hidden > 0 && (
        <span className="group relative">
          <button
            type="button"
            onClick={onToggleAlerts}
            aria-expanded={alertsOpen}
            aria-controls={alertsId}
            aria-label={`Mais ${hidden} drones`}
            aria-describedby={tooltipId}
            className="rounded-sm border border-rule px-1.5 py-px font-data text-xs text-ink hover:border-muted focus-visible:outline-2 focus-visible:outline-accent"
          >
            +{hidden}
          </button>
          <span
            id={tooltipId}
            role="tooltip"
            className="invisible absolute top-full right-0 z-10 mt-1 flex w-64 flex-wrap gap-1 rounded-sm border border-rule bg-canvas p-2 opacity-0 shadow-xl shadow-black/40 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
          >
            {reporters.map((reporter) => (
              <DroneChip key={reporter.droneId} {...reporter} />
            ))}
          </span>
        </span>
      )}
    </>
  )
}
