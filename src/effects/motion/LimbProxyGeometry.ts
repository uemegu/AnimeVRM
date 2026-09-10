import * as THREE from 'three';
import { LimbType } from './types';

export interface ProxyLimbDimensions {
  rootRadius: number;
  midRadius: number;
  tipRadius: number;
  tipEndExtension: number;
}

export const LIMB_DIMENSIONS: Record<LimbType, ProxyLimbDimensions> = {
  leftArm: {
    rootRadius: 0.046,
    midRadius: 0.038,
    tipRadius: 0.032,
    tipEndExtension: 0.10,
  },
  rightArm: {
    rootRadius: 0.046,
    midRadius: 0.038,
    tipRadius: 0.032,
    tipEndExtension: 0.10,
  },
  leftLeg: {
    rootRadius: 0.068,
    midRadius: 0.054,
    tipRadius: 0.044,
    tipEndExtension: 0.12,
  },
  rightLeg: {
    rootRadius: 0.068,
    midRadius: 0.054,
    tipRadius: 0.044,
    tipEndExtension: 0.12,
  },
};

const PROXY_SUBDIVISIONS = 8; // Number of longitudinal cross-sections along the whole limb
const TOTAL_VERTS = (PROXY_SUBDIVISIONS + 1) * 2;
const TOTAL_INDICES = PROXY_SUBDIVISIONS * 6;

export class LimbProxyGeometry {
  public geometry: THREE.BufferGeometry;
  public positions: Float32Array;
  public uvs: Float32Array;
  public limbType: LimbType;

  private _cameraPos = new THREE.Vector3();
  private _tipEnd = new THREE.Vector3();
  private _samplePoint = new THREE.Vector3();
  private _tangent = new THREE.Vector3();
  private _viewVec = new THREE.Vector3();
  private _sideVec = new THREE.Vector3();
  private _pointP = new THREE.Vector3();

  constructor(limbType: LimbType) {
    this.limbType = limbType;
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(TOTAL_VERTS * 3);
    this.uvs = new Float32Array(TOTAL_VERTS * 2);

    const indices = new Uint16Array(TOTAL_INDICES);
    let idx = 0;
    for (let i = 0; i < PROXY_SUBDIVISIONS; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      indices[idx++] = v0;
      indices[idx++] = v1;
      indices[idx++] = v2;

      indices[idx++] = v2;
      indices[idx++] = v1;
      indices[idx++] = v3;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);
  }

  public update(
    rootPos: THREE.Vector3,
    midPos: THREE.Vector3,
    tipPos: THREE.Vector3,
    camera: THREE.Camera,
    radiusScale: number = 1.0,
    offsetVec?: THREE.Vector3,
    options?: { ankleOnly?: boolean }
  ): void {
    camera.getWorldPosition(this._cameraPos);

    let dims = LIMB_DIMENSIONS[this.limbType];
    if (options?.ankleOnly && (this.limbType === 'leftLeg' || this.limbType === 'rightLeg')) {
      dims = {
        rootRadius: 0.038,
        midRadius: 0.036,
        tipRadius: 0.032,
        tipEndExtension: 0.05,
      };
    }

    // Compute hand/foot tip extension
    this._tangent.subVectors(tipPos, midPos).normalize();
    this._tipEnd.copy(tipPos).addScaledVector(this._tangent, dims.tipEndExtension);

    // 4 key points: Root, Mid, Tip, TipEnd
    const points = [rootPos, midPos, tipPos, this._tipEnd];
    const radii = [
      dims.rootRadius * radiusScale,
      dims.midRadius * radiusScale,
      dims.tipRadius * radiusScale,
      dims.tipRadius * 0.5 * radiusScale,
    ];

    let posIdx = 0;
    let uvIdx = 0;

    for (let i = 0; i <= PROXY_SUBDIVISIONS; i++) {
      const t = i / PROXY_SUBDIVISIONS; // 0 (root) to 1 (tipEnd)

      // Map t to segment index (0 to 2)
      const segFloat = t * 2.9999;
      const segIdx = Math.min(2, Math.floor(segFloat));
      const segT = segFloat - segIdx;

      const p0 = points[segIdx];
      const p1 = points[segIdx + 1];
      const r0 = radii[segIdx];
      const r1 = radii[segIdx + 1];

      this._samplePoint.lerpVectors(p0, p1, segT);
      const radius = THREE.MathUtils.lerp(r0, r1, segT);

      // Tangent direction along limb segment
      this._tangent.subVectors(p1, p0).normalize();

      // Camera view direction
      this._viewVec.subVectors(this._samplePoint, this._cameraPos).normalize();

      // Side vector facing camera
      this._sideVec.crossVectors(this._tangent, this._viewVec);
      if (this._sideVec.lengthSq() < 0.000001) {
        this._sideVec.set(1, 0, 0);
      } else {
        this._sideVec.normalize();
      }

      this._pointP.copy(this._samplePoint);
      if (offsetVec) {
        this._pointP.add(offsetVec);
      }

      // Left edge
      this.positions[posIdx++] = this._pointP.x + this._sideVec.x * radius;
      this.positions[posIdx++] = this._pointP.y + this._sideVec.y * radius;
      this.positions[posIdx++] = this._pointP.z + this._sideVec.z * radius;
      this.uvs[uvIdx++] = 0;
      this.uvs[uvIdx++] = t;

      // Right edge
      this.positions[posIdx++] = this._pointP.x - this._sideVec.x * radius;
      this.positions[posIdx++] = this._pointP.y - this._sideVec.y * radius;
      this.positions[posIdx++] = this._pointP.z - this._sideVec.z * radius;
      this.uvs[uvIdx++] = 1;
      this.uvs[uvIdx++] = t;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.setDrawRange(0, TOTAL_INDICES);
  }

  public hide(): void {
    this.geometry.setDrawRange(0, 0);
  }

  public dispose(): void {
    this.geometry.dispose();
  }
}
