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
import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, Res } from '@nestjs/common'
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
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
  `Agrupa na ocorrência aberta mais antiga do mesmo siteId + type detectada a partir de ` +
  `${DEDUP_WINDOW_MS / MINUTE_MS} min antes do alerta (count +1, severity +1 até ${MAX_SEVERITY}) e ` +
  `responde 200; senão cria e responde 201. detectedAt vale de ` +
  `${MAX_ALERT_AGE_MS / HOUR_MS} h atrás até ${MAX_FUTURE_SKEW_MS / MINUTE_MS} min à frente.`
const VALID_TRANSITIONS = Object.entries(STATUS_TRANSITIONS)
  .flatMap(([from, targets]) => targets.map((to) => `${from} → ${to}`))
  .join(', ')

@ApiTags('occurrences')
@ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Dados inválidos' })
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly service: OccurrencesService) {}

  @Post()
  @ApiOperation({ summary: 'Registra um alerta', description: REGISTER_DESCRIPTION })
  @ApiCreatedResponse({ type: OccurrenceResponseDto, description: 'Ocorrência criada' })
  @ApiOkResponse({ type: OccurrenceResponseDto, description: 'Agrupado em ocorrência existente' })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'WRITE_CONFLICT: retentativas de agrupar/criar esgotadas sob concorrência',
  })
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
  @ApiOkResponse({ type: [OccurrenceResponseDto] })
  async list(@Query() query: ListOccurrencesQueryDto): Promise<OccurrenceResponse[]> {
    const occurrences = await this.service.list(query)
    return occurrences.map(toOccurrenceResponse)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: `Muda o status (${VALID_TRANSITIONS}); resolved exige note` })
  @ApiBody({ type: UpdateStatusBodyDto })
  @ApiOkResponse({ type: OccurrenceResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Ocorrência não encontrada' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Transição inválida' })
  async changeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStatusBodySchema)) body: UpdateStatusInput,
  ): Promise<OccurrenceResponse> {
    return toOccurrenceResponse(await this.service.changeStatus(id, body))
  }
}
