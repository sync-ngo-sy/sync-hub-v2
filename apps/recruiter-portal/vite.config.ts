import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    // Must precede the React plugin: it generates the route tree the app imports.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // Route tests are colocated with their routes and are not themselves routes.
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
    port: 5174,
    proxy: {
      // Same-origin in dev, so the session cookies stay same-site.
      '/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // jsdom's own origin, so tests exercise the same-origin topology production runs. The contact
    // values are deliberately distinct from the code defaults, so a test asserting them proves the
    // landing reads the env rather than a hardcoded fallback.
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_CONTACT_WHATSAPP: '963111222333',
      VITE_CONTACT_EMAIL: 'team@sync.test',
    },
  },
});
