import {
  createOccurrenceBodySchema,
  errorResponseSchema,
  listOccurrencesQuerySchema,
  occurrenceResponseSchema,
  updateStatusBodySchema,
} from '@aeroscan/shared'
import { createZodDto } from 'nestjs-zod'

// Classes Nest dos schemas do shared: o pipe global valida pelo tipo do parâmetro e o Swagger lê o
// schema. O nome da classe vira o nome do componente no Swagger.
export class CreateOccurrenceDto extends createZodDto(createOccurrenceBodySchema) {}
export class ListOccurrencesQueryDto extends createZodDto(listOccurrencesQuerySchema) {}
export class OccurrenceResponseDto extends createZodDto(occurrenceResponseSchema) {}
export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}

// Union discriminada não pode ser base de `class extends` (TS2509): esta classe serve só ao Swagger,
// e o controller valida o PATCH com pipe explícito para manter o tipo da union no parâmetro.
export class UpdateStatusBodyDto extends (createZodDto(
  updateStatusBodySchema,
) as new () => object) {}
