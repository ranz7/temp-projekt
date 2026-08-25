import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname =
  typeof __dirname === 'undefined' ? path.dirname(fileURLToPath(import.meta.url)) : __dirname

export default defineConfig({
  test: {
    name: 'unit',
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'src/**/*.integration.test.ts', 'src/**/*.integration.test.tsx']
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
