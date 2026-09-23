import { defineConfig } from '@playwright/test';

// Pure TypeScript/Three.js quality tests do not start Vite or claim a local port.
export default defineConfig({
  testDir: './test',
  testMatch: ['motion-quality-measure.spec.ts', 'jev-motion-plan.spec.ts', 'ardy-score.spec.ts', 'ardy-fit.spec.ts'],
  workers: 1,
  timeout: 60000,
});
