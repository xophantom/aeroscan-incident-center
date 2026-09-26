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
          // O healthcheck da imagem bate a cada 10 s: não polui o log de acesso
          autoLogging: { ignore: (req) => req.url === '/health' },
          // A causa de um 5xx o filtro de exceções já registra; o log de acesso dispensa o erro
          // sintético ("failed with status code") que o pino-http anexa, com o stack dele
          customErrorObject: (_req, _res, _error, { err, ...rest }: Record<string, unknown>) =>
            rest,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
