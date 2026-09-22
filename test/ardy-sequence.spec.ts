import { test, expect, type Page } from '@playwright/test';

async function modulePage(page: Page) {
  await page.route('**/__sequence_test.html', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.goto('./__sequence_test.html');
}

test('motion arrays start with buffered speech, play in order, and use playback end rather than turnComplete', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { harness, tick, motion, toolStep } = await import('/AnimeVRM/test/fixtures/live-motion-harness.ts');
    const h = await harness();
    let firstReady!: (value: unknown) => void;
    let count = 0;
    h.controller.ardyService.generate = async (_prompt: string, duration: number) => {
      count++;
      return count === 1 ? new Promise(resolve => { firstReady = resolve; }) : motion(duration);
    };
    const toolResult = h.feed({ toolCall: { functionCalls: [{
      id: 'sequence', name: 'generateArdyMotion', args: { motions: [toolStep(), toolStep('A person lowers their right arm.')] },
    }] } });
    await tick();
    // Audio may arrive before the tool response; hold it until the first clip is ready.
    h.controller.receiveAudio(new Int16Array(6 * 24000), 24000);
    const beforeReady = { chunks: h.audio.chunks, played: h.played.length, responses: h.sent.length };
    firstReady(motion());
    await toolResult;
    await tick();
    await h.feed({ serverContent: { turnComplete: true } });
    const afterReady = { chunks: h.audio.chunks, played: h.played.length, status: h.controller.getState(), duration: h.played[0].duration, count };
    h.audio.remaining = 3;
    h.avatar.mixer.update(3.01);
    const afterFirst = { played: h.played.length, idle: [...h.idle], secondDuration: h.played[1]?.duration };
    h.audio.remaining = 0;
    h.controller.checkSpeechEnd();
    const afterAudio = { status: h.controller.getState(), active: !!h.controller.ardyRequest };
    h.controller.disconnect();
    return { beforeReady, afterReady, afterFirst, afterAudio, acknowledgement: h.sent[0].toolResponse.functionResponses[0].response.output };
  });
  expect(result.beforeReady).toEqual({ chunks: 0, played: 0, responses: 0 });
  expect(result.afterReady).toEqual({ chunks: 1, played: 1, status: 'speaking', duration: 3, count: 2 });
  expect(result.afterFirst).toEqual({ played: 2, idle: [], secondDuration: 3 });
  expect(result.afterAudio).toEqual({ status: 'connected', active: false });
  expect(result.acknowledgement.status).toBe('ready');
});

test('speech proceeds after the bounded wait when no motion tool arrives', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { harness } = await import('/AnimeVRM/test/fixtures/live-motion-harness.ts');
    const h = await harness();
    h.controller.receiveAudio(new Int16Array(48000), 24000);
    await h.feed({ serverContent: { turnComplete: true } });
    const before = h.audio.chunks;
    await new Promise(resolve => setTimeout(resolve, 1600));
    const after = h.audio.chunks;
    const state = h.controller.getState();
    h.controller.disconnect();
    return { before, after, state };
  });
  expect(result).toEqual({ before: 0, after: 1, state: 'speaking' });
});

test('silent motion prefetch stays one sequence ahead and continues without a user message', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { harness, tick, step } = await import('/AnimeVRM/test/fixtures/live-motion-harness.ts');
    const h = await harness();
    let planned = 0;
    h.controller.planner = { generate: async () => {
      planned++;
      return [step(`A person raises their right arm. Plan ${planned}`), step(`A person lowers their right arm. Plan ${planned}`)];
    } };
    h.controller.setAutonomousEnabled(true);
    await tick(); await tick();
    const initial = { planned, played: h.played.length, generated: h.generated.length };
    h.avatar.mixer.update(4.01);
    const currentClip = h.avatar.currentAction.getClip().uuid;
    await tick(); await tick();
    const speculative = {
      planned, played: h.played.length, generated: h.generated.length,
      unchanged: currentClip === h.avatar.currentAction.getClip().uuid,
    };
    h.controller.scheduleAutonomous(); h.controller.scheduleAutonomous();
    await tick();
    h.avatar.mixer.update(4.01);
    const next = { planned, played: h.played.length, idle: [...h.idle], history: h.controller.getHistory().length, audio: h.audio.chunks };
    h.controller.disconnect();
    await tick();
    return { initial, speculative, next, stopped: !h.controller.ardyRequest && !h.controller.pendingAutonomous && !h.controller.autonomousTimer };
  });
  expect(result.initial).toEqual({ planned: 1, played: 1, generated: 2 });
  expect(result.speculative).toEqual({ planned: 2, played: 2, generated: 4, unchanged: true });
  expect(result.next).toEqual({ planned: 2, played: 3, idle: [], history: 0, audio: 0 });
  expect(result.stopped).toBe(true);
});

test('voice input cancels a speculative planner and late results cannot generate or play', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { harness, tick, step } = await import('/AnimeVRM/test/fixtures/live-motion-harness.ts');
    const h = await harness();
    let finish!: (value: unknown) => void;
    let signal!: AbortSignal;
    h.controller.planner = { generate: (_key: string, _model: string, _context: unknown, requestSignal: AbortSignal) => {
      signal = requestSignal;
      return new Promise(resolve => { finish = resolve; });
    } };
    h.controller.setAutonomousEnabled(true);
    await tick();
    await h.feed({ serverContent: { inputTranscription: { text: 'こんにちは' } } });
    finish([step()]);
    await tick();
    const result = { aborted: signal.aborted, generated: h.generated.length, played: h.played.length, waiting: h.controller.waitingForReply, userText: h.controller.getHistory()[0].content };
    h.controller.disconnect();
    return result;
  });
  expect(result).toEqual({ aborted: true, generated: 0, played: 0, waiting: true, userText: 'こんにちは' });
});

