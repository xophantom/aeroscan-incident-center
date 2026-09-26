import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { AppConfig } from '../../config/app-config'

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          // Resolvido daqui: com pnpm, o pino não enxerga o pino-pretty, que é dependência da API
          transport: config.logPretty
            ? { target: require.resolve('pino-pretty'), options: { singleLine: true } }
            : undefined,
          // Healthcheck do compose bate a cada 10s: não polui o log de acesso
          autoLogging: { ignore: (req) => req.url === '/health' },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
