import { setTimeout as sleep } from 'node:timers/promises'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { ConnectionStates, type Connection } from 'mongoose'

// O probe do compose desiste em 3 s: o ping responde antes disso mesmo com o Mongo travado
const PING_TIMEOUT_MS = 1_500

@Injectable()
export class MongoHealth {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  isConnected(): boolean {
    return this.connection.readyState === ConnectionStates.connected
  }

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
