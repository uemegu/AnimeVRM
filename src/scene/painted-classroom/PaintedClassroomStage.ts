import * as THREE from 'three';
import type { AvatarConfig } from '../../Config';
import { loadPaintedClassroom, disposePaintedClassroom } from './PaintedClassroom';

/** Scenario adapter. The set itself can also be used by a lightweight preview. */
export class PaintedClassroomStage {
  private room: THREE.Group | null = null;
  private generation = 0;
  private saved: Pick<AvatarConfig, 'environment' | 'lighting'> | null = null;

  constructor(private options: {
    scene: THREE.Scene;
    getConfig: () => AvatarConfig;
    onApplyConfig: (config: AvatarConfig) => void;
  }) {}

  async enter(): Promise<void> {
    if (this.room) return;
    const generation = ++this.generation;
    const room = await loadPaintedClassroom();
    if (generation !== this.generation) {
      disposePaintedClassroom(room);
      return;
    }
    const config = this.options.getConfig();
    this.saved = structuredClone({ environment: config.environment, lighting: config.lighting });
    Object.assign(config.environment, {
      showBackgroundImage: false, showMidground: false, showNearground: false,
      showFloor: false, backgroundColor: '#b8c3d3',
    });
    config.lighting.sunShafts.enabled = false;
    config.lighting.lensFlare.enabled = false;
    Object.assign(config.lighting.ambient, { color: '#bfcddd', intensity: 1.2 });
    Object.assign(config.lighting.directional, { color: '#fff4df', intensity: 2.0, posX: -4, posY: 3, posZ: 2 });
    this.room = room;
    this.options.scene.add(room);
    this.options.onApplyConfig(config);
  }

  exit(): void {
    this.generation++;
    if (this.room) disposePaintedClassroom(this.room);
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
    restore(config.lighting, this.saved.lighting);
    this.saved = null;
    this.options.onApplyConfig(config);
  }
}
