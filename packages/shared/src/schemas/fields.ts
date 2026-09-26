import { z } from 'zod'

export const TEXT_MAX_LENGTH = 100

export function requiredText(field: string) {
  return z
    .string({
      required_error: `${field} é obrigatório`,
      invalid_type_error: `${field} deve ser um texto`,
    })
    .trim()
    .min(1, `${field} é obrigatório`)
    .max(TEXT_MAX_LENGTH, `${field} deve ter no máximo ${TEXT_MAX_LENGTH} caracteres`)
}

export function oneOf<T extends readonly [string, ...string[]]>(field: string, values: T) {
  return z.enum(values, {
    errorMap: () => ({ message: `${field} deve ser um de: ${values.join(', ')}` }),
  })
}

// "?status=" (como no enunciado) chega como string vazia: vale como filtro ausente
function blankToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

export function optionalQueryParam<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(blankToUndefined, schema.optional())
}
