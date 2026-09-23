import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from '../Avatar';
import { resolveAssetUrl } from '../utils/path';

export interface Persona5CrowdStyleOptions {
  opacity?: number;
  skinColor?: string;
  hairColor?: string;
  clothColor?: string;
  outlineColor?: string;
}

export interface CrowdMemberConfig {
  id: string;
  modelUrl: string;
  motionUrl: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  animTimeOffset?: number;
  // If moving along a path
  movement?: {
    endPosition: [number, number, number];
    speed: number; // meters per second
    loop?: boolean; // teleport back to start
  };
}

export interface Persona5CrowdMember {
  config: CrowdMemberConfig;
  vrm: VRM;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction | null;
  currentPosition: THREE.Vector3;
  materials: THREE.Material[];
}

export const DEFAULT_P5_CROWD_STYLE: Required<Persona5CrowdStyleOptions> = {
  opacity: 0.78,
  skinColor: '#d6dfea', // bright pale blue-gray for skin/face
  hairColor: '#5e6d80', // medium slate blue-gray for hair
  clothColor: '#36404e', // dark slate blue-gray for uniform
  outlineColor: '#1a2029',
};

/**
 * Applies Persona 5 styled crowd mob visual to a VRM model:
 * - Hides facial feature planes (eyes, eyebrows, eyelashes, mouth) -> faceless / featureless
 * - Removes diffuse maps and applies crisp desaturated cool blue-gray tones
 * - Enables smooth semi-transparency with depthWrite enabled to prevent inside-out clipping
 */
export function applyPersona5MobStyle(
  vrm: VRM,
  options: Persona5CrowdStyleOptions = {}
): THREE.Material[] {
  const style = { ...DEFAULT_P5_CROWD_STYLE, ...options };
  const faceFeaturesPattern = /Eye|Mouth|Brow|Eyeline|Eyelash|Line|Lash|目|口|眉|アイライン|まつげ|まつ毛/i;
  const hairPattern = /Hair|hair|髪/i;
  const skinPattern = /Skin|Face_00|Body_00|肌/i;
  const shoesPattern = /Shoes|靴/i;

  const touchedMaterials: THREE.Material[] = [];

  vrm.scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      materials.forEach((mat: any) => {
        if (!mat) return;
        touchedMaterials.push(mat);
        const name = mat.name || '';

        // 1. Hide facial feature geometry (render faceless head)
        if (faceFeaturesPattern.test(name)) {
          mat.visible = false;
          return;
        }

        // 2. Remove diffuse map completely to get clean faceless stylized tone
        mat.map = null;
        if (mat.uniforms && mat.uniforms.map) {
          mat.uniforms.map.value = null;
        }

        let targetHex = style.clothColor;
        if (skinPattern.test(name)) {
          targetHex = style.skinColor;
        } else if (hairPattern.test(name)) {
          targetHex = style.hairColor;
        } else if (shoesPattern.test(name)) {
          targetHex = '#222832';
        }

        const color = new THREE.Color(targetHex);
        if (mat.color) mat.color.copy(color);
        if (mat.shadeColorFactor) {
          mat.shadeColorFactor.copy(color).multiplyScalar(0.70);
        }

        // Outline coloring if MToon supports it
        if (mat.outlineColorFactor) {
          mat.outlineColorFactor.set(style.outlineColor);
        }
        if (typeof mat.outlineWidthFactor === 'number') {
          mat.outlineWidthFactor = 0.0025;
        }

        // 3. Semi-transparency with depth write
        if (style.opacity < 1.0) {
          mat.transparent = true;
          mat.opacity = style.opacity;
          mat.depthWrite = true;
        } else {
          mat.transparent = false;
          mat.opacity = 1.0;
        }

        mat.needsUpdate = true;
      });
    }
  });

  // Optimize mob: disable physics and lookAt
  if (vrm.springBoneManager) {
    vrm.springBoneManager.reset();
  }
  if (vrm.lookAt) {
    vrm.lookAt.autoUpdate = false;
  }

  return touchedMaterials;
}

/**
 * Controller for managing background crowd mobs in scenes.
 */
export class Persona5CrowdController {
  private scene: THREE.Scene;
  private members: Map<string, Persona5CrowdMember> = new Map();
  private styleOptions: Required<Persona5CrowdStyleOptions>;
  private isVisible: boolean = true;
  private loader: GLTFLoader;

