import * as THREE from 'three';
import type { AvatarManager } from './AvatarManager';

const CLASSROOM_DESK_COLUMNS = [-3.045, -1.925, -0.84, 0.84, 1.925, 3.045];
const CLASSROOM_DESK_ROWS = [3.6, 2.3904, 1.1808, -0.0288, -1.2384, -2.448];

export interface AvatarTransformControllerOptions {
  domElement: HTMLElement;
  avatarManager: AvatarManager;
}

/**
 * Controller for manipulating avatar position & rotation via trackpad and keyboard.
 * - Trackpad 1-finger drag: Rotate avatar (Y-axis)
 * - Trackpad Shift + drag (or right drag): Pan avatar (X, Y position)
 * - Trackpad scroll (wheel): Move avatar forward/backward (Z position)
 * - Keyboard WASD / Arrows / Q,E: Move & rotate avatar
 * - Keyboard R: Reset position & rotation
 */
export class AvatarTransformController {
  private domElement: HTMLElement;
  private avatarManager: AvatarManager;
  private enabled: boolean = true;
  private walkingMode: boolean = false;

  // Pointer drag state
  private isPointerDown: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private isPanning: boolean = false;

  // Key states for continuous smooth keyboard motion
  private keysPressed: Set<string> = new Set();
  private animationFrameId: number | null = null;

  // Default initial values
  private initialPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private initialRotationY: number = 0;
  private isInitialized: boolean = false;

  // Sensitivity constants
  private readonly ROTATION_SPEED = 0.007; // rad per pixel
  private readonly PAN_SPEED = 0.0022; // meters per pixel
  private readonly ZOOM_SPEED = 0.0018; // meters per wheel delta
  private readonly KEY_MOVE_SPEED = 0.8; // meters per second
  private readonly KEY_ROT_SPEED = 1.6; // rad per second

  // Limits
  private readonly MIN_Y = -1.2;
  private readonly MAX_Y = 1.8;
  private readonly MIN_X = -2.5;
  private readonly MAX_X = 2.5;
  private readonly MIN_Z = -2.5;
  private readonly MAX_Z = 1.8;

  constructor(options: AvatarTransformControllerOptions) {
    this.domElement = options.domElement;
    this.avatarManager = options.avatarManager;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.updateKeyMotion = this.updateKeyMotion.bind(this);

    this.attachEvents();
    this.startKeyLoop();
  }

  private attachEvents(): void {
    this.domElement.style.cursor = 'grab';
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public detachEvents(): void {
    this.domElement.style.cursor = '';
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.isPointerDown = false;
      this.keysPressed.clear();
    }
  }

  /** Switch the transform keys from studio placement to classroom free-roam. */
  public setWalkingMode(enabled: boolean): void {
    this.walkingMode = enabled;
    this.isPointerDown = false;
    this.keysPressed.clear();
    this.domElement.style.cursor = enabled ? 'crosshair' : '';
  }

  public syncInitialTransform(): void {
    if (this.avatarManager.avatarInstance || this.avatarManager.controlledScenarioAvatarId) {
      this.initialPosition.copy(this.avatarManager.getAvatarPosition());
      this.initialRotationY = this.avatarManager.getAvatarRotationY();
      this.isInitialized = true;
    }
  }

  private initDefaultsIfNeeded(): void {
    if (!this.isInitialized) {
      this.syncInitialTransform();
    }
  }

  private onContextMenu(e: MouseEvent): void {
    // Prevent context menu on right click / two finger tap so it can be used for panning
    e.preventDefault();
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled || this.walkingMode) return;
    // Don't interact with UI clicks that bubble
    if ((e.target as HTMLElement) !== this.domElement) return;

