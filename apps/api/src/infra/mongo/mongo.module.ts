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
        // Índices são sincronizados no boot (syncIndexes cria os do schema e remove os que saíram)
        autoIndex: false,
        serverSelectionTimeoutMS: 5_000,
      }),
    }),
  ],
  providers: [MongoHealth],
  exports: [MongoHealth],
})
export class MongoModule {}
