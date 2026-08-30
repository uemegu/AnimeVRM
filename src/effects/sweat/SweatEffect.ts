import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

export type SweatMode = 'fly4' | 'jito';

export interface SweatConfig {
  enabled: boolean;
  mode: SweatMode;                // 'fly4': 4方向放物線飛び散り, 'jito': こめかみタラーッ垂れ下がり
  scale: number;                  // 汗の基本サイズ (fly4用)
  jitoScale: number;              // じとー用サイズ
  side: 'right' | 'left' | 'both';// じとー用の表示側
  flySpeed: number;               // 飛び散る初速の倍率 (fly4用)
  gravity: number;                // 重力加速度 (fly4用)
  spawnInterval: number;          // バースト噴出間隔（秒、fly4用）
  dripSpeed: number;              // じとー用のタラーッと垂れる速度
  duration: number;               // 全体の表示時間（秒、Infinityで常時）
  loop: boolean;                  // ループ
  originOffset: { x: number; y: number; z: number }; // 頭上の発生中心 (fly4用)
  jitoRightOffset: { x: number; y: number; z: number }; // 右こめかみ位置 (jito用)
  jitoLeftOffset: { x: number; y: number; z: number };  // 左こめかみ位置 (jito用)
  color: string;                  // 汗のメインカラー
  accentColor: string;            // 汗のグラデーション終端色
}

export const DEFAULT_SWEAT_CONFIG: SweatConfig = {
  enabled: false,
  mode: 'fly4',
  scale: 0.045,                   // fly4用の小粒サイズ
  jitoScale: 0.04,                // こめかみ冷や汗用のサイズ (0.12の1/3)
  side: 'right',
  flySpeed: 1.0,
  gravity: 1.8,
  spawnInterval: 0.38,
  dripSpeed: 0.025,               // タラーッと垂れる距離
  duration: 3.0,
  loop: false,
  originOffset: { x: 0, y: 0.18, z: 0.06 },    // 頭上の発生位置
  jitoRightOffset: { x: 0.10, y: 0.07, z: 0.085 }, // 右こめかみ手前
  jitoLeftOffset: { x: -0.10, y: 0.07, z: 0.085 },  // 左こめかみ手前
  color: '#38bdf8',               // スカイブルー
  accentColor: '#0284c7',         // ディープシアン
};

/**
 * 進行方向に向かって尖った漫符汗マークテクスチャ（fly4用）
 */
