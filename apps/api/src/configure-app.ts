import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'

/** Configuração compartilhada entre main.ts e os testes e2e. */
export function configureApp(app: INestApplication): INestApplication {
  app.useLogger(app.get(Logger))
  // O front compilado pode ser aberto via file:// (Origin: null); "*" cobre esse caso (sem cookies)
  app.enableCors()
  app.enableShutdownHooks()

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AeroScan · Triagem de Ocorrências')
      .setDescription('Contrato HTTP em snake_case. Erros: { error: { code, message, details? } }')
      .setVersion('1.0')
      .build(),
  )
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document))

  return app
}
