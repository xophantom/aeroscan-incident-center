import {
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

@ApiTags('occurrences')
@ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Dados inválidos' })
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly service: OccurrencesService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra um alerta',
    description:
      'Se já existe ocorrência aberta do mesmo site_id + type nos últimos 10 min, agrupa ' +
      '(count +1, severity +1 até 5) e responde 200; senão cria e responde 201.',
  })
  @ApiCreatedResponse({ type: OccurrenceResponseDto, description: 'Ocorrência criada' })
  @ApiOkResponse({ type: OccurrenceResponseDto, description: 'Agrupado em ocorrência existente' })
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
  @ApiOperation({
    summary: 'Avança o status: open → acknowledged → resolved (resolved exige note)',
  })
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
