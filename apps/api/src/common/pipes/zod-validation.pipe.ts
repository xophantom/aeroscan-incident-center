import { createZodValidationPipe } from 'nestjs-zod'
import { validationException } from '../errors/validation'

/** Valida com os schemas Zod do shared; falha vira 422 no envelope padrão. */
export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: validationException,
})
