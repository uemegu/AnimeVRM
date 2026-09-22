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
  await expect(page.locator('#gemini-ardy-autonomous')).toBeChecked();
  await page.locator('#gemini-ardy-autonomous').uncheck();
  await expect(page.locator('#gemini-ardy-planner-model')).toBeDisabled();
  await page.locator('#gemini-ardy-autonomous').check();
  await expect(page.locator('#gemini-ardy-planner-model')).toHaveValue('gemini-3.5-flash-lite');
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
  expect(ardy.inputAudioTranscription).toEqual({});
  expect(ardy.tools[0].functionDeclarations[0].parameters.properties.motions.maxItems).toBe(6);
  expect(ardy.systemInstruction.parts[0].text).toContain('抽象語だけで指示しない');
  const fingerSchema = ardy.tools[0].functionDeclarations[0].parameters.properties.motions.items.properties.fingerMotion;
  expect(fingerSchema.required).toEqual(['right', 'left']);
  for (const hand of ['right', 'left']) {
    expect(Object.keys(fingerSchema.properties[hand].properties)).toEqual(['index', 'peace', 'thumb', 'fist', 'open', 'three']);
    for (const option of Object.values(fingerSchema.properties[hand].properties) as any[]) {
      expect(option.enum).toEqual(['YES', 'NO']);
    }
  }
  expect(ardy.systemInstruction.parts[0].text).toContain('動作終了まで保持');
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

test('controller waits for the first clip and discards results after cancellation or avatar replacement', async ({ page }) => {
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
    const firstResult = controller.handleToolExecution(tool('first'));
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.currentAssistantMessage = null; // Server turnComplete, while inference is still running.
    controller.disconnect();
    jobs[0].resolve({});
    await new Promise(resolve => setTimeout(resolve, 0));
    const first = await firstResult;
    const secondResult = controller.handleToolExecution(tool('second'));
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.setAvatar({ ...avatar });
    jobs[1].resolve({});
    await new Promise(resolve => setTimeout(resolve, 0));
    const second = await secondResult;
    const invalid = await controller.handleToolExecution({ ...tool('bad'), args: { prompt: '', duration: 999 } });
    return {
      first, second, invalid, played, aborted: jobs.map(job => job.signal.aborted),
      details: controller.getHistory().map((message: any) => message.tools[0].detail),
    };
  });
  expect(result.first.error).toBeTruthy();
  expect(result.second.error).toBeTruthy();
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
    const debug = console.debug;
    const timings: any[] = [];
    console.debug = (...args) => {
      if (args[0] === '[ardy-mini] generation timing') timings.push(args[1]);
      debug(...args);
    };
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
        contacts: Array.from(motion.contacts), angle: hips.quaternion.x, height: hips.position.y, timings,
      };
    } finally {
      service.dispose();
      console.debug = debug;
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
  expect(result.timings).toHaveLength(1);
  expect(result.timings[0]).toMatchObject({
    status: 'success', requestedSeconds: 4, frameCount: 2, inferenceMs: 1,
    textEncodeMs: 0, denoiseMs: 1, decodeMs: 0, motionSeconds: 0.1,
    framesPerSecond: 2000, realTimeFactor: 0.01,
  });
  expect(result.timings[0].wallMs).toBeGreaterThanOrEqual(result.timings[0].workerRoundTripMs);
  expect(result.timings[0].queueMs).toBeGreaterThanOrEqual(0);
});