  constructor(scene: THREE.Scene, styleOptions: Persona5CrowdStyleOptions = {}) {
    this.scene = scene;
    this.styleOptions = { ...DEFAULT_P5_CROWD_STYLE, ...styleOptions };

    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  public async addMember(config: CrowdMemberConfig): Promise<Persona5CrowdMember> {
    if (this.members.has(config.id)) {
      this.removeMember(config.id);
    }

    const resolvedModelUrl = resolveAssetUrl(config.modelUrl);
    const gltf = await this.loader.loadAsync(resolvedModelUrl);
    const vrm = gltf.userData.vrm as VRM;
    if (!vrm) {
      throw new Error(`Failed to load VRM from ${config.modelUrl}`);
    }

    VRMUtils.rotateVRM0(vrm);

    // Apply Persona 5 crowd aesthetic
    const materials = applyPersona5MobStyle(vrm, this.styleOptions);

    // Set transform
    const pos = config.position;
    vrm.scene.position.set(pos[0], pos[1], pos[2]);
    if (typeof config.rotationY === 'number') {
      vrm.scene.rotation.y = config.rotationY;
    }
    const scale = config.scale ?? 1.0;
    vrm.scene.scale.set(scale, scale, scale);

    vrm.scene.visible = this.isVisible;
    this.scene.add(vrm.scene);

    // Animation
    const mixer = new THREE.AnimationMixer(vrm.scene);
    let action: THREE.AnimationAction | null = null;
    if (config.motionUrl) {
      try {
        const clip = await loadMixamoAnimation(config.motionUrl, vrm);
        action = mixer.clipAction(clip);
        action.play();
        if (config.animTimeOffset) {
          action.time = config.animTimeOffset % clip.duration;
        }
      } catch (err) {
        console.warn(`Failed to load motion for crowd member ${config.id}:`, err);
      }
    }

    const member: Persona5CrowdMember = {
      config,
      vrm,
      mixer,
      action,
      currentPosition: new THREE.Vector3(pos[0], pos[1], pos[2]),
      materials,
    };

    this.members.set(config.id, member);
    return member;
  }

  public removeMember(id: string): void {
    const member = this.members.get(id);
    if (!member) return;

    this.scene.remove(member.vrm.scene);
    VRMUtils.deepDispose(member.vrm.scene);
    member.mixer.stopAllAction();
    this.members.delete(id);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    for (const member of this.members.values()) {
      member.vrm.scene.visible = visible;
    }
  }

  public getVisible(): boolean {
    return this.isVisible;
  }

  public setOpacity(opacity: number): void {
    this.styleOptions.opacity = opacity;
    for (const member of this.members.values()) {
      for (const mat of member.materials) {
        const m = mat as any;
        if (m.visible === false) continue; // Keep face parts hidden
        m.transparent = opacity < 1.0;
        m.opacity = opacity;
        m.depthWrite = true;
        m.needsUpdate = true;
      }
    }
  }

  public update(delta: number): void {
    if (!this.isVisible) return;

    for (const member of this.members.values()) {
      member.mixer.update(delta);

      // Handle linear path movement if configured
      const mv = member.config.movement;
      if (mv) {
        const startPos = new THREE.Vector3(...member.config.position);
        const endPos = new THREE.Vector3(...mv.endPosition);
        const totalDistance = startPos.distanceTo(endPos);

        if (totalDistance > 0.001) {
          const dir = endPos.clone().sub(startPos).normalize();
          const moveStep = mv.speed * delta;
          member.currentPosition.addScaledVector(dir, moveStep);

          const covered = startPos.distanceTo(member.currentPosition);
          if (covered >= totalDistance) {
            if (mv.loop !== false) {
              member.currentPosition.copy(startPos);
            } else {
              member.currentPosition.copy(endPos);
            }
          }
          member.vrm.scene.position.copy(member.currentPosition);
        }
      }

      // VRM humanoid / bone update
      member.vrm.update(delta);
    }
  }

  public clear(): void {
    for (const id of Array.from(this.members.keys())) {
      this.removeMember(id);
    }
  }

  public dispose(): void {
    this.clear();
  }
}
