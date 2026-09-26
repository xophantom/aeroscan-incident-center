import { defineConfig } from 'vitest/config'

// Separado do vite.config.ts: o Vitest 2 roda sobre o próprio Vite 5, e os testes não precisam dos plugins de build
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
