import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  // Vitest設定
  // @ts-expect-error vitest config field
  test: {
    globals: true,
    environment: 'node',
  },
});
