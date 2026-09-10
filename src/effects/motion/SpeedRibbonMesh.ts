import * as THREE from 'three';
import { FastMotionConfig, LimbType, LimbHistorySample } from './types';

const SEGMENTS_PER_STRAND = 28;
const MAX_STRANDS_PER_LIMB = 4;
const MAX_VERTS_PER_STRAND = (SEGMENTS_PER_STRAND + 1) * 2;
const MAX_INDICES_PER_STRAND = SEGMENTS_PER_STRAND * 6;

const SPEED_RIBBON_VERTEX_SHADER = /* glsl */ `
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vAlpha = aAlpha;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPEED_RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uMainColor;
  uniform vec3 uAccentColor;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    if (vAlpha <= 0.005) discard;

    // Anime speed streak cross-section: bright sharp center tapering to soft edges
    float distFromCenter = abs(vUv.x - 0.5) * 2.0;
    float crossProfile = clamp(1.0 - pow(distFromCenter, 1.6), 0.0, 1.0);

    // Subtle longitudinal striations (anime speed pen strokes)
    float streakStria = 0.85 + 0.15 * sin(vUv.y * 55.0 + vUv.x * 12.0);

    float finalAlpha = vAlpha * crossProfile * streakStria;
    if (finalAlpha <= 0.01) discard;

    // Gradient from accent color to glowing white center
    vec3 color = mix(uAccentColor, uMainColor, pow(crossProfile, 0.75));
    color = mix(color, vColor, 0.5);

    gl_FragColor = vec4(color, finalAlpha);
  }
`;

interface StrandGeometryData {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  uvs: Float32Array;
  alphas: Float32Array;
  colors: Float32Array;
  mesh: THREE.Mesh;
}

export class SpeedRibbonMesh {
  private group: THREE.Group;
  private config: FastMotionConfig;
  private material: THREE.ShaderMaterial;

  // Limb -> Array of StrandGeometryData
  private strandsByLimb: Map<LimbType, StrandGeometryData[]> = new Map();

  // Temporary computation scratchpads
  private _cameraPos = new THREE.Vector3();
  private _tangent = new THREE.Vector3();
  private _viewVec = new THREE.Vector3();
  private _sideVec = new THREE.Vector3();
  private _pointP = new THREE.Vector3();
  private _pointPrev = new THREE.Vector3();
  private _pointNext = new THREE.Vector3();
  private _interpolatedPos = new THREE.Vector3();
  private _strandOffset = new THREE.Vector3();
  private _mainColor = new THREE.Color();
  private _accentColor = new THREE.Color();

  constructor(config: FastMotionConfig) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = 'SpeedRibbonEffects';

    this._mainColor.set(config.effectColor);
    this._accentColor.set(config.accentColor);

