const base = require('../jest.config.js')

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  rootDir: '.',
  testRegex: '\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@aeroscan/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
  testTimeout: 30_000,
}
