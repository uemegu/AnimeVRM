import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

export interface SweatConfig {
  enabled: boolean;
  mode: 'fly4' | 'static';        // 'fly4': 4方向放物線飛び散り, 'static': こめかみ固定
  scale: number;                  // 汗の基本サイズ
  flySpeed: number;               // 飛び散る初速の倍率 (1.0 = 標準)
  gravity: number;                // 重力加速度 (下方向への引き込み)
  spawnInterval: number;          // バースト噴出間隔（秒）
  duration: number;               // 全体の表示時間（秒、Infinityで常時）
  loop: boolean;                  // ループ（常時噴出）
  originOffset: { x: number; y: number; z: number }; // 頭上の発生中心
  color: string;                  // 汗のメインカラー
  accentColor: string;            // 汗のグラデーション終端色
}

export const DEFAULT_SWEAT_CONFIG: SweatConfig = {
  enabled: false,
  mode: 'fly4',
  scale: 0.045,                  // 約1/3のサイズ (0.13 -> 0.045)
  flySpeed: 1.0,
  gravity: 1.8,
  spawnInterval: 0.38,            // 0.38秒ごとに4方向へピュッと噴出
  duration: 3.0,
  loop: false,
  originOffset: { x: 0, y: 0.18, z: -0.03 }, // イライラより上、頭上後頭部寄り（後ろ側）
  color: '#38bdf8',               // スカイブルー
  accentColor: '#0284c7',         // ディープシアン
};

/**
 * 進行方向に向かって尖った漫符汗マークテクスチャを Canvas 2D で生成する
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

  // 上向きのティアドロップ形状（先端が真上 Y = -size）
  const makeDropPath = (scaleFactor: number) => {
    const s = size * scaleFactor;
    ctx.beginPath();
    // 鋭い先端
    ctx.moveTo(0, -s * 1.15);
    // 右側のふくらみ
    ctx.bezierCurveTo(s * 0.78, -s * 0.3, s * 0.88, s * 0.72, 0, s * 0.92);
    // 左側のふくらみ
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
  grad.addColorStop(0.0, '#f0f9ff'); // 先端は明るく白に近い水色
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

  // 先端付近の小ハイライト
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
 * 漫符の汗マーク（4方向放物線 飛び散りエフェクト）クラス
 */
export class SweatEffect {
  public group: THREE.Group;
  public config: SweatConfig;

  private particles: FlyParticle[] = [];
  private cachedTexture: THREE.CanvasTexture | null = null;

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

    this.cachedTexture = createSweatDropTexture(this.config.color, this.config.accentColor);

    if (this.headBone) {
      this.headBone.add(this.group);
    }

    this.group.visible = this.config.enabled;
    if (this.config.enabled) {
      this.restart();
    }
  }

  /**
   * 4方向へ汗のしずくを放物線射出する
   */
  private spawn4WayBurst(): void {
    if (!this.cachedTexture) return;

    // 4方向の速度定義（左右対称、高め2方向 + 横め2方向）
    // ① 右上 (右上へ高く飛び出し、右下へ弧を描いて落下)
    // ② 左上 (左上へ高く飛び出し、左下へ弧を描いて落下)
    // ③ 右横 (右横へ鋭く飛び出し、外側下へ落下)
    // ④ 左横 (左横へ鋭く飛び出し、外側下へ落下)
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
      // 微小なランダムジッター（毎回少し自然にばらつかせる）
      const jitterX = (Math.random() - 0.5) * 0.06 * baseSpeed;
      const jitterY = (Math.random() - 0.5) * 0.08 * baseSpeed;

      const mat = new THREE.SpriteMaterial({
        map: this.cachedTexture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        opacity: 0,
      });

      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 998;
      sprite.scale.set(0, 0, 1);
      sprite.position.copy(origin);

      this.group.add(sprite);

      // 寿命: 0.55s 〜 0.70s
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
      if (this.cachedTexture) this.cachedTexture.dispose();
      this.cachedTexture = createSweatDropTexture(this.config.color, this.config.accentColor);
      for (const p of this.particles) {
        p.material.map = this.cachedTexture;
        p.material.needsUpdate = true;
      }
    }

    this.group.visible = this.config.enabled;
    if (this.config.enabled && !this.isPlaying) {
      this.restart();
    }
  }

  /**
   * 汗エフェクトの再生・リスタート
   */
  public restart(duration?: number): void {
    if (duration !== undefined) {
      this.config.duration = duration;
    }
    this.clearParticles();
    this.elapsedTime = 0.0;
    this.spawnTimer = this.config.spawnInterval; // すぐに最初の1発目を射出
    this.isPlaying = true;
    this.isAlive = true;
    this.group.visible = true;
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
  }

  /**
   * 毎フレームの更新処理（放物線パーティクル物理＆アニメーション）
   */
  public update(delta: number): void {
    if (!this.isPlaying || !this.isAlive) return;

    this.elapsedTime += delta;
    const t = this.elapsedTime;
    const duration = this.config.duration;

    // 1. 全体寿命チェック（loopでない場合）
    if (!this.config.loop && duration < Infinity && t >= duration) {
      if (this.particles.length === 0) {
        this.isAlive = false;
        this.isPlaying = false;
        this.group.visible = false;
        return;
      }
    }

    // 2. 4方向バーストの定期噴出（全体寿命内またはループ中）
    if (this.config.loop || t < duration - 0.4) {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.config.spawnInterval) {
        this.spawnTimer = 0.0;
        this.spawn4WayBurst();
      }
    }

    // 3. 各パーティクルの放物線軌道＆姿勢更新
    const g = this.config.gravity;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      const pt = p.life;
      const progress = pt / p.maxLife;

      if (progress >= 1.0) {
        // パーティクルの消滅
        this.group.remove(p.sprite);
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // 放物線位置計算 (x, y, z)
      // x(t) = x0 + vx * t
      // y(t) = y0 + vy * t - 0.5 * g * t^2
      // z(t) = z0 + vz * t
      const curX = p.origin.x + p.vx * pt;
      const curY = p.origin.y + p.vy * pt - 0.5 * g * pt * pt;
      const curZ = p.origin.z + p.vz * pt;
      p.sprite.position.set(curX, curY, curZ);

      // 現在の進行方向速度ベクトル (vx, vy - g * t)
      const currentVy = p.vy - g * pt;
      const currentVx = p.vx;

      // 進行方向に合わせてスプライトを回転（180度反転して尖った尾/丸い頭の向きを調整）
      // Canvasテクスチャは真上(Y+)基準なので、+ Math.PI / 2 で180度反転
      const angle = Math.atan2(currentVy, currentVx) + Math.PI / 2;
      p.material.rotation = angle;

      // スケールとアルファのアニメーション
      // 0.0〜0.15: ポップアップ拡大 (0 -> 1.25 -> 1.0)
      // 0.15〜0.65: フル表示 (1.0)
      // 0.65〜1.0: フェードアウト＆縮小
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

  public dispose(): void {
    this.clearParticles();
    if (this.cachedTexture) {
      this.cachedTexture.dispose();
      this.cachedTexture = null;
    }
    if (this.headBone) {
      this.headBone.remove(this.group);
    }
  }
}
