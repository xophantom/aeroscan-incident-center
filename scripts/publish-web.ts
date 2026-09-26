// Copia o build do web (apps/web/dist) para frontend-dist/, a pasta versionada da entrega
import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'apps/web/dist')
const target = resolve(root, 'frontend-dist')

if (!existsSync(source)) {
  console.error('apps/web/dist não existe: rode "pnpm --filter @aeroscan/web build" antes.')
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
cpSync(source, target, { recursive: true })
console.log('frontend-dist/ atualizado a partir de apps/web/dist/')
