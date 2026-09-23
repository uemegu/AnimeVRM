import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['crowd-mob.spec.ts'],
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4175/AnimeVRM/',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx vite preview --outDir docs --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175/AnimeVRM/crowd-test.html',
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-webgl',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
});
