import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfig } from '../../config/app-config'
import { MongoHealth } from './mongo-health'

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.mongoUri,
        // Índices são criados explicitamente no boot (syncIndexes), não em background
        autoIndex: false,
        serverSelectionTimeoutMS: 5_000,
      }),
    }),
  ],
  providers: [MongoHealth],
  exports: [MongoHealth],
})
export class MongoModule {}
