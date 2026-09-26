import * as THREE from 'three';

export interface AnimeDreamBackgroundConfig {
  /** 全体の継続秒数 (デフォルト 2.4秒) */
  duration?: number;
  /** 開始時のフェードイン秒数 (デフォルト 0.18秒) */
  fadeInDuration?: number;
  /** フェードアウト開始秒数 (デフォルト 1.7秒) */
  fadeOutStart?: number;
  /** フェードアウトにかける秒数 (デフォルト 0.7秒) */
  fadeOutDuration?: number;
  /** 背景のテーマ (デフォルト 'heart') */
  theme?: 'heart' | 'pastel';
}

interface HeartParticle {
  x: number;
  y: number;
  baseX: number;
  size: number;
  speedY: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  rotSpeed: number;
  pulseSpeed: number;
  color: string;
  style: 'filled' | 'outline' | 'inner';
  alpha: number;
  phase: number;
}

interface BokehParticle {
  x: number;
  y: number;
  baseX: number;
  radius: number;
  speedY: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  pulseSpeed: number;
  phase: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  rotSpeed: number;
  twinkleSpeed: number;
  color: string;
  phase: number;
}

export class AnimeDreamBackground {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private material: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;

  private _isActive = false;
  private elapsed = 0;
  private currentOpacity = 0;
  private config: Required<AnimeDreamBackgroundConfig>;

  // Animation particles
  private hearts: HeartParticle[] = [];
  private bokehOrbs: BokehParticle[] = [];
  private sparkles: SparkleParticle[] = [];
  private totalTime = 0;

  private readonly canvasWidth = 1024;
  private readonly canvasHeight = 1024;
  private readonly planeDistance = 5.0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    this.config = {
      duration: 2.4,
      fadeInDuration: 0.18,
      fadeOutStart: 1.7,
      fadeOutDuration: 0.7,
      theme: 'heart',
    };

    // Off-screen canvas for 2D dynamic animation texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Three.js Plane behind avatars (-5 renderOrder, depthTest=true so it stays strictly behind avatars)
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.0,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'AnimeDreamBackgroundMesh';
    this.mesh.renderOrder = -5;
    this.mesh.visible = false;

    this.scene.add(this.mesh);

    this.initParticles();
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get opacity(): number {
    return this.currentOpacity;
  }

