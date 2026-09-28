import { NOTE_MAX_LENGTH, resolveFormSchema } from '@aeroscan/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/Button'

interface ResolveFormProps {
  /** Ids dos elementos que identificam a ocorrência, para o leitor de tela. */
  describedBy: string
  onSubmit: (note: string) => Promise<void> | void
  onCancel: () => void
}

/** Nota de resolução validada com o mesmo schema que a API usa no PATCH. */
export function ResolveForm({ describedBy, onSubmit, onCancel }: ResolveFormProps) {
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
      className="space-y-2 border-t border-rule bg-canvas/40 py-3 pr-3 pl-5"
    >
      <label htmlFor={noteId} className="block text-sm font-medium text-ink">
        Nota de resolução
      </label>
      <textarea
        id={noteId}
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        autoFocus
        placeholder="Ex.: falso positivo; equipe verificou o perímetro."
        aria-invalid={errors.note ? true : undefined}
        aria-describedby={errors.note ? `${describedBy} ${errorId}` : describedBy}
        className="w-full rounded-sm border border-rule bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none aria-invalid:border-sev-5"
        {...register('note')}
      />
      {errors.note && (
        <p id={errorId} className="text-sm text-sev-5">
          {errors.note.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} aria-describedby={describedBy}>
          Confirmar resolução
        </Button>
      </div>
    </form>
  )
}
