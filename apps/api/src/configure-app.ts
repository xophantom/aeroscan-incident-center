import type { NestApplicationOptions } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { AppConfig } from './config/app-config'

// Usados pelo main.ts e pelos testes e2e, para o app testado ser o mesmo que sobe.
// bodyParser: false porque configureApp registra o parser JSON sem o modo strict.
export const APP_OPTIONS: NestApplicationOptions = { bufferLogs: true, bodyParser: false }

export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.useLogger(app.get(Logger))
  app.disable('x-powered-by')
  // Aceita qualquer JSON: corpo que não é objeto vira 422 da validação, não 400 do parser
  app.useBodyParser('json', { strict: false })
  // O padrão (Origin: null) atende o front aberto via file://. Não protege nada: a API não tem
  // autenticação e iframes sandbox também mandam null. Front num domínio próprio: só ele.
  app.enableCors({ origin: app.get(AppConfig).corsOrigins })
  app.enableShutdownHooks()

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AeroScan · Triagem de Ocorrências')
      .setDescription(
        'Erros das rotas de ocorrências no envelope { error: { code, message, details? } }; ' +
          'o /health responde { status, mongo }.',
      )
      .setVersion('1.0')
      .build(),
  )
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document))

  return app
}
