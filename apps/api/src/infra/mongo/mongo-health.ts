import { setTimeout as sleep } from 'node:timers/promises'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'

// O healthcheck da imagem desiste em 3 s: o ping responde antes disso mesmo com o Mongo travado
const PING_TIMEOUT_MS = 1_500

@Injectable()
export class MongoHealth {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async isUp(): Promise<boolean> {
    const db = this.connection.db
    if (!db) return false
    const ping = db
      .admin()
      .ping()
      .then(
        () => true,
        () => false,
      )
    return Promise.race([ping, sleep(PING_TIMEOUT_MS, false, { ref: false })])
  }
}
