import { STATUS_FILTERS } from './labels'
import type { StatusFilterValue } from './use-status-filter'

interface StatusFilterProps {
  value: StatusFilterValue
  onChange: (value: StatusFilterValue) => void
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div role="group" aria-label="Filtrar por status" className="flex overflow-x-auto">
      {STATUS_FILTERS.map((filter) => {
        const active = filter.value === value
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            className={`border-b-2 px-3 pt-1.5 pb-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
              active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
