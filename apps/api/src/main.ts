import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { AppConfig } from './config/app-config'
import { APP_OPTIONS, configureApp } from './configure-app'

async function bootstrap(): Promise<void> {
  // Falha no boot (ex.: Mongo inacessível) encerra com o erro, sem o process.abort padrão do Nest
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...APP_OPTIONS,
    abortOnError: false,
  })
  configureApp(app)
  await app.listen(app.get(AppConfig).port, '0.0.0.0')
}

bootstrap().catch((error: unknown) => {
  // O Nest já registrou o erro com o stack; aqui só a causa, sem o dump da rejeição não tratada
  console.error(`Falha ao iniciar a API: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
