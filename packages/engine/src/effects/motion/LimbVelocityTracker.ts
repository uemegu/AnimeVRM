import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { FastMotionConfig, LimbType, LimbJointNodes, LimbHistorySample } from './types';

const MAX_HISTORY_SAMPLES = 64;

interface LimbState {
  type: LimbType;
  nodes: LimbJointNodes | null;
  history: LimbHistorySample[];
  historyCount: number;
  prevTipPos: THREE.Vector3;
  prevMidPos: THREE.Vector3;
  prevRootPos: THREE.Vector3;
  currentTipPos: THREE.Vector3;
  currentMidPos: THREE.Vector3;
  currentRootPos: THREE.Vector3;
  relativeTipVel: THREE.Vector3;
  relativeMidVel: THREE.Vector3;
  relativeRootVel: THREE.Vector3;
  speed: number;
  isActive: boolean;
  intensity: number;
  initialized: boolean;
}

export class LimbVelocityTracker {
  private vrm: VRM;
  private config: FastMotionConfig;

  private bodyNode: THREE.Object3D | null = null;
  private prevBodyPos = new THREE.Vector3();
  private currentBodyPos = new THREE.Vector3();
  private bodyDelta = new THREE.Vector3();
  private bodyInitialized = false;

  private limbs: Map<LimbType, LimbState> = new Map();

  // Reusable scratch vectors to prevent GC allocations
  private _tmpVecA = new THREE.Vector3();
  private _tmpVecB = new THREE.Vector3();

  constructor(vrm: VRM, config: FastMotionConfig) {
    this.vrm = vrm;
    this.config = config;

    this.initBones();
  }

