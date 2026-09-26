import * as THREE from 'three';
import type { AvatarConfig } from '../../Config';
import { loadPaintedClassroom, disposePaintedClassroom, SKY_ONLY_BACKGROUND } from './PaintedClassroom';
import { resolveAssetUrl } from '../../utils/path';

/** A painted set the stage can show: the classroom by default, or e.g. the library. */
export interface PaintedSet {
  load: () => Promise<THREE.Group>;
  dispose: (room: THREE.Group) => void;
}

/** Scenario adapter. The set itself can also be used by a lightweight preview.
 * Lighting and post-processing come from the scene preset (e.g. day_school), exactly as
 * for painted backgrounds; the stage only swaps the flat background layers for the set.
 * The background image becomes a transparent one, so the viewer's sky shows in the windows. */
export class PaintedClassroomStage {
  private room: THREE.Group | null = null;
  private generation = 0;
  private saved: Pick<AvatarConfig, 'environment'> | null = null;

  constructor(private options: {
    scene: THREE.Scene;
    getConfig: () => AvatarConfig;
    onApplyConfig: (config: AvatarConfig) => void;
  }, private set: PaintedSet = { load: loadPaintedClassroom, dispose: disposePaintedClassroom }) {}

  async enter(): Promise<void> {
    if (this.room) return;
    const generation = ++this.generation;
    const room = await this.set.load();
    if (generation !== this.generation) {
      this.set.dispose(room);
      return;
    }
    const config = this.options.getConfig();
    this.saved = structuredClone({ environment: config.environment });
    this.room = room;
    this.options.scene.add(room);
    this.hideFlatBackground();
  }

  /** Scene presets restore the preset's background layers; call after applying one. */
  hideFlatBackground(): void {
    if (!this.room) return;
    const config = this.options.getConfig();
    Object.assign(config.environment, {
      showBackgroundImage: true, backgroundImageUrl: resolveAssetUrl(SKY_ONLY_BACKGROUND),
      showMidground: false, showNearground: false, showFloor: false,
    });
    this.options.onApplyConfig(config);
  }

  exit(): void {
    this.generation++;
    if (this.room) this.set.dispose(this.room);
    this.room = null;
    if (!this.saved) return;
    const config = this.options.getConfig();
    // Preserve nested objects referenced by the viewer's UI controls.
    const restore = (target: any, source: any) => {
      for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && target[key]) restore(target[key], value);
        else target[key] = value;
      }
    };
    restore(config.environment, this.saved.environment);
    this.saved = null;
    this.options.onApplyConfig(config);
  }
}