test('Finger Motion uses the motion.html shapes, reaches them in one second and preserves other bones', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { FingerMotionService, parseFingerMotion, applyFingerMotion, FINGER_MOTION_OPTIONS } = await import('/AnimeVRM/src/ai/motion/FingerMotion.ts');
    // @ts-expect-error Vite browser import
    const THREE = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const scene = new THREE.Scene();
    const bones = new Map<string, any>();
    for (const side of ['right', 'left']) {
      for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
        const segments = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
        for (const segment of segments) {
          const bone = new THREE.Bone(); scene.add(bone);
          bones.set(side + finger + segment, bone);
        }
      }
    }
    const wrist = new THREE.Bone(); scene.add(wrist); bones.set('rightHand', wrist);
    const vrm = { scene, meta: { metaVersion: '1' }, humanoid: { getNormalizedBoneNode: (name: string) => bones.get(name) ?? null } };
    const service = new FingerMotionService();
    const identity = new THREE.Quaternion();
    const shapes: any[] = [];
    for (const { id } of FINGER_MOTION_OPTIONS) {
      const targets = await service.createTargets({ right: id, left: id }, vrm);
      shapes.push({ id, angles: targets.map((target: any) => ({ bone: target.bone, angle: target.rotation.angleTo(identity) })) });
    }
    const selection = parseFingerMotion({ right: { peace: 'YES', index: 'NO' }, left: { open: 'NO' } });
    const targets = await service.createTargets(selection, vrm);
    const mirrored = await service.createTargets(selection, { ...vrm, meta: { metaVersion: '0' } });
    const mirrorErrors = targets.map((target: any, i: number) => {
      const q = target.rotation.clone(); q.x *= -1; q.z *= -1;
      return q.angleTo(mirrored[i].rotation);
    });
    const ring = bones.get('rightRingProximal')!;
    ring.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), .2);
    const before = ring.quaternion.clone();
    const target = targets.find((target: any) => target.bone === 'rightRingProximal')!.rotation;
    const thumb = bones.get('rightThumbMetacarpal')!;
    const leftIndex = bones.get('leftIndexProximal')!;
    const wristQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .4);
    const leftQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), .3);
    const clip = new THREE.AnimationClip('body', 4, [
      new THREE.QuaternionKeyframeTrack(wrist.uuid + '.quaternion', [0, 4], [...wristQ.toArray(), ...wristQ.toArray()]),
      new THREE.QuaternionKeyframeTrack(thumb.uuid + '.quaternion', [0, 4], [...wristQ.toArray(), ...wristQ.toArray()]),
      new THREE.QuaternionKeyframeTrack(leftIndex.uuid + '.quaternion', [0, 4], [...leftQ.toArray(), ...leftQ.toArray()]),
    ]);
    applyFingerMotion(clip, vrm, targets);
    const mixer = new THREE.AnimationMixer(scene);
    mixer.clipAction(clip).play();
    mixer.update(0);
    const startError = ring.quaternion.angleTo(before);
    mixer.update(.5);
    const halfError = ring.quaternion.angleTo(before.clone().slerp(target, .5));
    mixer.update(.5);
    const oneSecondError = ring.quaternion.angleTo(target);
    mixer.update(1);
    const holdError = ring.quaternion.angleTo(target);
    const conflicts: string[] = [];
    for (const input of [{ right: { peace: 'YES', index: 'YES' } }, { right: { peace: 'MAYBE' } }]) {
      try { parseFingerMotion(input); } catch (error) { conflicts.push((error as Error).message); }
    }
    const trackCount = clip.tracks.length;
    applyFingerMotion(clip, vrm, await service.createTargets(parseFingerMotion({ right: { peace: 'NO' } }), vrm));
    return {
      shapes, mirrorErrors, startError, halfError, oneSecondError, holdError, conflicts,
      wristError: wrist.quaternion.angleTo(wristQ), leftError: leftIndex.quaternion.angleTo(leftQ),
      thumbTrackCount: clip.tracks.filter((track: any) => track.name === thumb.uuid + '.quaternion').length,
      noSelectionUnchanged: clip.tracks.length === trackCount,
    };
  });
  const openByPose: Record<string, string[]> = {
    index: ['Index'], peace: ['Index', 'Middle'], thumb: ['Thumb'], fist: [],
    open: ['Thumb', 'Index', 'Middle', 'Ring', 'Little'], three: ['Index', 'Middle', 'Ring'],
  };
  for (const shape of result.shapes) {
    expect(shape.angles).toHaveLength(30);
    for (const { bone, angle } of shape.angles) {
      const open = openByPose[shape.id].some(finger => bone.includes(finger));
      expect(angle).toBeCloseTo(open ? 0 : bone.includes('Thumb') ? .55 : 1.25, 3);
    }
  }
  for (const error of [...result.mirrorErrors, result.startError, result.halfError, result.oneSecondError, result.holdError, result.wristError, result.leftError]) {
    expect(error).toBeLessThan(.001);
  }
  expect(result.thumbTrackCount).toBe(1);
  expect(result.noSelectionUnchanged).toBe(true);
  expect(result.conflicts).toHaveLength(2);
});

test('controller waits for ARDY before applying Finger Motion and cancels during pose preparation', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { GeminiLiveChatController } = await import('/AnimeVRM/src/ai/live/GeminiLiveChatController.ts');
    const controller = new GeminiLiveChatController() as any;
    let finishGeneration!: (motion: unknown) => void;
    let finishFingers!: (targets: unknown[]) => void;
    const requested: unknown[] = [];
    let played = 0;
    controller.setAvatar({ vrm: {}, stopGeneratedAnimation() {}, playAnimationClip() { played++; } });
    controller.setArdyEnabled(true);
    controller.ardyService = { ready: true, generate: () => new Promise(resolve => { finishGeneration = resolve; }) };
    controller.fingerMotionService = {
      createTargets: (selection: unknown) => {
        requested.push(selection);
        return new Promise(resolve => { finishFingers = resolve; });
      },
    };
    const acknowledgementResult = controller.handleToolExecution({
      id: 'fingers', name: 'generateArdyMotion',
      args: { prompt: 'A person raises their right hand.', fingerMotion: { right: { peace: 'YES' }, left: { open: 'NO' } } },
    });
    const beforeGeneration = requested.length;
    finishGeneration({});
    await new Promise(resolve => setTimeout(resolve, 0));
    const beforePoseReady = played;
    controller.disconnect();
    finishFingers([]);
    await new Promise(resolve => setTimeout(resolve, 0));
    const acknowledgement = await acknowledgementResult;
    return { acknowledgement, beforeGeneration, beforePoseReady, played, requested, detail: controller.getHistory()[0].tools[0].detail };
  });
  expect(result.acknowledgement.error).toBeTruthy();
  expect(result.beforeGeneration).toBe(0);
  expect(result.beforePoseReady).toBe(0);
  expect(result.requested).toEqual([{ right: 'peace' }]);
  expect(result.played).toBe(0);
  expect(result.detail).toContain('キャンセル');
  expect(result.detail).toContain('ピースをする=YES');
});
