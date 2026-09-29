import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { applyToonShader, type ToonShaderController } from '@anime-vrm/engine/ToonShader';
import { loadMixamoAnimation } from '@anime-vrm/engine/stage/StageAvatar';
import { applySmoothNormalsToHierarchy } from '@anime-vrm/engine/shader/SmoothNormalHelper';
import type { HairShadowUniforms } from '@anime-vrm/engine/shader/HairShadow';
import type { FloatingIsland } from './FloatingIsland';
import { LegIK, lookAtWithNeckAndHead } from './BodyIK';
// アプリと同じリップシンク（AudioWorklet 上の WASM で母音を解析）
import { AudioLipSync, PHONEMES } from '../../../app/src/services/audio/AudioLipSync';
import { resolveAssetUrl } from '../../../app/src/utils/path';

export type FighterId = 'aoi' | 'emili';
export type FighterState = 'ready' | 'attack' | 'stumble' | 'falling' | 'in_water' | 'won';
export type AttackType = 'normal' | 'heavy' | 'jump' | 'quick';
export type HitSeverity = 'light' | 'normal' | 'spin' | 'heavy';

export interface VoiceCue {
  url: string;
  text: string;
}

export interface FighterConfig {
  id: FighterId;
  name: string;
  themeColor: string;
  modelUrl: string;
  initialPos: THREE.Vector3;
  initialRotY: number;
  voices: {
    attack: VoiceCue[];
    hit: VoiceCue[];
    fall: VoiceCue[];
    win: VoiceCue[];
    ready?: VoiceCue[];
  };
}

export interface AttackConfig {
  motion: string;
  duration: number;
  impactTime: number;      // お尻を最も突き出すインパクト時刻（秒）
  lungeDistance: number;   // 相手に向かって踏み込む距離（メートル）
  pushPower: number;
  impulseY: number;
  severity: HitSeverity;
  expression: string;
}

export const ATTACK_CONFIGS: Record<AttackType, AttackConfig> = {
  quick: {
    motion: 'attack_quick',
    duration: 0.85,
    impactTime: 0.28,
    lungeDistance: 0.22,
    pushPower: 2.2,
    impulseY: -1.2,
    severity: 'light',
    expression: 'angry',
  },
  normal: {
    motion: 'attack_normal',
    duration: 1.15,
    impactTime: 0.38,
    lungeDistance: 0.30,
    pushPower: 3.2,
    impulseY: -1.8,
    severity: 'normal',
    expression: 'angry',
  },
  jump: {
    motion: 'attack_jump',
    duration: 1.25,
    impactTime: 0.46,
    lungeDistance: 0.36,
    pushPower: 4.0,
    impulseY: -2.4,
    severity: 'spin',
    expression: 'angry',
  },
  heavy: {
    motion: 'attack_heavy',
    duration: 1.45,
    impactTime: 0.58,
    lungeDistance: 0.44,
    pushPower: 4.8,
    impulseY: -3.2,
    severity: 'heavy',
    expression: 'angry',
  },
};

export interface HitConfig {
  motion: string;
  duration: number;
  expression: string;
}

export const HIT_CONFIGS: Record<HitSeverity, HitConfig> = {
  light: {
    motion: 'hit_light',
    duration: 0.6,
    expression: 'surprised',
  },
  normal: {
    motion: 'hit_normal',
    duration: 1.0,
    expression: 'surprised',
  },
  spin: {
    motion: 'hit_spin',
    duration: 1.15,
    expression: 'surprised',
  },
  heavy: {
    motion: 'hit_heavy',
    duration: 1.45,
    expression: 'sad',
  },
};

export class Fighter {
  public readonly id: FighterId;
  public readonly name: string;
  public readonly themeColor: string;

  public group = new THREE.Group();
  public vrm: VRM | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public toonController: ToonShaderController | null = null;

  public state: FighterState = 'ready';
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public rotationY = 0;

  // 攻撃時の踏み込み用ベース位置
  public basePosition = new THREE.Vector3();

  // 攻撃・被弾の種別とフラグ
  public currentAttackType: AttackType | null = null;
  public currentHitSeverity: HitSeverity | null = null;
  public hasHit = false; // 1回のアタックにつき1回のみ判定

  // --- 体の動き（腰のばね・脚IK・接地・お尻の位置）---
  /** 腰のずれ（キャラのローカル座標。+Z が正面）。押されたり、お尻を突き出したりで動く */
  public hipOffset = new THREE.Vector3();
  private hipVel = new THREE.Vector3();
  /** 押し合いの強さ 0..1（GameEngine が接触中に設定する） */
  public pressAmount = 0;
  /** 体勢の安定度。被弾で下がり、時間で戻る。低いほど大きく吹っ飛ぶ */
  public balance = 1;
  /** よろけから立ち直った直後（AI が反撃を判断するための合図） */
  public justRecovered = false;
  /** 相手がすでに落ち始めている間は、こちらは落ちない（同時に落ちて勝敗が付かなくなるのを防ぐ） */
  public cannotFall = false;
  private balanceRecoverDelay = 0;
  private legL: LegIK | null = null;
  private legR: LegIK | null = null;
  private groundOffset = 0;
  private soleOffToes = 0.03;
  private soleOffFoot = 0.08;
  private time = Math.random() * 10;
  /** お尻の後端が腰の位置からどれだけ後ろか（読み込み時に計測） */
  public rearOffset = 0.09;
  /** お尻の後端のワールド Z（毎フレーム更新） */
  public rearZ = 0;
  private lookTarget: THREE.Object3D | null = null;
  private lookWeight = 0;

