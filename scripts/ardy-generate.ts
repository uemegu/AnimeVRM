#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Browser, type Page } from '@playwright/test';

interface BatchItem {
  prompt: string;
  duration?: number;
  output: string;
  format?: 'fbx' | 'saved-motion' | 'raw';
}

const optionsConfig = {
  prompt: { type: 'string' as const, short: 'p' },
  duration: { type: 'string' as const, short: 'd', default: '4' },
  output: { type: 'string' as const, short: 'o' },
  format: { type: 'string' as const, short: 'f' },
  batch: { type: 'string' as const, short: 'b' },
  headed: { type: 'boolean' as const, default: false },
  port: { type: 'string' as const, default: '5173' },
  help: { type: 'boolean' as const, short: 'h', default: false },
};

function printHelp() {
  console.log(`
Usage: node scripts/ardy-generate.ts [options]

Generate 3D motions from English prompts using ardy-mini via WebGPU in Chrome.

Options:
  -p, --prompt <text>      English description of motion (e.g. "A person waves with right hand")
  -d, --duration <sec>     Motion duration in seconds (2 to 8, default: 4)
  -o, --output <path>      Output file path (.fbx or .json)
  -f, --format <format>    Output format: fbx, saved-motion, raw (auto-detected from file ext)
  -b, --batch <file>       JSON file containing an array of generation tasks
      --headed             Run browser in headed (visible) mode
      --port <port>        Vite dev server port (default: 5173)
  -h, --help               Show this help message

Examples:
  node scripts/ardy-generate.ts -p "A person raises their right hand and waves" -o public/animations/ardy_wave.fbx
  node scripts/ardy-generate.ts -p "A person bows politely" -d 3 -o public/animations/ardy_bow.fbx
  node scripts/ardy-generate.ts --batch batch_tasks.json
`);
}

async function checkServerRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(1000) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function main() {
  const { values } = parseArgs({
    options: optionsConfig,
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const tasks: BatchItem[] = [];

  if (values.batch) {
    const batchPath = path.resolve(process.cwd(), values.batch);
    if (!fs.existsSync(batchPath)) {
      console.error(`Error: Batch file not found: ${batchPath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(batchPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      console.error('Error: Batch file content must be a JSON array of tasks.');
      process.exit(1);
    }
    tasks.push(...parsed);
  } else if (values.prompt) {
    const output = values.output || 'output.fbx';
    const duration = parseFloat(values.duration || '4');
    let format = values.format as BatchItem['format'];
    if (!format) {
      format = output.endsWith('.json') ? 'saved-motion' : 'fbx';
    }
    tasks.push({
      prompt: values.prompt,
      duration,
      output,
      format,
    });
  } else {
    console.error('Error: Either --prompt or --batch must be provided.');
    printHelp();
    process.exit(1);
  }

  const port = parseInt(values.port || '5173', 10);
  const baseUrl = `http://127.0.0.1:${port}/AnimeVRM/`;
  const runnerUrl = `${baseUrl}cli-runner.html`;

  let viteServer: any = null;
  const isRunning = await checkServerRunning(baseUrl);
  if (!isRunning) {
    console.log(`[Vite] Starting local dev server on port ${port}...`);
    const { createServer } = await import('vite');
    viteServer = await createServer({
      server: { port, host: '127.0.0.1' },
    });
    await viteServer.listen();
    console.log(`[Vite] Server listening at ${baseUrl}`);
  } else {
    console.log(`[Vite] Existing dev server detected at ${baseUrl}`);
  }

  console.log('[Playwright] Launching Chrome with WebGPU enabled...');
  let context: any = null;
  try {
    const userDataDir = path.resolve(process.env.HOME || process.cwd(), '.cache/ardy-mini-profile');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',
      headless: !values.headed,
      args: [
        '--enable-unsafe-webgpu',
        '--enable-dawn-features=allow_unsafe_apis,disable_adapter_blocklist',
        '--enable-gpu',
        '--ignore-gpu-blocklist',
      ],
    });

    const page: Page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[ardy-mini]')) {
        console.log(`[Browser] ${text}`);
      }
    });

    page.on('pageerror', (err) => {
      console.error(`[Browser Error] ${err.message}`);
    });

    console.log(`[Playwright] Opening runner page: ${runnerUrl}`);
    await page.goto(runnerUrl, { waitUntil: 'domcontentloaded' });

    // Wait for __ardy to be available
    await page.waitForFunction(() => !!(window as any).__ardy, { timeout: 15000 });

    console.log('[ardy-mini] Initializing AI model & MotionEngine rig...');
    const initPromise = page.evaluate(() => (window as any).__ardy.init());

    // Monitor progress
    let lastDetail = '';
    const progressInterval = setInterval(async () => {
      try {
        const status = await page.evaluate(() => (window as any).__ardy?.status);
        if (status && status.detail !== lastDetail) {
          lastDetail = status.detail;
          console.log(`[ardy-mini Progress] ${status.state}: ${status.detail}`);
        }
      } catch {
        // Page might be busy or closed
      }
    }, 1000);

    try {
      await initPromise;
      clearInterval(progressInterval);
      console.log('[ardy-mini] Initialization complete! Ready for generation.\n');
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }

    // Execute generation tasks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskIndex = `[${i + 1}/${tasks.length}]`;
      console.log(`${taskIndex} Generating: "${task.prompt}" (duration: ${task.duration ?? 4}s, format: ${task.format ?? 'fbx'})`);

      const startTime = performance.now();
      const result = await page.evaluate(async (opt) => {
        return await (window as any).__ardy.generate(opt);
      }, {
        prompt: task.prompt,
        duration: task.duration ?? 4,
        format: task.format ?? (task.output.endsWith('.json') ? 'saved-motion' : 'fbx'),
      });

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`${taskIndex} Generation completed in ${elapsedSec}s (frames: ${result.frameCount})`);

      const outputPath = path.resolve(process.cwd(), task.output);
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (result.format === 'fbx') {
        const buffer = Buffer.from(result.data as string, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log(`${taskIndex} Saved FBX: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)\n`);
      } else {
        const jsonStr = JSON.stringify(result.data, null, 2);
        fs.writeFileSync(outputPath, jsonStr, 'utf-8');
        console.log(`${taskIndex} Saved JSON: ${outputPath} (${(jsonStr.length / 1024).toFixed(1)} KB)\n`);
      }
    }

    console.log('All generation tasks completed successfully!');
  } finally {
    if (context) {
      await context.close();
    }
    if (viteServer) {
      console.log('[Vite] Stopping dev server...');
      await viteServer.close();
    }
  }
}

main().catch((err) => {
  console.error('[CLI Error]', err);
  process.exit(1);
});
