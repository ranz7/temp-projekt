import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname =
  typeof __dirname === 'undefined' ? path.dirname(fileURLToPath(import.meta.url)) : __dirname

export default defineConfig({
  cacheDir: '.vitest-cache',
  test: {
    name: 'integration',
    globals: true,
    environment: 'node',
    isolate: false,
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules'],
    globalSetup: ['src/backend/__tests__/integration-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: [
      { find: /^@backend$/, replacement: path.resolve(dirname, './src/backend/index.ts') },
      { find: /^@backend\/(.*)$/, replacement: `${path.resolve(dirname, './src/backend')}/$1` },
      { find: /^@shared\/(.*)$/, replacement: `${path.resolve(dirname, './src/shared')}/$1` },
      { find: /^@\/(.*)$/, replacement: `${path.resolve(dirname, './src')}/$1` }
    ]
  }
})
