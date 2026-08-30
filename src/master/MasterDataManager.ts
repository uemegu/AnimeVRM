import {
  CharacterMasterItem,
  MotionMasterItem,
  SoundMasterItem,
  MasterDatabase,
} from './types';
import { ScenePresetData, ScenePresetId } from '../presets/ScenePresets';
import { DEFAULT_MASTER_DATABASE } from './defaultMasters';
import { resolveAssetUrl } from '../utils/path';

export class MasterDataManager {
  private db: MasterDatabase;
  private onDatabaseChangeCallbacks: Array<() => void> = [];

  constructor(initialData?: Partial<MasterDatabase>) {
    this.db = {
      characters: { ...DEFAULT_MASTER_DATABASE.characters, ...(initialData?.characters || {}) },
      motions: { ...DEFAULT_MASTER_DATABASE.motions, ...(initialData?.motions || {}) },
      sounds: { ...DEFAULT_MASTER_DATABASE.sounds, ...(initialData?.sounds || {}) },
      scenes: { ...DEFAULT_MASTER_DATABASE.scenes, ...(initialData?.scenes || {}) },
    };
  }

  public subscribe(cb: () => void): () => void {
    this.onDatabaseChangeCallbacks.push(cb);
    return () => {
      this.onDatabaseChangeCallbacks = this.onDatabaseChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private notifyChange(): void {
    this.onDatabaseChangeCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in MasterDataManager subscriber:', err);
      }
    });
  }

  // --- Characters ---
  public getCharacters(): CharacterMasterItem[] {
    return Object.values(this.db.characters);
  }

  public getCharacter(idOrUrl: string): CharacterMasterItem | null {
    if (this.db.characters[idOrUrl]) {
      return this.db.characters[idOrUrl];
    }
    // Search by URL match
    const found = Object.values(this.db.characters).find(
      (c) => c.modelUrl === idOrUrl || resolveAssetUrl(c.modelUrl) === resolveAssetUrl(idOrUrl)
    );
    return found || null;
  }

  public resolveCharacterModelUrl(idOrUrl?: string): string | null {
    if (!idOrUrl) return null;
    const char = this.getCharacter(idOrUrl);
    if (char) {
      return resolveAssetUrl(char.modelUrl);
    }
    return resolveAssetUrl(idOrUrl);
  }

  public registerCharacter(item: CharacterMasterItem): void {
    this.db.characters[item.id] = item;
    this.notifyChange();
  }

  // --- Motions ---
  public getMotions(): MotionMasterItem[] {
    return Object.values(this.db.motions);
  }

  public getMotion(idOrFile: string): MotionMasterItem | null {
    if (this.db.motions[idOrFile]) {
      return this.db.motions[idOrFile];
    }
    const found = Object.values(this.db.motions).find(
      (m) => m.file === idOrFile || resolveAssetUrl(m.file) === resolveAssetUrl(idOrFile)
    );
    return found || null;
  }

  public resolveMotionUrl(idOrFile?: string): string | null {
    if (!idOrFile) return null;
    const motion = this.getMotion(idOrFile);
    if (motion) {
      return resolveAssetUrl(motion.file);
    }
    return resolveAssetUrl(idOrFile);
  }

  public registerMotion(item: MotionMasterItem): void {
    this.db.motions[item.id] = item;
    this.notifyChange();
  }

  // --- Sounds (BGM, SE, Voice) ---
  public getSounds(type?: 'bgm' | 'se' | 'voice'): SoundMasterItem[] {
    const list = Object.values(this.db.sounds);
    if (type) {
      return list.filter((s) => s.type === type);
    }
    return list;
  }

  public getSound(idOrFile: string): SoundMasterItem | null {
    if (this.db.sounds[idOrFile]) {
      return this.db.sounds[idOrFile];
    }
    const found = Object.values(this.db.sounds).find(
      (s) => s.file === idOrFile || resolveAssetUrl(s.file) === resolveAssetUrl(idOrFile)
    );
    return found || null;
  }

  public resolveSoundUrl(idOrFile?: string): string | null {
    if (!idOrFile) return null;
    const sound = this.getSound(idOrFile);
    if (sound) {
      return resolveAssetUrl(sound.file);
    }
    return resolveAssetUrl(idOrFile);
  }

  public registerSound(item: SoundMasterItem): void {
    this.db.sounds[item.id] = item;
    this.notifyChange();
  }

  // --- Scenes ---
  public getScenes(): ScenePresetData[] {
    return Object.values(this.db.scenes);
  }

  public getScene(id: string): ScenePresetData | null {
    return this.db.scenes[id] || null;
  }

  public registerScene(item: ScenePresetData): void {
    this.db.scenes[item.id] = item;
    this.notifyChange();
  }

  // --- Export & Import ---
  public exportJSON(): string {
    return JSON.stringify(this.db, null, 2);
  }

  public downloadJSON(filename = 'masters.json'): void {
    const jsonStr = this.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public importJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.characters) this.db.characters = { ...this.db.characters, ...parsed.characters };
      if (parsed.motions) this.db.motions = { ...this.db.motions, ...parsed.motions };
      if (parsed.sounds) this.db.sounds = { ...this.db.sounds, ...parsed.sounds };
      if (parsed.scenes) this.db.scenes = { ...this.db.scenes, ...parsed.scenes };
      this.notifyChange();
      return true;
    } catch (err) {
      console.error('Failed to import Master JSON:', err);
      return false;
    }
  }

  public resetToDefault(): void {
    this.db = {
      characters: { ...DEFAULT_MASTER_DATABASE.characters },
      motions: { ...DEFAULT_MASTER_DATABASE.motions },
      sounds: { ...DEFAULT_MASTER_DATABASE.sounds },
      scenes: { ...DEFAULT_MASTER_DATABASE.scenes },
    };
    this.notifyChange();
  }
}