  // アニメーションクリップ
  private clips: Record<string, THREE.AnimationClip> = {};
  private currentAction: THREE.AnimationAction | null = null;

  // AIオート行動制御用
  public attackCooldown = 1.0 + Math.random() * 1.5;
  public stateTimer = 0;

  // ボイス（アプリと同じ AudioLipSync で再生し、解析した母音を口に反映する）
  private voiceCues: Record<string, VoiceCue[]> = { attack: [], hit: [], fall: [], win: [], ready: [] };
  private lipSync: AudioLipSync | null = null;
  private phonemeWeights: Record<string, number> = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

  // 表情・まばたき制御用
  private blinkTimer = 2.0 + Math.random() * 2.0;
  private isBlinking = false;
  public isFocused = false;

  private island: FloatingIsland;
  public onStateChange?: (fighter: Fighter, newState: FighterState) => void;
  public onSpeak?: (name: string, text: string, id: FighterId) => void;

  constructor(public config: FighterConfig, island: FloatingIsland) {
    this.id = config.id;
    this.name = config.name;
    this.themeColor = config.themeColor;
    this.island = island;

    this.position.copy(config.initialPos);
    this.basePosition.copy(config.initialPos);
    this.rotationY = config.initialRotY;

    for (const [key, cues] of Object.entries(config.voices)) {
      this.voiceCues[key] = cues ?? [];
    }
  }

