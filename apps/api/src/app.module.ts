import { Module } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { ServeStaticModule } from '@nestjs/serve-static'
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter'
import { LoggingModule } from './common/logging/logging.module'
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe'
import { AppConfig } from './config/app-config'
import { ConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { ClockModule } from './infra/clock/clock.module'
import { MongoModule } from './infra/mongo/mongo.module'
import { OccurrencesModule } from './occurrences/occurrences.module'

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    ClockModule,
    MongoModule,
    ServeStaticModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [
        // O front não tem rotas: só "/" devolve o index.html, sem fallback que engula 404 da API
        { rootPath: config.frontendDistPath, renderPath: '/' },
      ],
    }),
    HealthModule,
    OccurrencesModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
