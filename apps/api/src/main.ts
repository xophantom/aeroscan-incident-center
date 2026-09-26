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

void bootstrap()
