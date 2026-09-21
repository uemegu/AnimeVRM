import * as THREE from 'three';

export type MorphTargetCategory = 'brows' | 'eyes' | 'mouth' | 'other';
type Binding = { mesh: THREE.Mesh; index: number };
export interface MorphTargetControl {
  name: string;
  category: MorphTargetCategory;
  meshes: string[];
  weight: number;
}

/** Temporary, absolute morph weights applied after VRM expressions and procedural animation. */
export class MorphTargetPreview extends EventTarget {
  private targets = new Map<string, { control: MorphTargetControl; bindings: Binding[] }>();
  private underlying: Array<{ binding: Binding; weight: number }> = [];
  private active = false;
  private initialized = false;

  constructor(root: THREE.Object3D) {
    super();
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
        if (index < 0 || index >= mesh.morphTargetInfluences.length) continue;
        let target = this.targets.get(name);
        if (!target) {
          const category: MorphTargetCategory = /BRW|Brow|眉/i.test(name) ? 'brows'
            : /EYE|Blink|目/i.test(name) ? 'eyes'
            : /MTH|Mouth|Lip|Fcl_HA_|口/i.test(name) ? 'mouth' : 'other';
          target = { control: { name, category, meshes: [], weight: 0 }, bindings: [] };
          this.targets.set(name, target);
        }
        // A split face (including separate eyelines) must deform as one expression.
        target.bindings.push({ mesh, index });
        if (!target.control.meshes.includes(mesh.name)) target.control.meshes.push(mesh.name);
      }
    });
  }

  get enabled(): boolean { return this.active; }

  getControls(): MorphTargetControl[] {
    return [...this.targets.values()].map(({ control }) => ({ ...control, meshes: [...control.meshes] }));
  }

  setEnabled(enabled: boolean): void {
    if (!enabled && !this.active) return;
    if (enabled && !this.initialized) {
      this.captureCurrent();
      return;
    }
    this.restore();
    this.active = enabled && this.targets.size > 0;
    this.apply();
    this.dispatchEvent(new Event('change'));
  }

  captureCurrent(): void {
    this.restore();
    for (const { control, bindings } of this.targets.values()) {
      control.weight = THREE.MathUtils.clamp(Math.max(0, ...bindings.map(({ mesh, index }) =>
        mesh.morphTargetInfluences?.[index] ?? 0)), 0, 1);
      control.weight = Math.round(control.weight * 1000) / 1000;
    }
    this.initialized = true;
    this.active = this.targets.size > 0;
    this.apply();
    this.dispatchEvent(new Event('change'));
  }

  setWeight(name: string, weight: number): void {
    const target = this.targets.get(name);
    if (!target || !Number.isFinite(weight)) return;
    target.control.weight = Math.round(THREE.MathUtils.clamp(weight, 0, 1) * 1000) / 1000;
    this.initialized = true;
    this.restore();
    this.apply();
    this.dispatchEvent(new Event('change'));
  }

  reset(): void {
    this.restore();
    for (const { control } of this.targets.values()) control.weight = 0;
    this.initialized = true;
    this.apply();
    this.dispatchEvent(new Event('change'));
  }

  /** Undo only our previous frame, allowing normal animation to keep running underneath. */
  restore(): void {
    for (const { binding: { mesh, index }, weight } of this.underlying) {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = weight;
    }
    this.underlying = [];
  }

  apply(): void {
    if (!this.active || this.underlying.length > 0) return;
    for (const { control, bindings } of this.targets.values()) {
      for (const binding of bindings) {
        const influences = binding.mesh.morphTargetInfluences;
        if (!influences) continue;
        this.underlying.push({ binding, weight: influences[binding.index] });
        influences[binding.index] = control.weight;
      }
    }
  }

  exportPreset(name: string, sourceModel: string): object {
    return {
      name: name.trim() || 'custom_expression',
      sourceModel,
      morphTargetBinds: this.getControls()
        .filter((control) => control.weight !== 0)
        .map(({ name: shapeKey, weight }) => ({ shapeKey, weight })),
    };
  }

  dispose(): void {
    this.restore();
    this.active = false;
    this.targets.clear();
  }
}
