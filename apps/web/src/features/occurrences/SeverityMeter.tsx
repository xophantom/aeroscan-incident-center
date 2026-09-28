import { MAX_SEVERITY, MIN_SEVERITY } from '@aeroscan/shared'
import { severityBg } from './severity'

const LEVELS = Array.from(
  { length: MAX_SEVERITY - MIN_SEVERITY + 1 },
  (_, offset) => MIN_SEVERITY + offset,
)

// Apagado quando a ocorrência já foi tratada: a cor fica para o que ainda pede ação
export function SeverityMeter({ severity, muted = false }: { severity: number; muted?: boolean }) {
  const fill = muted ? 'bg-muted' : severityBg(severity)
  return (
    <span
      className="inline-flex items-center gap-2"
      title={`Severidade de ${MIN_SEVERITY} a ${MAX_SEVERITY}`}
    >
      <span aria-hidden className="flex items-end gap-0.5">
        {LEVELS.map((level) => (
          <span
            key={level}
            className={`w-1.5 rounded-[1px] ${level <= severity ? fill : 'bg-rule'}`}
            style={{ height: `${0.25 + level * 0.125}rem` }}
          />
        ))}
      </span>
      <span className="font-data text-xs text-muted">Severidade {severity}</span>
    </span>
  )
}
