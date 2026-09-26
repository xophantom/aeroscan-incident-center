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
        // Sem a fila do Mongoose: com o banco fora, a operação falha na seleção de servidor (2 s) e
        // vira 503; no boot, poucas tentativas para a API sem Mongo terminar logo, com erro claro
        bufferCommands: false,
        serverSelectionTimeoutMS: 2_000,
        retryAttempts: 2,
      }),
    }),
  ],
  providers: [MongoHealth],
  exports: [MongoHealth],
})
export class MongoModule {}
