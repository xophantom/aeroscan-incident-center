import { Injectable } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'

@Injectable()
export class MongoHealth {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async isUp(): Promise<boolean> {
    if (!this.connection.db) return false
    try {
      await this.connection.db.admin().ping()
      return true
    } catch {
      return false
    }
  }
}
