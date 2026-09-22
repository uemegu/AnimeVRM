import * as THREE from 'three';
import { Avatar } from '../../src/Avatar';
import { GeminiLiveChatController } from '../../src/ai/live/GeminiLiveChatController';
import { GeminiLiveClient } from '../../src/ai/live/GeminiLiveClient';
import { CORE27_SKELETON } from '../../src/ai/motion/ardy/vendor/motion-data';

export const tick = () => new Promise(resolve => setTimeout(resolve, 0));
export const step = (prompt = 'A person slowly raises their right forearm.', duration = 4) => ({ prompt, duration, fingers: {} });
export const toolStep = (prompt = 'A person slowly raises their right forearm.', duration = 4) => ({ prompt, duration, fingerMotion: {} });

export function motion(duration = 4) {
  const frameCount = duration * 20;
  const positions = new Float32Array(frameCount * 27 * 3);
  const rotations = new Float32Array(frameCount * 27 * 4);
  for (let i = 0; i < frameCount; i++) positions[i * 81 + 1] = 0.9544128252334833;
  for (let i = 0; i < frameCount * 27; i++) rotations[i * 4 + 3] = 1;
  return {
    skeleton: CORE27_SKELETON, frameCount, fps: 20, positions, positionsShape: [frameCount, 27, 3],
    globalRotations: { values: rotations, shape: [frameCount, 27, 4], format: 'quaternion-xyzw' },
  };
}

export async function harness() {
  const sent: any[] = [];
  GeminiLiveClient.prototype.connect = async function () {
    Object.assign(this, {
      isConnected: true, isSetupComplete: true,
      ws: { readyState: WebSocket.OPEN, send: (data: string) => sent.push(JSON.parse(data)), close() {} },
    });
    (this as any).callbacks.onSetupComplete();
  };
  const controller: any = new GeminiLiveChatController();
  const scene = new THREE.Scene();
  const hips = new THREE.Bone();
  scene.add(hips);
  const avatar: any = Object.assign(Object.create(Avatar.prototype), {
    vrm: {
      scene, meta: { metaVersion: '1' },
      humanoid: {
        normalizedRestPose: { hips: { position: [0, 1, 0] } },
        getNormalizedBoneNode: (name: string) => name === 'hips' ? hips : null,
      },
    },
    mixer: new THREE.AnimationMixer(scene), options: { defaultAnimationUrl: '/idle.fbx' },
    currentAction: null, animationRequestId: 0,
  });
  const played: THREE.AnimationClip[] = [];
  const idle: string[] = [];
  avatar.playAnimation = async (url: string) => { idle.push(url); return null; };
  avatar.playAnimationClip = (clip: THREE.AnimationClip, fade: number, finished: () => void) => {
    played.push(clip);
    return Avatar.prototype.playAnimationClip.call(avatar, clip, fade, finished);
  };
  const audio = {
    remaining: 0, chunks: 0,
    playPcmChunk(pcm: Int16Array, rate: number) { this.remaining += pcm.length / rate; this.chunks++; },
    stopPcmStream() { this.remaining = 0; },
    getPcmRemainingSeconds() { return this.remaining; },
  };
  const generated: string[] = [];
  controller.setAvatar(avatar);
  controller.setAudioLipSync(audio);
  controller.setArdyEnabled(true);
  controller.setAutonomousEnabled(false);
  controller.setApiKey('fixture-only');
  controller.startMicrophone = async () => {};
  controller.ardyService = {
    ready: true,
    generate: async (prompt: string, duration: number) => { generated.push(prompt); return motion(duration); },
  };
  await controller.connect();
  const feed = (data: unknown) => controller.client.handleServerMessage(data);
  return { controller, avatar, audio, sent, played, generated, idle, feed };
}
