import { test, expect } from '@playwright/test';

async function modulePage(page: import('@playwright/test').Page) {
  await page.route('**/__ardy_test.html', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.goto('./__ardy_test.html');
}

test('Others exposes opt-in ARDY controls without downloading models', async ({ page }) => {
  const modelRequests: string[] = [];
  page.on('request', r => { if (r.url().includes('huggingface.co')) modelRequests.push(r.url()); });
  await page.goto('./');
  await page.locator('.studio-tab-btn[data-tab="system"]').click();
  const enabled = page.locator('#gemini-ardy-enabled');
  await expect(enabled).not.toBeChecked();
  await expect(page.locator('#gemini-ardy-controls')).toBeHidden();
  await enabled.check();
  await expect(page.locator('#gemini-ardy-controls')).toBeVisible();
  await expect(page.locator('#gemini-ardy-load')).toBeEnabled();
  await expect(page.locator('#gemini-ardy-preview')).toBeDisabled();
  await expect(page.locator('#gemini-live-connect-btn')).toBeDisabled();
  await expect(page.locator('#gemini-ardy-prompt')).toHaveValue(/A person/);
  await page.screenshot({ path: '/tmp/ardy-mini-others.png', fullPage: true });
  await enabled.uncheck();
  await expect(page.locator('#gemini-live-connect-btn')).toBeEnabled();
  expect(modelRequests).toEqual([]);
});

test('Gemini declares the English motion tool only in ARDY mode and handles cancellation', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { GeminiLiveClient } = await import('/AnimeVRM/src/ai/live/GeminiLiveClient.ts');
    const payloads: any[] = [];
    let cancelled: string[] = [];
    for (const enabled of [false, true]) {
      const client = new GeminiLiveClient({ apiKey: 'test', ardyMotionEnabled: enabled }, {
        onToolCallCancelled: (ids: string[]) => { cancelled = ids; },
        onToolCall: () => ({ status: 'generating' }),
      }) as any;
      client.ws = { readyState: WebSocket.OPEN, send: (value: string) => payloads.push(JSON.parse(value)) };
      client.sendSetup();
      await client.handleServerMessage({ toolCallCancellation: { ids: ['cancel-me'] } });
    }
    return { payloads, cancelled };
  });
  const [legacy, ardy] = result.payloads.map(p => p.setup);
  expect(legacy.tools[0].functionDeclarations.map((t: any) => t.name)).toEqual(['setExpression', 'setMotion', 'composeMotion']);
  expect(ardy.tools[0].functionDeclarations.map((t: any) => t.name)).toEqual(['generateArdyMotion', 'setExpression']);
  expect(ardy.systemInstruction.parts[0].text).toContain('A person');
  expect(ardy.systemInstruction.parts[0].text).toContain('音声で読み上げず');
  expect(ardy.outputAudioTranscription).toEqual({});
  expect(result.cancelled).toEqual(['cancel-me']);
});

test('Core27 rotations become rig-specific VRM clips, stay in place and return to idle', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { createArdyAnimationClip } = await import('/AnimeVRM/src/ai/motion/ardy/createArdyAnimationClip.ts');
    // @ts-expect-error Vite browser import
    const { CORE27_SKELETON } = await import('/AnimeVRM/src/ai/motion/ardy/vendor/motion-data.ts');
    // @ts-expect-error Vite browser import
    const { Avatar } = await import('/AnimeVRM/src/Avatar.ts');
    // @ts-expect-error Vite browser import
    const THREE = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const scene = new THREE.Scene();
    const hips = new THREE.Bone();
    scene.add(hips);
    const vrm = {
      scene, meta: { metaVersion: '1' },
      humanoid: {
        normalizedRestPose: { hips: { position: [0, 1, 0] } },
        getNormalizedBoneNode: (name: string) => name === 'hips' ? hips : null,
      },
    };
    const positions = new Float32Array(2 * 27 * 3);
    positions[1] = positions[82] = 0.9544128252334833;
    positions[81] = 10;
    const globals = new Float32Array(2 * 27 * 4);
    for (let i = 0; i < 54; i++) globals[i * 4 + 3] = 1;
    globals.set([Math.sin(Math.PI / 8), 0, 0, Math.cos(Math.PI / 8)], 27 * 4);
    const clip = createArdyAnimationClip({
      skeleton: CORE27_SKELETON, frameCount: 2, fps: 20, positions, positionsShape: [2, 27, 3],
      globalRotations: { values: globals, shape: [2, 27, 4], format: 'quaternion-xyzw' },
    }, vrm);
    const avatar = Object.assign(Object.create(Avatar.prototype), {
      vrm, mixer: new THREE.AnimationMixer(scene), options: { defaultAnimationUrl: '/idle.fbx' },
      currentAction: null, animationRequestId: 0,
    });
    const returned: string[] = [];
    avatar.playAnimation = async (url: string) => { returned.push(url); return null; };
    avatar.playAnimationClip(clip, 0);
    avatar.mixer.update(0.05);
    const angle = hips.quaternion.x;
    avatar.mixer.update(0.1);
    return { angle, position: hips.position.toArray(), returned, tracks: clip.tracks.length };
  });
  expect(result.angle).toBeCloseTo(Math.sin(Math.PI / 8));
  expect(result.position[0]).toBe(0);
  expect(result.position[1]).toBeCloseTo(1);
  expect(result.tracks).toBe(2);
  expect(result.returned).toEqual(['/idle.fbx']);
});