  private initParticles(): void {
    this.hearts = [];
    this.bokehOrbs = [];
    this.sparkles = [];

    const heartColors = [
      '#ff5f9e', // candy pink
      '#ff7da7', // bubblegum pink
      '#ffa3c4', // pastel sakura
      '#ff6b8b', // sweet rose
      '#ffffff', // pure white shine
      '#ff8bb0', // coral pink
    ];

    // 1. Floating Hearts (28 particles)
    for (let i = 0; i < 28; i++) {
      const baseX = Math.random() * this.canvasWidth;
      const styleRand = Math.random();
      const style: 'filled' | 'outline' | 'inner' =
        styleRand < 0.55 ? 'filled' : styleRand < 0.82 ? 'outline' : 'inner';

      this.hearts.push({
        x: baseX,
        y: Math.random() * this.canvasHeight,
        baseX,
        size: 22 + Math.random() * 48,
        speedY: 45 + Math.random() * 65,
        wobbleSpeed: 1.4 + Math.random() * 1.8,
        wobbleAmp: 18 + Math.random() * 32,
        rotSpeed: 0.8 + Math.random() * 1.5,
        pulseSpeed: 2.2 + Math.random() * 2.5,
        color: heartColors[Math.floor(Math.random() * heartColors.length)],
        style,
        alpha: 0.65 + Math.random() * 0.32,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 2. Soft "ぽわわーん" Bokeh Bubbles (22 particles)
    const bokehPalettes = [
      { r: 255, g: 215, b: 230 }, // soft pink
      { r: 255, g: 242, b: 210 }, // soft warm yellow/cream
      { r: 255, g: 228, b: 242 }, // lilac blossom
      { r: 255, g: 200, b: 220 }, // rosy blush
    ];

    for (let i = 0; i < 22; i++) {
      const baseX = Math.random() * this.canvasWidth;
      const palette = bokehPalettes[Math.floor(Math.random() * bokehPalettes.length)];
      this.bokehOrbs.push({
        x: baseX,
        y: Math.random() * this.canvasHeight,
        baseX,
        radius: 35 + Math.random() * 65,
        speedY: 20 + Math.random() * 38,
        wobbleSpeed: 0.8 + Math.random() * 1.2,
        wobbleAmp: 12 + Math.random() * 20,
        r: palette.r,
        g: palette.g,
        b: palette.b,
        alpha: 0.22 + Math.random() * 0.24,
        pulseSpeed: 1.5 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 3. Anime Sparkles (18 particles)
    for (let i = 0; i < 18; i++) {
      this.sparkles.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight,
        size: 16 + Math.random() * 28,
        speedY: 18 + Math.random() * 32,
        rotSpeed: 0.5 + Math.random() * 1.2,
        twinkleSpeed: 2.8 + Math.random() * 3.5,
        color: Math.random() < 0.65 ? '#ffffff' : '#fff9d6',
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public play(config?: AnimeDreamBackgroundConfig): void {
    if (config) {
      this.config = {
        duration: config.duration ?? 2.4,
        fadeInDuration: config.fadeInDuration ?? 0.18,
        fadeOutStart: config.fadeOutStart ?? 1.7,
        fadeOutDuration: config.fadeOutDuration ?? 0.7,
        theme: config.theme ?? 'heart',
      };
    }

    this._isActive = true;
    this.elapsed = 0;
    this.currentOpacity = 0.0;
    this.material.opacity = 0.0;
    this.mesh.visible = true;

    // Reposition particles across the frame
    this.initParticles();
    this.renderFrame(0);
    this.texture.needsUpdate = true;
  }

  public stop(instant = false): void {
    if (!this._isActive && this.currentOpacity <= 0) return;

    if (instant || this.currentOpacity <= 0.02) {
      this._isActive = false;
      this.currentOpacity = 0.0;
      this.material.opacity = 0.0;
      this.mesh.visible = false;
    } else {
      // Begin quick fade out
      this._isActive = false;
      this.config.fadeOutStart = this.elapsed;
      this.config.fadeOutDuration = 0.35;
    }
  }

  public update(delta: number): void {
    if (!this._isActive && this.currentOpacity <= 0) {
      if (this.mesh.visible) {
        this.mesh.visible = false;
      }
      return;
    }

    this.elapsed += delta;
    this.totalTime += delta;

    // 1. Calculate fade-in / hold / fade-out opacity curve
    if (this.elapsed < this.config.fadeInDuration) {
      // 0 -> 1.0 (smooth fade-in)
      const t = this.elapsed / Math.max(0.01, this.config.fadeInDuration);
      this.currentOpacity = Math.min(1.0, t * (2 - t)); // Ease-out quad
    } else if (this.elapsed < this.config.fadeOutStart) {
      // 1.0 (fully opaque heart background during 360 degree camera rotation)
      this.currentOpacity = 1.0;
    } else if (this.elapsed < this.config.fadeOutStart + this.config.fadeOutDuration) {
      // 1.0 -> 0.0 (smooth cross-fade back to classroom background)
      const t = (this.elapsed - this.config.fadeOutStart) / Math.max(0.01, this.config.fadeOutDuration);
      const easeT = t * t * (3 - 2 * t); // Smoothstep
      this.currentOpacity = Math.max(0.0, 1.0 - easeT);
    } else {
      // Finished
      this.currentOpacity = 0.0;
      this._isActive = false;
      this.mesh.visible = false;
    }

    this.material.opacity = this.currentOpacity;

    if (this.currentOpacity <= 0) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;

    // 2. Align 3D mesh with Camera Frustum
    this.updateMeshFrustum();

    // 3. Update particle physics & render dynamic 2D canvas
    this.updateParticles(delta);
    this.renderFrame(delta);
    this.texture.needsUpdate = true;
  }

  /**
   * Position and scale mesh directly in front of camera to fill entire screen view.
   */
  private updateMeshFrustum(): void {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const centerPos = this.camera.position
      .clone()
      .addScaledVector(forward, this.planeDistance);

    this.mesh.position.copy(centerPos);
    this.mesh.quaternion.copy(this.camera.quaternion);

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const frustumHeight = 2 * this.planeDistance * Math.tan(vFovRad / 2);
    const frustumWidth = frustumHeight * this.camera.aspect;

    // 35% margin to guarantee no gaps at screen edges during rapid rotation
    this.mesh.scale.set(frustumWidth * 1.35, frustumHeight * 1.35, 1);
  }

  private updateParticles(delta: number): void {
    const h = this.canvasHeight;
    const t = this.totalTime;

    // Update hearts
    for (const heart of this.hearts) {
      heart.y -= heart.speedY * delta;
      heart.x = heart.baseX + Math.sin(t * heart.wobbleSpeed + heart.phase) * heart.wobbleAmp;

      if (heart.y < -heart.size * 2) {
        heart.y = h + heart.size * 2;
        heart.baseX = Math.random() * this.canvasWidth;
        heart.x = heart.baseX;
      }
    }

    // Update bokeh orbs
    for (const orb of this.bokehOrbs) {
      orb.y -= orb.speedY * delta;
      orb.x = orb.baseX + Math.sin(t * orb.wobbleSpeed + orb.phase) * orb.wobbleAmp;

      if (orb.y < -orb.radius * 2) {
        orb.y = h + orb.radius * 2;
        orb.baseX = Math.random() * this.canvasWidth;
        orb.x = orb.baseX;
      }
    }

    // Update sparkles
    for (const sparkle of this.sparkles) {
      sparkle.y -= sparkle.speedY * delta;
      if (sparkle.y < -sparkle.size * 2) {
        sparkle.y = h + sparkle.size * 2;
        sparkle.x = Math.random() * this.canvasWidth;
      }
    }
  }

  /**
   * Render dreamy pastel anime atmosphere onto canvas.
   */
  private renderFrame(_delta: number): void {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const t = this.totalTime;

    // 1. Pastel Anime Vertical Gradient (warm pink -> sweet rose -> soft lilac)
    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0.0, '#fff5f8'); // soft white-pink
    baseGrad.addColorStop(0.35, '#ffebf3'); // warm peach-pink
    baseGrad.addColorStop(0.7, '#ffd6e7'); // candy rose
    baseGrad.addColorStop(1.0, '#fce4f4'); // fairytale fairy pink
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Warm Sunburst Rays (subtle rotating anime light shafts)
    ctx.save();
    ctx.translate(w * 0.5, h * 0.48);
    ctx.rotate(t * 0.09);
    const rayCount = 14;
    const rayAngleStep = (Math.PI * 2) / rayCount;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    for (let i = 0; i < rayCount; i += 2) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, w * 0.85, i * rayAngleStep, (i + 1) * rayAngleStep);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3. Central Soft Warm Bloom (pulsing radial glow)
    const pulseR = 0.55 + 0.05 * Math.sin(t * 2.2);
    const centerGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      0,
      w * 0.5,
      h * 0.48,
      w * pulseR
    );
    centerGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.72)');
    centerGrad.addColorStop(0.4, 'rgba(255, 240, 246, 0.45)');
    centerGrad.addColorStop(0.85, 'rgba(255, 222, 238, 0.15)');
    centerGrad.addColorStop(1.0, 'rgba(255, 210, 230, 0.0)');
    ctx.fillStyle = centerGrad;
    ctx.fillRect(0, 0, w, h);

    // 4. "ぽわわーん" Bokeh Glow Orbs
    for (const orb of this.bokehOrbs) {
      const pulse = 1.0 + 0.15 * Math.sin(t * orb.pulseSpeed + orb.phase);
      const rad = orb.radius * pulse;
      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, rad);
      grad.addColorStop(0.0, `rgba(255, 255, 255, ${orb.alpha * 1.3})`);
      grad.addColorStop(0.35, `rgba(${orb.r}, ${orb.g}, ${orb.b}, ${orb.alpha * 0.8})`);
      grad.addColorStop(0.75, `rgba(${orb.r}, ${orb.g}, ${orb.b}, ${orb.alpha * 0.2})`);
      grad.addColorStop(1.0, `rgba(${orb.r}, ${orb.g}, ${orb.b}, 0.0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Floating Anime Hearts
    for (const heart of this.hearts) {
      const pulse = 1.0 + 0.12 * Math.sin(t * heart.pulseSpeed + heart.phase);
      const curSize = heart.size * pulse;
      const angle = Math.sin(t * heart.rotSpeed + heart.phase) * 0.28; // gentle tilt +/- 16 deg

      this.drawHeart(
        ctx,
        heart.x,
        heart.y,
        curSize,
        angle,
        heart.style,
        heart.color,
        heart.alpha
      );
    }

    // 6. Twinkling Anime Sparkles (✨ Kira-Kira)
    for (const sp of this.sparkles) {
      const twinkle = Math.pow(Math.sin(t * sp.twinkleSpeed + sp.phase), 2);
      const curSize = sp.size * (0.6 + 0.5 * twinkle);
      const curAlpha = 0.35 + 0.65 * twinkle;
      const curAngle = t * sp.rotSpeed + sp.phase;

      this.drawSparkle(ctx, sp.x, sp.y, curSize, curAngle, curAlpha, sp.color);
    }
  }

  /**
   * Draw a stylized cute anime heart with lobes, cleft, and shine highlight.
   */
  private drawHeart(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    angle: number,
    style: 'filled' | 'outline' | 'inner',
    color: string,
    alpha: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    const d = size;

    // Smooth Bezier Heart Path
    ctx.beginPath();
    ctx.moveTo(0, -0.25 * d);
    // Left lobe
    ctx.bezierCurveTo(-0.55 * d, -0.85 * d, -1.0 * d, -0.2 * d, -0.6 * d, 0.4 * d);
    ctx.bezierCurveTo(-0.35 * d, 0.7 * d, 0, 0.9 * d, 0, 1.05 * d);
    // Right lobe
    ctx.bezierCurveTo(0, 0.9 * d, 0.35 * d, 0.7 * d, 0.6 * d, 0.4 * d);
    ctx.bezierCurveTo(1.0 * d, -0.2 * d, 0.55 * d, -0.85 * d, 0, -0.25 * d);
    ctx.closePath();

    if (style === 'filled') {
      ctx.fillStyle = color;
      ctx.fill();

      // Cute white reflection shine on top-left lobe
      ctx.beginPath();
      ctx.ellipse(-0.32 * d, -0.42 * d, 0.16 * d, 0.08 * d, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();
    } else if (style === 'outline') {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3.5, size * 0.12);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Subtle translucent fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
    } else if (style === 'inner') {
      ctx.fillStyle = color;
      ctx.fill();

      // Nested smaller white heart
      ctx.save();
      ctx.scale(0.48, 0.48);
      ctx.beginPath();
      ctx.moveTo(0, -0.25 * d);
      ctx.bezierCurveTo(-0.55 * d, -0.85 * d, -1.0 * d, -0.2 * d, -0.6 * d, 0.4 * d);
      ctx.bezierCurveTo(-0.35 * d, 0.7 * d, 0, 0.9 * d, 0, 1.05 * d);
      ctx.bezierCurveTo(0, 0.9 * d, 0.35 * d, 0.7 * d, 0.6 * d, 0.4 * d);
      ctx.bezierCurveTo(1.0 * d, -0.2 * d, 0.55 * d, -0.85 * d, 0, -0.25 * d);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Draw 4-point anime star sparkle (✨ Kira-Kira).
   */
  private drawSparkle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    angle: number,
    alpha: number,
    color: string
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = color;
    ctx.beginPath();
    const half = size * 0.5;
    const waist = size * 0.08;

    // Diamond quadratic curves
    ctx.moveTo(0, -half);
    ctx.quadraticCurveTo(0, 0, -half, 0);
    ctx.quadraticCurveTo(0, 0, 0, half);
    ctx.quadraticCurveTo(0, 0, half, 0);
    ctx.quadraticCurveTo(0, 0, 0, -half);
    ctx.closePath();
    ctx.fill();

    // Central bright core
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.5, waist * 1.5), 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  public dispose(): void {
    this.stop(true);
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
