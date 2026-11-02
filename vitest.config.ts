import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Simulationen und Formen-Tests brauchen unter Last mehr als die üblichen 5 s
    testTimeout: 30_000,
  },
});