test('controller acknowledges promptly and discards results after cancellation or avatar replacement', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { GeminiLiveChatController } = await import('/AnimeVRM/src/ai/live/GeminiLiveChatController.ts');
    const controller = new GeminiLiveChatController() as any;
    const jobs: Array<{ resolve: (motion: any) => void; signal: AbortSignal }> = [];
    let played = 0;
    const avatar = { vrm: {}, stopGeneratedAnimation() {}, playAnimationClip() { played++; } };
    controller.setAvatar(avatar);
    controller.setArdyEnabled(true);
    controller.ardyService = {
      ready: true,
      generate: (_p: string, _d: number, signal: AbortSignal) =>
        new Promise(resolve => jobs.push({ resolve, signal })),
    };
    const tool = (id: string) => ({ id, name: 'generateArdyMotion', args: { prompt: 'A person waves.', duration: 4 } });
    const first = await controller.handleToolExecution(tool('first'));
    controller.currentAssistantMessage = null; // Server turnComplete, while inference is still running.
    controller.disconnect();
    jobs[0].resolve({});
    await new Promise(resolve => setTimeout(resolve, 0));
    const second = await controller.handleToolExecution(tool('second'));
    controller.setAvatar({ ...avatar });
    jobs[1].resolve({});
    await new Promise(resolve => setTimeout(resolve, 0));
    const invalid = await controller.handleToolExecution({ ...tool('bad'), args: { prompt: '', duration: 999 } });
    return {
      first, second, invalid, played, aborted: jobs.map(job => job.signal.aborted),
      details: controller.getHistory().map((message: any) => message.tools[0].detail),
    };
  });
  expect(result.first.status).toBe('generating');
  expect(result.second.status).toBe('generating');
  expect(result.aborted).toEqual([true, true]);
  expect(result.played).toBe(0);
  expect(result.details.every((detail: string) => detail.includes('キャンセル'))).toBe(true);
  expect(result.invalid.error).toContain('prompt');
});

test('real inference worker boots and validates WebGPU without a model download', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    const worker = new Worker('/AnimeVRM/src/ai/motion/ardy/vendor/inference.worker.ts', { type: 'module' });
    return await new Promise<{ type: string; message?: string }>((resolve, reject) => {
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker boot timeout')); }, 25_000);
      worker.onerror = e => { clearTimeout(timer); worker.terminate(); reject(new Error(e.message)); };
      worker.onmessage = ({ data }) => {
        if (data.type === 'workerReady') worker.postMessage({ type: 'getWebGpuCapabilities', requestId: 'test' });
        else if (data.requestId === 'test') {
          clearTimeout(timer);
          worker.terminate();
          resolve({ type: data.type, message: data.error?.message });
        }
      };
    });
  });
  expect(['webGpuCapabilities', 'error']).toContain(result.type);
  if (result.type === 'error') expect(result.message).toMatch(/WebGPU|GPU adapter/);
});

