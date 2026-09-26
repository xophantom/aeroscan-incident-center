import { getConnectionToken } from '@nestjs/mongoose'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AbstractLoader, ExpressLoader } from '@nestjs/serve-static'
import { Test } from '@nestjs/testing'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Connection } from 'mongoose'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { AppConfig } from '../../src/config/app-config'
import { APP_OPTIONS, configureApp } from '../../src/configure-app'
import { ClockService } from '../../src/infra/clock/clock.service'
import { FakeClock } from './fake-clock'

export const T0 = new Date('2026-09-25T12:00:00.000Z')

export interface TestApp {
  app: NestExpressApplication
  connection: Connection
  clock: FakeClock
  http: ReturnType<typeof request>
  reset(): Promise<void>
  close(): Promise<void>
}

/** App real (mesmo AppModule e configureApp do main.ts) contra um Mongo em memória. */
export async function createTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create()
  const clock = new FakeClock(T0)

  try {
    return await bootApp(mongo, clock)
  } catch (error) {
    // Sem isso um boot quebrado deixa o mongod vivo e o Jest nunca termina
    await mongo.stop()
    throw error
  }
}

async function bootApp(mongo: MongoMemoryServer, clock: FakeClock): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(
      new AppConfig({
        MONGO_URI: mongo.getUri('aeroscan-e2e'),
        LOG_LEVEL: 'silent',
        LOG_PRETTY: 'false',
      }),
    )
    .overrideProvider(ClockService)
    .useValue(clock)
    // No módulo de teste o serve-static nasce antes do adapter HTTP e cairia no NoopLoader
    .overrideProvider(AbstractLoader)
    .useValue(new ExpressLoader())
    .compile()

  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS))
  // Porta real: requisições em paralelo (teste de concorrência) chegam de fato simultâneas
  await app.listen(0, '127.0.0.1')

  const connection = app.get<Connection>(getConnectionToken())

  return {
    app,
    connection,
    clock,
    http: request(app.getHttpServer()),
    async reset() {
      clock.set(T0)
      // deleteMany (e não dropDatabase) para manter os índices criados no boot
      await Promise.all(Object.values(connection.collections).map((c) => c.deleteMany({})))
    },
    async close() {
      await app.close()
      await mongo.stop()
    },
  }
}