  public initBones(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    // Body reference bone (prefer chest, fallback to upperChest or hips)
    this.bodyNode =
      humanoid.getNormalizedBoneNode('chest') ||
      humanoid.getNormalizedBoneNode('upperChest') ||
      humanoid.getNormalizedBoneNode('hips') ||
      null;

    const createLimbState = (
      type: LimbType,
      rootName: 'leftUpperArm' | 'rightUpperArm' | 'leftUpperLeg' | 'rightUpperLeg',
      midName: 'leftLowerArm' | 'rightLowerArm' | 'leftLowerLeg' | 'rightLowerLeg',
      tipName: 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot'
    ): LimbState => {
      const root = humanoid.getNormalizedBoneNode(rootName);
      const mid = humanoid.getNormalizedBoneNode(midName);
      const tip = humanoid.getNormalizedBoneNode(tipName);

      // Pre-allocate history sample pool to eliminate GC allocations
      const history: LimbHistorySample[] = [];
      for (let i = 0; i < MAX_HISTORY_SAMPLES; i++) {
        history.push({
          time: 0,
          rootPos: new THREE.Vector3(),
          midPos: new THREE.Vector3(),
          tipPos: new THREE.Vector3(),
          relativeTipVel: new THREE.Vector3(),
          relativeMidVel: new THREE.Vector3(),
          relativeRootVel: new THREE.Vector3(),
          speed: 0,
        });
      }

      return {
        type,
        nodes: root && mid && tip ? { root, mid, tip } : null,
        history,
        historyCount: 0,
        prevTipPos: new THREE.Vector3(),
        prevMidPos: new THREE.Vector3(),
        prevRootPos: new THREE.Vector3(),
        currentTipPos: new THREE.Vector3(),
        currentMidPos: new THREE.Vector3(),
        currentRootPos: new THREE.Vector3(),
        relativeTipVel: new THREE.Vector3(),
        relativeMidVel: new THREE.Vector3(),
        relativeRootVel: new THREE.Vector3(),
        speed: 0,
        isActive: false,
        intensity: 0,
        initialized: false,
      };
    };

    this.limbs.set('leftArm', createLimbState('leftArm', 'leftUpperArm', 'leftLowerArm', 'leftHand'));
    this.limbs.set('rightArm', createLimbState('rightArm', 'rightUpperArm', 'rightLowerArm', 'rightHand'));
    this.limbs.set('leftLeg', createLimbState('leftLeg', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot'));
    this.limbs.set('rightLeg', createLimbState('rightLeg', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'));

    this.bodyInitialized = false;
  }

  public updateConfig(config: FastMotionConfig): void {
    this.config = config;
  }

  public update(delta: number, currentTime: number): void {
    if (!this.config.enabled || delta <= 0.0001) return;

    // 1. Calculate body reference motion
    if (this.bodyNode) {
      this.bodyNode.getWorldPosition(this.currentBodyPos);
      if (!this.bodyInitialized) {
        this.prevBodyPos.copy(this.currentBodyPos);
        this.bodyDelta.set(0, 0, 0);
        this.bodyInitialized = true;
      } else {
        this.bodyDelta.subVectors(this.currentBodyPos, this.prevBodyPos);
        this.prevBodyPos.copy(this.currentBodyPos);
      }
    } else {
      this.bodyDelta.set(0, 0, 0);
    }

    const invDelta = 1.0 / Math.max(delta, 0.001);

    // 2. Track each limb
    for (const [limbType, state] of this.limbs.entries()) {
      const isArm = limbType === 'leftArm' || limbType === 'rightArm';
      const isLeg = limbType === 'leftLeg' || limbType === 'rightLeg';

      if ((isArm && !this.config.enableArms) || (isLeg && !this.config.enableLegs)) {
        state.isActive = false;
        state.intensity = 0;
        state.historyCount = 0;
        continue;
      }

      if (!state.nodes) continue;

      // Extract world positions
      state.nodes.root.getWorldPosition(state.currentRootPos);
      state.nodes.mid.getWorldPosition(state.currentMidPos);
      state.nodes.tip.getWorldPosition(state.currentTipPos);

      if (!state.initialized) {
        state.prevRootPos.copy(state.currentRootPos);
        state.prevMidPos.copy(state.currentMidPos);
        state.prevTipPos.copy(state.currentTipPos);
        state.initialized = true;
        continue;
      }

      // Relative displacement (subtracting whole-body translation)
      this._tmpVecA.subVectors(state.currentTipPos, state.prevTipPos).sub(this.bodyDelta);
      state.relativeTipVel.copy(this._tmpVecA).multiplyScalar(invDelta);

      this._tmpVecB.subVectors(state.currentMidPos, state.prevMidPos).sub(this.bodyDelta);
      state.relativeMidVel.copy(this._tmpVecB).multiplyScalar(invDelta);

      this._tmpVecA.subVectors(state.currentRootPos, state.prevRootPos).sub(this.bodyDelta);
      state.relativeRootVel.copy(this._tmpVecA).multiplyScalar(invDelta);

      // Tip relative speed in m/s
      state.speed = state.relativeTipVel.length();

      // Hysteresis threshold logic:
      // Start effect above minSpeed, stop only when dropping below stopSpeed
      if (state.speed >= this.config.minSpeed) {
        state.isActive = true;
      } else if (state.speed <= this.config.stopSpeed) {
        state.isActive = false;
      }

      // Normalized target intensity
      let targetIntensity = 0;
      if (state.isActive) {
        const span = Math.max(this.config.maxSpeed - this.config.stopSpeed, 0.1);
        targetIntensity = THREE.MathUtils.clamp((state.speed - this.config.stopSpeed) / span, 0, 1);
      }

      // Smooth intensity transition (fast attack, natural smooth decay)
      const lerpSpeed = targetIntensity > state.intensity ? 25.0 : 12.0;
      state.intensity = THREE.MathUtils.damp(state.intensity, targetIntensity, lerpSpeed, delta);

      // Store in ring buffer when active or decaying
      if (state.intensity > 0.01 || state.isActive) {
        this.addHistorySample(state, currentTime);
      }

      // Prune history samples older than trailDuration
      this.pruneHistory(state, currentTime);

      // Save previous positions
      state.prevRootPos.copy(state.currentRootPos);
      state.prevMidPos.copy(state.currentMidPos);
      state.prevTipPos.copy(state.currentTipPos);
    }
  }

  private addHistorySample(state: LimbState, currentTime: number): void {
    // If pool is full, shift left to keep chronological order
    if (state.historyCount >= MAX_HISTORY_SAMPLES) {
      const first = state.history.shift()!;
      state.history.push(first);
      state.historyCount = MAX_HISTORY_SAMPLES - 1;
    }

    const sample = state.history[state.historyCount];
    sample.time = currentTime;
    sample.rootPos.copy(state.currentRootPos);
    sample.midPos.copy(state.currentMidPos);
    sample.tipPos.copy(state.currentTipPos);
    sample.relativeTipVel.copy(state.relativeTipVel);
    sample.relativeMidVel.copy(state.relativeMidVel);
    sample.relativeRootVel.copy(state.relativeRootVel);
    sample.speed = state.speed;

    state.historyCount++;
  }

  private pruneHistory(state: LimbState, currentTime: number): void {
    const minTime = currentTime - this.config.trailDuration;
    let validCount = 0;

    for (let i = 0; i < state.historyCount; i++) {
      if (state.history[i].time >= minTime) {
        if (i !== validCount) {
          // Swap positions in array
          const temp = state.history[validCount];
          state.history[validCount] = state.history[i];
          state.history[i] = temp;
        }
        validCount++;
      }
    }
    state.historyCount = validCount;
  }

  public getHistory(limbType: LimbType): LimbHistorySample[] {
    const state = this.limbs.get(limbType);
    if (!state) return [];
    return state.history.slice(0, state.historyCount);
  }

  public getIntensity(limbType: LimbType): number {
    return this.limbs.get(limbType)?.intensity ?? 0;
  }

  public getSpeed(limbType: LimbType): number {
    return this.limbs.get(limbType)?.speed ?? 0;
  }

  public isActive(limbType: LimbType): boolean {
    return this.limbs.get(limbType)?.isActive ?? false;
  }

  public getCurrentPositions(limbType: LimbType): { root: THREE.Vector3; mid: THREE.Vector3; tip: THREE.Vector3 } | null {
    const state = this.limbs.get(limbType);
    if (!state || !state.initialized) return null;
    return {
      root: state.currentRootPos,
      mid: state.currentMidPos,
      tip: state.currentTipPos,
    };
  }

  public getCurrentVelocities(limbType: LimbType): { root: THREE.Vector3; mid: THREE.Vector3; tip: THREE.Vector3 } | null {
    const state = this.limbs.get(limbType);
    if (!state || !state.initialized) return null;
    return {
      root: state.relativeRootVel,
      mid: state.relativeMidVel,
      tip: state.relativeTipVel,
    };
  }

  public reset(): void {
    for (const state of this.limbs.values()) {
      state.historyCount = 0;
      state.isActive = false;
      state.intensity = 0;
      state.initialized = false;
    }
    this.bodyInitialized = false;
  }
}
