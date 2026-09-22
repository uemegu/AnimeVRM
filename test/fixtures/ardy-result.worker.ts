import type { RuntimeGenerationResult } from '../../src/ai/motion/ardy/vendor/runtime/engine';
import type { WorkerCommand, GenerationCompleteEvent } from '../../src/ai/motion/ardy/vendor/runtime/protocol';

// Model inference is stubbed; structured cloning and transferable buffers use a real worker.
const port = self as unknown as {
  onmessage: (event: MessageEvent<WorkerCommand>) => void;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
port.onmessage = ({ data: command }) => {
  if (command.type === 'getWebGpuCapabilities') {
    port.postMessage({ type: 'webGpuCapabilities', requestId: command.requestId, shaderF16: true });
  } else if (command.type === 'loadModel') {
    port.postMessage({ type: 'modelLoaded', requestId: command.requestId, model: { manifest: {} } });
  } else if (command.type === 'generate') {
    const joints = new Float32Array(2 * 27 * 3);
    joints[1] = joints[82] = 0.9544128252334833;
    const rotations = new Float32Array(2 * 27 * 9);
    for (let joint = 0; joint < 54; joint++) rotations.set([1, 0, 0, 0, 1, 0, 0, 0, 1], joint * 9);
    const angle = Math.PI / 4;
    rotations.set([1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle)], 27 * 9);
    const result: RuntimeGenerationResult = {
      seed: 1, prompt: command.prompt, fps: 20, frameCount: 2, startFrame: 0, chunks: 1,
      motion: new Float32Array([1, 2, 3, 4]), motionShape: [1, 2, 2],
      joints, jointsShape: [1, 2, 27, 3],
      localRotations: rotations.slice(), localRotationsShape: [1, 2, 27, 3, 3],
      globalRotations: rotations, globalRotationsShape: [1, 2, 27, 3, 3],
      rootPositions: new Float32Array(6), rootPositionsShape: [1, 2, 3],
      globalRootHeading: new Float32Array([1, 0, 1, 0]), globalRootHeadingShape: [1, 2, 2],
      footContacts: new Uint8Array(8).fill(1), footContactsShape: [1, 2, 4],
      continuation: {
        frameCount: 2, hybridTokens: new Float32Array(4), hybridDim: 4,
        random: { seed: 1, state: 1 }, initialTranslation: [0, 0, 0], initialHeading: 0,
      },
      timingsMs: { total: 1, text: 0, denoising: 1, decoding: 0 },
    };
    const event: GenerationCompleteEvent = {
      type: 'generationComplete', requestId: command.requestId, mode: 'replace',
      generatedFrameCount: 2, sessionFrameCount: 2, result,
    };
    const arrays = [
      result.motion, result.joints, result.localRotations!, result.globalRotations!,
      result.rootPositions!, result.globalRootHeading!, result.footContacts!, result.continuation.hybridTokens,
    ];
    port.postMessage(event, arrays.map(array => array.buffer as ArrayBuffer));
  }
};
