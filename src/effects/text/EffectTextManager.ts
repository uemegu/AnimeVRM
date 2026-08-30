import * as THREE from 'three';
import { EffectPresetName, EffectTextPreset, ShowEffectTextOptions, StreamConfig } from './types';
import { EffectTextInstance } from './EffectTextInstance';
import { EFFECT_TEXT_PRESETS } from './presets';
import { clearEffectTextTextureCache } from './textureGenerator';

const DEFAULT_PRESET_TEXTS: Record<string, string> = {
  wanawana: 'ワナワナ',
  iraira: 'イライラ',
  doki: 'ドキドキ',
  gaan: 'ガーン',
  shiin: 'シーン',
  kirakira: 'キラキラ',
  biku: 'ビクッ',
  yatta: 'やったー！',
};

/**
 * Helper to extract repeated subphrase for stream mode
 * e.g. "ワナワナ" -> "ワナ", "イライラ" -> "イラ", "ドキドキ" -> "ドキ", "モヤモヤ" -> "モヤ"
 */
function extractSubphrase(text?: string, defaultPhrase?: string): string {
  if (!text) {
    return defaultPhrase || 'ドキ';
  }
  if (defaultPhrase && (text === defaultPhrase + defaultPhrase || text === defaultPhrase)) {
    return defaultPhrase;
  }

  const len = text.length;
  // 4 characters repeated 2x2 (e.g. "ワナワナ", "ぷんぷん")
  if (len === 4 && text.slice(0, 2) === text.slice(2, 4)) {
    return text.slice(0, 2);
  }
  // 6 characters repeated 3x3 (e.g. "イライラ", "ドキドキ" in 3-char chunks or "わなわなわな")
  if (len === 6 && text.slice(0, 3) === text.slice(3, 6)) {
    return text.slice(0, 3);
  }
  if (len === 6 && text.slice(0, 2) === text.slice(2, 4) && text.slice(2, 4) === text.slice(4, 6)) {
    return text.slice(0, 2);
  }

  return text;
}

/**
 * Controller for spawning stream of rising bubble words from left/right
 */
class StreamEmitter {
  public id: string;
  public isFinished: boolean = false;
  private options: ShowEffectTextOptions;
  private preset: EffectTextPreset;
  private phrase: string;
  private totalCount: number;
  private spawnedCount: number = 0;
  private interval: number;
  private timer: number = 0;
  private sideToggle: number = 0;
  private spreadX: number;
  private particleScale: number;
  private particleDuration: number;
  private manager: EffectTextManager;

  constructor(options: ShowEffectTextOptions, id: string, manager: EffectTextManager) {
    this.id = id;
    this.options = options;
    this.manager = manager;

    const presetName = options.stylePreset || 'wanawana';
    this.preset = EFFECT_TEXT_PRESETS[presetName as keyof typeof EFFECT_TEXT_PRESETS] || EFFECT_TEXT_PRESETS.wanawana;

    const streamCfg: StreamConfig = {
      ...(this.preset.streamConfig || {}),
      ...(options.streamConfig || {}),
    };

    this.phrase = extractSubphrase(options.text, streamCfg.phrase);
    this.totalCount = streamCfg.count ?? 8;
    this.interval = streamCfg.interval ?? 0.16;
    this.spreadX = streamCfg.spreadX ?? 0.32;
    this.particleScale = (options.scale ?? 1.0) * (streamCfg.particleScale ?? 0.42);
    this.particleDuration = streamCfg.particleDuration ?? 1.25;

    // Immediately spawn first particle
    this.spawnParticle();
  }

  private spawnParticle(): void {
    if (this.spawnedCount >= this.totalCount) {
      this.isFinished = true;
      return;
    }

    // Alternate left (-1) and right (+1) with organic variation
    const side = this.sideToggle % 2 === 0 ? -1 : 1;
    this.sideToggle++;

    const baseOffset = this.options.offset ?? this.preset.defaultOffset;
    const jitterX = Math.random() * 0.05 - 0.025;
    const posX = baseOffset.x + side * this.spreadX + jitterX;
    const posY = baseOffset.y + (Math.random() * 0.04 - 0.02);
    const posZ = baseOffset.z + (Math.random() * 0.03 - 0.015);

    const childOptions: ShowEffectTextOptions = {
      ...this.options,
      text: this.phrase,
      offset: { x: posX, y: posY, z: posZ },
      scale: this.particleScale,
      duration: this.particleDuration,
      animations: this.options.animations ?? this.preset.animations,
    };

    this.manager.spawnSingleInstance(childOptions);
    this.spawnedCount++;

    if (this.spawnedCount >= this.totalCount) {
      this.isFinished = true;
      if (this.options.onComplete) {
        this.options.onComplete();
      }
    }
  }

  public update(delta: number): boolean {
    if (this.isFinished) return false;

    this.timer += delta;
    while (this.timer >= this.interval && this.spawnedCount < this.totalCount) {
      this.timer -= this.interval;
      this.spawnParticle();
    }

    return !this.isFinished;
  }
}

export class EffectTextManager {
  private container: THREE.Group;
  private instances: Map<string, EffectTextInstance> = new Map();
  private emitters: Map<string, StreamEmitter> = new Map();
  private nextId: number = 1;
  private customPresets: Map<string, EffectTextPreset> = new Map();

  constructor(scene?: THREE.Scene | THREE.Group) {
    this.container = new THREE.Group();
    this.container.name = 'MangaEffectTextContainer';
    if (scene) {
      scene.add(this.container);
    }
  }

