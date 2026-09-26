import { resolveFormSchema } from '@aeroscan/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/Button'

interface ResolveFormProps {
  onSubmit: (note: string) => Promise<void> | void
  onCancel: () => void
}

/** Nota de resolução validada com o mesmo schema que a API usa no PATCH. */
export function ResolveForm({ onSubmit, onCancel }: ResolveFormProps) {
  const noteId = useId()
  const errorId = useId()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resolveFormSchema), defaultValues: { note: '' } })

  const submit = handleSubmit(({ note }) => onSubmit(note))

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="mt-3 space-y-2 border-t border-slate-100 pt-3"
    >
      <label htmlFor={noteId} className="block text-sm font-medium text-slate-700">
        Nota de resolução
      </label>
      <textarea
        id={noteId}
        rows={3}
        autoFocus
        placeholder="Ex.: falso positivo; equipe verificou o perímetro."
        aria-invalid={errors.note ? true : undefined}
        aria-describedby={errors.note ? errorId : undefined}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none aria-invalid:border-red-500"
        {...register('note')}
      />
      {errors.note && (
        <p id={errorId} className="text-sm text-red-600">
          {errors.note.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Confirmar resolução
        </Button>
      </div>
    </form>
  )
}
