import scenarioIndex from '../../data/scenarioIndex.json';
import { ScenarioCategory, ScenarioIndexEntry, ScenarioPackage } from '../../types/scenario';
import { CallScenario, MailScenario } from '../../types/communication';
import { resolveAssetUrl } from '../../utils/path';

/** シナリオファイル（JSON）を読み込む関数。テストではファイルシステムから読む実装に差し替える */
export type ScenarioJsonLoader = (url: string) => Promise<unknown>;

const fetchJson: ScenarioJsonLoader = async (url) => {
  const response = await fetch(resolveAssetUrl(url));
  if (!response.ok) {
    throw new Error(`Failed to load scenario: ${url} (${response.status})`);
  }
  return response.json();
};

/**
 * シナリオの目次と本文の読み込みを担う。
 * - 目次（scenarioIndex.json）は同期的に参照でき、発生判定や場所ヒントに使う
 * - 本文（public/scenarios/<category>/<id>/scenario.json）は再生直前に遅延ロードする
 */
export class ScenarioRepository {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    private readonly entries: ScenarioIndexEntry[] = scenarioIndex as unknown as ScenarioIndexEntry[],
    private readonly loadJson: ScenarioJsonLoader = fetchJson
  ) {}

  /** 目次の一覧（category 指定時はその種類のみ）。並びは同優先度での選択順を兼ねる */
  public list(category?: ScenarioCategory): ScenarioIndexEntry[] {
    return category ? this.entries.filter((entry) => entry.category === category) : this.entries;
  }

  public get(id: string): ScenarioIndexEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  /** シナリオ本文を読み込む。ボイス等の相対パスはシナリオディレクトリ基準の絶対パスに直す */
  public load(id: string): Promise<ScenarioPackage> {
    return this.loadFile(id, (json, entry) => resolveScenarioAssets(json as ScenarioPackage, entry.baseUrl));
  }

  /** 夜の電話の本文を読み込む */
  public loadCall(id: string): Promise<CallScenario> {
    return this.loadFile(id, (json, entry) => {
      const call = json as CallScenario;
      const steps = Object.fromEntries(
        Object.entries(call.steps).map(([key, step]) => [key, { ...step, voiceUrl: resolveRelative(step.voiceUrl, entry.baseUrl) }])
      );
      return { ...call, steps };
    });
  }

  /** 夜のメールの本文を読み込む */
  public loadMail(id: string): Promise<MailScenario> {
    return this.loadFile(id, (json) => json as MailScenario);
  }

  private loadFile<T>(id: string, parse: (json: unknown, entry: ScenarioIndexEntry) => T): Promise<T> {
    const cached = this.cache.get(id);
    if (cached) return cached as Promise<T>;

    const entry = this.get(id);
    if (!entry) return Promise.reject(new Error(`Unknown scenario id: ${id}`));

    const promise = this.loadJson(`${entry.baseUrl}scenario.json`).then((json) => parse(json, entry));
    // 失敗した読み込みはキャッシュせず、次回に再試行できるようにする
    promise.catch(() => this.cache.delete(id));
    this.cache.set(id, promise);
    return promise;
  }
}

function resolveRelative(url: string | undefined, baseUrl: string): string | undefined {
  if (!url || url.startsWith('/') || /^[a-z]+:/i.test(url)) return url;
  return `${baseUrl}${url}`;
}

function resolveScenarioAssets(scenario: ScenarioPackage, baseUrl: string): ScenarioPackage {
  return {
    ...scenario,
    scenes: scenario.scenes.map((scene) => ({
      ...scene,
      voiceUrl: resolveRelative(scene.voiceUrl, baseUrl),
      seUrl: resolveRelative(scene.seUrl, baseUrl),
    })),
  };
}

export const scenarioRepository = new ScenarioRepository();
