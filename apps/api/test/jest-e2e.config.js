const base = require('../jest.config.js')

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  // test/ e src/ estão na mesma profundidade: os caminhos com <rootDir> do base continuam valendo
  rootDir: '.',
  testRegex: '\\.e2e-spec\\.ts$',
  testTimeout: 30_000,
}
