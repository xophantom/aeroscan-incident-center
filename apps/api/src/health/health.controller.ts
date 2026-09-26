import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { MongoHealth } from '../infra/mongo/mongo-health'

const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  mongo: z.enum(['up', 'down']),
})

type HealthResponse = z.infer<typeof healthResponseSchema>

class HealthResponseDto extends createZodDto(healthResponseSchema) {}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly mongo: MongoHealth) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto, description: 'API e Mongo no ar' })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto, description: 'Mongo indisponível' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const mongoUp = await this.mongo.isUp()
    res.status(mongoUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
    return { status: mongoUp ? 'ok' : 'error', mongo: mongoUp ? 'up' : 'down' }
  }
}
