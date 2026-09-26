import { join } from 'node:path'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/aeroscan'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: z.enum(['true', 'false']).optional(),
  // src/config e dist/config estão a 4 níveis da raiz do monorepo
  FRONTEND_DIST_PATH: z
    .string()
    .min(1)
    .default(join(__dirname, '..', '..', '..', '..', 'frontend-dist')),
})

export type LogLevel = z.infer<typeof envSchema>['LOG_LEVEL']

export class AppConfig {
  readonly port: number
  readonly mongoUri: string
  readonly logLevel: LogLevel
  readonly logPretty: boolean
  readonly frontendDistPath: string

  constructor(env: NodeJS.ProcessEnv) {
    const parsed = envSchema.parse(env)
    this.port = parsed.PORT
    this.mongoUri = parsed.MONGO_URI
    this.logLevel = parsed.LOG_LEVEL
    this.logPretty = parsed.LOG_PRETTY
      ? parsed.LOG_PRETTY === 'true'
      : env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test'
    this.frontendDistPath = parsed.FRONTEND_DIST_PATH
  }
}
