import type { NestApplicationOptions } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { AppConfig } from './config/app-config'

/** Opções de criação do app, as mesmas no main.ts e nos testes e2e. */
export const APP_OPTIONS: NestApplicationOptions = { bufferLogs: true, bodyParser: false }

/** Configuração compartilhada entre main.ts e os testes e2e. */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.useLogger(app.get(Logger))
  // Aceita qualquer JSON: corpo que não é objeto vira 422 da validação, não 400 do parser
  app.useBodyParser('json', { strict: false })
  // Servido pela API ou pelo proxy do Vite, o front é mesma origem; só o file:// (Origin: null)
  // precisa de CORS. Liberar "*" deixaria qualquer site no navegador do gestor mudar status.
  app.enableCors({ origin: app.get(AppConfig).corsOrigins })
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
