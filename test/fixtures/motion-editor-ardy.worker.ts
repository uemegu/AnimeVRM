import { CORE27_SKELETON } from '../../src/ai/motion/ardy/vendor/motion-data';
import type { WorkerCommand } from '../../src/ai/motion/ardy/vendor/runtime/protocol';

// Exercise the real worker/service transfer boundary without downloading model weights.
const port = self as unknown as {
  onmessage: (event: MessageEvent<WorkerCommand>) => void;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
port.onmessage = ({ data: command }) => {
  if (command.type === 'getWebGpuCapabilities') {
    port.postMessage({ type: 'webGpuCapabilities', requestId: command.requestId, shaderF16: true });
  } else if (command.type === 'loadModel') {
    port.postMessage({ type: 'modelLoaded', requestId: command.requestId, model: { manifest: {} } });
  } else if (command.type === 'cancel') {
    port.postMessage({ type: 'cancelled', requestId: command.requestId, targetRequestId: command.targetRequestId });
  } else if (command.type === 'generate') {
    if (command.prompt.includes('[fail]')) {
      port.postMessage({ type: 'error', requestId: command.requestId, error: { message: 'Fixture inference failed' } });
      return;
    }
    const frameCount = Math.round(command.durationSeconds! * 20);
    const joints = new Float32Array(frameCount * 27 * 3);
    const rotations = new Float32Array(frameCount * 27 * 9);
    for (let frame = 0; frame < frameCount; frame++) {
      joints[frame * 81] = frame * .02; // Horizontal displacement must be discarded.
      joints[frame * 81 + 1] = .9544128252334833 + .03 * frame / frameCount;
      for (let joint = 0; joint < 27; joint++) {
        const name = CORE27_SKELETON.jointNames[joint];
        const angle = ['RightArm', 'RightForeArm', 'RightHand', 'RightHandThumb1'].includes(name) ? .7 * frame / (frameCount - 1) : 0;
        rotations.set([1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle)], (frame * 27 + joint) * 9);
      }
    }
    const result = {
      seed: 1, prompt: command.prompt, fps: 20, frameCount, startFrame: 0, chunks: 1,
      motion: new Float32Array(frameCount * 2), motionShape: [1, frameCount, 2],
      joints, jointsShape: [1, frameCount, 27, 3],
      globalRotations: rotations, globalRotationsShape: [1, frameCount, 27, 3, 3],
      continuation: { frameCount, hybridTokens: new Float32Array(4), hybridDim: 4, random: { seed: 1, state: 1 }, initialTranslation: [0, 0, 0], initialHeading: 0 },
      timingsMs: { total: 12, text: 2, denoising: 8, decoding: 2 },
    };
    const send = () => port.postMessage({ type: 'generationComplete', requestId: command.requestId, mode: 'replace', generatedFrameCount: frameCount, sessionFrameCount: frameCount, result }, [result.motion.buffer, joints.buffer, rotations.buffer, result.continuation.hybridTokens.buffer]);
    // Deliberately send a stale result after cancellation; the service must discard it.
    setTimeout(send, command.prompt.includes('[slow]') ? 500 : 10);
  }
};
