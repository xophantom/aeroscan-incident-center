import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AppConfig } from './config/app-config'
import { configureApp } from './configure-app'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  configureApp(app)
  await app.listen(app.get(AppConfig).port, '0.0.0.0')
}

void bootstrap()