  /** VRMモデルとアニメーションの初期ロード */
  public async load(scene: THREE.Scene, camera: THREE.Camera, hairShadow?: HairShadowUniforms): Promise<void> {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(resolveAssetUrl(this.config.modelUrl));
    const vrm = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.removeUnnecessaryJoints(gltf.scene);

    // 1. 法線の平均化（滑らかな輪郭線）
    applySmoothNormalsToHierarchy(vrm.scene);

    // 2. メッシュのシャドウとカリング解除
    vrm.scene.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });

    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);

    // 3. セルルックシェーダー（ToonShader）の適用 - 昼設定(day preset)と完全一致
    this.toonController = applyToonShader(vrm, scene, {
      camera,
      hairShadow,
      config: {
        outline: {
          width: 0.0016,
          color: '#1a1016',
        },
        materials: {
          body: {
            color: '#ffffff',
            shadeColor: '#d49ea3',
            shadingShift: -0.05,
            shadingToony: 0.9895,
            giEqualizationFactor: 0.9,
            matcapEnabled: true,
            emissiveIntensity: 0,
          },
          hair: {
            color: '#ffffff',
            shadeColor: '#8474a4',
            shadingShift: -0.05,
            shadingToony: 0.994,
            giEqualizationFactor: 0.9,
            // 元の髪ハイライト（matcap / emissive）をOFFにし、天使の輪（HairRing）だけを描画する
            matcapEnabled: false,
            emissiveIntensity: 0,
          },
          cloth: {
            color: '#ffffff',
            shadeColor: '#b8bcd8',
            shadingShift: -0.05,
            shadingToony: 0.997,
            giEqualizationFactor: 0.9,
            matcapEnabled: true,
            emissiveIntensity: 0,
          },
        },
      },
    });

    this.group.add(vrm.scene);
    scene.add(this.group);

    // 足裏の位置を骨から推定するための計測（T ポーズの足裏の高さと、足首・つま先の骨との差）
    this.legL = new LegIK(vrm, 'left');
    this.legR = new LegIK(vrm, 'right');
    this.calibrateSoles();

    // アニメーションFBXのロードとバインド
    const motionUrls: Record<string, string> = {
      ready: '/assets/motions/hip_ready.fbx',
      attack_normal: '/assets/motions/hip_attack.fbx',
      attack_heavy: '/assets/motions/hip_attack_heavy.fbx',
      attack_jump: '/assets/motions/hip_attack_jump.fbx',
      attack_quick: '/assets/motions/hip_attack_quick.fbx',
      hit_normal: '/assets/motions/hit_stumble.fbx',
      hit_heavy: '/assets/motions/hit_heavy.fbx',
      hit_spin: '/assets/motions/hit_spin.fbx',
      hit_light: '/assets/motions/hit_light.fbx',
      fall: '/assets/motions/fall_water.fbx',
      win: '/animations/ardy_victory.fbx',
    };

    for (const [name, url] of Object.entries(motionUrls)) {
      try {
        const clip = await loadMixamoAnimation(url, vrm);
        this.clips[name] = clip;
        const hipsTrack = clip.tracks.find(t => t.name.endsWith('.position'));
        if (hipsTrack) {
          console.log(`[HEIGHT-CHECK] ${this.name} ${name}: HipsY(t=0) = ${hipsTrack.values[1].toFixed(3)}`);
        }
      } catch (err) {
        console.warn(`[Fighter ${this.name}] Failed to load motion: ${url}`, err);
      }
    }

    this.playMotion('ready', 0.2, true);
    this.calibrateRear();
  }

  /** 全メッシュの頂点をワールド座標で走査する */
  private forEachVertex(fn: (p: THREE.Vector3) => void, step = 2) {
    if (!this.vrm) return;
    const p = new THREE.Vector3();
    this.vrm.scene.traverse(o => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i += step) {
        m.getVertexPosition(i, p);
        p.applyMatrix4(m.matrixWorld);
        fn(p);
      }
    });
  }

  private calibrateSoles() {
    const vrm = this.vrm;
    if (!vrm) return;
    this.group.updateMatrixWorld(true);
    vrm.scene.updateMatrixWorld(true);
    let minY = Infinity;
    this.forEachVertex(p => { if (p.y < minY) minY = p.y; });
    const h = vrm.humanoid;
    const y = (n: string) => {
      const b = h.getNormalizedBoneNode(n as never);
      return b ? b.getWorldPosition(new THREE.Vector3()).y : null;
    };
    const toes = y('leftToes');
    const foot = y('leftFoot');
    if (toes !== null) this.soleOffToes = toes - minY;
    if (foot !== null) this.soleOffFoot = foot - minY;
  }

  /** 構えの姿勢でのお尻の後端（腰より後ろにどれだけ出ているか）を測る */
  private calibrateRear() {
    const vrm = this.vrm;
    if (!vrm || !this.mixer) return;
    this.mixer.update(0);
    this.applyCrouchBlend();
    this.group.updateMatrixWorld(true);
    vrm.scene.updateMatrixWorld(true);
    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (!hips) return;
    const hp = hips.getWorldPosition(new THREE.Vector3());
    let minZ = Infinity;
    this.forEachVertex(p => {
      if (p.y > hp.y - 0.13 && p.y < hp.y + 0.08 && p.z < minZ) minZ = p.z;
    }, 3);
    if (Number.isFinite(minZ)) this.rearOffset = THREE.MathUtils.clamp(hp.z - minZ, 0.05, 0.25);
  }

  /** 注視するもの（予想画面でカメラを向くなど）。null で解除 */
  public setLookTarget(target: THREE.Object3D | null) {
    this.lookTarget = target;
    if (this.vrm?.lookAt) this.vrm.lookAt.target = target ?? undefined;
  }

  /** モーション再生 */
  public playMotion(name: string, fadeDuration = 0.2, loop = false) {
    if (!this.mixer || !this.clips[name]) return;
    const clip = this.clips[name];
    const newAction = this.mixer.clipAction(clip);

    newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    newAction.clampWhenFinished = !loop;

    if (this.currentAction && this.currentAction !== newAction) {
      this.currentAction.crossFadeTo(newAction, fadeDuration, true);
    }
    newAction.reset().play();
    this.currentAction = newAction;
  }

  /** リップシンク付きの再生器（最初の再生時に作る。ユーザー操作のあとなので AudioContext も作れる） */
  private getLipSync(): AudioLipSync {
    if (!this.lipSync) {
      this.lipSync = new AudioLipSync();
      this.lipSync.setVoiceGender('female');
      this.lipSync.setVolume(0.8);
      // 検証用: player_audio_muted が true なら、音は出さずに口パク解析だけ行う
      try {
        if (localStorage.getItem('player_audio_muted') === 'true') this.lipSync.setMuted(true);
      } catch { /* localStorage が使えない環境 */ }
    }
    return this.lipSync;
  }

  /** ボイス停止（発話の中断） */
  public stopVoice() {
    this.lipSync?.stop();
  }

  /** ボイス再生（ランダムまたは指定インデックス：話者ごとに同時に発話できるのは1個） */
  public playVoice(type: 'attack' | 'hit' | 'fall' | 'win' | 'ready', specificIndex?: number): string {
    const list = this.voiceCues[type];
    if (!list || list.length === 0) return '';

    const idx = (specificIndex !== undefined && specificIndex >= 0 && specificIndex < list.length)
      ? specificIndex
      : Math.floor(Math.random() * list.length);

    const cue = list[idx];
    if (!cue) return '';

    const ls = this.getLipSync();
    ls.loadAudioUrl(cue.url, cue.url.split('/').pop());
    void ls.play();
    this.onSpeak?.(this.name, cue.text, this.id);
    return cue.text;
  }

  /**
   * 解析した母音を口に反映する（アプリの StageAvatar.updateLipSync と同じ係数・同じ滑らかさ）。
   * 声が鳴っていないときは口を閉じる。
   */
  private updateLipSync(): void {
    const em = this.vrm?.expressionManager;
    if (!em) return;
    const ls = this.lipSync;
    const phoneme = ls && ls.isPlaying ? ls.currentPhoneme : undefined;
    const gain = 0.7;
    const smoothing = 0.2;
    for (const p of PHONEMES) {
      const cw = this.phonemeWeights[p] ?? 0;
      const tw = phoneme && phoneme !== 'nn' && phoneme === p ? 1 : 0;
      // 口が開くときは素早く、閉じるときは滑らかに
      const eff = tw > cw ? Math.min(1.0, smoothing * 2.0 + 0.25) : smoothing;
      const nw = cw + eff * (tw - cw);
      const w = nw < 0.005 ? 0 : nw;
      this.phonemeWeights[p] = w;
      em.setValue(p, w * gain);
    }
  }

  /** フォーカス（予想時など注視された際のリアクション） */
  public triggerFocus(voiceIndex?: number): string {
    this.isFocused = true;
    this.setExpression('happy', 1.0);
    return this.playVoice('ready', voiceIndex);
  }

  /** フォーカス解除 */
  public clearFocus() {
    this.isFocused = false;
    this.setLookTarget(null);
    this.stopVoice();
    this.setExpression('relaxed', 1.0);
  }

  /** 表情設定（即時指定用） */
  public setExpression(preset: string, weight = 1.0) {
    if (!this.vrm?.expressionManager) return;
    const em = this.vrm.expressionManager;
    ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'blink', 'aa', 'oh'].forEach(name => {
      em.setValue(name, 0);
    });
    if (preset) {
      em.setValue(preset, weight);
    }
    em.update();
  }

  /** 状況に応じた表情・まばたき・叫び口の毎フレーム自動更新 */
  private updateExpression(delta: number): void {
    if (!this.vrm?.expressionManager) return;
    const em = this.vrm.expressionManager;

    let targetEmotion = 'relaxed';

    if (this.state === 'ready') {
      if (this.isFocused) {
        // フォーカス時：笑顔でプレイヤーへ意気込みをアピール
        targetEmotion = 'happy';
      } else {
        targetEmotion = 'relaxed';
      }
      // 自然なまばたき
      this.blinkTimer -= delta;
      if (this.blinkTimer <= 0) {
        if (!this.isBlinking) {
          this.isBlinking = true;
          this.blinkTimer = 0.12; // 瞬きの持続時間
        } else {
          this.isBlinking = false;
          this.blinkTimer = 2.0 + Math.random() * 2.5; // 次の瞬きまでの間隔
        }
      }
    } else if (this.state === 'attack') {
      this.isBlinking = false;
      // 攻撃中：気合の angry
      targetEmotion = 'angry';
    } else if (this.state === 'stumble') {
      this.isBlinking = false;
      const duration = this.currentHitSeverity ? HIT_CONFIGS[this.currentHitSeverity].duration : 1.0;
      // 被弾前半：驚き（surprised）
      // 被弾後半：耐える・痛がる（sad）
      if (this.stateTimer < duration * 0.45) {
        targetEmotion = 'surprised';
      } else {
        targetEmotion = 'sad';
      }
    } else if (this.state === 'falling') {
      this.isBlinking = false;
      // 落下中：驚き（口の動きはボイスの解析結果に任せる）
      targetEmotion = 'surprised';
    } else if (this.state === 'in_water') {
      // 水面プカプカ：しょんぼり（sad）
      targetEmotion = 'sad';
    } else if (this.state === 'won') {
      this.isBlinking = false;
      // 勝利：満面の笑顔
      targetEmotion = 'happy';
    }

    // 感情表情の適用（規約に従い 1.0 または 0.0）
    const emotions = ['happy', 'angry', 'sad', 'surprised', 'relaxed'];
    for (const name of emotions) {
      em.setValue(name, name === targetEmotion ? 1.0 : 0.0);
    }

    // 口は、鳴っているボイスの母音解析だけで動かす
    this.updateLipSync();

    // まばたき
    em.setValue('blink', this.isBlinking ? 1.0 : 0.0);

    em.update();
  }

  /** アタック開始（通常・強・飛び込み・クイック） */
  public triggerAttack(type: AttackType = 'normal', voiceIndex?: number) {
    if (this.state !== 'ready') return;
    this.state = 'attack';
    this.currentAttackType = type;
    this.hasHit = false;
    this.stateTimer = 0;
    this.basePosition.copy(this.position);

    const cfg = ATTACK_CONFIGS[type];
    this.playMotion(cfg.motion, 0.1, false);
    this.setExpression(cfg.expression, 1.0);
    this.playVoice('attack', voiceIndex);
    this.onStateChange?.(this, 'attack');
  }

  /** 被弾（軽・通常・スピン・強） */
  public takeHit(pushVelocity: THREE.Vector3, severity: HitSeverity = 'normal', voiceIndex?: number) {
    if (this.state === 'falling' || this.state === 'in_water') return;
    this.state = 'stumble';
    this.currentHitSeverity = severity;
    this.currentAttackType = null;
    this.hasHit = false;
    this.stateTimer = 0;
    this.velocity.add(pushVelocity);
    this.basePosition.copy(this.position);

    // 押された勢いで腰が先にずれ、上体がのけぞる（ばねで戻る）。キャラのローカルでは +Z が正面
    const localPush = pushVelocity.clone().applyQuaternion(this.group.quaternion.clone().invert());
    this.hipVel.z += THREE.MathUtils.clamp(localPush.z, -3, 3) * 1.1;
    this.hipVel.x += THREE.MathUtils.clamp(localPush.x, -2, 2) * 0.8;
    this.balance = Math.max(0.05, this.balance - (severity === 'heavy' ? 0.34 : severity === 'spin' ? 0.28 : severity === 'normal' ? 0.22 : 0.15));
    this.balanceRecoverDelay = 1.2;

    const cfg = HIT_CONFIGS[severity];
    this.playMotion(cfg.motion, 0.08, false);
    this.setExpression(cfg.expression, 1.0);
    this.playVoice('hit', voiceIndex);
    this.onStateChange?.(this, 'stumble');
  }

  /** 落下開始 */
  public triggerFall(voiceIndex?: number) {
    if (this.state === 'falling' || this.state === 'in_water') return;
    this.state = 'falling';
    this.currentAttackType = null;
    this.currentHitSeverity = null;
    this.hasHit = false;
    this.stateTimer = 0;
    this.velocity.y = 1.6; // 少し跳ねてから落ちる
    this.playMotion('fall', 0.15, false);
    this.setExpression('sad', 1.0);
    this.playVoice('fall', voiceIndex);
    this.onStateChange?.(this, 'falling');
  }

  /** 勝利 */
  public triggerWin(voiceIndex?: number) {
    this.state = 'won';
    this.currentAttackType = null;
    this.currentHitSeverity = null;
    this.hasHit = false;
    this.velocity.set(0, 0, 0);
    this.playMotion('win', 0.2, true);
    this.setExpression('happy', 1.0);
    this.playVoice('win', voiceIndex);
    this.onStateChange?.(this, 'won');
  }

  /** リセット（次のラウンド） */
  public reset() {
    this.state = 'ready';
    this.currentAttackType = null;
    this.currentHitSeverity = null;
    this.hasHit = false;
    this.position.copy(this.config.initialPos);
    this.basePosition.copy(this.config.initialPos);
    this.velocity.set(0, 0, 0);
    this.rotationY = this.config.initialRotY;
    this.stateTimer = 0;
    this.attackCooldown = 0.25 + Math.random() * 0.5;
    this.hipOffset.set(0, 0, 0);
    this.hipVel.set(0, 0, 0);
    this.pressAmount = 0;
    this.balance = 1;
    this.balanceRecoverDelay = 0;
    this.cannotFall = false;
    this.groundOffset = 0;
    this.setLookTarget(null);
    this.lookWeight = 0;
    this.setExpression('relaxed', 1.0);
    this.playMotion('ready', 0.3, true);
  }

  /** 反動: 腰にワールド Z 方向の勢いを与える（相手を押した反動など） */
  public recoilImpulse(worldZ: number) {
    const local = new THREE.Vector3(0, 0, worldZ).applyQuaternion(this.group.quaternion.clone().invert());
    this.hipVel.z += local.z;
  }

  /** 接触の解決などで、ルートを Z 方向にずらす */
  public shiftRootZ(dz: number) {
    this.position.z += dz;
    this.basePosition.z += dz;
    this.group.position.z += dz;
    this.rearZ += dz;
  }

  /** X 方向にずらす（相手と向き合う位置合わせ） */
  public shiftRootX(dx: number) {
    this.position.x += dx;
    this.basePosition.x += dx;
    this.group.position.x += dx;
  }

  /** 毎フレームの更新 */
  public update(delta: number) {
    this.stateTimer += delta;
    this.time += delta;
    this.mixer?.update(delta);

    // 中腰姿勢の合成（立ち姿勢のアニメーションを中腰低姿勢にブレンド）
    this.applyCrouchBlend();

    // 1. 位置・速度の更新
    if (this.state === 'ready' || this.state === 'stumble') {
      // 摩擦減衰（浮島上）
      this.velocity.x *= Math.exp(-delta * 3.8);
      this.velocity.z *= Math.exp(-delta * 3.8);

      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      this.basePosition.copy(this.position);

      // 島の表面の高さと傾きに接地
      this.position.y = this.island.getSurfaceHeightAt(this.position.x, this.position.z);

      // 島から出たかチェック
      this.checkEdge();

      // よろめきの終了判定 -> ready に戻る
      if (this.state === 'stumble') {
        const duration = this.currentHitSeverity ? HIT_CONFIGS[this.currentHitSeverity].duration : 1.0;
        if (this.stateTimer >= duration) {
          this.state = 'ready';
          this.currentHitSeverity = null;
          this.justRecovered = true;
          this.playMotion('ready', 0.2, true);
          this.setExpression('relaxed', 1.0);
          this.onStateChange?.(this, 'ready');
        }
      }
    } else if (this.state === 'attack') {
      const cfg = this.currentAttackType ? ATTACK_CONFIGS[this.currentAttackType] : ATTACK_CONFIGS.normal;

      // 踏み込み移動（相手に向かってヒップを突き出しに行く）
      // アオイ（+Z向き、背後は -Z）: -Z 方向へ踏み込む
      // エミリ（-Z向き、背後は +Z）: +Z 方向へ踏み込む
      const backDir = this.id === 'aoi' ? -1 : 1;
      let lunge = 0;

      if (this.stateTimer <= cfg.impactTime) {
        // タメからインパクトへ向けて加速前進（Ease-In）
        const progress = Math.min(1, this.stateTimer / cfg.impactTime);
        const ease = Math.pow(progress, 2.5);
        lunge = cfg.lungeDistance * ease;
      } else {
        // インパクト後は押し込んだ分の半分を保ち、残りだけ戻る（当たった時は間合いを詰めたまま）
        const recoverTime = cfg.duration - cfg.impactTime;
        const progress = Math.min(1, (this.stateTimer - cfg.impactTime) / Math.max(0.1, recoverTime));
        const ease = Math.cos((progress * Math.PI) / 2); // 1から0へ減衰
        const keep = this.hasHit ? 0.5 : 0;
        lunge = cfg.lungeDistance * (keep + (1 - keep) * ease);
      }

      this.position.x = this.basePosition.x;
      this.position.z = this.basePosition.z + backDir * lunge;
      this.position.y = this.island.getSurfaceHeightAt(this.position.x, this.position.z);

      // ジャンプアタック時の跳躍
      if (this.currentAttackType === 'jump') {
        const jumpProgress = Math.sin((this.stateTimer / cfg.duration) * Math.PI);
        this.position.y += Math.max(0, jumpProgress * 0.28);
      }

      // 島から出たかチェック
      this.checkEdge();

      // アタック終了判定 -> ready に戻る
      if (this.stateTimer >= cfg.duration) {
        this.state = 'ready';
        this.currentAttackType = null;
        this.hasHit = false;
        this.basePosition.copy(this.position);
        this.playMotion('ready', 0.2, true);
        this.setExpression('relaxed', 1.0);
        this.onStateChange?.(this, 'ready');
      }
    } else if (this.state === 'falling') {
      // 自由落下（重力加速度）
      this.velocity.y -= 9.8 * delta;
      this.position.x += this.velocity.x * delta;
      this.position.y += this.velocity.y * delta;
      this.position.z += this.velocity.z * delta;

      // 水面（y <= -0.4）に着水
      if (this.position.y <= -0.4) {
        this.state = 'in_water';
        this.position.y = -0.4;
        this.velocity.set(0, 0, 0);
        this.onStateChange?.(this, 'in_water');
      }
    } else if (this.state === 'in_water') {
      // 水面でプカプカ漂う
      this.position.y = -0.4 + Math.sin(this.stateTimer * 2.5) * 0.04;
    } else if (this.state === 'won') {
      // 島の表面に立ち続ける
      this.position.y = this.island.getSurfaceHeightAt(this.position.x, this.position.z);
    }

    // 2. Transform 反映（接地の補正は前フレームの値を使い、あとで更新する）
    this.group.rotation.y = this.rotationY;
    if (this.state === 'ready' || this.state === 'attack' || this.state === 'stumble' || this.state === 'won') {
      // 浮島の上にいるときは、浮島の傾きに体を追従させる
      this.group.rotation.x = this.island.tiltX;
      this.group.rotation.z = this.island.tiltZ;
    } else {
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
    }
    this.applyGroupPosition();

    // 3. 体の動き（腰・上体・脚 IK・顔の向き）と接地
    this.applyBodyPose(delta);

    // 4. 表情・骨の反映
    this.updateExpression(delta);
    this.vrm?.update(delta);

    // 5. お尻の後端の位置を更新
    this.updateRear();
  }

  private checkEdge() {
    if (!this.island.isOutOfIsland(this.position)) return;
    if (!this.cannotFall) {
      this.triggerFall();
      return;
    }
    // 落ちない間は縁の内側に留める
    const r = Math.hypot(this.position.x, this.position.z);
    const k = (this.island.radius - 0.02) / r;
    this.position.x *= k;
    this.position.z *= k;
    this.basePosition.x = this.position.x;
    this.basePosition.z = this.position.z;
  }

  /** ルート位置に、接地の補正（キャラの上方向）を足して group に反映する */
  private applyGroupPosition() {
    this.group.position.copy(this.position);
    if (this.groundOffset !== 0) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion);
      this.group.position.addScaledVector(up, this.groundOffset);
    }
  }

  private static rotX(angle: number, out = new THREE.Quaternion()) {
    return out.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  }

  /**
   * 腰のばねと、それに合わせた上体の傾き・脚 IK・顔の向き。
   * 足は動く前の位置に固定したまま腰だけをずらすので、押されると足が踏ん張って上体が持っていかれる。
   */
  private applyBodyPose(delta: number) {
    const vrm = this.vrm;
    if (!vrm) return;
    const st = this.state;
    const onIsland = st === 'ready' || st === 'attack' || st === 'stumble';
    const h = vrm.humanoid;
    const hips = h.getNormalizedBoneNode('hips');

    // --- 腰のばね ---
    let tz = 0, ty = 0, lean = 0, tuck = 0;
    if (st === 'ready') {
      const press = this.pressAmount;
      const wob = Math.sin(this.time * 8.0 + (this.id === 'aoi' ? 0 : 1.7)) * 0.012;
      tz = -0.05 * press + wob * press;
      ty = -0.012 * press;
      lean = 0.08 * press;
    } else if (st === 'attack') {
      const cfg = this.currentAttackType ? ATTACK_CONFIGS[this.currentAttackType] : ATTACK_CONFIGS.normal;
      const t = this.stateTimer;
      const ti = cfg.impactTime;
      const windEnd = ti * 0.55;
      const smooth = (x: number) => x * x * (3 - 2 * x);
      if (t < windEnd) {
        // タメ: 腰を前に引いて沈める
        const p = smooth(Math.min(1, t / windEnd));
        tz = 0.10 * p; ty = -0.035 * p; lean = 0.10 * p;
      } else if (t < ti + 0.08) {
        // 突き出し: お尻を後ろへ一気に
        const p = smooth(Math.min(1, (t - windEnd) / (ti + 0.08 - windEnd)));
        tz = 0.10 + (-0.17 - 0.10) * p; ty = -0.035 * (1 - p); lean = 0.10 + 0.14 * p; tuck = 0.22 * p;
      } else {
        // 戻り
        const k = Math.exp(-(t - ti - 0.08) / 0.22);
        tz = -0.17 * k; lean = 0.24 * k; tuck = 0.22 * k;
      }
    }

    const stiff = st === 'attack' ? 260 : 90;
    const damp = 2 * Math.sqrt(stiff) * (st === 'stumble' ? 0.45 : 0.85);
    const target = new THREE.Vector3(0, ty, tz);
    const acc = target.sub(this.hipOffset).multiplyScalar(stiff).addScaledVector(this.hipVel, -damp);
    this.hipVel.addScaledVector(acc, delta);
    this.hipOffset.addScaledVector(this.hipVel, delta);
    this.hipOffset.z = THREE.MathUtils.clamp(this.hipOffset.z, -0.3, 0.32);
    this.hipOffset.x = THREE.MathUtils.clamp(this.hipOffset.x, -0.2, 0.2);

    // --- 足を固定して腰を動かす ---
    const pinFeet = onIsland && this.legL && this.legR && hips;
    let footL: THREE.Vector3 | null = null, footR: THREE.Vector3 | null = null;
    let quatL: THREE.Quaternion | null = null, quatR: THREE.Quaternion | null = null;
    if (pinFeet) {
      this.group.updateMatrixWorld(true);
      vrm.scene.updateMatrixWorld(true);
      footL = this.legL!.footWorld(new THREE.Vector3());
      footR = this.legR!.footWorld(new THREE.Vector3());
      quatL = this.legL!.foot.getWorldQuaternion(new THREE.Quaternion());
      quatR = this.legR!.foot.getWorldQuaternion(new THREE.Quaternion());
    }

    if (hips && onIsland) {
      hips.position.add(this.hipOffset);
      if (tuck !== 0) hips.quaternion.multiply(Fighter.rotX(tuck));

      // 上体の傾き（腰が前に持っていかれるほど前かがみ、のけぞり）
      const pitch = THREE.MathUtils.clamp(lean + this.hipOffset.z * 2.4 + this.hipVel.z * 0.10, -0.4, 0.75);
      const spine = h.getNormalizedBoneNode('spine');
      const chest = h.getNormalizedBoneNode('chest');
      if (spine) spine.quaternion.multiply(Fighter.rotX(pitch * 0.55));
      if (chest) chest.quaternion.multiply(Fighter.rotX(pitch * 0.35));
      // 横に押された時は上体が横へ流れる
      const roll = THREE.MathUtils.clamp(-this.hipOffset.x * 2.0, -0.35, 0.35);
      if (spine && Math.abs(roll) > 1e-4) spine.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    }

    if (pinFeet && footL && footR && quatL && quatR) {
      vrm.scene.updateMatrixWorld(true);
      // よろめき中は足が小刻みに踏み出す（左右交互）
      const stepL = new THREE.Vector3(), stepR = new THREE.Vector3();
      if (st === 'stumble') {
        const dur = this.currentHitSeverity ? HIT_CONFIGS[this.currentHitSeverity].duration : 1.0;
        const env = Math.max(0, 1 - this.stateTimer / dur);
        const w = this.stateTimer * 13;
        const amp = 0.09 * env * Math.min(1, Math.abs(this.hipVel.z) * 0.5 + Math.abs(this.hipOffset.z) * 4);
        const sL = Math.sin(w), sR = Math.sin(w + Math.PI);
        stepL.set(0, Math.max(0, sL) * 0.05 * env, sL * amp);
        stepR.set(0, Math.max(0, sR) * 0.05 * env, sR * amp);
        stepL.applyQuaternion(this.group.quaternion);
        stepR.applyQuaternion(this.group.quaternion);
      }
      this.legL!.solve(footL.add(stepL), quatL);
      this.legR!.solve(footR.add(stepR), quatR);
    }

    // --- 顔をカメラへ ---
    const wantLook = this.lookTarget && (st === 'ready' || st === 'won') ? 1 : 0;
    this.lookWeight += (wantLook - this.lookWeight) * (1 - Math.exp(-delta * 8));
    if (this.lookWeight > 0.01 && this.lookTarget) {
      vrm.scene.updateMatrixWorld(true);
      lookAtWithNeckAndHead(vrm, this.lookTarget.getWorldPosition(new THREE.Vector3()), this.lookWeight, 1.35);
    }

    // --- 接地: いちばん低い足裏が島の表面に触れるよう、高さを合わせる ---
    if (onIsland || st === 'won') {
      const jumping = st === 'attack' && this.currentAttackType === 'jump';
      if (!jumping) {
        vrm.scene.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
        const p = new THREE.Vector3();
        let minSole = Infinity;
        const probe = (name: string, off: number) => {
          const b = h.getNormalizedBoneNode(name as never);
          if (!b) return;
          b.getWorldPosition(p).applyMatrix4(inv);
          minSole = Math.min(minSole, p.y - off);
        };
        probe('leftToes', this.soleOffToes);
        probe('rightToes', this.soleOffToes);
        probe('leftFoot', this.soleOffFoot);
        probe('rightFoot', this.soleOffFoot);
        if (Number.isFinite(minSole)) {
          const targetOffset = -minSole + 0.01; // 足裏の推定の誤差ぶん（実測でほぼ 1cm 沈むので）
          this.groundOffset += (targetOffset - this.groundOffset) * (1 - Math.exp(-delta * 30));
        }
      }
    } else {
      this.groundOffset += (0 - this.groundOffset) * (1 - Math.exp(-delta * 10));
    }
    this.applyGroupPosition();

    // 安定度は時間で戻る
    this.balanceRecoverDelay -= delta;
    if (this.balanceRecoverDelay <= 0 && this.balance < 1) this.balance = Math.min(1, this.balance + delta * 0.12);
  }

  /** お尻の後端（腰の骨から、体の後ろ向きに rearOffset）のワールド Z を更新 */
  private updateRear() {
    const hips = this.vrm?.humanoid.getNormalizedBoneNode('hips');
    if (!hips) return;
    this.group.updateMatrixWorld(true);
    hips.updateWorldMatrix(true, false);
    const p = hips.getWorldPosition(new THREE.Vector3());
    const back = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
    this.rearZ = p.z + back.z * this.rearOffset;
  }

  /** お尻の後端（Buttocks Surface）のワールド Z */
  public getButtocksWorldZ(): number {
    return this.rearZ;
  }

  // 中腰ブレンド用の静的クォータニオン（中腰スクワットの基準姿勢）
  private static readonly CROUCH_HIPS_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.28, 0, 0));
  private static readonly CROUCH_SPINE_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0));
  private static readonly CROUCH_L_UPPER_LEG = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.32, 0.02, -0.08));
  private static readonly CROUCH_R_UPPER_LEG = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.42, -0.02, 0.08));
  private static readonly CROUCH_L_LOWER_LEG = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.60, 0, 0));
  private static readonly CROUCH_R_LOWER_LEG = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.70, 0, 0));
  private static readonly CROUCH_L_FOOT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0));
  private static readonly CROUCH_R_FOOT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0, 0));

  /**
   * 中腰姿勢合成（Procedural Crouch Blend）
   * 攻撃や被弾など直立（立ち姿勢）のアニメーション中も、
   * 腰を落とした低姿勢（中腰スクワット）をキープしたまま動作させる
   */
  private applyCrouchBlend(): void {
    if (!this.vrm?.humanoid) return;
    // 落下中・水没・勝利時は中腰ブレンドを解除（ダイナミックなアクションを優先）
    if (this.state === 'falling' || this.state === 'in_water' || this.state === 'won') {
      return;
    }

    const humanoid = this.vrm.humanoid;
    const hips = humanoid.getNormalizedBoneNode('hips');
    if (!hips) return;

    // 現在の腰の高さが 0.72m を超えている場合（立ち姿勢の攻撃・被弾モーション等）
    // ※ hip_ready.fbx は元から 0.64m なのでスキップされる
    if (hips.position.y > 0.72) {
      // 1. 腰の高さを中腰基準（0.64m）に引き下げる
      hips.position.y = 0.64;

      // 2. 骨盤の前傾補正
      hips.quaternion.multiply(Fighter.CROUCH_HIPS_ROT);

      // 3. 背骨の補正（前傾バランス）
      const spine = humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        spine.quaternion.multiply(Fighter.CROUCH_SPINE_ROT);
      }

      // 4. 太もも（UpperLeg）を中腰スタンスへブレンド
      const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
      const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
      if (leftUpperLeg) {
        leftUpperLeg.quaternion.slerp(Fighter.CROUCH_L_UPPER_LEG, 0.85);
      }
      if (rightUpperLeg) {
        rightUpperLeg.quaternion.slerp(Fighter.CROUCH_R_UPPER_LEG, 0.85);
      }

      // 5. 膝（LowerLeg）を中腰スタンスへブレンド
      const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
      const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
      if (leftLowerLeg) {
        leftLowerLeg.quaternion.slerp(Fighter.CROUCH_L_LOWER_LEG, 0.85);
      }
      if (rightLowerLeg) {
        rightLowerLeg.quaternion.slerp(Fighter.CROUCH_R_LOWER_LEG, 0.85);
      }

      // 6. 足首（Foot）を水平接地へブレンド
      const leftFoot = humanoid.getNormalizedBoneNode('leftFoot');
      const rightFoot = humanoid.getNormalizedBoneNode('rightFoot');
      if (leftFoot) {
        leftFoot.quaternion.slerp(Fighter.CROUCH_L_FOOT, 0.80);
      }
      if (rightFoot) {
        rightFoot.quaternion.slerp(Fighter.CROUCH_R_FOOT, 0.80);
      }
    }
  }
}

