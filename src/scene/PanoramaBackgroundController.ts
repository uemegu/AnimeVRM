import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface PanoramaConfig {
  imageUrl: string;
  initialYaw: number;
  initialPitch?: number;
  initialFov?: number;
}

export interface LookAtOptions {
  yaw: number;
  pitch?: number;
  fov?: number;
  duration?: number; // milliseconds
  onComplete?: () => void;
}

export interface PanoramaControllerOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  domElement: HTMLElement;
  onStateChange?: (active: boolean) => void;
}

export class PanoramaBackgroundController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private domElement: HTMLElement;

  private textureLoader = new THREE.TextureLoader();
  private currentTexture: THREE.Texture | null = null;

  public isActive = false;
  public sensitivity = 0.003;
  public invertDrag = false;
  public idleMotionEnabled = true;
  public lerpFactor = 0.12;
  public cameraY = 1.1;

  // View state (Target & Current for smoothing)
  public targetYaw = 0;
  public targetPitch = 0;
  public currentYaw = 0;
  public currentPitch = 0;
  public targetFov = 60;
  public currentFov = 60;

  private readonly maxPitch = THREE.MathUtils.degToRad(80);
  private readonly minFov = 35;
  private readonly maxFov = 80;

  // Pointer drag state
  private isDragging = false;
  private previousPointerX = 0;
  private previousPointerY = 0;
  private activePointerId: number | null = null;
  private lastUserInteractionTime = 0;

  // Pinch zoom state
  private activeTouchPointers = new Map<number, { x: number; y: number }>();
  private initialPinchDistance = 0;
  private initialPinchFov = 60;

  // Tween / Animation state
  private isAnimating = false;
  private animStartTime = 0;
  private animDuration = 0;
  private animStartYaw = 0;
  private animStartPitch = 0;
  private animStartFov = 60;
  private animTargetYaw = 0;
  private animTargetPitch = 0;
  private animTargetFov = 60;
  private animOnComplete: (() => void) | null = null;

  // Saved camera/scene state for restore
  private savedCameraPosition = new THREE.Vector3();
  private savedCameraRotation = new THREE.Euler();
  private savedCameraFov = 60;
  private savedControlsEnabled = true;
  private savedBackground: THREE.Color | THREE.Texture | null = null;

  private onStateChange?: (active: boolean) => void;
  private isCameraControlEnabled = true;

  constructor(options: PanoramaControllerOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.controls = options.controls;
    this.domElement = options.domElement;
    this.onStateChange = options.onStateChange;

    this.bindEvents();
  }

  /**
   * Enable/disable manual camera controls and camera pose overwriting.
   * When false (e.g. during cinematic dialogue scenario), camera pose is managed by DialogueCameraController.
   */
  public setCameraControlEnabled(enabled: boolean): void {
    this.isCameraControlEnabled = enabled;
    if (!enabled) {
      this.isDragging = false;
      this.activeTouchPointers.clear();
      this.activePointerId = null;
    }
  }

  public get cameraControlEnabled(): boolean {
    return this.isCameraControlEnabled;
  }

  private bindEvents(): void {
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onWheel = this.onWheel.bind(this);

    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('pointercancel', this.onPointerCancel);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  public unbindEvents(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('pointercancel', this.onPointerCancel);
    this.domElement.removeEventListener('wheel', this.onWheel);
  }

  /**
   * Load and activate a 360° equirectangular panorama texture.
   */
  public async load(config: PanoramaConfig): Promise<THREE.Texture> {
    const texture = await this.textureLoader.loadAsync(config.imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;

    this.activate(texture, config);
    return texture;
  }

  /**
   * Activate panorama mode with an already loaded or newly loaded texture.
   */
  public activate(texture: THREE.Texture, config?: Partial<PanoramaConfig>): void {
    if (!this.isActive) {
      // Save current camera / controls / background state
      this.savedCameraPosition.copy(this.camera.position);
      this.savedCameraRotation.copy(this.camera.rotation);
      this.savedCameraFov = this.camera.fov;
      this.savedControlsEnabled = this.controls.enabled;
      this.savedBackground = this.scene.background;

      // Lock controls
      this.controls.enabled = false;
      this.camera.position.set(0, this.cameraY, 0);
    }

    if (this.currentTexture && this.currentTexture !== texture) {
      this.currentTexture.dispose();
    }
    this.currentTexture = texture;
    this.scene.background = texture;

    // Set view parameters
    const initYaw = config?.initialYaw ?? 0;
    const initPitch = config?.initialPitch ?? 0;
    const initFov = config?.initialFov ?? 60;

    this.targetYaw = initYaw;
    this.currentYaw = initYaw;
    this.targetPitch = THREE.MathUtils.clamp(initPitch, -this.maxPitch, this.maxPitch);
    this.currentPitch = this.targetPitch;
    this.targetFov = THREE.MathUtils.clamp(initFov, this.minFov, this.maxFov);
    this.currentFov = this.targetFov;

    this.camera.fov = this.currentFov;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.currentYaw;
    this.camera.rotation.x = this.currentPitch;
    this.camera.rotation.z = 0;
    this.camera.updateProjectionMatrix();

    this.isActive = true;
    this.lastUserInteractionTime = performance.now();
    this.onStateChange?.(true);
  }

  /**
   * Deactivate panorama mode and restore previous camera / controls / background.
   */
  public deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.isDragging = false;
    this.isAnimating = false;
    this.activeTouchPointers.clear();

    // Restore background
    if (this.currentTexture) {
      this.currentTexture.dispose();
      this.currentTexture = null;
    }
    this.scene.background = this.savedBackground;

    // Restore camera & controls
    this.camera.position.copy(this.savedCameraPosition);
    this.camera.rotation.copy(this.savedCameraRotation);
    this.camera.fov = this.savedCameraFov;
    this.camera.updateProjectionMatrix();
    this.controls.enabled = this.savedControlsEnabled;

    this.onStateChange?.(false);
  }

  /**
   * Smoothly move camera look angle and fov.
   */
  public lookAt(options: LookAtOptions): Promise<void> {
    return new Promise((resolve) => {
      this.isAnimating = true;
      this.animStartTime = performance.now();
      this.animDuration = options.duration ?? 1000;

      this.animStartYaw = this.currentYaw;
      this.animStartPitch = this.currentPitch;
      this.animStartFov = this.currentFov;

      this.animTargetYaw = options.yaw;
      this.animTargetPitch = THREE.MathUtils.clamp(options.pitch ?? this.currentPitch, -this.maxPitch, this.maxPitch);
      this.animTargetFov = THREE.MathUtils.clamp(options.fov ?? this.currentFov, this.minFov, this.maxFov);

      this.animOnComplete = () => {
        this.isAnimating = false;
        options.onComplete?.();
        resolve();
      };
    });
  }

  /**
   * Play the demo camera animation described in the specification:
   * Front -> 1.5s smoothly turn Right -> Pause 1s -> Turn back to Front
   */
  public async playDemoAnimation(): Promise<void> {
    if (!this.isActive) return;

    const baseYaw = this.targetYaw;
    const basePitch = 0;

    // 1. Look to front
    await this.lookAt({
      yaw: baseYaw,
      pitch: basePitch,
      fov: 60,
      duration: 800,
    });

    if (!this.isActive) return;

    // 2. Turn right over 1.5s (~90deg)
    await this.lookAt({
      yaw: baseYaw - THREE.MathUtils.degToRad(80),
      pitch: THREE.MathUtils.degToRad(5),
      fov: 55,
      duration: 1500,
    });

    if (!this.isActive) return;

    // 3. Pause for 800ms
    await new Promise((r) => setTimeout(r, 800));

    if (!this.isActive) return;

    // 4. Return to front over 1.2s
    await this.lookAt({
      yaw: baseYaw,
      pitch: basePitch,
      fov: 60,
      duration: 1200,
    });
  }

  /**
   * Reset view to initial front position
   */
  public resetView(yaw = 0, pitch = 0, fov = 60): void {
    this.targetYaw = yaw;
    this.targetPitch = THREE.MathUtils.clamp(pitch, -this.maxPitch, this.maxPitch);
    this.targetFov = THREE.MathUtils.clamp(fov, this.minFov, this.maxFov);
    this.currentYaw = this.targetYaw;
    this.currentPitch = this.targetPitch;
    this.currentFov = this.targetFov;
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Pointer Event Handlers
   */
  private onPointerDown(event: PointerEvent): void {
    if (!this.isActive || !this.isCameraControlEnabled) return;

    this.activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activeTouchPointers.size === 1) {
      this.isDragging = true;
      this.activePointerId = event.pointerId;
      this.previousPointerX = event.clientX;
      this.previousPointerY = event.clientY;
      this.isAnimating = false; // Cancel ongoing auto camera movement
      this.lastUserInteractionTime = performance.now();

      try {
        this.domElement.setPointerCapture(event.pointerId);
      } catch (err) {
        // Ignored
      }
    } else if (this.activeTouchPointers.size === 2) {
      // Pinch zoom start
      this.isDragging = false;
      const pts = Array.from(this.activeTouchPointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      this.initialPinchDistance = Math.hypot(dx, dy);
      this.initialPinchFov = this.targetFov;
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isActive || !this.isCameraControlEnabled) return;

    if (this.activeTouchPointers.has(event.pointerId)) {
      this.activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (this.activeTouchPointers.size === 2) {
      // Multi-touch pinch zoom
      const pts = Array.from(this.activeTouchPointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const currentDist = Math.hypot(dx, dy);
      if (this.initialPinchDistance > 0) {
        const scale = currentDist / this.initialPinchDistance;
        const newFov = this.initialPinchFov / scale;
        this.targetFov = THREE.MathUtils.clamp(newFov, this.minFov, this.maxFov);
      }
      this.lastUserInteractionTime = performance.now();
      return;
    }

    if (!this.isDragging || event.pointerId !== this.activePointerId) return;

    const dx = event.clientX - this.previousPointerX;
    const dy = event.clientY - this.previousPointerY;

    this.previousPointerX = event.clientX;
    this.previousPointerY = event.clientY;

    const sign = this.invertDrag ? 1 : -1;
    this.targetYaw += sign * dx * this.sensitivity;
    this.targetPitch += sign * dy * this.sensitivity;

    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch,
      -this.maxPitch,
      this.maxPitch
    );

    this.lastUserInteractionTime = performance.now();
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.isActive || !this.isCameraControlEnabled) return;

    this.activeTouchPointers.delete(event.pointerId);

    if (this.activePointerId === event.pointerId) {
      this.isDragging = false;
      this.activePointerId = null;
      try {
        this.domElement.releasePointerCapture(event.pointerId);
      } catch (err) {
        // Ignored
      }
    }

    if (this.activeTouchPointers.size === 1) {
      // Return to single touch drag
      const remainingId = Array.from(this.activeTouchPointers.keys())[0];
      const pos = this.activeTouchPointers.get(remainingId)!;
      this.activePointerId = remainingId;
      this.previousPointerX = pos.x;
      this.previousPointerY = pos.y;
      this.isDragging = true;
    }

    this.lastUserInteractionTime = performance.now();
  }

  private onPointerCancel(event: PointerEvent): void {
    this.onPointerUp(event);
  }

  private onWheel(event: WheelEvent): void {
    if (!this.isActive || !this.isCameraControlEnabled) return;

    event.preventDefault();

    this.targetFov += event.deltaY * 0.02;
    this.targetFov = THREE.MathUtils.clamp(this.targetFov, this.minFov, this.maxFov);
    this.lastUserInteractionTime = performance.now();
  }

  /**
   * Main per-frame update loop
   */
  public update(delta: number, elapsed: number): void {
    if (!this.isActive) return;

    // If camera control is delegated to DialogueCameraController, skip camera transform override
    if (!this.isCameraControlEnabled) return;

    // Handle auto-animation (Tween)
    if (this.isAnimating) {
      const now = performance.now();
      const progress = Math.min(1, (now - this.animStartTime) / Math.max(1, this.animDuration));
      // EaseInOutCubic
      const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.currentYaw = THREE.MathUtils.lerp(this.animStartYaw, this.animTargetYaw, t);
      this.currentPitch = THREE.MathUtils.lerp(this.animStartPitch, this.animTargetPitch, t);
      this.currentFov = THREE.MathUtils.lerp(this.animStartFov, this.animTargetFov, t);

      this.targetYaw = this.currentYaw;
      this.targetPitch = this.currentPitch;
      this.targetFov = this.currentFov;

      if (progress >= 1) {
        const cb = this.animOnComplete;
        this.animOnComplete = null;
        this.isAnimating = false;
        cb?.();
      }
    } else {
      // Smooth interpolation towards targets
      this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, this.targetYaw, this.lerpFactor);
      this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, this.targetPitch, this.lerpFactor);
      this.currentFov = THREE.MathUtils.lerp(this.currentFov, this.targetFov, this.lerpFactor);
    }

    // Apply Idle Motion if not dragging and not animating
    let idleYawOffset = 0;
    let idlePitchOffset = 0;
    const timeSinceInteraction = (performance.now() - this.lastUserInteractionTime) / 1000;

    if (this.idleMotionEnabled && !this.isDragging && !this.isAnimating && timeSinceInteraction > 0.5) {
      const idleWeight = Math.min(1, (timeSinceInteraction - 0.5) * 1.5);
      idleYawOffset = Math.sin(elapsed * 0.25) * THREE.MathUtils.degToRad(0.2) * idleWeight;
      idlePitchOffset = Math.sin(elapsed * 0.17) * THREE.MathUtils.degToRad(0.12) * idleWeight;
    }

    // Apply position, rotation & projection to camera
    this.camera.position.set(0, this.cameraY, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.currentYaw + idleYawOffset;
    this.camera.rotation.x = this.currentPitch + idlePitchOffset;
    this.camera.rotation.z = 0;

    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  public dispose(): void {
    this.unbindEvents();
    if (this.currentTexture) {
      this.currentTexture.dispose();
      this.currentTexture = null;
    }
  }
}
