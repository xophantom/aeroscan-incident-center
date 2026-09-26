import { Badge } from '../../components/ui/Badge'

const SEVERITY_CLASS: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-800',
  2: 'bg-lime-100 text-lime-800',
  3: 'bg-amber-100 text-amber-900',
  4: 'bg-orange-500 text-white',
  5: 'bg-red-600 text-white',
}

export function SeverityBadge({ severity }: { severity: number }) {
  return (
    <Badge className={SEVERITY_CLASS[severity] ?? SEVERITY_CLASS[1]} title="Severidade (1 a 5)">
      Severidade {severity}
    </Badge>
  )
}
