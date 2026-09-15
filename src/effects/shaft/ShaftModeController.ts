import * as THREE from 'three';
import type { AvatarManager } from '../../avatar/AvatarManager';
import type { ViewerCore } from '../../scene/ViewerCore';
import type { AvatarConfig } from '../../Config';

export interface ShaftCharacterInfo {
  name: string;
  color: string;
}

export class ShaftModeController {
  private avatarManager: AvatarManager;
  private viewerCore: ViewerCore;
  private getConfig: () => AvatarConfig;

  private isActive = false;
  private stageGroup: THREE.Group | null = null;
  private overlayEl: HTMLElement | null = null;
  private textEl: HTMLElement | null = null;
  private originalSunShafts: boolean | null = null;
  private originalLensFlare: boolean | null = null;

  private texturesToDispose: THREE.Texture[] = [];

  constructor(options: {
    avatarManager: AvatarManager;
    viewerCore: ViewerCore;
    getConfig: () => AvatarConfig;
  }) {
    this.avatarManager = options.avatarManager;
    this.viewerCore = options.viewerCore;
    this.getConfig = options.getConfig;

    this.initOverlay();
    this.initStage();
  }

  /**
   * DOM overlay for the giant vertical Mincho text.
   */
  private initOverlay(): void {
    let overlay = document.getElementById('shaft-typography-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'shaft-typography-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.userSelect = 'none';
      overlay.style.overflow = 'hidden';
      overlay.style.zIndex = '30';
      overlay.style.display = 'none';

      const container = document.getElementById('viewport-container') || document.body;
      container.appendChild(overlay);
    }
    this.overlayEl = overlay;

    const text = document.createElement('div');
    text.className = 'shaft-vertical-text';
    text.style.position = 'absolute';
    text.style.writingMode = 'vertical-rl';
    text.style.textOrientation = 'upright';
    text.style.whiteSpace = 'nowrap';
    text.style.lineHeight = '1.1';
    text.style.fontFamily = '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif';
    text.style.fontWeight = '800';
    text.style.fontSize = 'clamp(1.6rem, 3.4vw, 2.5rem)';
    text.style.color = '#ffffff';
    text.style.letterSpacing = '0.22em';
    text.style.textShadow =
      '0 0 8px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.9)';
    text.style.transform = 'translate(-50%, -50%) scale(1)';
    text.style.transition = 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)';
    text.style.display = 'inline-block';
    overlay.appendChild(text);
    this.textEl = text;
  }

  /**
   * Builds the borderless minimal gray low-poly stage ("床", "黒板", "机", "椅子").
   */
  private initStage(): void {
    const group = new THREE.Group();
    group.name = 'ShaftAbstractStage';
    group.visible = false;

    // Helper to create borderless Kanji CanvasTexture
    const createKanjiTexture = (
      text: string,
      bgColor: string,
      fgColor: string,
      fontSize = 110
    ): THREE.CanvasTexture => {
      const cvs = document.createElement('canvas');
      cvs.width = 512;
      cvs.height = 512;
      const ctx = cvs.getContext('2d')!;

      // Flat solid background (no border)
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 512, 512);

      // Kanji text in Mincho font
      ctx.fillStyle = fgColor;
      ctx.font = `bold ${fontSize}px "Shippori Mincho", "Yu Mincho", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 256);

      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.texturesToDispose.push(tex);
      return tex;
    };

    // 1. Floor ("床") - minimal light gray, no border
    const floorGeo = new THREE.BoxGeometry(14, 0.2, 14);
    const floorTex = createKanjiTexture('床', '#e4e4e7', '#a1a1aa', 95);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);

    const floorMat = new THREE.MeshBasicMaterial({
      map: floorTex,
      toneMapped: false,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.1, 0);
    group.add(floorMesh);

    // 2. Blackboard ("黒板") - simple borderless solid gray slab
    const boardGeo = new THREE.BoxGeometry(4.0, 1.9, 0.05);
    const boardTex = createKanjiTexture('黒板', '#3f3f46', '#ffffff', 130);
    const boardMat = new THREE.MeshBasicMaterial({
      map: boardTex,
      toneMapped: false,
    });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.position.set(0, 1.6, -2.6);
    group.add(boardMesh);

    // Helper to create desk
    const deskTopGeo = new THREE.BoxGeometry(0.85, 0.04, 0.55);
    const deskTex = createKanjiTexture('机', '#52525b', '#ffffff', 110);
    const deskTopMat = new THREE.MeshBasicMaterial({ map: deskTex, toneMapped: false });
    const deskLegMat = new THREE.MeshBasicMaterial({ color: 0x3f3f46, toneMapped: false });
    const deskLegGeo = new THREE.BoxGeometry(0.04, 0.7, 0.04);
    const deskOffsets = [
      [-0.38, -0.23],
      [0.38, -0.23],
      [-0.38, 0.23],
      [0.38, 0.23],
    ];

    const createDeskGroup = (posX: number, posZ: number): THREE.Group => {
      const dg = new THREE.Group();
      dg.position.set(posX, 0, posZ);

      const top = new THREE.Mesh(deskTopGeo, deskTopMat);
      top.position.set(0, 0.72, 0);
      dg.add(top);

      for (const [ox, oz] of deskOffsets) {
        const leg = new THREE.Mesh(deskLegGeo, deskLegMat);
        leg.position.set(ox, 0.35, oz);
        dg.add(leg);
      }
      return dg;
    };

    // Helper to create chair
    const seatGeo = new THREE.BoxGeometry(0.42, 0.03, 0.42);
    const chairTex = createKanjiTexture('椅子', '#52525b', '#ffffff', 95);
    const chairSeatMat = new THREE.MeshBasicMaterial({ map: chairTex, toneMapped: false });
    const backGeo = new THREE.BoxGeometry(0.42, 0.24, 0.03);
    const chairLegMat = new THREE.MeshBasicMaterial({ color: 0x3f3f46, toneMapped: false });
    const chairLegGeo = new THREE.BoxGeometry(0.03, 0.42, 0.03);
    const backPoleGeo = new THREE.BoxGeometry(0.03, 0.36, 0.03);
    const chairOffsets = [
      [-0.18, -0.18],
      [0.18, -0.18],
      [-0.18, 0.18],
      [0.18, 0.18],
    ];

    const createChairGroup = (posX: number, posZ: number): THREE.Group => {
      const cg = new THREE.Group();
      cg.position.set(posX, 0, posZ);

      const seat = new THREE.Mesh(seatGeo, chairSeatMat);
      seat.position.set(0, 0.42, 0);
      cg.add(seat);

      const back = new THREE.Mesh(backGeo, chairSeatMat);
      back.position.set(0, 0.75, 0.18);
      cg.add(back);

      for (const [ox, oz] of chairOffsets) {
        const leg = new THREE.Mesh(chairLegGeo, chairLegMat);
        leg.position.set(ox, 0.21, oz);
        cg.add(leg);
      }

      const poleL = new THREE.Mesh(backPoleGeo, chairLegMat);
      poleL.position.set(-0.18, 0.58, 0.18);
      const poleR = new THREE.Mesh(backPoleGeo, chairLegMat);
      poleR.position.set(0.18, 0.58, 0.18);
      cg.add(poleL, poleR);

      return cg;
    };

    // 3. Desks & Chairs on both Right and Left sides
    // Right side
    group.add(createDeskGroup(0.85, 0.2));
    group.add(createChairGroup(0.85, 0.75));

    // Left side
    group.add(createDeskGroup(-0.85, 0.2));
    group.add(createChairGroup(-0.85, 0.75));

    // Add to main scene
    this.viewerCore.scene.add(group);
    this.stageGroup = group;
  }

  /**
   * Determine character identity and color scheme:
   * Aoi -> Yellowish (#f59e0b)
   * Emili -> Reddish (#dc2626)
   * Shion -> Bluish (#2563eb)
   */
  public getCharacterInfo(): ShaftCharacterInfo {
    const url = (this.avatarManager.currentModelUrl || '').toLowerCase();
    if (url.includes('aoi')) {
      return { name: 'アオイ', color: '#f59e0b' }; // Amber/Gold yellow
    } else if (url.includes('emili')) {
      return { name: 'エミリ', color: '#dc2626' }; // Crimson red
    } else if (url.includes('shion')) {
      return { name: 'シオン', color: '#2563eb' }; // Blue
    }
    return { name: 'アバター', color: '#e11d48' };
  }

  /**
   * Toggle or set Shaft mode state.
   */
  public setShaftMode(enabled: boolean): void {
    if (this.isActive === enabled) return;
    this.isActive = enabled;

    const charInfo = this.getCharacterInfo();

    if (enabled) {
      // 1. Solid color avatar with bold white outline
      this.avatarManager.setSolidColorMode(true, charInfo.color);

      // 2. Hide existing backgrounds, set pure white background
      this.viewerCore.scene.background = new THREE.Color(0xffffff);
      this.viewerCore.renderer.setClearColor(0xffffff, 1.0);
      const container = document.getElementById('viewport-container');
      if (container) {
        container.style.backgroundColor = '#ffffff';
      }

      this.viewerCore.skyBackground.mesh.visible = false;
      this.viewerCore.midgroundMesh.visible = false;
      this.viewerCore.neargroundMesh.visible = false;
      this.viewerCore.sunEffect.sunGroup.visible = false;
      this.viewerCore.sunEffect.flareGroup.visible = false;
      this.viewerCore.godRaysPass.enabled = false;

      // Temporarily disable sunShafts and lensFlare in config to prevent god rays pass
      const cfg = this.getConfig();
      if (cfg.lighting.sunShafts) {
        this.originalSunShafts = cfg.lighting.sunShafts.enabled;
        cfg.lighting.sunShafts.enabled = false;
      }
      if (cfg.lighting.lensFlare) {
        this.originalLensFlare = cfg.lighting.lensFlare.enabled;
        cfg.lighting.lensFlare.enabled = false;
      }

      if (this.stageGroup) {
        this.stageGroup.visible = true;
      }

      // 3. Show typography overlay
      if (this.overlayEl && this.textEl) {
        this.textEl.textContent = charInfo.name;
        this.overlayEl.style.display = 'block';

        // Trigger cut-in pop
        this.textEl.style.transform = 'translate(-50%, -50%) scale(1.2)';
        requestAnimationFrame(() => {
          if (this.textEl) {
            this.textEl.style.transform = 'translate(-50%, -50%) scale(1)';
          }
        });
      }
    } else {
      // Restore avatar
      this.avatarManager.setSolidColorMode(false);

      // Restore stage & backgrounds
      if (this.stageGroup) {
        this.stageGroup.visible = false;
      }

      // Restore sunShafts & lensFlare config
      const cfg = this.getConfig();
      if (this.originalSunShafts !== null && cfg.lighting.sunShafts) {
        cfg.lighting.sunShafts.enabled = this.originalSunShafts;
        this.originalSunShafts = null;
      }
      if (this.originalLensFlare !== null && cfg.lighting.lensFlare) {
        cfg.lighting.lensFlare.enabled = this.originalLensFlare;
        this.originalLensFlare = null;
      }

      this.viewerCore.updateBackgroundDisplay(cfg);
      this.viewerCore.updateMidgroundDisplay(cfg);
      this.viewerCore.updateNeargroundDisplay(cfg);
      this.viewerCore.sunEffect.sunGroup.visible =
        (cfg.lighting.sunShafts?.enabled || cfg.lighting.lensFlare?.enabled) ?? false;
      this.viewerCore.sunEffect.flareGroup.visible = cfg.lighting.lensFlare?.enabled ?? false;

      // Hide overlay
      if (this.overlayEl) {
        this.overlayEl.style.display = 'none';
      }
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * If the model changes while Shaft mode is active, refresh character color & text.
   */
  public refreshCurrentAvatar(): void {
    if (!this.isActive) return;
    const charInfo = this.getCharacterInfo();
    this.avatarManager.setSolidColorMode(true, charInfo.color);
    if (this.textEl) {
      this.textEl.textContent = charInfo.name;
    }

    // Ensure stage remains visible and default environmental layers remain hidden
    this.viewerCore.scene.background = new THREE.Color(0xffffff);
    this.viewerCore.renderer.setClearColor(0xffffff, 1.0);
    const container = document.getElementById('viewport-container');
    if (container) {
      container.style.backgroundColor = '#ffffff';
    }

    this.viewerCore.skyBackground.mesh.visible = false;
    this.viewerCore.midgroundMesh.visible = false;
    this.viewerCore.neargroundMesh.visible = false;
    this.viewerCore.sunEffect.sunGroup.visible = false;
    this.viewerCore.sunEffect.flareGroup.visible = false;
    this.viewerCore.godRaysPass.enabled = false;

    if (this.stageGroup) {
      this.stageGroup.visible = true;
    }
  }

  /**
   * Update text position every frame to track the avatar's head/chest.
   */
  public update(): void {
    if (!this.isActive || !this.textEl || !this.overlayEl) return;

    // Guarantee pure white background even if an async background load resolves
    if (this.viewerCore.skyBackground.mesh.visible) {
      this.viewerCore.skyBackground.mesh.visible = false;
    }
    if (this.viewerCore.scene.background === null || !(this.viewerCore.scene.background as any).isColor) {
      this.viewerCore.scene.background = new THREE.Color(0xffffff);
    }

    const avatar = this.avatarManager.isMultiAvatarScenarioActive
      ? (this.avatarManager.scenarioAvatars.get('girl_01') || this.avatarManager.scenarioAvatars.values().next().value)
      : this.avatarManager.avatarInstance;

    if (!avatar?.vrm) {
      this.textEl.style.left = '50%';
      this.textEl.style.top = '48%';
      return;
    }

    // Target head bone or chest
    const headNode =
      avatar.vrm.humanoid?.getNormalizedBoneNode('head') ||
      avatar.vrm.humanoid?.getNormalizedBoneNode('neck');

    const targetPos = new THREE.Vector3();
    if (headNode) {
      headNode.getWorldPosition(targetPos);
      targetPos.y -= 0.10; // Lower towards face/neck center
    } else {
      targetPos.set(0, 1.25, 0);
    }

    const camera = this.viewerCore.camera;
    const projected = targetPos.clone().project(camera);

    // Convert normalized device coords (-1 to +1) to screen percentage
    const x = (projected.x * 0.5 + 0.5) * 100;
    const y = (-projected.y * 0.5 + 0.5) * 100;

    // Check if behind camera or far offscreen
    if (projected.z > 1.0 || projected.x < -1.05 || projected.x > 1.05) {
      this.textEl.style.display = 'none';
    } else {
      this.textEl.style.display = 'inline-block';
      this.textEl.style.left = `${x.toFixed(1)}%`;
      this.textEl.style.top = `${y.toFixed(1)}%`;
    }
  }

  public dispose(): void {
    if (this.isActive) {
      this.setShaftMode(false);
    }
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    if (this.stageGroup) {
      this.viewerCore.scene.remove(this.stageGroup);
    }
    this.texturesToDispose.forEach((tex) => tex.dispose());
    this.texturesToDispose = [];
  }
}
