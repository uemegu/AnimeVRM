#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createJevMotionPlan } from './lib/jev-motion-plan.ts';
import { validateAvatarContactProfile, validateMotionQualityPlan } from '../src/ai/motion/quality/validate.ts';

interface BatchItem {
  prompt: string;
  duration?: number;
  output: string;
  format?: 'fbx' | 'saved-motion' | 'raw';
  qualityPlan?: string;
  jev?: boolean;
  actingNote?: string;
  avatar?: string;
  contactProfile?: string;
  candidates?: number;
  seed?: string;
  cfg?: number | number[];
  keep?: number;
  preview?: boolean;
  lockLegs?: boolean;
  amplitude?: number;
  loop?: boolean;
}

const optionsConfig = {
  prompt: { type: 'string' as const, short: 'p' },
  duration: { type: 'string' as const, short: 'd', default: '4' },
  output: { type: 'string' as const, short: 'o' },
  format: { type: 'string' as const, short: 'f' },
  'quality-plan': { type: 'string' as const },
  jev: { type: 'boolean' as const, default: false },
  'acting-note': { type: 'string' as const },
  avatar: { type: 'string' as const },
  'contact-profile': { type: 'string' as const },
  candidates: { type: 'string' as const, short: 'n' },
  seed: { type: 'string' as const },
  cfg: { type: 'string' as const },
  keep: { type: 'string' as const },
  preview: { type: 'boolean' as const, default: false },
  'fit-hands': { type: 'boolean' as const, default: true },
  'lock-legs': { type: 'boolean' as const, default: false },
  loop: { type: 'boolean' as const, default: false },
  amplitude: { type: 'string' as const },
  batch: { type: 'string' as const, short: 'b' },
  headed: { type: 'boolean' as const, default: false },
  port: { type: 'string' as const },
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
      --quality-plan <file>  JSON MotionQualityPlan (requires --avatar and --contact-profile)
      --jev                  Ask Jev multiple typed questions and compose a contact plan (requires --avatar and --contact-profile)
      --acting-note <text>   Extra acting intent supplied to Jev
      --avatar <URL>         Target VRM URL served by the local app; the motion is baked for this avatar
      --contact-profile <file> JSON profile for that exact VRM
  -n, --candidates <n>     Seeds to try per CFG weight (1 to 32, default: 1); the best-scoring one is saved
      --seed <text>        Base seed; with -n 1 it reproduces a candidate listed in .candidates.json
      --cfg <w[,w...]>     CFG weight(s) (default: 3.5); a list compares weights on the same seeds
      --keep <n>           Files to write, best first (default: 3 with several candidates, else 1)
      --preview            Write a .preview.png contact sheet per FBX (requires --avatar)
      --no-fit-hands       With --avatar, keep ardy-mini's arm rotations instead of refitting the palms to the avatar
      --lock-legs          With --avatar, hold the legs and hips height at the first frame (gestures in place)
      --amplitude <a>      With --avatar, scale the motion toward an upright arms-down pose (0.3 to 1.5, default 1)
      --loop               Ease the last 0.5 s into the first pose, for motions played on repeat
  -b, --batch <file>       JSON array of tasks; each may also set candidates, seed, cfg, keep, preview, lockLegs, amplitude, loop
      --headed             Run browser in headed (visible) mode
      --port <port>        Vite dev server port (default: Vite's default, 5173)
  -h, --help               Show this help message

Examples:
  node scripts/ardy-generate.ts -p "A person raises their right hand and waves" -o public/animations/ardy_wave.fbx
  node scripts/ardy-generate.ts -p "A person bows politely" -d 3 -o public/animations/ardy_bow.fbx
  node scripts/ardy-generate.ts -p "A person gently touches their cheek" --jev --acting-note "shy, soft, brief" --avatar /models/aoi/aoi-school.vrm --contact-profile motion-profiles/aoi.json -o public/animations/ardy_cheek.fbx
  node scripts/ardy-generate.ts -p "A person raises their right hand and waves" -n 8 --cfg 2,3.5,5 -o public/animations/ardy_wave.fbx
  node scripts/ardy-generate.ts --batch batch_tasks.json
`);
}

async function main() {
  const { values } = parseArgs({
    options: optionsConfig,
    allowPositionals: false,
    allowNegative: true,
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
      qualityPlan: values['quality-plan'],
      jev: values.jev,
      actingNote: values['acting-note'],
      avatar: values.avatar,
      contactProfile: values['contact-profile'],
    });
  } else {
    console.error('Error: Either --prompt or --batch must be provided.');
    printHelp();
    process.exit(1);
  }

  // Command-line sampling options also apply to batch tasks that do not set their own.
  const cliCandidates = values.candidates === undefined ? undefined : Number(values.candidates);
  const cliKeep = values.keep === undefined ? undefined : Number(values.keep);
  const cliCfg = values.cfg?.split(',').map(Number);
  for (const task of tasks) {
    task.avatar ??= values.avatar;
    const candidates = task.candidates ?? cliCandidates ?? 1;
    if (!Number.isInteger(candidates) || candidates < 1 || candidates > 32) throw new RangeError(task.output + ': candidates must be an integer from 1 to 32.');
    const cfg = task.cfg === undefined ? cliCfg : [task.cfg].flat();
    if (cfg?.some(weight => !Number.isFinite(weight) || weight < 0 || weight > 20)) throw new RangeError(task.output + ': cfg weights must be numbers from 0 to 20.');
    const keep = task.keep ?? cliKeep;
    if (keep !== undefined && (!Number.isInteger(keep) || keep < 1)) throw new RangeError(task.output + ': keep must be a positive integer.');
  }

  const requestedPort = values.port === undefined ? undefined : Number(values.port);
  if (requestedPort !== undefined && (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535)) {
    throw new RangeError('--port must be an integer between 1 and 65535.');
  }
  // Preflight every file and ask Jev before opening Chrome or generating anything.
  const preparedQuality = new Map<number, { plan: unknown; profile: unknown; avatarUrl: string; planner?: { model: string; confidence: Record<string, number>; note: string } }>();
  if ((values.jev || tasks.some(task => task.jev)) && !process.env.JEV_API_KEY && !process.env.TYPESAFE_API_KEY && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(path.resolve(process.cwd(), '.env'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const useJev = task.jev ?? values.jev;
    if (task.qualityPlan && useJev) throw new Error(task.output + ': choose either --quality-plan or --jev, not both.');
    if ((task.qualityPlan || task.contactProfile) && !(task.qualityPlan && task.avatar && task.contactProfile) && !useJev) {
      throw new Error(task.output + ': quality requires avatar and contact-profile, plus either quality-plan or --jev.');
    }
    if (task.avatar && (!task.avatar.startsWith('/') || task.avatar.startsWith('//'))) {
      throw new Error(task.output + ': avatar must be a same-origin URL path such as /models/aoi/aoi-school.vrm.');
    }
    if ((task.preview ?? values.preview) && !task.avatar) throw new Error(task.output + ': --preview requires --avatar.');
    if (useJev && (!task.avatar || !task.contactProfile)) {
      throw new Error(task.output + ': --jev requires avatar and contact-profile.');
    }
    if (!task.qualityPlan && !useJev) continue;
    const duration = task.duration ?? 4;
    if (!Number.isFinite(duration) || duration < 2 || duration > 8) throw new RangeError(task.output + ': duration must be between 2 and 8 seconds.');
    const avatarUrl = task.avatar!;
    if (!avatarUrl.startsWith('/') || avatarUrl.startsWith('//')) throw new Error(task.output + ': avatar must be a same-origin URL path such as /models/aoi/aoi-school.vrm.');
    const profilePath = path.resolve(process.cwd(), task.contactProfile!);
    const profile = validateAvatarContactProfile(JSON.parse(fs.readFileSync(profilePath, 'utf-8')));
    if (!profile.calibrated) throw new Error(task.output + ': contact profile is not calibrated; mark it calibrated only after visually checking every anchor.');
    let plan: unknown;
    let planner: { model: string; confidence: Record<string, number>; note: string } | undefined;
    if (useJev) {
      console.log(`[Jev] Interpreting ${task.output} with one batched typed-question request...`);
      const generated = await createJevMotionPlan({ prompt: task.prompt, actingNote: task.actingNote ?? values['acting-note'], duration });
      plan = generated.plan;
      planner = { model: generated.model, confidence: generated.confidence, note: generated.note };
      console.log(`[Jev] Plan prepared from ${Object.keys(generated.confidence).length} answers. Contact timing will be marked for review.`);
    } else {
      const planPath = path.resolve(process.cwd(), task.qualityPlan!);
      plan = validateMotionQualityPlan(JSON.parse(fs.readFileSync(planPath, 'utf-8')));
    }
    const validatedPlan = validateMotionQualityPlan(plan);
    if (Math.abs(validatedPlan.duration - duration) > 1 / 30) throw new Error(task.output + ': plan duration does not match the generation duration.');
    if ((task.format ?? (task.output.endsWith('.json') ? 'saved-motion' : 'fbx')) === 'raw') throw new Error(task.output + ': quality correction cannot be combined with raw output.');
    preparedQuality.set(i, { plan: validatedPlan, profile, avatarUrl, ...(planner ? { planner } : {}) });
  }

  let viteServer: any = null;
  let baseUrl: string;
  try {
    console.log(`[Vite] Starting isolated local dev server${requestedPort === undefined ? ' with Vite defaults' : ` on port ${requestedPort}`}...`);
    const { createServer } = await import('vite');
    const serverOptions = requestedPort === undefined
      ? { host: '127.0.0.1' }
      : { host: '127.0.0.1', port: requestedPort };
    viteServer = await createServer({
      server: serverOptions,
    });
    await viteServer.listen();
    const address = viteServer.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Vite did not report its listening port.');
    baseUrl = `http://127.0.0.1:${address.port}/AnimeVRM/`;
    console.log(`[Vite] Server listening at ${baseUrl}`);
  } catch (error) {
    if (viteServer) await viteServer.close();
    throw error;
  }
  const runnerUrl = `${baseUrl}cli-runner.html`;

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
      const prepared = preparedQuality.get(i);
      const quality = prepared ? { plan: prepared.plan, avatarUrl: prepared.avatarUrl, profile: prepared.profile, planner: prepared.planner } : undefined;
      const result = await page.evaluate(async (opt) => {
        return await (window as any).__ardy.generate(opt);
      }, {
        prompt: task.prompt,
        actingNote: task.actingNote ?? values['acting-note'],
        duration: task.duration ?? 4,
        format: task.format ?? (task.output.endsWith('.json') ? 'saved-motion' : 'fbx'),
        ...(quality ? { quality } : {}),
        candidates: task.candidates ?? cliCandidates ?? 1,
        seed: task.seed ?? values.seed,
        cfgWeights: task.cfg === undefined ? cliCfg : [task.cfg].flat(),
        keep: task.keep ?? cliKeep,
        avatarUrl: task.avatar,
        preview: task.preview ?? values.preview,
        fitHands: values['fit-hands'],
        loop: task.loop ?? values.loop,
        style: {
          lockLegs: task.lockLegs ?? values['lock-legs'],
          ...(task.amplitude ?? values.amplitude) === undefined ? {} : { amplitude: Number(task.amplitude ?? values.amplitude) },
        },
      });

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`${taskIndex} Generation completed in ${elapsedSec}s (frames: ${result.frameCount})`);

      let outputPath = path.resolve(process.cwd(), task.output);
      const basePath = outputPath.replace(/[.][^.]+$/, '');
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const extension = path.extname(outputPath);
      const reportPath = basePath + '.quality.json';
      const best = result.candidates[0];
      console.log(`${taskIndex} Best: seed ${best.seed}, cfg ${best.cfgWeight}, score ${best.score.total.toFixed(2)}`);
      if (result.candidates.length > 1) {
        const candidatesPath = basePath + '.candidates.json';
        const summary = {
          prompt: task.prompt,
          duration: task.duration ?? 4,
          note: 'Lower score is better. Scores detect defects only; watch the kept files before choosing.',
          candidates: result.candidates.map((candidate: any) => ({
            ...candidate,
            file: candidate.rank === 1 ? path.basename(outputPath)
              : candidate.rank <= result.alternates.length + 1 ? path.basename(basePath + '.cand' + candidate.rank + extension) : null,
          })),
        };
        fs.writeFileSync(candidatesPath, JSON.stringify(summary, null, 2), 'utf-8');
        for (const candidate of result.candidates) {
          const metrics = candidate.score.metrics;
          console.log(`${taskIndex}   #${candidate.rank} seed ${candidate.seed} cfg ${candidate.cfgWeight} score ${candidate.score.total.toFixed(2)}`
            + ` slide ${metrics.footSlide.toFixed(3)} penetration ${metrics.handPenetration.toFixed(2)}`
            + ` wrist ${metrics.wristStrain.toFixed(2)} activity ${metrics.activity.toFixed(2)}${candidate.lowActivity ? ' (low activity)' : ''}`);
        }
        for (const alternate of result.alternates) {
          const alternatePath = basePath + '.cand' + alternate.rank + extension;
          fs.writeFileSync(alternatePath, result.format === 'fbx'
            ? Buffer.from(alternate.data as string, 'base64')
            : JSON.stringify(alternate.data, null, 2));
          console.log(`${taskIndex} Alternate #${alternate.rank}: ${alternatePath}`);
          if (alternate.preview) fs.writeFileSync(basePath + '.cand' + alternate.rank + '.preview.png', Buffer.from(alternate.preview, 'base64'));
        }
        console.log(`${taskIndex} Candidates: ${candidatesPath}`);
      }
      if (result.qualityReport) {
        fs.writeFileSync(reportPath, JSON.stringify(result.qualityReport, null, 2), 'utf-8');
        console.log(taskIndex + ' Quality: ' + result.qualityReport.status);
        for (const reason of result.qualityReport.reasons) console.log(taskIndex + ' Quality note: ' + reason);
        if (result.sourceMotion) {
          const sourcePath = basePath + '.source.saved-motion.json';
          fs.writeFileSync(sourcePath, JSON.stringify(result.sourceMotion, null, 2), 'utf-8');
          console.log(taskIndex + ' Source motion: ' + sourcePath);
        }
      }
      if (result.data === null) {
        console.error(taskIndex + ' Quality blocked export. No motion asset was written. Report: ' + reportPath);
        process.exitCode = 1;
        continue;
      }
      if (result.qualityReport?.status === 'needs-review') {
        outputPath = extension ? outputPath.slice(0, -extension.length) + '.review' + extension : outputPath + '.review';
        console.log(taskIndex + ' Review copy: ' + outputPath);
        process.exitCode = 1;
      }
      if (result.format === 'fbx') {
        const buffer = Buffer.from(result.data as string, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log(`${taskIndex} Saved FBX: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)\n`);
        if (result.preview) {
          const previewPath = outputPath.replace(/[.][^.]+$/, '') + '.preview.png';
          fs.writeFileSync(previewPath, Buffer.from(result.preview, 'base64'));
          console.log(`${taskIndex} Preview: ${previewPath}`);
        }
      } else {
        const jsonStr = JSON.stringify(result.data, null, 2);
        fs.writeFileSync(outputPath, jsonStr, 'utf-8');
        console.log(`${taskIndex} Saved JSON: ${outputPath} (${(jsonStr.length / 1024).toFixed(1)} KB)\n`);
      }
    }

    if (process.exitCode === 1) console.error('One or more quality gates refused export.');
    else console.log('All generation tasks completed successfully!');
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
