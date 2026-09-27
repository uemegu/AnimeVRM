import { ArdyMotionGenerator } from './generator';

// CLI（scripts/ardy-generate.ts）が Playwright から window.__ardy を呼ぶ
const runner = new ArdyMotionGenerator();
(window as unknown as { __ardy: ArdyMotionGenerator }).__ardy = runner;
