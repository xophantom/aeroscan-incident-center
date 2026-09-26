import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { AppConfig } from './config/app-config'
import { APP_OPTIONS, configureApp } from './configure-app'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, APP_OPTIONS)
  configureApp(app)
  await app.listen(app.get(AppConfig).port, '0.0.0.0')
}

// Falhas ao montar os módulos (ex.: Mongo inacessível) o Nest registra e encerra sozinho; as do
// listen (onModuleInit, porta ocupada) chegam aqui com os logs do boot retidos pelo bufferLogs.
bootstrap().catch((error: unknown) => {
  Logger.flush()
  console.error('Falha ao iniciar a API:', error)
  process.exit(1)
})