    this.initDefaultsIfNeeded();
    this.isPointerDown = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    // Shift key, right click (button 2), or Ctrl+click triggers panning
    this.isPanning = e.shiftKey || e.button === 2 || e.ctrlKey;
    this.domElement.style.cursor = this.isPanning ? 'move' : 'ew-resize';
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.walkingMode) return;
    if (!this.enabled) {
      this.domElement.style.cursor = '';
      return;
    }

    if (!this.isPointerDown) {
      // Hover feedback
      this.domElement.style.cursor = e.shiftKey ? 'move' : 'grab';
      return;
    }

    const deltaX = e.clientX - this.lastPointerX;
    const deltaY = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    const isShift = e.shiftKey || e.button === 2 || e.ctrlKey || this.isPanning;
    this.domElement.style.cursor = isShift ? 'move' : 'ew-resize';

    if (isShift) {
      // Shift + Drag: Pan avatar (X, Y)
      const currentPos = this.avatarManager.getAvatarPosition();
      const newX = THREE.MathUtils.clamp(currentPos.x + deltaX * this.PAN_SPEED, this.MIN_X, this.MAX_X);
      const newY = THREE.MathUtils.clamp(currentPos.y - deltaY * this.PAN_SPEED, this.MIN_Y, this.MAX_Y);
      this.avatarManager.setAvatarPosition(newX, newY, currentPos.z);
    } else {
      // 1-finger Drag: Rotate avatar (Y-axis)
      const currentRot = this.avatarManager.getAvatarRotationY();
      const newRot = currentRot + deltaX * this.ROTATION_SPEED;
      this.avatarManager.setAvatarRotationY(newRot);
    }
  }

  private onPointerUp(_e: PointerEvent): void {
    this.isPointerDown = false;
    this.isPanning = false;
    this.domElement.style.cursor = this.walkingMode ? 'crosshair' : 'grab';
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled || this.walkingMode) return;
    e.preventDefault();

    this.initDefaultsIfNeeded();
    const currentPos = this.avatarManager.getAvatarPosition();
    // Scroll up = move forward (closer, +Z), Scroll down = move backward (-Z)
    const newZ = THREE.MathUtils.clamp(
      currentPos.z - e.deltaY * this.ZOOM_SPEED,
      this.MIN_Z,
      this.MAX_Z
    );
    this.avatarManager.setAvatarPosition(currentPos.x, currentPos.y, newZ);
  }

  private isInputFocused(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || (active as HTMLElement).isContentEditable;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.enabled || this.isInputFocused()) return;

    // Reset key (R)
    if (e.key === 'r' || e.key === 'R') {
      this.resetTransform();
      return;
    }

    const key = e.key.toLowerCase();
    if (this.walkingMode) {
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        this.keysPressed.add(key);
        e.preventDefault();
      }
      return;
    }
    if (
      [
        'arrowleft',
        'arrowright',
        'arrowup',
        'arrowdown',
        'a',
        'd',
        'w',
        's',
        'q',
        'e',
      ].includes(key)
    ) {
      this.keysPressed.add(key);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.keysPressed.delete(key);
  }

  private startKeyLoop(): void {
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      if (this.enabled && this.keysPressed.size > 0 && !this.isInputFocused()) {
        this.updateKeyMotion(delta);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private updateKeyMotion(delta: number): void {
    this.initDefaultsIfNeeded();
    const currentPos = this.avatarManager.getAvatarPosition();
    let currentRot = this.avatarManager.getAvatarRotationY();

    if (this.walkingMode) {
      let forward = 0;
      let strafe = 0;
      let turn = 0;
      if (this.keysPressed.has('w')) forward += 1;
      if (this.keysPressed.has('s')) forward -= 1;
      if (this.keysPressed.has('d')) strafe += 1;
      if (this.keysPressed.has('a')) strafe -= 1;
      if (this.keysPressed.has('e')) turn += 1;
      if (this.keysPressed.has('q')) turn -= 1;

      const step = this.KEY_MOVE_SPEED * 3.2 * delta;
      const forwardX = Math.sin(currentRot);
      const forwardZ = Math.cos(currentRot);
      const rightX = Math.cos(currentRot);
      const rightZ = -Math.sin(currentRot);
      const proposedX = currentPos.x + (forwardX * forward + rightX * strafe) * step;
      const proposedZ = currentPos.z + (forwardZ * forward + rightZ * strafe) * step;
      // Resolve each axis separately so Aoi can slide along a desk or wall.
      const newX = this.isClassroomWalkable(proposedX, currentPos.z)
        ? proposedX : currentPos.x;
      const newZ = this.isClassroomWalkable(newX, proposedZ)
        ? proposedZ : currentPos.z;
      if (forward !== 0 || strafe !== 0) {
        this.avatarManager.setAvatarPosition(newX, currentPos.y, newZ);
      }
      if (turn !== 0) {
        this.avatarManager.setAvatarRotationY(currentRot + turn * this.KEY_ROT_SPEED * delta);
      }
      return;
    }

    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;
    let rotY = 0;

    // Arrows: Pan X, Y
    if (this.keysPressed.has('arrowleft')) moveX -= 1;
    if (this.keysPressed.has('arrowright')) moveX += 1;
    if (this.keysPressed.has('arrowup')) moveY += 1;
    if (this.keysPressed.has('arrowdown')) moveY -= 1;

    // A/D or Q/E: Rotate
    if (this.keysPressed.has('a') || this.keysPressed.has('q')) rotY -= 1;
    if (this.keysPressed.has('d') || this.keysPressed.has('e')) rotY += 1;

    // W/S: Forward / Backward
    if (this.keysPressed.has('w')) moveZ += 1;
    if (this.keysPressed.has('s')) moveZ -= 1;

    if (moveX !== 0 || moveY !== 0 || moveZ !== 0) {
      const newX = THREE.MathUtils.clamp(
        currentPos.x + moveX * this.KEY_MOVE_SPEED * delta,
        this.MIN_X,
        this.MAX_X
      );
      const newY = THREE.MathUtils.clamp(
        currentPos.y + moveY * this.KEY_MOVE_SPEED * delta,
        this.MIN_Y,
        this.MAX_Y
      );
      const newZ = THREE.MathUtils.clamp(
        currentPos.z + moveZ * this.KEY_MOVE_SPEED * delta,
        this.MIN_Z,
        this.MAX_Z
      );
      this.avatarManager.setAvatarPosition(newX, newY, newZ);
    }

    if (rotY !== 0) {
      const newRot = currentRot + rotY * this.KEY_ROT_SPEED * delta;
      this.avatarManager.setAvatarRotationY(newRot);
    }
  }

  private isClassroomWalkable(x: number, z: number): boolean {
    // Allow for the avatar's roughly 25 cm radius inside the 8.96 x 10.66 m room.
    if (Math.abs(x) > 4.18 || Math.abs(z) > 5.02) return false;

    for (const deskX of CLASSROOM_DESK_COLUMNS) {
      if (Math.abs(x - deskX) > 0.57) continue;
      for (const deskZ of CLASSROOM_DESK_ROWS) {
        // The seat extends behind the desktop toward positive z.
        if (z > deskZ - 0.41 && z < deskZ + 0.74) return false;
      }
    }

    // The teacher's desk occupies the front teaching area.
    if (Math.abs(x) < 0.95 && z > -4.55 && z < -3.53) return false;
    return true;
  }

  public resetTransform(): void {
    if (this.isInitialized) {
      this.avatarManager.setAvatarPosition(
        this.initialPosition.x,
        this.initialPosition.y,
        this.initialPosition.z
      );
      this.avatarManager.setAvatarRotationY(this.initialRotationY);
    } else {
      this.avatarManager.setAvatarPosition(0, 0, 0);
      this.avatarManager.setAvatarRotationY(0);
    }
  }
}
