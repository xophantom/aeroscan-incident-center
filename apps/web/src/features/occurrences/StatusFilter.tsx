import { STATUS_FILTERS } from './labels'
import type { StatusFilterValue } from './use-status-filter'

interface StatusFilterProps {
  value: StatusFilterValue
  onChange: (value: StatusFilterValue) => void
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar por status"
      className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
    >
      {STATUS_FILTERS.map((filter) => {
        const active = filter.value === value
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
