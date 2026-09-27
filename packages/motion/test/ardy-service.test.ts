import * as THREE from 'three';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ArdyMotionService } from '../src/ardy/ArdyMotionService';
import { normalizeStructuredMotion } from '../src/ardy/vendor/motion-data';
import { createArdyAnimationClip } from '../src/ardy/createArdyAnimationClip';

type Listener = (event: { data: unknown }) => void;

/** 推論ワーカーの代わり。コマンドを記録し、返すイベントはテストが決める */
class MockWorker {
  static last: MockWorker;
  static respond: (worker: MockWorker, command: any) => void = () => {};
  onmessage: Listener | null = null;
  onerror: unknown = null;
  onmessageerror: unknown = null;
  commands: any[] = [];
  constructor() {
    MockWorker.last = this;
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
  postMessage(command: any) {
    this.commands.push(command);
    MockWorker.respond(this, command);
  }
  terminate() {}
}

beforeEach(() => {
  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const identityRotations = (count: number) => {
  const rotations = new Float32Array(count * 27 * 9);
  for (let j = 0; j < count * 27; j++) rotations.set([1, 0, 0, 0, 1, 0, 0, 0, 1], j * 9);
  return rotations;
};

test('GPU に合うモデルを選び、キャンセルを待ってから次の生成を送り、結果を読み、読み込みの失敗を残す', async () => {
  let loadError = false;
  MockWorker.respond = (worker, command) => {
    if (command.type === 'getWebGpuCapabilities') queueMicrotask(() => worker.emit({ type: 'webGpuCapabilities', requestId: command.requestId, shaderF16: true }));
    if (command.type === 'loadModel')
      queueMicrotask(() =>
        worker.emit(
          loadError
            ? { type: 'error', requestId: command.requestId, error: { message: 'Model download failed: HTTP 503' } }
            : { type: 'modelLoaded', requestId: command.requestId, model: { manifest: {} } }
        )
      );
    if (command.type === 'cancel')
      setTimeout(() => worker.emit({ type: 'cancelled', requestId: command.requestId, targetRequestId: command.targetRequestId }), 10);
  };
  const service = new ArdyMotionService();
  await service.initialize();
  const worker = MockWorker.last;
  const abort = new AbortController();
  const first = service.generate('A person waves.', 4, abort.signal).catch((e: Error) => e.name);
  await new Promise((resolve) => setTimeout(resolve, 0));
  abort.abort();
  const second = service.generate('A person bows.', 4, new AbortController().signal);
  const countBeforeCancelDrains = worker.commands.filter((c) => c.type === 'generate').length;
  await first;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const generates = worker.commands.filter((c) => c.type === 'generate');
  worker.emit({
    type: 'generationComplete',
    requestId: generates[1].requestId,
    result: {
      motion: new Float32Array([1, 2]), motionShape: [1, 1, 2],
      joints: new Float32Array(27 * 3), frameCount: 1, fps: 20,
      globalRotations: identityRotations(1), globalRotationsShape: [1, 1, 27, 3, 3],
    },
  });
  const motion = await second;
  service.dispose();
  loadError = true;
  const error = await service.initialize().then(() => '', (e: Error) => e.message);

  expect(countBeforeCancelDrains).toBe(1);
  expect(generates.map((c) => c.prompt)).toEqual(['A person waves.', 'A person bows.']);
  expect(worker.commands.find((c) => c.type === 'loadModel').baseUrl).toMatch(/\/[a-f0-9]{40}\/fp16\/$/);
  expect(motion.globalRotations?.shape).toEqual([1, 27, 9]);
  expect(Array.from(motion.normalizedMotion ?? [])).toEqual([1, 2]);
  expect(error).toContain('HTTP 503');
  expect(service.ready).toBe(false);
});

test('ワーカーから届いた配列が、VRM で再生できるクリップになる', async () => {
  MockWorker.respond = (worker, command) => {
    if (command.type === 'getWebGpuCapabilities') queueMicrotask(() => worker.emit({ type: 'webGpuCapabilities', requestId: command.requestId, shaderF16: true }));
    if (command.type === 'loadModel') queueMicrotask(() => worker.emit({ type: 'modelLoaded', requestId: command.requestId, model: { manifest: {} } }));
    if (command.type !== 'generate') return;
    const joints = new Float32Array(2 * 27 * 3);
    joints[1] = joints[82] = 0.9544128252334833;
    const rotations = identityRotations(2);
    const angle = Math.PI / 4;
    rotations.set([1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle)], 27 * 9);
    queueMicrotask(() =>
      worker.emit({
        type: 'generationComplete', requestId: command.requestId, mode: 'replace', generatedFrameCount: 2, sessionFrameCount: 2,
        result: {
          seed: 1, prompt: command.prompt, fps: 20, frameCount: 2, startFrame: 0, chunks: 1,
          motion: new Float32Array([1, 2, 3, 4]), motionShape: [1, 2, 2],
          joints, jointsShape: [1, 2, 27, 3],
          localRotations: rotations.slice(), localRotationsShape: [1, 2, 27, 3, 3],
          globalRotations: rotations, globalRotationsShape: [1, 2, 27, 3, 3],
          rootPositions: new Float32Array(6), rootPositionsShape: [1, 2, 3],
          globalRootHeading: new Float32Array([1, 0, 1, 0]), globalRootHeadingShape: [1, 2, 2],
          footContacts: new Uint8Array(8).fill(1), footContactsShape: [1, 2, 4],
          timingsMs: { total: 1, text: 0, denoising: 1, decoding: 0 },
        },
      })
    );
  };
  const service = new ArdyMotionService();
  await service.initialize();
  const motion = await service.generate('A person waves.', 4, new AbortController().signal);
  service.dispose();

  const scene = new THREE.Scene();
  const hips = new THREE.Bone();
  scene.add(hips);
  const vrm = {
    scene, meta: { metaVersion: '1' },
    humanoid: { normalizedRestPose: { hips: { position: [0, 1, 0] } }, getNormalizedBoneNode: (name: string) => (name === 'hips' ? hips : null) },
  };
  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(createArdyAnimationClip(motion, vrm as never)).play();
  mixer.update(0.05);

  expect(Array.from(motion.normalizedMotion ?? [])).toEqual([1, 2, 3, 4]);
  expect(motion.positionsShape).toEqual([2, 27, 3]);
  expect(motion.globalRotations?.shape).toEqual([2, 27, 9]);
  expect(Array.from(motion.contacts ?? [])).toEqual(Array(8).fill(1));
  expect(hips.quaternion.x).toBeCloseTo(Math.sin(Math.PI / 8));
  expect(hips.position.y).toBeCloseTo(1);
  // 特徴量は型付き配列・ArrayBuffer・配列のどれでも外側に残り、入れ子の動作データはほどく
  const features = [new Float32Array([5, 6]), new Float32Array([5, 6]).buffer, [5, 6]].map((f) =>
    Array.from(normalizeStructuredMotion({ motion: f, joints: new Float32Array(27 * 3), frameCount: 1, fps: 20 }).normalizedMotion ?? [])
  );
  expect(features).toEqual([[5, 6], [5, 6], [5, 6]]);
  expect(normalizeStructuredMotion({ motion: { joints: new Float32Array(27 * 3), frameCount: 1, fps: 20 } }).frameCount).toBe(1);
});
