import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { OccurrenceEvents } from './occurrence-events'
import { OCCURRENCE_MODEL, OccurrenceSchema } from './occurrence.schema'
import { OccurrencesController } from './occurrences.controller'
import { OccurrencesGateway } from './occurrences.gateway'
import { OccurrencesRepository } from './occurrences.repository'
import { OccurrencesService } from './occurrences.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: OCCURRENCE_MODEL, schema: OccurrenceSchema }])],
  controllers: [OccurrencesController],
  providers: [OccurrencesService, OccurrencesRepository, OccurrenceEvents, OccurrencesGateway],
})
export class OccurrencesModule {}