test('planner uses system instructions and structured JSON without adding a Live user turn', async ({ page }) => {
  await modulePage(page);
  const bodies: any[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify({ motions: [{ prompt: 'A person slowly tilts their head to the right.', duration: 4, fingerMotion: {} }] }) }] } }] } });
  });
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { GeminiMotionPlanner } = await import('/AnimeVRM/src/ai/live/GeminiMotionPlanner.ts');
    return new GeminiMotionPlanner().generate('fixture-key', 'gemini-3.5-flash-lite', { conversation: [], recentMotions: [], speaking: false, remainingSpeechSeconds: 0 }, new AbortController().signal);
  });
  expect(result).toHaveLength(1);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].systemInstruction.parts[0].text).toContain('投機的に計画');
  expect(bodies[0].systemInstruction.parts[0].text).toContain('抽象語だけで指示しない');
  expect(bodies[0].generationConfig.responseMimeType).toBe('application/json');
  expect(bodies[0].generationConfig.responseSchema.properties.motions.maxItems).toBe(6);
  expect(bodies[0].clientContent).toBeUndefined();
});

test('an interrupted turn completion does not restart autonomous motion during user speech', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { harness, tick } = await import('/AnimeVRM/test/fixtures/live-motion-harness.ts');
    const h = await harness();
    let calls = 0;
    h.controller.planner = { generate: async () => { calls++; throw new Error('should not run'); } };
    await h.feed({ serverContent: { interrupted: true, inputTranscription: { text: 'ちょっと' }, turnComplete: true } });
    h.controller.setAutonomousEnabled(true);
    await h.feed({ serverContent: { inputTranscription: { text: '待って' } } });
    await tick();
    const result = { calls, waiting: h.controller.waitingForReply, messages: h.controller.getHistory().map((message: any) => message.content) };
    h.controller.disconnect();
    return result;
  });
  expect(result).toEqual({ calls: 0, waiting: true, messages: ['ちょっと待って'] });
});

test('autonomous failures back off and stop after three errors without disrupting conversation', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { harness, tick } = await import('/AnimeVRM/test/fixtures/live-motion-harness.ts');
    const h = await harness();
    let calls = 0;
    h.controller.planner = { generate: async () => { calls++; throw new Error('Motion planner HTTP 429'); } };
    h.controller.setAutonomousEnabled(true);
    await tick(); await tick();
    const backoff = { calls, scheduled: !!h.controller.autonomousTimer };
    for (let i = 0; i < 2; i++) {
      clearTimeout(h.controller.autonomousTimer);
      h.controller.autonomousTimer = null;
      await h.controller.prepareAutonomous();
    }
    const result = { backoff, calls, enabled: h.controller.getAutonomousEnabled(), scheduled: !!h.controller.autonomousTimer, state: h.controller.getState(), detail: h.controller.getArdyDetail() };
    h.controller.disconnect();
    return result;
  });
  expect(result.backoff).toEqual({ calls: 1, scheduled: true });
  expect(result.calls).toBe(3);
  expect(result.enabled).toBe(false);
  expect(result.scheduled).toBe(false);
  expect(result.state).toBe('connected');
  expect(result.detail).toContain('3回失敗');
});

test('retiming preserves one-second hand poses and motion plans reject unbounded or invalid steps', async ({ page }) => {
  await modulePage(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { ArdyMotionSequence } = await import('/AnimeVRM/src/ai/live/ArdyMotionSequence.ts');
    // @ts-expect-error Vite browser import
    const { parseArdyMotionPlan } = await import('/AnimeVRM/src/ai/live/ArdyMotionPlan.ts');
    // @ts-expect-error Vite browser import
    const THREE = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const node = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(node);
    let clip: any;
    const abort = new AbortController();
    const sharedTimes = new Float32Array([0, 1, 4]);
    const seq = new ArdyMotionSequence([{ prompt: 'A person raises an arm.', duration: 4, fingers: {} }], abort.signal, {
      prepare: async () => ({ clip: new THREE.AnimationClip('test', 4, [
        new THREE.QuaternionKeyframeTrack('.quaternion', sharedTimes, [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]),
        new THREE.VectorKeyframeTrack('.position', sharedTimes, [0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ]), applyFingers() {} }),
      play: (value: any) => { clip = value; return mixer.clipAction(clip).play(); },
      onStep() {}, onLowWater() {}, onComplete() {}, onError(error: unknown) { throw error; },
    });
    await seq.prepare(); seq.start(); mixer.update(0.5); seq.fitToSpeech(2.5);
    const times = Array.from(clip.tracks[0].times);
    mixer.update(0.5);
    const poseAtOne = node.quaternion.toArray();
    const invalid = [[], Array(7).fill({ prompt: 'A person stands.' }), [{ prompt: '' }], [{ prompt: 'A person stands.', duration: Infinity }], [{ prompt: 'A person stands.', fingerMotion: { right: { peace: 'YES', index: 'YES' } } }]];
    let rejected = 0;
    for (const motions of invalid) { try { parseArdyMotionPlan({ motions }); } catch { rejected++; } }
    abort.abort();
    return { times, poseAtOne, rejected };
  });
  expect(result.times).toEqual([0, 1, 3]);
  expect(result.poseAtOne).toEqual([0, 0, 1, 0]);
  expect(result.rejected).toBe(5);
});
