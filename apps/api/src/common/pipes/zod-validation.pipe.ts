import { createZodValidationPipe } from 'nestjs-zod'
import { validationException } from '../errors/validation'

export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: validationException,
})
