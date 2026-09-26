import {
  DEDUP_WINDOW_MS,
  HOUR_MS,
  MAX_ALERT_AGE_MS,
  MAX_FUTURE_SKEW_MS,
  MAX_SEVERITY,
  MINUTE_MS,
  STATUS_TRANSITIONS,
  updateStatusBodySchema,
  type OccurrenceResponse,
  type UpdateStatusInput,
} from '@aeroscan/shared'
import {
  applyDecorators,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  CreateOccurrenceDto,
  ErrorResponseDto,
  ListOccurrencesQueryDto,
  OccurrenceResponseDto,
  UpdateStatusBodyDto,
} from './occurrence.dto'
import { toOccurrenceResponse } from './occurrence.mapper'
import { OccurrencesService } from './occurrences.service'

// Textos do Swagger derivados das regras, para não ficarem desatualizados
const REGISTER_DESCRIPTION =
  `Agrupa na ocorrência aberta mais antiga do mesmo siteId + type detectada até ` +
  `${DEDUP_WINDOW_MS / MINUTE_MS} min antes ou depois do alerta (count +1, severity +1 até ` +
  `${MAX_SEVERITY}) e responde 200; senão cria e responde 201. detectedAt vale de ` +
  `${MAX_ALERT_AGE_MS / HOUR_MS} h atrás até ${MAX_FUTURE_SKEW_MS / MINUTE_MS} min à frente.`
const VALID_TRANSITIONS = Object.entries(STATUS_TRANSITIONS)
  .flatMap(([from, targets]) => targets.map((to) => `${from} → ${to}`))
  .join(', ')

// Erros ao ler a requisição, comuns às rotas com corpo
const ApiBodyErrors = (badRequest: string) =>
  applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto, description: badRequest }),
    ApiPayloadTooLargeResponse({ type: ErrorResponseDto, description: 'Corpo acima do limite' }),
    ApiUnsupportedMediaTypeResponse({
      type: ErrorResponseDto,
      description: 'Codificação do corpo não suportada',
    }),
  )

// Todo 503 sai com Retry-After: o pedido pode ser repetido
const ApiUnavailable = (description: string) =>
  ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description,
    headers: {
      'Retry-After': { description: 'Segundos até repetir', schema: { type: 'integer' } },
    },
  })

@ApiTags('occurrences')
@ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Dados inválidos' })
@ApiUnavailable('SERVICE_UNAVAILABLE: banco de dados indisponível')
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly service: OccurrencesService) {}

  @Post()
  @ApiOperation({ summary: 'Registra um alerta', description: REGISTER_DESCRIPTION })
  @ApiCreatedResponse({ type: OccurrenceResponseDto, description: 'Ocorrência criada' })
  @ApiOkResponse({ type: OccurrenceResponseDto, description: 'Agrupado em ocorrência existente' })
  @ApiUnavailable(
    'Banco de dados indisponível (SERVICE_UNAVAILABLE) ou retentativas esgotadas sob concorrência (WRITE_CONFLICT)',
  )
  @ApiBodyErrors('JSON malformado')
  async create(
    @Body() body: CreateOccurrenceDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OccurrenceResponse> {
    const { occurrence, created } = await this.service.register(body)
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK)
    return toOccurrenceResponse(occurrence)
  }

  @Get()
  @ApiOperation({ summary: 'Lista por prioridade (severity × peso); empate → mais recente' })
  @ApiOkResponse({ type: [OccurrenceResponseDto], description: 'Ocorrências por prioridade' })
  async list(@Query() query: ListOccurrencesQueryDto): Promise<OccurrenceResponse[]> {
    const occurrences = await this.service.list(query)
    return occurrences.map(toOccurrenceResponse)
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: `Muda o status (${VALID_TRANSITIONS}); resolved exige note`,
    description:
      'A falta de note só é cobrada (422) depois de conferir existência (404) e transição (409).',
  })
  @ApiBody({
    type: UpdateStatusBodyDto,
    description:
      'note só é lida em resolved. open é aceito, mas nenhuma transição leva a ele (409).',
  })
  @ApiOkResponse({ type: OccurrenceResponseDto, description: 'Status alterado' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Ocorrência não encontrada' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Transição inválida' })
  @ApiBodyErrors('JSON malformado ou id com escape % inválido')
  async changeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStatusBodySchema)) body: UpdateStatusInput,
  ): Promise<OccurrenceResponse> {
    return toOccurrenceResponse(await this.service.changeStatus(id, body))
  }
}
