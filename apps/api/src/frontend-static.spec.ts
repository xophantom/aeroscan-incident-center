import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { frontendServeOptions } from './frontend-static'

describe('frontendServeOptions', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'front-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('serve o index.html em "/" quando o build do front existe', () => {
    writeFileSync(join(dir, 'index.html'), '<div id="root"></div>')

    expect(frontendServeOptions(dir)).toEqual([{ rootPath: dir, renderPath: '/' }])
  })

  it('sem o build do front, não serve nada', () => {
    expect(frontendServeOptions(dir)).toEqual([])
  })
})
