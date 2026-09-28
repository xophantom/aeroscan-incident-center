import type { ServeStaticModuleOptions } from '@nestjs/serve-static'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * O front não tem rotas: só "/" devolve o index.html, sem fallback que engula 404 da API.
 * Sem o build do front, não serve nada e "/" cai no 404 do envelope.
 */
export function frontendServeOptions(frontendDistPath: string): ServeStaticModuleOptions[] {
  return existsSync(join(frontendDistPath, 'index.html'))
    ? [{ rootPath: frontendDistPath, renderPath: '/' }]
    : []
}
