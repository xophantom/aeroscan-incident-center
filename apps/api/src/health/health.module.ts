import { Module } from '@nestjs/common'
import { MongoModule } from '../infra/mongo/mongo.module'
import { HealthController } from './health.controller'

@Module({
  imports: [MongoModule],
  controllers: [HealthController],
})
export class HealthModule {}
