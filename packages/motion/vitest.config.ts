import { defineConfig } from 'vitest/config';

// MotionEngine などは素材を import.meta.env.BASE_URL から読む。テストでは仮の絶対 URL にし、
// test/setup.ts の fetch で assets/ のファイルを返す
export default defineConfig({
  test: { setupFiles: ['test/setup.ts'] },
});
