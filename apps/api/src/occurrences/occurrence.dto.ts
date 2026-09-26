import {
  createOccurrenceBodySchema,
  errorResponseSchema,
  listOccurrencesQuerySchema,
  occurrenceResponseSchema,
  updateStatusBodySchema,
} from '@aeroscan/shared'
import { createZodDto } from 'nestjs-zod'

// DTOs são só a "casca" Nest dos schemas do shared: validação (pipe global) e Swagger
export class CreateOccurrenceDto extends createZodDto(createOccurrenceBodySchema) {}
export class ListOccurrencesQueryDto extends createZodDto(listOccurrencesQuerySchema) {}
export class OccurrenceResponseDto extends createZodDto(occurrenceResponseSchema) {}
export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}

// Union discriminada não pode ser base de `class extends` (TS2509): o cast só troca o tipo da
// instância; schema e isZodDto continuam herdados, e o nome da classe vira o nome no Swagger
export class UpdateStatusBodyDto extends (createZodDto(
  updateStatusBodySchema,
) as new () => object) {}
