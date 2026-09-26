import { spawn } from 'node:child_process';
import path from 'node:path';

/** 音声合成まわりの外部コマンド。テストでは偽物に差し替える */
export interface VoiceTools {
  /** Irodori-TTS のバッチ JSON（[{ text, caption, ref_wav, output }]）を合成する */
  synthesize(batchJsonPath: string, onLog: (line: string) => void): Promise<void>;
  /** 後処理（女神のリバーブなど） */
  postprocess(effect: string, src: string, dst: string): Promise<void>;
  /** 配信用の mp3（モノラル 96kbps）にする */
  toMp3(src: string, dst: string): Promise<void>;
}

function run(command: string, args: string[], onLog?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const forward = (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) onLog?.(line);
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(command)} が終了コード ${code} で終わりました`))));
  });
}

export interface IrodoriPaths {
  /** Irodori-TTS の仮想環境の python */
  python: string;
  /** .agents/skills/irodori-tts/scripts/synthesize.py */
  synthesizeScript: string;
  /** server/python/voice_effects.py */
  effectsScript: string;
  ffmpeg: string;
  /** mps / cuda / cpu */
  device: string;
}

export function createVoiceTools(paths: IrodoriPaths): VoiceTools {
  return {
    synthesize: (batchJsonPath, onLog) =>
      run(paths.python, [paths.synthesizeScript, '--batch-json', batchJsonPath, '--device', paths.device], onLog),
    postprocess: (effect, src, dst) => run(paths.python, [paths.effectsScript, effect, src, dst]),
    toMp3: (src, dst) => run(paths.ffmpeg, ['-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-b:a', '96k', dst]),
  };
}
