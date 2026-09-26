import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { frontendServeOptions } from './frontend-static'

describe('frontendServeOptions', () => {
  it('serve o index.html em "/" quando o build do front existe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'front-'))
    writeFileSync(join(dir, 'index.html'), '<div id="root"></div>')

    expect(frontendServeOptions(dir)).toEqual([{ rootPath: dir, renderPath: '/' }])
  })

  it('sem o build do front, não serve nada', () => {
    expect(frontendServeOptions(mkdtempSync(join(tmpdir(), 'front-')))).toEqual([])
  })
})
