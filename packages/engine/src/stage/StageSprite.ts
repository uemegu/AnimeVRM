import * as THREE from 'three';
import type { StageSprite } from '@anime-vrm/scenario';

const textureCache = new Map<string, Promise<THREE.Texture>>();

function loadTexture(url: string): Promise<THREE.Texture> {
  let texture = textureCache.get(url);
  if (!texture) {
    texture = new THREE.TextureLoader().loadAsync(url).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    });
    textureCache.set(url, texture);
  }
  return texture;
}

/** 3D の舞台に立つ 2D のデフォルメ画像。足元を地面に付け、縦軸だけカメラへ向ける板 */
export class StageSpriteActor {
  public readonly root = new THREE.Group();
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private textures: THREE.Texture[] = [];
  private config: StageSprite | null = null;
  private frameKey = '';
  private loadVersion = 0;
  private time = 0;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, toneMapped: false }));
    this.mesh.name = 'Sprite';
    // 足元の丸い影（地面に立っているように見せる）
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.004;
    this.shadow.scale.set(1, 0.55, 1);
    this.root.add(this.shadow, this.mesh);
    this.root.visible = false;
    scene.add(this.root);
  }

  /** 画像・高さを設定する（同じ指定なら何もしない）。読み込みが終わるまで前の見た目のまま */
  public async setSprite(sprite: StageSprite): Promise<void> {
    const key = `${sprite.frames.join('|')}`;
    this.config = sprite;
    this.mesh.scale.set(sprite.height, sprite.height, 1);
    this.shadow.scale.set(sprite.height * 0.8, sprite.height * 0.8 * 0.55, 1);
    if (key === this.frameKey) return;
    this.frameKey = key;
    const version = ++this.loadVersion;
    const textures = await Promise.all(sprite.frames.map(loadTexture));
    if (version !== this.loadVersion) return;
    this.textures = textures;
    this.time = 0;
    this.applyFrame(0);
  }

  public place(position: [number, number, number]): void {
    this.root.position.set(...position);
  }

  public setVisible(visible: boolean): void {
    this.root.visible = visible && this.textures.length > 0;
  }

  public update(delta: number, camera: THREE.Camera): void {
    if (!this.root.visible || !this.config) return;
    this.time += delta;
    const count = this.textures.length;
    if (count > 1) {
      const step = Math.floor(this.time * this.config.fps);
      let index: number;
      if (this.config.playback === 'once') index = Math.min(step, count - 1);
      else if (this.config.playback === 'loop') index = step % count;
      else {
        const cycle = (count - 1) * 2;
        const phase = step % cycle;
        index = phase < count ? phase : cycle - phase;
      }
      this.applyFrame(index);
    }
    // 縦軸だけカメラへ向ける（見上げ・見下ろしでも倒れない）
    const dx = camera.position.x - this.root.position.x;
    const dz = camera.position.z - this.root.position.z;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  private applyFrame(index: number): void {
    const texture = this.textures[index];
    if (!texture || this.mesh.material.map === texture) return;
    this.mesh.material.map = texture;
    this.mesh.material.needsUpdate = true;
    this.root.visible = true;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
