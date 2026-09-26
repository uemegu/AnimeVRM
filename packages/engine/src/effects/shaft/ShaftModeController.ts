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
  private labelElements: Map<string, HTMLElement> = new Map();
  private originalSunShafts: boolean | null = null;
  private originalLensFlare: boolean | null = null;

  // Space Stage (シャフト宇宙ステージ: 太陽・公転する地球・取り残されるアオイ文字)
  private currentSpaceStage: 'orbit' | 'ghost_left_behind' | false = false;
  private spaceGroup: THREE.Group | null = null;
  private sunMesh: THREE.Mesh | null = null;
  private earthGroup: THREE.Group | null = null;
  private earthMesh: THREE.Mesh | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private aoiGhostMesh: THREE.Mesh | null = null;
  private orbitAngle = 0;
  private aoiGhostPos = new THREE.Vector3();

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
    this.initSpaceStage();
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
  }

  private createOrGetLabelElement(key: string, name: string): HTMLElement {
    let el = this.labelElements.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = `shaft-vertical-text shaft-text-${key}`;
      el.style.position = 'absolute';
      el.style.writingMode = 'vertical-rl';
      el.style.textOrientation = 'upright';
      el.style.whiteSpace = 'nowrap';
      el.style.lineHeight = '1.1';
      el.style.fontFamily = '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif';
      el.style.fontWeight = '800';
      el.style.fontSize = 'clamp(1.6rem, 3.4vw, 2.5rem)';
      el.style.color = '#ffffff';
      el.style.letterSpacing = '0.22em';
      el.style.textShadow =
        '0 0 8px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.9)';
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      el.style.transition = 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.display = 'inline-block';
      this.overlayEl?.appendChild(el);
      this.labelElements.set(key, el);
    }
    el.textContent = name;
    return el;
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
   * Builds the Shaft surreal space stage ("太陽", "地球", "月", 公転軌道, 宇宙空間に漂う「アオイ」文字).
   */
  private initSpaceStage(): void {
    const group = new THREE.Group();
    group.name = 'ShaftSpaceStage';
    group.visible = false;

    // Helper for circular Kanji badge texture
    const createCircleKanjiTexture = (
      text: string,
      bgColor: string,
      fgColor: string,
      strokeColor: string,
      size = 512,
      subText?: string
    ): THREE.CanvasTexture => {
      const cvs = document.createElement('canvas');
      cvs.width = size;
      cvs.height = size;
      const ctx = cvs.getContext('2d')!;

      const center = size / 2;
      const radius = size * 0.44;

      // Outer thin ring
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = size * 0.02;
      ctx.beginPath();
      ctx.arc(center, center, radius + size * 0.03, 0, Math.PI * 2);
      ctx.stroke();

      // Main circle
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner thin stroke
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = size * 0.015;
      ctx.beginPath();
      ctx.arc(center, center, radius * 0.92, 0, Math.PI * 2);
      ctx.stroke();

      // Kanji text in Mincho font
      ctx.fillStyle = fgColor;
      ctx.font = `bold ${Math.round(size * 0.32)}px "Shippori Mincho", "Yu Mincho", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, center, subText ? center - size * 0.05 : center);

      if (subText) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${Math.round(size * 0.08)}px "Montserrat", sans-serif`;
        ctx.letterSpacing = '3px';
        ctx.fillText(subText, center, center + size * 0.22);
      }

      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.texturesToDispose.push(tex);
      return tex;
    };

    // 1. Sun ("太陽")
    const sunTex = createCircleKanjiTexture('太陽', '#dc2626', '#ffffff', '#fca5a5', 512, 'SUN');
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    const sunGeo = new THREE.PlaneGeometry(1.35, 1.35);
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(0, 0.4, 0);
    group.add(this.sunMesh);

    // Decorative sun rays ring
    const sunRayGeo = new THREE.RingGeometry(0.72, 0.73, 64);
    const sunRayMat = new THREE.MeshBasicMaterial({ color: 0xf87171, side: THREE.DoubleSide, toneMapped: false });
    const sunRay = new THREE.Mesh(sunRayGeo, sunRayMat);
    sunRay.position.set(0, 0.4, -0.01);
    group.add(sunRay);

    // 2. Orbit Line (Dashed ellipse on X-Z)
    const orbitRadiusX = 2.35;
    const orbitRadiusZ = 1.75;
    const curvePoints: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      curvePoints.push(new THREE.Vector3(Math.cos(theta) * orbitRadiusX, 0.4, Math.sin(theta) * orbitRadiusZ));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const orbitMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.14,
      gapSize: 0.08,
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    orbitLine.computeLineDistances();
    group.add(orbitLine);

    // 3. Earth Group & Mesh ("地球")
    this.earthGroup = new THREE.Group();
    const earthTex = createCircleKanjiTexture('地球', '#2563eb', '#ffffff', '#93c5fd', 512, 'EARTH');
    const earthMat = new THREE.MeshBasicMaterial({
      map: earthTex,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    const earthGeo = new THREE.PlaneGeometry(0.68, 0.68);
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthGroup.add(this.earthMesh);

    // Moon ("月") orbiting earth
    const moonTex = createCircleKanjiTexture('月', '#eab308', '#000000', '#fef08a', 256);
    const moonMat = new THREE.MeshBasicMaterial({
      map: moonTex,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    const moonGeo = new THREE.PlaneGeometry(0.30, 0.30);
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.position.set(0.52, 0, 0);
    this.earthGroup.add(this.moonMesh);

    group.add(this.earthGroup);

    // 4. "アオイ" Typography Billboard (Left behind in space)
    const aoiCvs = document.createElement('canvas');
    aoiCvs.width = 384;
    aoiCvs.height = 768;
    const aoiCtx = aoiCvs.getContext('2d')!;

    // Vertical text "アオイ" with bold white outline + black drop shadow
    aoiCtx.font = 'bold 155px "Shippori Mincho", "Yu Mincho", serif';
    aoiCtx.textAlign = 'center';
    aoiCtx.textBaseline = 'middle';

    const chars = ['ア', 'オ', 'イ'];
    // Outer black shadow
    aoiCtx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    aoiCtx.shadowBlur = 18;
    aoiCtx.lineWidth = 20;
    aoiCtx.strokeStyle = '#000000';
    chars.forEach((c, idx) => {
      const y = 180 + idx * 175;
      aoiCtx.strokeText(c, 192, y);
    });

    // White bold outline
    aoiCtx.shadowBlur = 0;
    aoiCtx.lineWidth = 14;
    aoiCtx.strokeStyle = '#ffffff';
    chars.forEach((c, idx) => {
      const y = 180 + idx * 175;
      aoiCtx.strokeText(c, 192, y);
    });

    // Amber fill
    aoiCtx.fillStyle = '#f59e0b';
    chars.forEach((c, idx) => {
      const y = 180 + idx * 175;
      aoiCtx.fillText(c, 192, y);
    });

    // Subtitle "AOI"
    aoiCtx.font = '800 38px "Montserrat", sans-serif';
    aoiCtx.strokeStyle = '#000000';
    aoiCtx.lineWidth = 8;
    aoiCtx.strokeText('AOI', 192, 700);
    aoiCtx.fillStyle = '#ffffff';
    aoiCtx.fillText('AOI', 192, 700);

    const aoiTex = new THREE.CanvasTexture(aoiCvs);
    aoiTex.colorSpace = THREE.SRGBColorSpace;
    this.texturesToDispose.push(aoiTex);

    const aoiMat = new THREE.MeshBasicMaterial({
      map: aoiTex,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const aoiGeo = new THREE.PlaneGeometry(0.65, 1.3);
    this.aoiGhostMesh = new THREE.Mesh(aoiGeo, aoiMat);
    this.aoiGhostMesh.name = 'ShaftAoiGhostMesh';
    this.aoiGhostMesh.visible = false;
    group.add(this.aoiGhostMesh);

    // 5. Shaft Minimal Cross Stars (+)
    const starCoords = [
      [-3.2, 2.0, -1.0],
      [3.0, 1.8, -1.2],
      [-2.5, -0.6, 0.8],
      [2.8, -0.4, 1.2],
      [-1.2, 2.5, -2.0],
      [1.5, 2.6, -1.8],
      [-3.5, 0.5, 0.2],
      [3.4, 0.8, -0.3],
      [-0.8, -0.8, 1.5],
      [0.9, -0.9, 1.6],
    ];
    for (const [sx, sy, sz] of starCoords) {
      const crossCanvas = document.createElement('canvas');
      crossCanvas.width = 64;
      crossCanvas.height = 64;
      const cctx = crossCanvas.getContext('2d')!;
      cctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      cctx.lineWidth = 4;
      cctx.beginPath();
      cctx.moveTo(32, 10);
      cctx.lineTo(32, 54);
      cctx.moveTo(10, 32);
      cctx.lineTo(54, 32);
      cctx.stroke();

      const crossTex = new THREE.CanvasTexture(crossCanvas);
      this.texturesToDispose.push(crossTex);
      const crossMat = new THREE.MeshBasicMaterial({
        map: crossTex,
        transparent: true,
        toneMapped: false,
        depthWrite: false,
      });
      const crossMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), crossMat);
      crossMesh.position.set(sx, sy, sz);
      group.add(crossMesh);
    }

    this.viewerCore.scene.add(group);
    this.spaceGroup = group;
  }

  /**
   * Switch space stage mode: 'orbit' (Sun & Earth), 'ghost_left_behind' (Aoi text stranded), or false.
   */
  public setSpaceStage(stage?: 'orbit' | 'ghost_left_behind' | false): void {
    const nextStage = stage || false;
    if (this.currentSpaceStage === nextStage) return;
    this.currentSpaceStage = nextStage;

    if (nextStage) {
      if (this.spaceGroup) {
        this.spaceGroup.visible = true;
      }
      if (this.stageGroup) {
        this.stageGroup.visible = false;
      }
      if (this.overlayEl) {
        this.overlayEl.style.display = 'none';
      }

      // Space background: pure black
      this.viewerCore.scene.background = new THREE.Color(0x000000);
      this.viewerCore.renderer.setClearColor(0x000000, 1.0);
      const container = document.getElementById('viewport-container');
      if (container) {
        container.style.backgroundColor = '#000000';
      }

      if (nextStage === 'ghost_left_behind') {
        if (this.aoiGhostMesh) {
          this.aoiGhostMesh.visible = true;
          // Fix AOI's position at the orbit where earth was passing
          // Earth will rapidly orbit away and leave AOI behind in space!
          this.aoiGhostPos.set(1.4, 0.7, 0.6);
          this.aoiGhostMesh.position.copy(this.aoiGhostPos);
          this.orbitAngle = 1.1;
        }
      } else {
        if (this.aoiGhostMesh) {
          this.aoiGhostMesh.visible = false;
        }
      }
    } else {
      if (this.spaceGroup) {
        this.spaceGroup.visible = false;
      }
      if (this.aoiGhostMesh) {
        this.aoiGhostMesh.visible = false;
      }

      // If shaftMode is still active, restore classroom stage and white background
      if (this.isActive) {
        if (this.stageGroup) {
          this.stageGroup.visible = true;
        }
        this.viewerCore.scene.background = new THREE.Color(0xffffff);
        this.viewerCore.renderer.setClearColor(0xffffff, 1.0);
        const container = document.getElementById('viewport-container');
        if (container) {
          container.style.backgroundColor = '#ffffff';
        }
        if (this.overlayEl) {
          this.overlayEl.style.display = 'block';
        }
      }
    }
  }

  /**
   * Determine character identity and color scheme:
   * Aoi -> Yellowish (#f59e0b)
   * Emili -> Reddish (#dc2626)
   * Shion -> Bluish (#2563eb)
   */
  public getCharacterInfoForAvatar(charIdOrUrl?: string): ShaftCharacterInfo {
    const key = (charIdOrUrl || '').toLowerCase();
    if (key.includes('aoi') || key.includes('girl_01')) {
      return { name: 'アオイ', color: '#f59e0b' }; // Amber/Gold yellow
    } else if (key.includes('emili') || key.includes('girl_02')) {
      return { name: 'エミリ', color: '#dc2626' }; // Crimson red
    } else if (key.includes('shion') || key.includes('girl_03')) {
      return { name: 'シオン', color: '#2563eb' }; // Blue
    }
    return { name: 'アバター', color: '#e11d48' };
  }

  /**
   * Determine character identity and color scheme:
   * Aoi -> Yellowish (#f59e0b)
   * Emili -> Reddish (#dc2626)
   * Shion -> Bluish (#2563eb)
   */
  public getCharacterInfo(): ShaftCharacterInfo {
    return this.getCharacterInfoForAvatar(this.avatarManager.currentModelUrl);
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

      // 3. Show typography overlay for all present avatars
      if (this.overlayEl) {
        this.overlayEl.style.display = 'block';
        if (this.avatarManager.isMultiAvatarScenarioActive && this.avatarManager.scenarioAvatars.size > 0) {
          for (const [charId] of this.avatarManager.scenarioAvatars.entries()) {
            const info = this.getCharacterInfoForAvatar(charId);
            const el = this.createOrGetLabelElement(charId, info.name);
            el.style.display = 'inline-block';
            el.style.transform = 'translate(-50%, -50%) scale(1.2)';
            requestAnimationFrame(() => {
              el.style.transform = 'translate(-50%, -50%) scale(1)';
            });
          }
        } else {
          const el = this.createOrGetLabelElement('single', charInfo.name);
          el.style.display = 'inline-block';
          el.style.transform = 'translate(-50%, -50%) scale(1.2)';
          requestAnimationFrame(() => {
            el.style.transform = 'translate(-50%, -50%) scale(1)';
          });
        }
      }
    } else {
      // Restore avatar
      this.avatarManager.setSolidColorMode(false);

      // Restore stage & backgrounds
      if (this.stageGroup) {
        this.stageGroup.visible = false;
      }
      this.setSpaceStage(false);

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

      // Hide overlay and all labels
      if (this.overlayEl) {
        this.overlayEl.style.display = 'none';
      }
      for (const el of this.labelElements.values()) {
        el.style.display = 'none';
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

    if (this.avatarManager.isMultiAvatarScenarioActive && this.avatarManager.scenarioAvatars.size > 0) {
      for (const [charId] of this.avatarManager.scenarioAvatars.entries()) {
        const info = this.getCharacterInfoForAvatar(charId);
        this.createOrGetLabelElement(charId, info.name);
      }
    } else {
      this.createOrGetLabelElement('single', charInfo.name);
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
   * Update text positions every frame to track each avatar's head/chest, or animate space stage.
   */
  public update(): void {
    if (!this.isActive) return;

    // 1. Update space stage animation if active
    if (this.currentSpaceStage && this.spaceGroup?.visible) {
      if (
        this.viewerCore.scene.background === null ||
        !(this.viewerCore.scene.background as any).isColor ||
        (this.viewerCore.scene.background as THREE.Color).getHex() !== 0x000000
      ) {
        this.viewerCore.scene.background = new THREE.Color(0x000000);
      }

      // Fast surreal orbit speed (shaft style rapid movement)
      this.orbitAngle += 0.045;
      const orbitRadiusX = 2.35;
      const orbitRadiusZ = 1.75;

      if (this.earthGroup) {
        const ex = Math.cos(this.orbitAngle) * orbitRadiusX;
        const ez = Math.sin(this.orbitAngle) * orbitRadiusZ;
        this.earthGroup.position.set(ex, 0.4, ez);

        // Moon orbit around Earth
        if (this.moonMesh) {
          const moonAngle = this.orbitAngle * 4;
          this.moonMesh.position.set(
            Math.cos(moonAngle) * 0.55,
            Math.sin(moonAngle) * 0.25,
            Math.sin(moonAngle) * 0.35
          );
        }
      }

      // Billboard orientation towards camera for 2D flat typography discs
      const cam = this.viewerCore.camera;
      if (this.sunMesh) {
        this.sunMesh.quaternion.copy(cam.quaternion);
      }
      if (this.earthMesh) {
        this.earthMesh.quaternion.copy(cam.quaternion);
      }
      if (this.moonMesh) {
        this.moonMesh.quaternion.copy(cam.quaternion);
      }

      // AOI text billboard & slight floating vibration
      if (this.currentSpaceStage === 'ghost_left_behind' && this.aoiGhostMesh?.visible) {
        this.aoiGhostMesh.quaternion.copy(cam.quaternion);
        const floatOffset = Math.sin(Date.now() * 0.003) * 0.04;
        this.aoiGhostMesh.position.y = this.aoiGhostPos.y + floatOffset;
      }

      return;
    }

    if (!this.overlayEl) return;

    // Guarantee pure white background even if an async background load resolves
    if (this.viewerCore.skyBackground.mesh.visible) {
      this.viewerCore.skyBackground.mesh.visible = false;
    }
    if (this.viewerCore.scene.background === null || !(this.viewerCore.scene.background as any).isColor) {
      this.viewerCore.scene.background = new THREE.Color(0xffffff);
    }

    const camera = this.viewerCore.camera;

    if (this.avatarManager.isMultiAvatarScenarioActive && this.avatarManager.scenarioAvatars.size > 0) {
      for (const [charId, av] of this.avatarManager.scenarioAvatars.entries()) {
        const info = this.getCharacterInfoForAvatar(charId);
        const el = this.createOrGetLabelElement(charId, info.name);

        if (!av?.vrm || !av.getVisible() || !av.vrm.scene.visible) {
          el.style.display = 'none';
          continue;
        }

        // Target head bone or neck
        const headNode =
          av.vrm.humanoid?.getNormalizedBoneNode('head') ||
          av.vrm.humanoid?.getNormalizedBoneNode('neck');

        const targetPos = new THREE.Vector3();
        if (headNode) {
          headNode.getWorldPosition(targetPos);
          targetPos.y -= 0.10; // Lower towards face/neck center
        } else {
          av.vrm.scene.getWorldPosition(targetPos);
          targetPos.y += 1.25;
        }

        const projected = targetPos.clone().project(camera);

        // Convert normalized device coords (-1 to +1) to screen percentage
        const x = (projected.x * 0.5 + 0.5) * 100;
        const y = (-projected.y * 0.5 + 0.5) * 100;

        // Check if behind camera or far offscreen
        if (projected.z > 1.0 || projected.x < -1.05 || projected.x > 1.05) {
          el.style.display = 'none';
        } else {
          el.style.display = 'inline-block';
          el.style.left = `${x.toFixed(1)}%`;
          el.style.top = `${y.toFixed(1)}%`;
        }
      }
    } else {
      const avatar = this.avatarManager.avatarInstance;
      const charInfo = this.getCharacterInfo();
      const el = this.createOrGetLabelElement('single', charInfo.name);

      if (!avatar?.vrm || !avatar.getVisible() || !avatar.vrm.scene.visible) {
        el.style.display = 'none';
        return;
      }

      // Target head bone or neck
      const headNode =
        avatar.vrm.humanoid?.getNormalizedBoneNode('head') ||
        avatar.vrm.humanoid?.getNormalizedBoneNode('neck');

      const targetPos = new THREE.Vector3();
      if (headNode) {
        headNode.getWorldPosition(targetPos);
        targetPos.y -= 0.10; // Lower towards face/neck center
      } else {
        avatar.vrm.scene.getWorldPosition(targetPos);
        targetPos.y += 1.25;
      }

      const camera = this.viewerCore.camera;
      const projected = targetPos.clone().project(camera);

      // Convert normalized device coords (-1 to +1) to screen percentage
      const x = (projected.x * 0.5 + 0.5) * 100;
      const y = (-projected.y * 0.5 + 0.5) * 100;

      // Check if behind camera or far offscreen
      if (projected.z > 1.0 || projected.x < -1.05 || projected.x > 1.05) {
        el.style.display = 'none';
      } else {
        el.style.display = 'inline-block';
        el.style.left = `${x.toFixed(1)}%`;
        el.style.top = `${y.toFixed(1)}%`;
      }
    }
  }

  public dispose(): void {
    if (this.isActive) {
      this.setShaftMode(false);
    }
    this.setSpaceStage(false);
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.labelElements.clear();
    if (this.stageGroup) {
      this.viewerCore.scene.remove(this.stageGroup);
    }
    if (this.spaceGroup) {
      this.viewerCore.scene.remove(this.spaceGroup);
    }
    this.texturesToDispose.forEach((tex) => tex.dispose());
    this.texturesToDispose = [];
  }
}
