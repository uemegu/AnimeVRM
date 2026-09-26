import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { VoiceTools } from './voiceTools.ts';

export interface TtsJobRequest {
  category: string;
  scenarioId: string;
  lineId: string;
  speaker: string;
  /** 画面に出す本文（ファイル名のハッシュに使う） */
  text: string;
  caption: string;
  /** 参照音声（絶対パス） */
  refWav: string;
  postprocess?: string;
  candidates: number;
}

export type TtsJobStatus = 'queued' | 'running' | 'done' | 'error';

export interface TtsJob {
  id: string;
  status: TtsJobStatus;
  request: TtsJobRequest;
  createdAt: string;
  /** できあがった候補の番号（0 始まり） */
  candidates: number[];
  error?: string;
  log: string[];
}

const LOG_LIMIT = 200;

/**
 * 音声生成ジョブを1本ずつ順に実行する（GPU を取り合わないように）。
 * 候補は <workDir>/<jobId>/cand_<n>.mp3 に置く。
 */
export class TtsJobQueue {
  private readonly jobs = new Map<string, TtsJob>();
  private chain: Promise<void> = Promise.resolve();
  private readonly workDir: string;
  private readonly tools: VoiceTools;
  private readonly ttsText: (text: string) => string;

  constructor(workDir: string, tools: VoiceTools, ttsText: (text: string) => string) {
    this.workDir = workDir;
    this.tools = tools;
    this.ttsText = ttsText;
  }

  enqueue(request: TtsJobRequest): TtsJob {
    const job: TtsJob = { id: randomUUID(), status: 'queued', request, createdAt: new Date().toISOString(), candidates: [], log: [] };
    this.jobs.set(job.id, job);
    this.chain = this.chain.then(() => this.run(job));
    return job;
  }

  get(id: string): TtsJob | undefined {
    return this.jobs.get(id);
  }

  candidatePath(job: TtsJob, index: number): string | null {
    return job.candidates.includes(index) ? path.join(this.jobDir(job), `cand_${index}.mp3`) : null;
  }

  /** 全ジョブが終わるまで待つ（テスト用） */
  idle(): Promise<void> {
    return this.chain;
  }

  private jobDir(job: TtsJob): string {
    return path.join(this.workDir, job.id);
  }

  private async run(job: TtsJob): Promise<void> {
    job.status = 'running';
    const log = (line: string) => {
      job.log.push(line);
      if (job.log.length > LOG_LIMIT) job.log.shift();
    };
    try {
      const dir = this.jobDir(job);
      await fs.mkdir(dir, { recursive: true });
      const { request } = job;
      const items = Array.from({ length: request.candidates }, (_, i) => ({
        id: `cand_${i}`,
        text: this.ttsText(request.text),
        caption: request.caption,
        ref_wav: request.refWav,
        output: path.join(dir, `cand_${i}.raw.wav`),
      }));
      const batch = path.join(dir, 'batch.json');
      await fs.writeFile(batch, JSON.stringify(items, null, 1));
      await this.tools.synthesize(batch, log);
      for (let i = 0; i < items.length; i++) {
        const raw = items[i].output;
        let wav = raw;
        if (request.postprocess) {
          wav = path.join(dir, `cand_${i}.wav`);
          await this.tools.postprocess(request.postprocess, raw, wav);
        }
        await this.tools.toMp3(wav, path.join(dir, `cand_${i}.mp3`));
        job.candidates.push(i);
      }
      job.status = 'done';
    } catch (err) {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      log(job.error);
    }
  }
}