function createSweatDropTexture(color: string, accentColor: string): THREE.CanvasTexture {
  const width = 256;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height * 0.52;
  const size = 96;

  ctx.save();
  ctx.translate(cx, cy);

  const makeDropPath = (scaleFactor: number) => {
    const s = size * scaleFactor;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.15);
    ctx.bezierCurveTo(s * 0.78, -s * 0.3, s * 0.88, s * 0.72, 0, s * 0.92);
    ctx.bezierCurveTo(-s * 0.88, s * 0.72, -s * 0.78, -s * 0.3, 0, -s * 1.15);
    ctx.closePath();
  };

  // 1. 最外郭の濃紺アウトライン
  ctx.strokeStyle = '#082f49';
  ctx.lineWidth = size * 0.24;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  makeDropPath(1.0);
  ctx.stroke();

  // 2. 白のアニメ調太縁取り
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.15;
  makeDropPath(0.98);
  ctx.stroke();

  // 3. 内部のグラデーション塗りつぶし
  const grad = ctx.createLinearGradient(0, -size * 1.1, 0, size * 0.9);
  grad.addColorStop(0.0, '#f0f9ff');
  grad.addColorStop(0.35, color);
  grad.addColorStop(1.0, accentColor);
  ctx.fillStyle = grad;
  makeDropPath(0.95);
  ctx.fill();

  // 4. アニメ風ハイライト（ツヤ）
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.26, size * 0.25, size * 0.16, size * 0.36, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(-size * 0.08, -size * 0.38, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

/**
 * こめかみタラーッ用の大小2連冷や汗テクスチャ（jito用）
 */
function createJitoSweatTexture(color: string, accentColor: string): THREE.CanvasTexture {
  const width = 256;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  const drawDrop = (
    cx: number,
    cy: number,
    size: number,
    rotation: number,
    gradientStart: string,
    gradientEnd: string
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    const makeDropPath = (scaleFactor: number) => {
      const s = size * scaleFactor;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.05);
      ctx.bezierCurveTo(s * 0.75, -s * 0.25, s * 0.85, s * 0.65, 0, s * 0.85);
      ctx.bezierCurveTo(-s * 0.85, s * 0.65, -s * 0.75, -s * 0.25, 0, -s * 1.05);
      ctx.closePath();
    };

    // 最外郭のアウトライン
    ctx.strokeStyle = '#082f49';
    ctx.lineWidth = size * 0.22;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    makeDropPath(1.0);
    ctx.stroke();

    // 白縁取り
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.14;
    makeDropPath(0.98);
    ctx.stroke();

    // グラデーション塗りつぶし
    const grad = ctx.createLinearGradient(0, -size, 0, size * 0.8);
    grad.addColorStop(0.0, '#e0f2fe');
    grad.addColorStop(0.3, gradientStart);
    grad.addColorStop(1.0, gradientEnd);
    ctx.fillStyle = grad;
    makeDropPath(0.95);
    ctx.fill();

    // ハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.28, size * 0.22, size * 0.18, size * 0.35, -Math.PI / 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(-size * 0.1, -size * 0.35, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // メインの大きなしずく
  drawDrop(width * 0.48, height * 0.52, 92, 0.28, color, accentColor);
  // 寄り添う小さなしずく
  drawDrop(width * 0.80, height * 0.72, 38, 0.35, color, accentColor);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

/**
 * 放物線を飛ぶ個々の汗パーティクル
 */
interface FlyParticle {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  origin: THREE.Vector3;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale: number;
}

/**
 * 漫符の汗マークエフェクトクラス（4方向放物線 ＆ じとー冷や汗タラーッ）
 */
export class SweatEffect {
  public group: THREE.Group;
  public config: SweatConfig;

  // fly4 用
  private particles: FlyParticle[] = [];
  private cachedFlyTexture: THREE.CanvasTexture | null = null;

  // jito 用
  private jitoRightSprite: THREE.Sprite | null = null;
  private jitoLeftSprite: THREE.Sprite | null = null;
  private jitoRightMaterial: THREE.SpriteMaterial | null = null;
  private jitoLeftMaterial: THREE.SpriteMaterial | null = null;
  private cachedJitoTexture: THREE.CanvasTexture | null = null;

  private vrm: VRM;
  private headBone: THREE.Object3D | null = null;
  private elapsedTime = 0.0;
  private spawnTimer = 0.0;
  private isPlaying = false;
  private isAlive = false;

  constructor(vrm: VRM, config?: Partial<SweatConfig>) {
    this.vrm = vrm;
    this.config = { ...DEFAULT_SWEAT_CONFIG, ...config };
    this.group = new THREE.Group();
    this.group.name = 'SweatEffectGroup';

    this.init();
  }

  private init(): void {
    // VRM の Head ボーンを取得
    this.headBone = this.vrm.humanoid?.getNormalizedBoneNode('head') ?? null;
    if (!this.headBone) {
      this.headBone = this.vrm.humanoid?.getRawBoneNode('head') ?? this.vrm.scene;
    }

    this.buildTextures();
    this.buildJitoSprites();

    if (this.headBone) {
      this.headBone.add(this.group);
    }

    this.group.visible = this.config.enabled;
    if (this.config.enabled) {
      this.restart();
    }
  }

  private buildTextures(): void {
    if (this.cachedFlyTexture) this.cachedFlyTexture.dispose();
    if (this.cachedJitoTexture) this.cachedJitoTexture.dispose();

    this.cachedFlyTexture = createSweatDropTexture(this.config.color, this.config.accentColor);
    this.cachedJitoTexture = createJitoSweatTexture(this.config.color, this.config.accentColor);
  }

  private buildJitoSprites(): void {
    this.disposeJitoSprites();
    if (!this.cachedJitoTexture) return;

    // 右こめかみスプライト
    this.jitoRightMaterial = new THREE.SpriteMaterial({
      map: this.cachedJitoTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      rotation: 0.15,
      opacity: 0,
    });
    this.jitoRightSprite = new THREE.Sprite(this.jitoRightMaterial);
    this.jitoRightSprite.renderOrder = 999;
    this.jitoRightSprite.scale.set(this.config.jitoScale, this.config.jitoScale, 1);
    this.jitoRightSprite.position.set(
      this.config.jitoRightOffset.x,
      this.config.jitoRightOffset.y,
      this.config.jitoRightOffset.z
    );

    // 左こめかみスプライト（左右反転）
    this.jitoLeftMaterial = new THREE.SpriteMaterial({
      map: this.cachedJitoTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      rotation: -0.15,
      opacity: 0,
    });
    this.jitoLeftSprite = new THREE.Sprite(this.jitoLeftMaterial);
    this.jitoLeftSprite.renderOrder = 999;
    this.jitoLeftSprite.scale.set(-this.config.jitoScale, this.config.jitoScale, 1);
    this.jitoLeftSprite.position.set(
      this.config.jitoLeftOffset.x,
      this.config.jitoLeftOffset.y,
      this.config.jitoLeftOffset.z
    );

    this.group.add(this.jitoRightSprite);
    this.group.add(this.jitoLeftSprite);

    this.updateJitoVisibility();
  }

  private updateJitoVisibility(): void {
    const isJitoMode = this.config.mode === 'jito';
    if (this.jitoRightSprite) {
      this.jitoRightSprite.visible =
        isJitoMode && (this.config.side === 'right' || this.config.side === 'both');
    }
    if (this.jitoLeftSprite) {
      this.jitoLeftSprite.visible =
        isJitoMode && (this.config.side === 'left' || this.config.side === 'both');
    }
  }

  /**
   * 4方向へ汗のしずくを放物線射出する (fly4モード用)
   */
  private spawn4WayBurst(): void {
    if (!this.cachedFlyTexture) return;

    const baseSpeed = this.config.flySpeed;
    const spreadZ = 0.02;

    const directions = [
      { vx: 0.42 * baseSpeed, vy: 0.68 * baseSpeed, vz: (Math.random() - 0.5) * spreadZ },  // 右上
      { vx: -0.42 * baseSpeed, vy: 0.68 * baseSpeed, vz: (Math.random() - 0.5) * spreadZ }, // 左上
      { vx: 0.56 * baseSpeed, vy: 0.36 * baseSpeed, vz: (Math.random() - 0.5) * spreadZ },  // 右横
      { vx: -0.56 * baseSpeed, vy: 0.36 * baseSpeed, vz: (Math.random() - 0.5) * spreadZ }, // 左横
    ];

    const origin = new THREE.Vector3(
      this.config.originOffset.x,
      this.config.originOffset.y,
      this.config.originOffset.z
    );

    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      const jitterX = (Math.random() - 0.5) * 0.06 * baseSpeed;
      const jitterY = (Math.random() - 0.5) * 0.08 * baseSpeed;

      const mat = new THREE.SpriteMaterial({
        map: this.cachedFlyTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      });

      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 999;
      sprite.scale.set(0, 0, 1);
      sprite.position.copy(origin);

      this.group.add(sprite);

      const maxLife = 0.58 + Math.random() * 0.12;

      this.particles.push({
        sprite,
        material: mat,
        origin: origin.clone(),
        vx: dir.vx + jitterX,
        vy: dir.vy + jitterY,
        vz: dir.vz,
        life: 0,
        maxLife,
        baseScale: this.config.scale * (0.9 + Math.random() * 0.2),
      });
    }
  }

  /**
   * 設定の更新
   */
  public updateConfig(newConfig: Partial<SweatConfig>): void {
    const colorChanged =
      (newConfig.color !== undefined && newConfig.color !== this.config.color) ||
      (newConfig.accentColor !== undefined && newConfig.accentColor !== this.config.accentColor);

    this.config = { ...this.config, ...newConfig };

    if (colorChanged) {
      this.buildTextures();
      this.buildJitoSprites();
    } else {
      this.updateJitoVisibility();
    }

    this.group.visible = this.config.enabled;
    if (this.config.enabled && !this.isPlaying) {
      this.restart();
    }
  }

  /**
   * 汗エフェクトの再生・リスタート
   */
  public restart(mode?: SweatMode, duration?: number): void {
    if (mode !== undefined) {
      this.config.mode = mode;
    }
    if (duration !== undefined) {
      this.config.duration = duration;
    }

    this.clearParticles();
    this.elapsedTime = 0.0;
    this.spawnTimer = this.config.spawnInterval;
    this.isPlaying = true;
    this.isAlive = true;
    this.group.visible = true;

    this.updateJitoVisibility();
  }

  /**
   * 停止
   */
  public stop(): void {
    this.isPlaying = false;
    this.isAlive = false;
    this.group.visible = false;
    this.config.enabled = false;
    this.clearParticles();
    if (this.jitoRightMaterial) this.jitoRightMaterial.opacity = 0;
    if (this.jitoLeftMaterial) this.jitoLeftMaterial.opacity = 0;
  }

  /**
   * 毎フレームの更新処理
   */
  public update(delta: number): void {
    if (!this.isPlaying || !this.isAlive) return;

    this.elapsedTime += delta;
    const t = this.elapsedTime;
    const duration = this.config.duration;

    // 1. 全体寿命チェック（loopでない場合）
    if (!this.config.loop && duration < Infinity && t >= duration) {
      if (this.config.mode === 'jito' || this.particles.length === 0) {
        this.isAlive = false;
        this.isPlaying = false;
        this.group.visible = false;
        if (this.jitoRightMaterial) this.jitoRightMaterial.opacity = 0;
        if (this.jitoLeftMaterial) this.jitoLeftMaterial.opacity = 0;
        return;
      }
    }

    // ----------------------------------------------------
    // モード別の更新
    // ----------------------------------------------------
    if (this.config.mode === 'jito') {
      this.updateJitoMode(delta, t, duration);
    } else {
      this.updateFly4Mode(delta, t, duration);
    }
  }

  /**
   * じとーモード（こめかみタラーッ）の更新
   */
  private updateJitoMode(_delta: number, t: number, duration: number): void {
    // じとー周期（ループ時は約2.8秒ごとにピョコッ→タラーッを繰り返す）
    const cycleTime = this.config.loop ? (t % 2.8) : Math.min(t, duration);
    const cycleDuration = this.config.loop ? 2.8 : duration;

    // 1. 出現時のポップイン (0.0s〜0.25s: 0 -> 1.25 -> 1.0)
    let popScale = 1.0;
    const popDur = 0.25;
    if (cycleTime < popDur) {
      const pt = cycleTime / popDur;
      popScale = Math.sin(pt * Math.PI * 0.5) * (1.0 + Math.sin(pt * Math.PI) * 0.4);
    }

    // 2. タラーッと下へ垂れ下がる（滑らかなイーズイン）
    const slideProgress = Math.min(1.0, Math.max(0.0, (cycleTime - 0.1) / (cycleDuration - 0.4)));
    const slideY = -Math.pow(slideProgress, 1.3) * this.config.dripSpeed;

    // 3. 微細なプルプル震え（気まずさ・冷や汗の揺れ）
    const shiverFreq = 24.0;
    const shiverRot = Math.sin(t * shiverFreq) * 0.05;
    const shiverX = Math.cos(t * shiverFreq * 1.1) * 0.001;

    // 4. フェードアウト（サイクル終了前の0.35秒間）
    let alpha = 1.0;
    const fadeDur = 0.35;
    if (cycleTime > cycleDuration - fadeDur) {
      alpha = Math.max(0.0, (cycleDuration - cycleTime) / fadeDur);
    }

    const currentScale = this.config.jitoScale * Math.max(0.01, popScale);

    if (this.jitoRightSprite && this.jitoRightMaterial) {
      this.jitoRightSprite.scale.set(currentScale, currentScale, 1);
      this.jitoRightSprite.position.set(
        this.config.jitoRightOffset.x + shiverX,
        this.config.jitoRightOffset.y + slideY,
        this.config.jitoRightOffset.z
      );
      this.jitoRightMaterial.rotation = 0.15 + shiverRot;
      this.jitoRightMaterial.opacity = alpha;
    }

    if (this.jitoLeftSprite && this.jitoLeftMaterial) {
      this.jitoLeftSprite.scale.set(-currentScale, currentScale, 1);
      this.jitoLeftSprite.position.set(
        this.config.jitoLeftOffset.x - shiverX,
        this.config.jitoLeftOffset.y + slideY,
        this.config.jitoLeftOffset.z
      );
      this.jitoLeftMaterial.rotation = -0.15 - shiverRot;
      this.jitoLeftMaterial.opacity = alpha;
    }
  }

  /**
   * 4方向放物線モード（焦り汗）の更新
   */
  private updateFly4Mode(delta: number, t: number, duration: number): void {
    // 4方向バーストの定期噴出
    if (this.config.loop || t < duration - 0.4) {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.config.spawnInterval) {
        this.spawnTimer = 0.0;
        this.spawn4WayBurst();
      }
    }

    const g = this.config.gravity;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      const pt = p.life;
      const progress = pt / p.maxLife;

      if (progress >= 1.0) {
        this.group.remove(p.sprite);
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // 放物線位置
      const curX = p.origin.x + p.vx * pt;
      const curY = p.origin.y + p.vy * pt - 0.5 * g * pt * pt;
      const curZ = p.origin.z + p.vz * pt;
      p.sprite.position.set(curX, curY, curZ);

      // 進行方向回転 (180度反転して尾/頭の向きを調整)
      const currentVy = p.vy - g * pt;
      const currentVx = p.vx;
      const angle = Math.atan2(currentVy, currentVx) + Math.PI / 2;
      p.material.rotation = angle;

      // スケールとアルファ
      let scaleFactor = 1.0;
      let alpha = 1.0;

      if (progress < 0.15) {
        const norm = progress / 0.15;
        scaleFactor = Math.sin(norm * Math.PI * 0.5) * 1.25;
        alpha = norm;
      } else if (progress > 0.65) {
        const norm = (progress - 0.65) / 0.35;
        scaleFactor = 1.0 - norm * 0.5;
        alpha = 1.0 - norm;
      }

      const s = p.baseScale * scaleFactor;
      p.sprite.scale.set(s, s, 1);
      p.material.opacity = Math.max(0, Math.min(1, alpha));
    }
  }

  private clearParticles(): void {
    for (const p of this.particles) {
      this.group.remove(p.sprite);
      p.material.dispose();
    }
    this.particles = [];
  }

  private disposeJitoSprites(): void {
    if (this.jitoRightSprite) {
      this.group.remove(this.jitoRightSprite);
      this.jitoRightSprite = null;
    }
    if (this.jitoLeftSprite) {
      this.group.remove(this.jitoLeftSprite);
      this.jitoLeftSprite = null;
    }
    if (this.jitoRightMaterial) {
      this.jitoRightMaterial.dispose();
      this.jitoRightMaterial = null;
    }
    if (this.jitoLeftMaterial) {
      this.jitoLeftMaterial.dispose();
      this.jitoLeftMaterial = null;
    }
  }

  public dispose(): void {
    this.clearParticles();
    this.disposeJitoSprites();
    if (this.cachedFlyTexture) {
      this.cachedFlyTexture.dispose();
      this.cachedFlyTexture = null;
    }
    if (this.cachedJitoTexture) {
      this.cachedJitoTexture.dispose();
      this.cachedJitoTexture = null;
    }
    if (this.headBone) {
      this.headBone.remove(this.group);
    }
  }
}
