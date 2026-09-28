import { getConnectionToken } from '@nestjs/mongoose'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AbstractLoader, ExpressLoader } from '@nestjs/serve-static'
import { Test } from '@nestjs/testing'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Connection } from 'mongoose'
import type { AddressInfo } from 'node:net'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { AppConfig } from '../../src/config/app-config'
import { APP_OPTIONS, configureApp } from '../../src/configure-app'
import { ClockService } from '../../src/infra/clock/clock.service'
import { EVENTS_PATH } from '../../src/occurrences/occurrences.gateway'
import { FakeClock } from './fake-clock'

export const T0 = new Date('2026-09-25T12:00:00.000Z')

export interface TestApp {
  app: NestExpressApplication
  connection: Connection
  clock: FakeClock
  http: ReturnType<typeof request>
  wsUrl: string
  reset(): Promise<void>
  stopDatabase(): Promise<void>
  close(): Promise<void>
}

/**
 * O mesmo AppModule e configureApp do main.ts contra um Mongo em memória; só config, relógio e o
 * loader do front são trocados.
 */
export async function createTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create()
  const clock = new FakeClock(T0)

  try {
    return await bootApp(mongo, clock)
  } catch (error) {
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

    .overrideProvider(AbstractLoader)
    .useValue(new ExpressLoader())
    .compile()

  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS))

  await app.listen(0, '127.0.0.1')

  const connection = app.get<Connection>(getConnectionToken())
  const { port } = app.getHttpServer().address() as AddressInfo

  return {
    app,
    connection,
    clock,
    http: request(app.getHttpServer()),
    wsUrl: `ws://127.0.0.1:${port}${EVENTS_PATH}`,
    async reset() {
      clock.set(T0)
      // deleteMany pra manter os índices criados no boot
      await Promise.all(Object.values(connection.collections).map((c) => c.deleteMany({})))
    },
    async stopDatabase() {
      await mongo.stop()
    },
    async close() {
      await app.close()
      await mongo.stop()
    },
  }
}
