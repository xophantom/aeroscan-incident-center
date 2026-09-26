import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { MongoHealth } from '../infra/mongo/mongo-health'

interface HealthResponse {
  status: 'ok' | 'error'
  mongo: 'up' | 'down'
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly mongo: MongoHealth) {}

  @Get()
  @ApiOkResponse({ description: 'API e Mongo no ar' })
  @ApiServiceUnavailableResponse({ description: 'Mongo indisponível' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const mongoUp = await this.mongo.isUp()
    res.status(mongoUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
    return { status: mongoUp ? 'ok' : 'error', mongo: mongoUp ? 'up' : 'down' }
  }
}
