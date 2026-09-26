import type { Server } from 'node:http'
import type { INestApplication } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import { Test } from '@nestjs/testing'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Connection } from 'mongoose'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { AppConfig } from '../../src/config/app-config'
import { configureApp } from '../../src/configure-app'
import { ClockService } from '../../src/infra/clock/clock.service'
import { FakeClock } from './fake-clock'

export const T0 = new Date('2026-09-25T12:00:00.000Z')

export interface TestApp {
  app: INestApplication
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
    .compile()

  const app = configureApp(moduleRef.createNestApplication({ bufferLogs: true }))
  // Porta real: requisições em paralelo (teste de concorrência) chegam de fato simultâneas
  await app.listen(0, '127.0.0.1')

  const connection = app.get<Connection>(getConnectionToken())

  return {
    app,
    clock,
    http: request(app.getHttpServer() as Server),
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