    this.material = new THREE.ShaderMaterial({
      vertexShader: SPEED_RIBBON_VERTEX_SHADER,
      fragmentShader: SPEED_RIBBON_FRAGMENT_SHADER,
      uniforms: {
        uMainColor: { value: this._mainColor },
        uAccentColor: { value: this._accentColor },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.initGeometries();
  }

  private initGeometries(): void {
    const limbTypes: LimbType[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

    for (const limb of limbTypes) {
      const strands: StrandGeometryData[] = [];

      for (let s = 0; s < MAX_STRANDS_PER_LIMB; s++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(MAX_VERTS_PER_STRAND * 3);
        const uvs = new Float32Array(MAX_VERTS_PER_STRAND * 2);
        const alphas = new Float32Array(MAX_VERTS_PER_STRAND);
        const colors = new Float32Array(MAX_VERTS_PER_STRAND * 3);

        const indices = new Uint16Array(MAX_INDICES_PER_STRAND);
        let indexOffset = 0;
        for (let i = 0; i < SEGMENTS_PER_STRAND; i++) {
          const v0 = i * 2;
          const v1 = i * 2 + 1;
          const v2 = (i + 1) * 2;
          const v3 = (i + 1) * 2 + 1;

          indices[indexOffset++] = v0;
          indices[indexOffset++] = v1;
          indices[indexOffset++] = v2;

          indices[indexOffset++] = v2;
          indices[indexOffset++] = v1;
          indices[indexOffset++] = v3;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.setDrawRange(0, 0);

        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 3; // Render crisp speed lines in front of character meshes
        this.group.add(mesh);

        strands.push({
          geometry,
          positions,
          uvs,
          alphas,
          colors,
          mesh,
        });
      }

      this.strandsByLimb.set(limb, strands);
    }
  }

  public getRootObject(): THREE.Group {
    return this.group;
  }

  public updateConfig(config: FastMotionConfig): void {
    this.config = config;
    this._mainColor.set(config.effectColor);
    this._accentColor.set(config.accentColor);
    this.material.uniforms.uMainColor.value.copy(this._mainColor);
    this.material.uniforms.uAccentColor.value.copy(this._accentColor);
  }

  public update(
    limb: LimbType,
    history: LimbHistorySample[],
    intensity: number,
    camera: THREE.Camera
  ): void {
    const strands = this.strandsByLimb.get(limb);
    if (!strands) return;

    if (!this.config.enabled || !this.config.speedLinesEnabled || intensity <= 0.02 || history.length < 3) {
      for (const strand of strands) {
        strand.geometry.setDrawRange(0, 0);
        strand.mesh.visible = false;
      }
      return;
    }

    camera.getWorldPosition(this._cameraPos);

    const ribbonCount = Math.min(this.config.ribbonCount, MAX_STRANDS_PER_LIMB);
    const nSamples = history.length;

    // Strands definition:
    // Strand 0: Main wrist/foot trajectory (thickest, central)
    // Strand 1: Secondary offset wrist/foot line (slightly offset + jitter)
    // Strand 2: Third wrist line (slightly higher/lateral)
    // Strand 3: Mid-joint (elbow/knee) trajectory to emphasize whole arm/leg swing
    const strandConfigs = [
      { useMidJoint: false, offsetScale: 0.0, widthScale: 1.0, alphaScale: 1.0 },
      { useMidJoint: false, offsetScale: 1.0, widthScale: 0.75, alphaScale: 0.85 },
      { useMidJoint: false, offsetScale: -1.0, widthScale: 0.65, alphaScale: 0.75 },
      { useMidJoint: true,  offsetScale: 0.0, widthScale: 0.7, alphaScale: 0.65 },
    ];

    for (let s = 0; s < MAX_STRANDS_PER_LIMB; s++) {
      const strand = strands[s];
      if (s >= ribbonCount) {
        strand.geometry.setDrawRange(0, 0);
        strand.mesh.visible = false;
        continue;
      }

      strand.mesh.visible = true;
      const sCfg = strandConfigs[s];

      let vertIndex = 0;
      let posOffset = 0;
      let uvOffset = 0;
      let alphaOffset = 0;
      let colorOffset = 0;

      for (let seg = 0; seg <= SEGMENTS_PER_STRAND; seg++) {
        // progress along trail: 0 = oldest (tail), 1 = current (head)
        const u = seg / SEGMENTS_PER_STRAND;

        // Sample position along history
        const sampleF = u * (nSamples - 1);
        const idx0 = Math.floor(sampleF);
        const idx1 = Math.min(idx0 + 1, nSamples - 1);
        const frac = sampleF - idx0;

        const sampA = history[idx0];
        const sampB = history[idx1];

        const pA = sCfg.useMidJoint ? sampA.midPos : sampA.tipPos;
        const pB = sCfg.useMidJoint ? sampB.midPos : sampB.tipPos;
        this._interpolatedPos.lerpVectors(pA, pB, frac);

        // Tangent calculation
        const idxPrev = Math.max(0, idx0 - 1);
        const idxNext = Math.min(nSamples - 1, idx1 + 1);
        const pPrev = sCfg.useMidJoint ? history[idxPrev].midPos : history[idxPrev].tipPos;
        const pNext = sCfg.useMidJoint ? history[idxNext].midPos : history[idxNext].tipPos;

        this._tangent.subVectors(pNext, pPrev);
        if (this._tangent.lengthSq() < 0.000001) {
          this._tangent.set(0, 1, 0);
        } else {
          this._tangent.normalize();
        }

        // Camera view vector
        this._viewVec.subVectors(this._interpolatedPos, this._cameraPos).normalize();

        // Cross product produces ribbon width vector facing camera
        this._sideVec.crossVectors(this._tangent, this._viewVec);
        if (this._sideVec.lengthSq() < 0.000001) {
          this._sideVec.set(1, 0, 0);
        } else {
          this._sideVec.normalize();
        }

        // Tapered width: zero at tail, maxWidth at head
        const taper = Math.pow(u, 1.4);
        const width = this.config.ribbonMaxWidth * sCfg.widthScale * taper * intensity;

        // Strand lateral separation offset
        const latOffsetDist = this.config.ribbonMaxWidth * 0.5 * sCfg.offsetScale;
        this._strandOffset.copy(this._sideVec).multiplyScalar(latOffsetDist);

        // Slight forward bias towards camera to avoid intersecting avatar mesh
        const forwardOffsetDist = -0.015;
        this._pointP.copy(this._interpolatedPos)
          .add(this._strandOffset)
          .addScaledVector(this._viewVec, forwardOffsetDist);

        // Compute left and right ribbon edge positions
        const halfW = width * 0.5;
        const lx = this._pointP.x + this._sideVec.x * halfW;
        const ly = this._pointP.y + this._sideVec.y * halfW;
        const lz = this._pointP.z + this._sideVec.z * halfW;

        const rx = this._pointP.x - this._sideVec.x * halfW;
        const ry = this._pointP.y - this._sideVec.y * halfW;
        const rz = this._pointP.z - this._sideVec.z * halfW;

        // Alpha falloff: bright at head, faded at tail
        const alpha = Math.pow(u, 0.9) * intensity * sCfg.alphaScale;

        // Vertex 0 (left edge)
        strand.positions[posOffset++] = lx;
        strand.positions[posOffset++] = ly;
        strand.positions[posOffset++] = lz;
        strand.uvs[uvOffset++] = 0;
        strand.uvs[uvOffset++] = u;
        strand.alphas[alphaOffset++] = alpha;
        strand.colors[colorOffset++] = this._mainColor.r;
        strand.colors[colorOffset++] = this._mainColor.g;
        strand.colors[colorOffset++] = this._mainColor.b;

        // Vertex 1 (right edge)
        strand.positions[posOffset++] = rx;
        strand.positions[posOffset++] = ry;
        strand.positions[posOffset++] = rz;
        strand.uvs[uvOffset++] = 1;
        strand.uvs[uvOffset++] = u;
        strand.alphas[alphaOffset++] = alpha;
        strand.colors[colorOffset++] = this._mainColor.r;
        strand.colors[colorOffset++] = this._mainColor.g;
        strand.colors[colorOffset++] = this._mainColor.b;

        vertIndex += 2;
      }

      strand.geometry.attributes.position.needsUpdate = true;
      strand.geometry.attributes.uv.needsUpdate = true;
      (strand.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      (strand.geometry.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      strand.geometry.setDrawRange(0, SEGMENTS_PER_STRAND * 6);
    }
  }

  public hideAll(): void {
    for (const strands of this.strandsByLimb.values()) {
      for (const strand of strands) {
        strand.geometry.setDrawRange(0, 0);
        strand.mesh.visible = false;
      }
    }
  }

  public dispose(): void {
    this.hideAll();
    for (const strands of this.strandsByLimb.values()) {
      for (const strand of strands) {
        strand.geometry.dispose();
        if (strand.mesh.parent) {
          strand.mesh.parent.remove(strand.mesh);
        }
      }
    }
    this.strandsByLimb.clear();
    this.material.dispose();
  }
}
