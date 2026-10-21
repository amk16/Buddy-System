// vitest/config re-exports everything vite's defineConfig accepts and adds the
// `test` block, so one config file serves both the dev/build pipeline and the
// test runner.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom = a fake browser (window, document, localStorage) inside Node, so
    // browser-shaped modules can be unit-tested without launching a browser.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
