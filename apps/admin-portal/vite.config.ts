import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '\\.test\\.tsx?$',
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/v1': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    env: {
      VITE_API_BASE_URL: 'http://sync.test',
    },
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    testTimeout: 15_000,
  },
});
