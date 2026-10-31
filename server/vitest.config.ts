import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 120000,
    testTimeout: 60000,
    fileParallelism: false,
  },
});
