import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * O build precisa abrir direto do disco (file://). Nessa origem o Chrome bloqueia
 * <script type="module"> e recursos com crossorigin, então o bundle vira um script clássico (IIFE).
 */
function classicScriptForFileProtocol(): Plugin {
  return {
    name: 'classic-script-for-file-protocol',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/ type="module"/g, ' defer').replace(/ crossorigin/g, ''),
    },
  }
}

export default defineConfig({
  // Caminhos relativos: o mesmo build funciona via file:// e servido pela API em "/"
  base: './',
  plugins: [react(), tailwindcss(), classicScriptForFileProtocol()],
  build: {
    modulePreload: false,
    // Em IIFE o Vite embutiria o CSS no JS; assim sai um .css próprio
    cssCodeSplit: false,
    rollupOptions: { output: { format: 'iife' } },
  },
  server: {
    port: 5173,
    // Em dev o front usa "mesma origem"; o Vite repassa para a API
    proxy: { '/occurrences': 'http://localhost:3000', '/health': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
