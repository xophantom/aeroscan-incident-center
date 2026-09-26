/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleNameMapper: {
    // Testes usam o fonte do shared: não dependem de build e cobrem o código real
    '^@aeroscan/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