test('service selects a GPU variant, drains cancellation, decodes results and preserves load errors', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { ArdyMotionService } = await import('/AnimeVRM/src/ai/motion/ardy/ArdyMotionService.ts');
    const commands: any[] = [];
    let worker: any;
    let loadError = false;
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });
    class MockWorker {
      onmessage: any;
      constructor() { worker = this; }
      emit(data: any) { this.onmessage({ data }); }
      terminate() {}
      postMessage(command: any) {
        commands.push(command);
        if (command.type === 'getWebGpuCapabilities') queueMicrotask(() =>
          this.emit({ type: 'webGpuCapabilities', requestId: command.requestId, shaderF16: true }));
        if (command.type === 'loadModel') queueMicrotask(() => this.emit(loadError
          ? { type: 'error', requestId: command.requestId, error: { message: 'Model download failed: HTTP 503' } }
          : { type: 'modelLoaded', requestId: command.requestId, model: { manifest: {} } }));
        if (command.type === 'cancel') setTimeout(() => this.emit({
          type: 'cancelled', requestId: command.requestId, targetRequestId: command.targetRequestId,
        }), 10);
      }
    }
    window.Worker = MockWorker as any;
    const service = new ArdyMotionService();
    await service.initialize();
    const abort = new AbortController();
    const first = service.generate('A person waves.', 4, abort.signal).catch((e: Error) => e.name);
    await new Promise(resolve => setTimeout(resolve, 0));
    abort.abort();
    const second = service.generate('A person bows.', 4, new AbortController().signal);
    const countBeforeCancelDrains = commands.filter(c => c.type === 'generate').length;
    await first;
    await new Promise(resolve => setTimeout(resolve, 0));
    const generateCommands = commands.filter(c => c.type === 'generate');
    const rotations = new Float32Array(27 * 9);
    for (let j = 0; j < 27; j++) rotations.set([1, 0, 0, 0, 1, 0, 0, 0, 1], j * 9);
    worker.emit({
      type: 'generationComplete', requestId: generateCommands[1].requestId,
      result: {
        motion: new Float32Array([1, 2]), motionShape: [1, 1, 2],
        joints: new Float32Array(27 * 3), frameCount: 1, fps: 20,
        globalRotations: rotations, globalRotationsShape: [1, 1, 27, 3, 3],
      },
    });
    const motion = await second;
    service.dispose();
    loadError = true;
    let error = '';
    try { await service.initialize(); } catch (e) { error = (e as Error).message; }
    return {
      countBeforeCancelDrains, prompts: generateCommands.map(c => c.prompt), error,
      baseUrl: commands.find(c => c.type === 'loadModel').baseUrl,
      shape: motion.globalRotations.shape, readyAfterFailure: service.ready,
      normalizedMotion: Array.from(motion.normalizedMotion),
    };
  });
  expect(result.countBeforeCancelDrains).toBe(1);
  expect(result.prompts).toEqual(['A person waves.', 'A person bows.']);
  expect(result.baseUrl).toMatch(/\/[a-f0-9]{40}\/fp16\/$/);
  expect(result.shape).toEqual([1, 27, 9]);
  expect(result.normalizedMotion).toEqual([1, 2]);
  expect(result.error).toContain('HTTP 503');
  expect(result.readyAfterFailure).toBe(false);
});

test('transferred runtime motion arrays reach VRM playback through the service', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { ArdyMotionService } = await import('/AnimeVRM/src/ai/motion/ardy/ArdyMotionService.ts');
    // @ts-expect-error Vite browser import
    const { normalizeStructuredMotion } = await import('/AnimeVRM/src/ai/motion/ardy/vendor/motion-data.ts');
    // @ts-expect-error Vite browser import
    const { createArdyAnimationClip } = await import('/AnimeVRM/src/ai/motion/ardy/createArdyAnimationClip.ts');
    // @ts-expect-error Vite browser import
    const THREE = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() { super('/AnimeVRM/test/fixtures/ardy-result.worker.ts', { type: 'module' }); }
    } as typeof Worker;
    const service = new ArdyMotionService();
    try {
      await service.initialize();
      const motion = await service.generate('A person waves.', 4, new AbortController().signal);
      const scene = new THREE.Scene();
      const hips = new THREE.Bone();
      scene.add(hips);
      const vrm = {
        scene, meta: { metaVersion: '1' },
        humanoid: {
          normalizedRestPose: { hips: { position: [0, 1, 0] } },
          getNormalizedBoneNode: (name: string) => name === 'hips' ? hips : null,
        },
      };
      const mixer = new THREE.AnimationMixer(scene);
      const clip = createArdyAnimationClip(motion, vrm);
      mixer.clipAction(clip).play();
      mixer.update(0.05);
      // Both binary feature formats must stay on the outer result, while
      // an actual nested motion object must continue to unwrap correctly.
      const featureFormats = [new Float32Array([5, 6]), new Float32Array([5, 6]).buffer, [5, 6]];
      const features = featureFormats.map(features => Array.from(normalizeStructuredMotion({
        motion: features, joints: new Float32Array(27 * 3), frameCount: 1, fps: 20,
      }).normalizedMotion));
      const nested = normalizeStructuredMotion({
        motion: { joints: new Float32Array(27 * 3), frameCount: 1, fps: 20 },
      });
      return {
        features, nestedFrames: nested.frameCount,
        normalizedMotion: Array.from(motion.normalizedMotion),
        positionsShape: motion.positionsShape, rotationsShape: motion.globalRotations.shape,
        contacts: Array.from(motion.contacts), angle: hips.quaternion.x, height: hips.position.y,
      };
    } finally {
      service.dispose();
      window.Worker = NativeWorker;
    }
  });
  expect(result.normalizedMotion).toEqual([1, 2, 3, 4]);
  expect(result.positionsShape).toEqual([2, 27, 3]);
  expect(result.rotationsShape).toEqual([2, 27, 9]);
  expect(result.contacts).toEqual(Array(8).fill(1));
  expect(result.angle).toBeCloseTo(Math.sin(Math.PI / 8));
  expect(result.height).toBeCloseTo(1);
  expect(result.features).toEqual([[5, 6], [5, 6], [5, 6]]);
  expect(result.nestedFrames).toBe(1);
});
