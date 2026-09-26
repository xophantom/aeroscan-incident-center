import type { NestApplicationOptions } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'

/** Opções de criação do app, as mesmas no main.ts e nos testes e2e. */
export const APP_OPTIONS: NestApplicationOptions = { bufferLogs: true, bodyParser: false }

/** Configuração compartilhada entre main.ts e os testes e2e. */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.useLogger(app.get(Logger))
  // Aceita qualquer JSON: corpo que não é objeto vira 422 da validação, não 400 do parser
  app.useBodyParser('json', { strict: false })
  // O front compilado pode ser aberto via file:// (Origin: null); "*" cobre esse caso (sem cookies)
  app.enableCors()
  app.enableShutdownHooks()

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AeroScan · Triagem de Ocorrências')
      .setDescription('Erros sempre no envelope { error: { code, message, details? } }')
      .setVersion('1.0')
      .build(),
  )
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document))

  return app
}