  public attachTo(parent: THREE.Scene | THREE.Group): void {
    if (this.container.parent !== parent) {
      parent.add(this.container);
    }
  }

  /**
   * Internal: spawn a single visual instance
   */
  public spawnSingleInstance(options: ShowEffectTextOptions): EffectTextInstance {
    const id = `effect_text_inst_${this.nextId++}`;
    const instance = new EffectTextInstance(options, id);

    this.container.add(instance.sprite);
    this.instances.set(id, instance);

    return instance;
  }

  /**
   * Show a manga emotion effect text.
   * If preset or mode is 'stream', spawns rising words sequence from avatar sides.
   * If mode is 'single', spawns centered banner.
   */
  public show(options: ShowEffectTextOptions): EffectTextInstance | null {
    const presetName = options.stylePreset || (options as any).preset || 'doki';
    const preset = EFFECT_TEXT_PRESETS[presetName as keyof typeof EFFECT_TEXT_PRESETS] || EFFECT_TEXT_PRESETS.doki;

    const text = options.text || DEFAULT_PRESET_TEXTS[presetName] || 'ドキドキ';
    const normalizedOptions: ShowEffectTextOptions = {
      ...options,
      stylePreset: presetName,
      text,
    };

    const mode = normalizedOptions.mode ?? preset.spawnMode ?? 'single';

    if (mode === 'stream') {
      const emitterId = `effect_stream_${this.nextId++}`;
      const emitter = new StreamEmitter(normalizedOptions, emitterId, this);
      this.emitters.set(emitterId, emitter);
      return null;
    }

    if (mode === 'surround') {
      const defaultPhrase = preset.streamConfig?.phrase || (presetName === 'wanawana' ? 'ワナ' : (presetName === 'iraira' ? 'イラ' : 'ドキ'));
      const phrase = extractSubphrase(text, defaultPhrase);
      const duration = normalizedOptions.duration ?? preset.defaultDuration ?? Infinity;
      const baseScale = (normalizedOptions.scale ?? 1.0) * (preset.defaultScale ?? 0.38);

      // 4 surround positions tightly wrapped around avatar head/chest (1 o'clock, 3〜4 o'clock, 8〜9 o'clock, 11 o'clock)
      const positions = [
        { x: 0.18, y: 0.10, z: 0.04, rot: -0.12 },  // 1時（右上）
        { x: 0.21, y: -0.06, z: 0.04, rot: 0.10 },  // 3〜4時（右下）
        { x: -0.21, y: -0.06, z: 0.04, rot: -0.10 }, // 8〜9時（左下）
        { x: -0.18, y: 0.10, z: 0.04, rot: 0.12 },  // 11時（左上）
      ];

      const baseOffset = normalizedOptions.offset ?? preset.defaultOffset ?? { x: 0, y: 0, z: 0 };

      positions.forEach((pos) => {
        const itemOptions: ShowEffectTextOptions = {
          ...normalizedOptions,
          text: phrase,
          offset: {
            x: baseOffset.x + pos.x,
            y: baseOffset.y + pos.y,
            z: baseOffset.z + pos.z,
          },
          scale: baseScale,
          duration: duration,
          animations: normalizedOptions.animations ?? preset.animations,
        };
        const inst = this.spawnSingleInstance(itemOptions);
        (inst as any).initialRotation = pos.rot;
      });

      return null;
    }

    return this.spawnSingleInstance(normalizedOptions);
  }

  /**
   * Show multiple effects simultaneously
   */
  public showMultiple(effects: ShowEffectTextOptions[]): (EffectTextInstance | null)[] {
    return effects.map((eff) => this.show(eff));
  }

  /**
   * Register or override a custom style preset
   */
  public registerPreset(name: string, preset: EffectTextPreset): void {
    this.customPresets.set(name, preset);
    (EFFECT_TEXT_PRESETS as any)[name] = preset;
  }

  /**
   * Get all registered presets
   */
  public getPresets(): Record<string, EffectTextPreset> {
    return { ...EFFECT_TEXT_PRESETS, ...Object.fromEntries(this.customPresets) };
  }

  /**
   * Update all active effect text instances and stream emitters.
   * Call this in your requestAnimationFrame / render loop with delta time.
   */
  public update(delta: number, camera?: THREE.Camera): void {
    // 1. Update Stream Emitters
    const deadEmitterIds: string[] = [];
    for (const [id, emitter] of this.emitters) {
      const active = emitter.update(delta);
      if (!active) {
        deadEmitterIds.push(id);
      }
    }
    for (const id of deadEmitterIds) {
      this.emitters.delete(id);
    }

    // 2. Update Active Instances
    const deadInstanceIds: string[] = [];
    for (const [id, instance] of this.instances) {
      const stillAlive = instance.update(delta, camera);
      if (!stillAlive) {
        deadInstanceIds.push(id);
      }
    }

    for (const id of deadInstanceIds) {
      const inst = this.instances.get(id);
      if (inst) {
        inst.dispose();
        this.instances.delete(id);
      }
    }
  }

  /**
   * Remove and dispose all active effects immediately
   */
  public clear(): void {
    this.emitters.clear();
    for (const instance of this.instances.values()) {
      instance.dispose();
    }
    this.instances.clear();
  }

  /**
   * Get count of currently active effect instances and stream emitters
   */
  public get activeCount(): number {
    return this.instances.size + this.emitters.size;
  }

  /**
   * Dispose container and textures
   */
  public dispose(): void {
    this.clear();
    if (this.container.parent) {
      this.container.parent.remove(this.container);
    }
    clearEffectTextTextureCache();
  }
}
