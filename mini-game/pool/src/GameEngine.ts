import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

import { CinematicAnimeShader } from '@anime-vrm/engine/postprocessing/CinematicAnimeShader';
import { GodRaysShader } from '@anime-vrm/engine/postprocessing/GodRaysShader';
import { SunEffect } from '@anime-vrm/engine/postprocessing/SunEffect';
import { HairShadowRenderer } from '@anime-vrm/engine/shader/HairShadow';
import { CharacterMaskRenderer, LightWrapShader } from '@anime-vrm/engine/postprocessing/LightWrap';
import { ParaShader, DEFAULT_PARA_PARAMS, applyParaParams } from '@anime-vrm/engine/postprocessing/Para';
import { setHairRingTint } from '@anime-vrm/engine/shader/HairRing';

import { WaterSurface } from './WaterSurface';
import { FloatingIsland } from './FloatingIsland';
import { LensDroplets } from './LensDroplets';
import { Fighter, ATTACK_CONFIGS, type AttackType, type AttackConfig, type HitSeverity } from './Fighter';
import { SoundManager } from './Sound';

/** 落下してから、着水地点にカメラを向け続ける秒数（0 で無効） */
const SPLASH_CAM_DURATION = 1.5;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private controls: OrbitControls;

  // ライティング
  private directionalLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private rimLight: THREE.DirectionalLight;
  private sunEffect: SunEffect;

  // ポストプロセスパス
  private renderPass: RenderPass;
  private lightWrapPass: ShaderPass;
  private bloomPass: UnrealBloomPass;
  private godRaysPass: ShaderPass;
  private paraPass: ShaderPass;
  private cinematicAnimePass: ShaderPass;
  private lensDroplets: LensDroplets;
  private smaaPass: SMAAPass;

  // マスク描画
  private hairShadow: HairShadowRenderer;
  private characterMask: CharacterMaskRenderer;

  private water: WaterSurface;
  private island: FloatingIsland;
  public fighterAoi: Fighter;
  public fighterEmili: Fighter;

  // ゲームステート
  public gameState: 'predict' | 'ready' | 'fight' | 'round_end' = 'predict';
  public selectedPrediction: 'aoi' | 'emili' | null = null;
  public predictFocus: 'aoi' | 'emili' | null = null;
  public predictionStats = { total: 0, correct: 0, streak: 0 };
  private roundTimer = 0;
  private elapsedTime = 0;
  public scoreAoi = 0;
  public scoreEmili = 0;

  // カメラモード ('side' | 'dramatic' | 'free')
  public cameraMode: 'side' | 'dramatic' | 'free' = 'dramatic';
  private cameraShake = 0;
  private hitStopTimer = 0;
  private fightTime = 0;
  private fallStartedAt = new Map<string, number>();
  private sound = new SoundManager();
  // 落下ごとに 1 回だけ着水の演出を起こすための記録
  private splashedFall = new Set<string>();
  // 落下〜着水を見せるカメラ（落ちたキャラの着水地点をしばらく映す）
  private splashCamTimer = 0;
  private splashCamTarget: Fighter | null = null;
  private splashCamCut = false;
  // 着水のしぶきがレンズに届くまでの間（この秒数のあとに水滴が付く）
  private lensSplashDelay = -1;

  // UI要素参照
  private scoreAoiElem: HTMLElement | null;
  private scoreEmiliElem: HTMLElement | null;
  private matchStatusElem: HTMLElement | null;
  private centerBannerElem: HTMLElement | null;
  private bannerTextElem: HTMLElement | null;
  private tiltBarElem: HTMLElement | null;
  private speakerNameElem: HTMLElement | null;
  private speechTextElem: HTMLElement | null;
  private predictionDeckElem: HTMLElement | null = null;
  private userPredictionBadgeElem: HTMLElement | null = null;
  private userPredictionNameElem: HTMLElement | null = null;
  private resultModalElem: HTMLElement | null = null;
  private resultTitleElem: HTMLElement | null = null;
  private resultMessageElem: HTMLElement | null = null;
  private rsWinnerElem: HTMLElement | null = null;
  private rsPredictedElem: HTMLElement | null = null;
  private rsStreakElem: HTMLElement | null = null;
  private statCorrectElem: HTMLElement | null = null;
  private statTotalElem: HTMLElement | null = null;
  private statStreakElem: HTMLElement | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // 1. シーン・カメラ・レンダラー初期化
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 250);
    this.camera.position.set(3.4, 1.25, 0.8);

    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const targetW = Math.floor(window.innerWidth * pixelRatio);
    const targetH = Math.floor(window.innerHeight * pixelRatio);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // toneMapping は設定しない（THREE.NoToneMapping: 本編アプリ StageManager.ts と完全一致。
    // ACESFilmicToneMapping をかけるとセルルックの彩度・コントラストが落ちて白濁・くすみが発生するため）
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // OrbitControls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0.8, 0);

    // 2. 昼のライティング設定 (day preset に完全準拠)
    this.setupDayLighting();

    // 天使の輪の色（昼光になじませる）
    setHairRingTint('#f2f5ff');

    // 3. プール水面と浮島
    this.water = new WaterSurface(this.scene, this.renderer);
    this.island = new FloatingIsland(this.scene);
    this.water.setIsland(this.island);

    // 4. マスクレンダラー初期化（前髪の影 ＆ ライトラップ/パラ用キャラマスク）
    this.hairShadow = new HairShadowRenderer(targetW, targetH);
    this.characterMask = new CharacterMaskRenderer(targetW, targetH);

    // 5. キャラクター作成（あおい & えみり）- 拡張ボイス・セリフ全集
    this.fighterAoi = new Fighter({
      id: 'aoi',
      name: 'アオイ',
      themeColor: '#eab308',
      modelUrl: '/models/aoi/aoi-swim.vrm',
      initialPos: new THREE.Vector3(0, 0, 0.28),
      initialRotY: 0, // +Z向き（背中は -Z）
      voices: {
        attack: [
          { url: '/assets/voices/aoi_attack_1.wav', text: 'えいっ！' },
          { url: '/assets/voices/aoi_attack_2.wav', text: 'それっ！' },
          { url: '/assets/voices/aoi_attack_3.wav', text: '覚悟してね！' },
          { url: '/assets/voices/aoi_attack_4.wav', text: 'これで…どうっ！' },
          { url: '/assets/voices/aoi_attack_5.wav', text: 'ヒップアタック！' },
        ],
        hit: [
          { url: '/assets/voices/aoi_hit.wav', text: 'きゃっ！' },
          { url: '/assets/voices/aoi_hit_2.wav', text: '痛っ…！強い…！' },
          { url: '/assets/voices/aoi_hit_3.wav', text: '押されちゃう…！' },
        ],
        fall: [
          { url: '/assets/voices/aoi_fall.wav', text: '冷たーいっ！落ちちゃった…！' },
          { url: '/assets/voices/aoi_fall_2.wav', text: 'あぁ〜っ！水が〜！' },
        ],
        win: [
          { url: '/assets/voices/aoi_win.wav', text: 'ふふっ、私の勝ちだね！' },
          { url: '/assets/voices/aoi_win_2.wav', text: 'えへへ、私の勝ちだね！' },
        ],
        ready: [
          { url: '/assets/voices/aoi_ready_1.wav', text: '私を選んでくれるの？絶対に負けないから見ててね！' },
          { url: '/assets/voices/aoi_ready_2.wav', text: '応援よろしくね！えいっと一気に押し出しちゃうよ！' },
        ],
      },
    }, this.island);

    this.fighterEmili = new Fighter({
      id: 'emili',
      name: 'エミリ',
      themeColor: '#ef4444',
      modelUrl: '/models/emili/emili-swim.vrm',
      initialPos: new THREE.Vector3(0, 0, -0.28),
      initialRotY: Math.PI, // -Z向き（背中は +Z）
      voices: {
        attack: [
          { url: '/assets/voices/emili_attack_1.wav', text: 'とーっ！' },
          { url: '/assets/voices/emili_attack_2.wav', text: '吹っ飛びなさい！' },
          { url: '/assets/voices/emili_attack_3.wav', text: 'ヒップ・インパクトぉー！' },
          { url: '/assets/voices/emili_attack_4.wav', text: '遠慮はいらないわよね！' },
          { url: '/assets/voices/emili_attack_5.wav', text: 'わたくしの本気、受けてみなさい！' },
        ],
        hit: [
          { url: '/assets/voices/emili_hit.wav', text: 'きゃあっ！' },
          { url: '/assets/voices/emili_hit_2.wav', text: 'ひゃあっ！？な、何よ今の…！' },
          { url: '/assets/voices/emili_hit_3.wav', text: 'わたくしが押されるなんて…！' },
        ],
        fall: [
          { url: '/assets/voices/emili_fall.wav', text: 'あーん、落とされたーっ！冷たい〜！' },
          { url: '/assets/voices/emili_fall_2.wav', text: 'きゃーっ！濡れちゃうーっ！' },
        ],
        win: [
          { url: '/assets/voices/emili_win.wav', text: 'わーい、私の勝ち〜！楽勝ね！' },
          { url: '/assets/voices/emili_win_2.wav', text: 'おーほほほ！わたくしに敵うはずがないでしょ！' },
        ],
        ready: [
          { url: '/assets/voices/emili_ready_1.wav', text: 'ふふん、見る目があるじゃない！わたくしの華麗なヒップアタックをお見せしますわ！' },
          { url: '/assets/voices/emili_ready_2.wav', text: 'わたくしに賭けるのね？後悔させませんことよ、覚悟なさい！' },
        ],
      },
    }, this.island);

    // 6. ポストプロセス完全パイプラインの構築
    const composerRenderTarget = new THREE.WebGLRenderTarget(targetW, targetH, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, composerRenderTarget);
    this.composer.setPixelRatio(pixelRatio);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // ライトラップ（背景の光をキャラの輪郭の内側ににじませる。リニア空間）
    this.lightWrapPass = new ShaderPass(LightWrapShader);
    this.lightWrapPass.uniforms['uResolution'].value.set(targetW, targetH);
    this.lightWrapPass.uniforms['tMask'].value = this.characterMask.texture;
    this.lightWrapPass.uniforms['tHair'].value = this.hairShadow.depthTexture;
    this.composer.addPass(this.lightWrapPass);

    // 昼のブルーム（白靄・白ボケを防ぎ、極微細なハイライト反射のみを光らせる）
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(targetW, targetH),
      0.012, // strength (本編 StageManager L260: 0.01 に準拠)
      0.08,  // radius (0.7 だと画面全体が白靄で濁るため 0.08 に抑制)
      0.92   // threshold
    );
    this.composer.addPass(this.bloomPass);

    // サンシャフト（ゴッドレイ: 画面全体の白濁を防ぎつつ、淡い太陽光の光条を表現）
    this.godRaysPass = new ShaderPass(GodRaysShader);
    this.godRaysPass.uniforms['tMask'].value = this.characterMask.texture;
    this.godRaysPass.uniforms['uUseMask'].value = 1.0;
    this.godRaysPass.uniforms['uExposure'].value = 0.05; // 0.22 は画面全体が白濁するため 0.05 に調整
    this.godRaysPass.uniforms['uDecay'].value = 0.85;
    this.godRaysPass.uniforms['uDensity'].value = 0.28;
    this.godRaysPass.uniforms['uWeight'].value = 0.04;
    (this.godRaysPass.uniforms['uRayColor'].value as THREE.Color).set('#fff4e0');
    this.godRaysPass.uniforms['uShimmer'].value = 0.18;
    this.composer.addPass(this.godRaysPass);

    // ここまでリニア空間。OutputPass で表示用 sRGB に変換
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // パラ（背景の空気の色をキャラの上だけにグラデーションで重ねる。sRGB空間）
    this.paraPass = new ShaderPass(ParaShader);
    this.paraPass.uniforms['tMask'].value = this.characterMask.texture;
    applyParaParams(this.paraPass.uniforms as typeof ParaShader.uniforms, {
      ...DEFAULT_PARA_PARAMS,
      enabled: true,
      strength: 0.08, // キャラが白茶けないようマイルドに調整
      tintAmount: 0.4,
    });
    this.composer.addPass(this.paraPass);

    // 色調補正 (CinematicAnimeShader in sRGB space)
    this.cinematicAnimePass = new ShaderPass(CinematicAnimeShader);
    this.cinematicAnimePass.uniforms['uResolution'].value.set(targetW, targetH);
    const u = this.cinematicAnimePass.uniforms;
    // ディフュージョン（スクリーン加算白光）はオフにして、白くすみを排除しセルルック本来の抜けを出す
    u.uDiffusionEnabled.value = 0.0;
    u.uDiffusionStrength.value = 0.0;
    u.uDiffusionRadius.value = 2.0;

    // カラーグレーディング: 黄土色や濁った青の色被りを排除
    u.uColorGradingEnabled.value = 0.0;
    u.uGradingStrength.value = 0.0;
    u.uGradingContrast.value = 0.0;
    u.uGamma.value = 1.0;

    // 抜けの良いコントラストと鮮やかな発色
    u.uSaturation.value = 0.28;
    u.uBrightness.value = 0.0;
    u.uContrast.value = 0.08; // 影を引き締めてコントラストと抜け感を向上

    u.uVignetteEnabled.value = 1.0;
    u.uVignetteOffset.value = 1.25;
    u.uVignetteDarkness.value = 0.06;
    u.uVignetteColor.value.set('#0f172a').convertLinearToSRGB();

    u.uChromaticAberrationEnabled.value = 1.0;
    u.uChromaticAberrationOffset.value = 0.001;
    this.composer.addPass(this.cinematicAnimePass);

    // カメラのレンズに付く水滴（落水後）。SMAA の前に置き、水滴の縁もなめらかにする
    this.lensDroplets = new LensDroplets(targetW, targetH);
    this.composer.addPass(this.lensDroplets.pass);

    // SMAAPass (アンチエイリアス)
    this.smaaPass = new SMAAPass();
    this.smaaPass.setSize(targetW, targetH);
    this.composer.addPass(this.smaaPass);

    // UI要素バインド
    this.scoreAoiElem = document.getElementById('score-aoi');
    this.scoreEmiliElem = document.getElementById('score-emili');
    this.matchStatusElem = document.getElementById('match-status');
    this.centerBannerElem = document.getElementById('center-banner');
    this.bannerTextElem = document.getElementById('banner-text');
    this.tiltBarElem = document.getElementById('tilt-bar');
    this.speakerNameElem = document.getElementById('speaker-name');
    this.speechTextElem = document.getElementById('speech-text');
    this.predictionDeckElem = document.getElementById('prediction-deck');
    this.userPredictionBadgeElem = document.getElementById('user-prediction-badge');
    this.userPredictionNameElem = document.getElementById('user-prediction-name');
    this.resultModalElem = document.getElementById('result-modal');
    this.resultTitleElem = document.getElementById('result-title');
    this.resultMessageElem = document.getElementById('result-message');
    this.rsWinnerElem = document.getElementById('rs-winner');
    this.rsPredictedElem = document.getElementById('rs-predicted');
    this.rsStreakElem = document.getElementById('rs-streak');
    this.statCorrectElem = document.getElementById('stat-correct');
    this.statTotalElem = document.getElementById('stat-total');
    this.statStreakElem = document.getElementById('stat-streak');

    this.bindPredictionUI();

    this.bindFighterEvents(this.fighterAoi);
    this.bindFighterEvents(this.fighterEmili);

    window.addEventListener('resize', this.onResize);
  }

  /** 昼のライティング設定 (day preset & SkyBackground の青空・雲に準拠) */
  private setupDayLighting() {
    // 澄み切った青空＆流れる雲の全天球スカイドーム (SkyBackground アルゴリズムを3D全天球展開)
    const skyGeo = new THREE.SphereGeometry(120, 48, 32);
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uZenith: { value: new THREE.Color('#0284c7') },     // 鮮やかな晴天の天頂ブルー
        uHorizon: { value: new THREE.Color('#7dd3fc') },    // 地平線も白飛びせず爽やかなスカイブルー
        uCloudLight: { value: new THREE.Color('#ffffff') }, // 太陽光に照らされた輝く白雲
        uCloudShade: { value: new THREE.Color('#93c5fd') }, // 雲の爽やかなスカイブルー陰影
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uCloudLight;
        uniform vec3 uCloudShade;
        varying vec3 vWorldPosition;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
        }

        float cloudField(vec2 p) {
          return noise(p) * 0.52 + noise(p * 2.08) * 0.28
               + noise(p * 4.15) * 0.13 + noise(p * 8.31) * 0.07;
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = clamp(dir.y, 0.0, 1.0);

          // 1. 青空グラデーション（地平線〜天頂）: 澄み切ったセルルック青空
          vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.65, h));

          // 2. 天空平面プロジェクション (dir.xz によるシームレスな天空投影)
          // atan/phi による角度ジャンプ（垂直な境界線の段差）を数学的に完全排除
          vec2 skyPlane = dir.xz / (max(dir.y, 0.03) + 0.32) * 1.6;
          vec2 p = skyPlane - vec2(uTime * 0.012, uTime * 0.003);

          float body = cloudField(p);
          float clouds = smoothstep(0.47, 0.58, body);
          float light = smoothstep(-0.06, 0.09, body - cloudField(p + vec2(0.04, 0.12)));
          vec3 cloud = mix(uCloudShade, uCloudLight, light);

          // 雲の高度分布（地平線のすぐ上から中天まで広がる）
          float cloudMask = smoothstep(0.05, 0.25, h) * (1.0 - smoothstep(0.65, 0.90, h));
          sky = mix(sky, cloud, clouds * cloudMask * 0.92);

          // 雲の縁の微細な光彩
          float cloudHalo = smoothstep(0.38, 0.58, body) * cloudMask;
          sky += uCloudLight * (0.08 * cloudHalo);

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.scene.add(skyMesh);

    // 1. 平行光 (太陽光: 本編 day preset に準拠 - intensity 3.2, pos: -1.9, 1.5, 2.6)
    this.directionalLight = new THREE.DirectionalLight('#ffffff', 3.2);
    this.directionalLight.position.set(-1.9, 1.5, 2.6);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.bias = -0.0005;
    this.scene.add(this.directionalLight);

    // 2. 環境光 (本編 day preset 完全準拠: color: #776e74, intensity 0.95。影側の白飛びを防ぎコントラストを締める)
    this.ambientLight = new THREE.AmbientLight('#776e74', 0.95);
    this.scene.add(this.ambientLight);

    // 3. リムライト (自然な反射光)
    this.rimLight = new THREE.DirectionalLight('#e0f2fe', 0.05);
    this.rimLight.position.set(0, 1.5, 2.5);
    this.scene.add(this.rimLight);

    // 4. 太陽・レンズフレア効果
    this.sunEffect = new SunEffect(this.scene);
  }

  private bindFighterEvents(fighter: Fighter) {
    fighter.onSpeak = (name, text, id) => {
      if (this.speakerNameElem && this.speechTextElem) {
        this.speakerNameElem.textContent = name;
        this.speakerNameElem.className = `speaker-name ${id}`;
        this.speechTextElem.textContent = text;
      }
      const bubbleSpeaker = document.getElementById('bubble-speaker');
      const bubbleText = document.getElementById('bubble-text');
      if (bubbleSpeaker && bubbleText && this.gameState === 'predict') {
        bubbleSpeaker.textContent = name;
        bubbleSpeaker.className = `bubble-speaker-tag ${id}`;
        bubbleText.textContent = text;
      }
    };

    // 着水のしぶき・カメラの揺れ・レンズの水滴は、水面を横切った瞬間に update() で起こす
  }

  /** ブラウザの Autoplay Policy による音声ロックをユーザー操作時に解除 */
  public unlockAudio() {
    // BGM・効果音（Web Audio）。BGM は小さめの音量で流し続ける
    this.sound.unlock();
    this.sound.startLoop('bgm', 1.5);
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      try {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      } catch {}
    }
    // ダミーの微小オーディオ再生によるアンロック
    const dummyAudio = new Audio();
    dummyAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    dummyAudio.play().catch(() => {});
  }

  private bindPredictionUI() {
    const btnStart = document.getElementById('btn-start');
    const startOverlay = document.getElementById('start-overlay');
    const cardAoi = document.getElementById('card-aoi');
    const cardEmili = document.getElementById('card-emili');
    const btnPredictAoi = document.getElementById('btn-predict-aoi');
    const btnPredictEmili = document.getElementById('btn-predict-emili');
    const btnNextMatch = document.getElementById('btn-next-match');

    // 1. ゲーム開始ボタン（音声ロック解除 ＆ スタート画面フェードアウト）
    btnStart?.addEventListener('click', () => {
      this.unlockAudio();
      startOverlay?.classList.add('fade-out');
      setTimeout(() => {
        startOverlay?.classList.add('hidden');
      }, 450);
    });

    // 2. フォーカス（mouseenter のみで二重発火を完全防止）
    const onFocusAoi = () => this.focusPrediction('aoi');
    const onFocusEmili = () => this.focusPrediction('emili');
    const onLeaveAoi = () => { if (this.predictFocus === 'aoi') this.focusPrediction(null); };
    const onLeaveEmili = () => { if (this.predictFocus === 'emili') this.focusPrediction(null); };

    cardAoi?.addEventListener('mouseenter', onFocusAoi);
    cardAoi?.addEventListener('focus', onFocusAoi);

    cardEmili?.addEventListener('mouseenter', onFocusEmili);
    cardEmili?.addEventListener('focus', onFocusEmili);

    // フォーカス解除
    cardAoi?.addEventListener('mouseleave', onLeaveAoi);
    cardAoi?.addEventListener('blur', onLeaveAoi);

    cardEmili?.addEventListener('mouseleave', onLeaveEmili);
    cardEmili?.addEventListener('blur', onLeaveEmili);

    // 予想決定
    btnPredictAoi?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.submitPrediction('aoi');
    });
    cardAoi?.addEventListener('click', () => {
      this.submitPrediction('aoi');
    });

    btnPredictEmili?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.submitPrediction('emili');
    });
    cardEmili?.addEventListener('click', () => {
      this.submitPrediction('emili');
    });

    // 次の勝負へ
    btnNextMatch?.addEventListener('click', () => {
      this.startRound();
    });
  }

  /** キャラクターへのフォーカス（予想フェーズでの注視＆セリフ：重複実行・重なり再生を防止） */
  public focusPrediction(id: 'aoi' | 'emili' | null) {
    if (this.gameState !== 'predict') return;
    if (this.predictFocus === id) return; // 既にフォーカス中なら重複処理しない

    this.predictFocus = id;

    const cardAoi = document.getElementById('card-aoi');
    const cardEmili = document.getElementById('card-emili');
    const bubbleSpeaker = document.getElementById('bubble-speaker');
    const bubbleText = document.getElementById('bubble-text');

    if (id === 'aoi') {
      cardAoi?.classList.add('focused');
      cardEmili?.classList.remove('focused');
      this.fighterEmili.clearFocus();
      this.fighterAoi.setLookTarget(this.camera);
      this.fighterAoi.triggerFocus();
    } else if (id === 'emili') {
      cardEmili?.classList.add('focused');
      cardAoi?.classList.remove('focused');
      this.fighterAoi.clearFocus();
      this.fighterEmili.setLookTarget(this.camera);
      this.fighterEmili.triggerFocus();
    } else {
      cardAoi?.classList.remove('focused');
      cardEmili?.classList.remove('focused');
      this.fighterAoi.clearFocus();
      this.fighterEmili.clearFocus();
      if (bubbleSpeaker && bubbleText) {
        bubbleSpeaker.textContent = '案内';
        bubbleSpeaker.className = 'bubble-speaker-tag';
        bubbleText.textContent = 'どちらが勝つか予想してキャラクターに注目してみましょう';
      }
    }
  }

  /** 予想を確定して試合開始 */
  public submitPrediction(id: 'aoi' | 'emili') {
    if (this.gameState !== 'predict') return;
    this.selectedPrediction = id;
    this.predictFocus = null;
    this.fighterAoi.clearFocus();
    this.fighterEmili.clearFocus();

    // 予想デッキを非表示、フッターを表示
    this.predictionDeckElem?.classList.add('hidden');
    document.querySelector('.hud-footer')?.classList.remove('hidden');

    // ヘッダーに予想バッジを表示
    if (this.userPredictionBadgeElem && this.userPredictionNameElem) {
      this.userPredictionBadgeElem.classList.remove('hidden');
      this.userPredictionNameElem.textContent = id === 'aoi' ? 'アオイ' : 'エミリ';
      this.userPredictionNameElem.style.color = id === 'aoi' ? '#ca8a04' : '#dc2626';
    }

    this.gameState = 'ready';
    if (this.matchStatusElem) this.matchStatusElem.textContent = '準備中';

    this.sound.startLoop('water', 1.0);
    this.showBanner('READY...', 1100, () => {
      this.showBanner('HAKKEYOI!', 900, () => {
        this.gameState = 'fight';
        this.fightTime = 0;
        if (this.matchStatusElem) this.matchStatusElem.textContent = '対戦中';
      });
    });
  }

  /** 予想結果の表示 */
  private showPredictionResult(winnerId: 'aoi' | 'emili') {
    if (!this.selectedPrediction) return;

    this.predictionStats.total++;
    const isCorrect = (winnerId === this.selectedPrediction);
    if (isCorrect) {
      this.predictionStats.correct++;
      this.predictionStats.streak++;
    } else {
      this.predictionStats.streak = 0;
    }

    this.updatePredictionStatsUI();

    if (this.resultTitleElem) {
      this.resultTitleElem.textContent = isCorrect ? '予想的中！' : '予想ハズレ…';
      this.resultTitleElem.style.color = isCorrect ? '#0284c7' : '#64748b';
    }
    if (this.resultMessageElem) {
      if (isCorrect) {
        this.resultMessageElem.textContent = `${winnerId === 'aoi' ? 'アオイ' : 'エミリ'}が相手を圧倒してプールを制覇！素晴らしい見立てでした！`;
      } else {
        this.resultMessageElem.textContent = `惜しくも予想は外れましたが、白熱した名勝負でした！次のラウンドに期待しましょう。`;
      }
    }
    if (this.rsWinnerElem) {
      this.rsWinnerElem.textContent = winnerId === 'aoi' ? 'アオイ' : 'エミリ';
      this.rsWinnerElem.style.color = winnerId === 'aoi' ? '#ca8a04' : '#dc2626';
    }
    if (this.rsPredictedElem) {
      this.rsPredictedElem.textContent = this.selectedPrediction === 'aoi' ? 'アオイ' : 'エミリ';
      this.rsPredictedElem.style.color = this.selectedPrediction === 'aoi' ? '#ca8a04' : '#dc2626';
    }
    if (this.rsStreakElem) {
      this.rsStreakElem.textContent = `${this.predictionStats.streak} 連勝`;
    }

    // 勝者ズームイン後にモーダル表示
    setTimeout(() => {
      this.resultModalElem?.classList.remove('hidden');
    }, 1800);
  }

  private updatePredictionStatsUI() {
    if (this.statCorrectElem) this.statCorrectElem.textContent = String(this.predictionStats.correct);
    if (this.statTotalElem) this.statTotalElem.textContent = String(this.predictionStats.total);
    if (this.statStreakElem) this.statStreakElem.textContent = String(this.predictionStats.streak);
  }

  public async init() {
    this.showBanner('NOW LOADING...');
    // 前髪の影（HairShadowRenderer.uniforms）を渡してロード
    await Promise.all([
      this.fighterAoi.load(this.scene, this.camera, this.hairShadow.uniforms),
      this.fighterEmili.load(this.scene, this.camera, this.hairShadow.uniforms),
    ]);
    this.startRound();
  }

  public startRound() {
    this.gameState = 'predict';
    this.roundTimer = 0;
    this.selectedPrediction = null;
    this.predictFocus = null;

    this.fighterAoi.reset();
    this.fighterEmili.reset();
    this.splashedFall.clear();
    this.fallStartedAt.clear();
    this.splashCamTimer = 0;
    this.splashCamTarget = null;
    this.water.clearEffects();
    this.lensDroplets.clear();
    this.lensSplashDelay = -1;
    this.sound.stopLoop('water', 0.4);

    // UI初期化
    this.centerBannerElem?.classList.remove('show');
    this.predictionDeckElem?.classList.remove('hidden');
    this.userPredictionBadgeElem?.classList.add('hidden');
    this.resultModalElem?.classList.add('hidden');
    document.querySelector('.hud-footer')?.classList.add('hidden');
    if (this.matchStatusElem) this.matchStatusElem.textContent = '予想フェーズ';

    if (this.speakerNameElem && this.speechTextElem) {
      this.speakerNameElem.textContent = '';
      this.speakerNameElem.className = 'speaker-name';
      this.speechTextElem.textContent = 'どちらが勝つか予想してキャラクターに注目してみましょう';
    }

    const cardAoi = document.getElementById('card-aoi');
    const cardEmili = document.getElementById('card-emili');
    cardAoi?.classList.remove('focused');
    cardEmili?.classList.remove('focused');
  }

  public restart() {
    this.startRound();
  }

  public toggleCamera() {
    if (this.cameraMode === 'dramatic') {
      this.cameraMode = 'side';
      this.camera.position.set(3.8, 1.3, 0);
      this.controls.target.set(0, 0.8, 0);
    } else if (this.cameraMode === 'side') {
      this.cameraMode = 'free';
    } else {
      this.cameraMode = 'dramatic';
    }
  }

  public showBanner(text: string, duration = 0, onComplete?: () => void) {
    if (this.bannerTextElem && this.centerBannerElem) {
      this.bannerTextElem.textContent = text;
      this.centerBannerElem.classList.add('show');

      if (duration > 0) {
        setTimeout(() => {
          this.centerBannerElem?.classList.remove('show');
          onComplete?.();
        }, duration);
      }
    }
  }

  public triggerCameraShake(strength = 0.2) {
    this.cameraShake = strength;
  }

  /** メインゲームループ */
  public update(delta: number) {
    this.elapsedTime += delta;

    // ヒットストップ処理（打撃瞬間の重み付け）
    let activeDelta = delta;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= delta;
      activeDelta = delta * 0.15;
    }

    // 0. スカイドーム雲アニメーション更新
    if (this.skyMaterial) {
      this.skyMaterial.uniforms['uTime'].value = this.elapsedTime;
    }

    // 2. 浮島物理更新
    const isAoiOn = this.fighterAoi.state !== 'falling' && this.fighterAoi.state !== 'in_water';
    const isEmiliOn = this.fighterEmili.state !== 'falling' && this.fighterEmili.state !== 'in_water';
    this.island.updatePhysics(activeDelta, this.fighterAoi.position, this.fighterEmili.position, isAoiOn, isEmiliOn);

    // 傾きインジケーターUI
    if (this.tiltBarElem) {
      const tiltMag = Math.sqrt(this.island.tiltX * this.island.tiltX + this.island.tiltZ * this.island.tiltZ);
      const percent = Math.min(100, Math.round((tiltMag / 0.3) * 100));
      this.tiltBarElem.style.width = `${percent}%`;
      this.tiltBarElem.style.backgroundColor = percent > 65 ? '#ef4444' : percent > 35 ? '#f59e0b' : '#38bdf8';
    }

    // 3. ファイター更新
    this.fighterAoi.update(activeDelta);
    this.fighterEmili.update(activeDelta);

    // 3.5 水面・しぶき・波紋の更新（着水の検出を含む）
    this.updateWaterInteraction();
    this.water.update(activeDelta, this.camera);
    if (this.lensSplashDelay >= 0) {
      this.lensSplashDelay -= activeDelta;
      if (this.lensSplashDelay < 0) this.lensDroplets.splash(1);
    }
    this.lensDroplets.update(delta);

    // 4. オートバトルAI & 当たり判定 (FIGHT中)
    if (this.gameState === 'fight') {
      this.updateFight(activeDelta);
    } else if (this.gameState === 'round_end') {
      this.roundTimer += activeDelta;
      // 予想結果モーダルが表示されるため、プレイヤーが「次の勝負へ」ボタンを押すまで待機
    }

    // 5. 太陽・レンズフレア・オクルージョン計算
    const activeMeshes: THREE.Object3D[] = [];
    if (this.fighterAoi.vrm?.scene) activeMeshes.push(this.fighterAoi.vrm.scene);
    if (this.fighterEmili.vrm?.scene) activeMeshes.push(this.fighterEmili.vrm.scene);

    const sunInfo = this.sunEffect.update(
      this.camera,
      activeDelta,
      this.elapsedTime,
      {
        lighting: {
          sunShafts: {
            enabled: true,
            followDirectionalLight: false,
            sunPosition: { x: 3.2, y: 4.3, z: -3.8 },
            exposure: 0.22,
            decay: 0.83,
            density: 0.35,
            weight: 0.08,
            color: '#fff2db',
            shimmer: 0.25,
          },
          lensFlare: {
            enabled: true,
            sunSize: 1.3,
            sunColor: '#fffbf5',
            glowIntensity: 0.95,
            starburstIntensity: 0.05,
            anamorphicIntensity: 1.15,
            ghostIntensity: 0.35,
            haloIntensity: 0.5,
          },
        },
      },
      this.directionalLight,
      activeMeshes
    );

    // 6. ゴッドレイのユニフォーム更新
    if (this.godRaysPass.enabled) {
      this.godRaysPass.uniforms['uSunPosition'].value.copy(sunInfo.sunScreenPosition);
      this.godRaysPass.uniforms['uSunVisibility'].value = sunInfo.sunVisibility;
      this.godRaysPass.uniforms['uTime'].value = this.elapsedTime;
    }

    this.cinematicAnimePass.uniforms['uTime'].value = this.elapsedTime;

    // 7. 前髪の影用に髪の深度を描く（スクリーンスペース方式）
    this.hairShadow.render(this.renderer, this.scene, this.camera, this.directionalLight);

    // 8. キャラのマスク（ライトラップ・パラ用）を描画
    this.characterMask.render(this.renderer, this.scene, this.camera);

    // 9. カメラワーク更新
    this.updateCamera(activeDelta);

    // 10. 水面の平面反射（カメラの最終位置が決まったあとで描く）
    this.water.renderReflection(this.scene, this.camera, [
      this.sunEffect['sunGroup'],
      this.sunEffect['flareGroup'],
    ]);

    // 11. レンダリング
    this.composer.render();
  }

  /** 落下したキャラが水面に届いた時のしぶき・レンズの水滴、水に浮かぶキャラの波紋 */
  private updateWaterInteraction() {
    for (const f of [this.fighterAoi, this.fighterEmili]) {
      if (f.state === 'falling') {
        if (!this.splashedFall.has(f.id + ':started')) {
          this.splashedFall.add(f.id + ':started');
          this.fallStartedAt.set(f.id, this.fightTime);
          // 勝敗はこの時点で決まっている。相手は落ちない
          (f === this.fighterAoi ? this.fighterEmili : this.fighterAoi).cannotFall = true;
          this.splashCamTarget = f;
          this.splashCamTimer = SPLASH_CAM_DURATION;
          this.splashCamCut = true;
        }
        if (f.position.y <= 0 && f.velocity.y < 0 && !this.splashedFall.has(f.id)) {
          this.splashedFall.add(f.id);
          const speed = Math.max(0, -f.velocity.y);
          this.water.triggerBigSplash(f.position, speed / 2.6);
          this.sound.play('drop');
          this.triggerCameraShake(0.55);
          this.lensSplashDelay = 0.35;
        }
      } else if (f.state !== 'in_water') {
        this.splashedFall.delete(f.id);
        this.splashedFall.delete(f.id + ':started');
      }
      this.water.setFloater(f.id, f.position.x, f.position.z, f.state === 'in_water');
    }
  }

  /**
   * 対戦の 1 フレーム。
   * 間合い詰め → 攻撃の判断 → お尻の接触と押し合い → 当たり判定 → 決着、の順。
   */
  private updateFight(delta: number) {
    this.fightTime += delta;
    this.updateBattleAI(delta);
    this.resolveContact(delta);
    this.checkHipCollision();
    this.checkRingOut();
  }

  /** 攻撃の強さは、長引いたら少しずつ上げて決着を促す */
  private get fightIntensity(): number {
    return 1 + Math.max(0, this.fightTime - 12) * 0.08;
  }

  /** オート対戦AIロジック（間合いを詰める・押し合い・攻撃の判断） */
  private updateBattleAI(delta: number) {
    const A = this.fighterAoi;
    const E = this.fighterEmili;

    // 性格: アオイは素早い突き中心、エミリは重い攻撃中心
    const chooseAttack = (f: Fighter): AttackType => {
      const r = Math.random();
      if (f.id === 'aoi') {
        if (r < 0.40) return 'quick';
        if (r < 0.70) return 'normal';
        if (r < 0.88) return 'jump';
        return 'heavy';
      }
      if (r < 0.22) return 'quick';
      if (r < 0.54) return 'normal';
      if (r < 0.78) return 'jump';
      return 'heavy';
    };

    // 1. 間合いを詰める（お尻の隙間が空いていれば、構えているほうが下がって寄る）
    const gap = A.rearZ - E.rearZ;
    const aReady = A.state === 'ready', eReady = E.state === 'ready';
    if (gap > 0.005) {
      const speed = 1.1 * delta;
      if (aReady && eReady) {
        const d = Math.min(gap / 2, speed);
        A.shiftRootZ(-d);
        E.shiftRootZ(d);
      } else if (aReady && E.state !== 'attack') {
        A.shiftRootZ(-Math.min(gap, speed * 1.5));
      } else if (eReady && A.state !== 'attack') {
        E.shiftRootZ(Math.min(gap, speed * 1.5));
      }
    }
    // 横のずれは、向き合う位置へ寄せる
    if (aReady && eReady) {
      const dx = A.position.x - E.position.x;
      if (Math.abs(dx) > 0.03) {
        const d = Math.sign(dx) * Math.min(Math.abs(dx) / 2, 0.6 * delta);
        A.shiftRootX(-d);
        E.shiftRootX(d);
      }
    }

    // 2. 押し合い: 構え同士で接していると、力の強いほうへ少しずつ押していく（止まって見えないように）
    if (aReady && eReady && gap < 0.04) {
      const t = this.fightTime;
      const strength = (f: Fighter, phase: number, base: number) =>
        base * (0.65 + 0.35 * Math.sin(t * 1.9 + phase) * Math.sin(t * 0.7 + phase * 2.1)) * (0.55 + 0.45 * f.balance);
      const drift = strength(A, 0.4, 1.0) - strength(E, 2.3, 1.0);
      const v = THREE.MathUtils.clamp(drift * 0.55, -0.28, 0.28); // + はアオイが押している（-Z 方向へ）
      A.shiftRootZ(-v * delta);
      E.shiftRootZ(-v * delta);
    }

    // 3. 攻撃の判断（接していて、相手が構え・よろけ・攻撃中のとき）
    const near = Math.abs(A.rearZ - E.rearZ) < 0.25 && Math.abs(A.position.x - E.position.x) < 0.45;
    const tryAttack = (me: Fighter, other: Fighter) => {
      if (me.state !== 'ready' || !near) return;
      // 相手がよろけている・崩れているときは畳みかける
      const chance = other.state === 'stumble' ? 2.2 : 1 + (1 - other.balance) * 0.8;
      me.attackCooldown -= delta * chance;
      if (me.attackCooldown <= 0) {
        const type = chooseAttack(me);
        me.triggerAttack(type);
        const base = type === 'heavy' ? 1.1 : type === 'jump' ? 0.9 : type === 'normal' ? 0.7 : 0.5;
        me.attackCooldown = base + Math.random() * 0.6;
      }
    };
    tryAttack(A, E);
    tryAttack(E, A);

    // 4. よろけから立ち直ったら、すぐ反撃に出ることが多い
    for (const f of [A, E]) {
      if (f.justRecovered) {
        f.justRecovered = false;
        if (Math.random() < 0.35 + 0.4 * f.balance) f.attackCooldown = Math.min(f.attackCooldown, 0.15 + Math.random() * 0.25);
      }
    }
  }

  /**
   * お尻の接触。お尻の後端がめり込んだ分だけルートをずらして、隙間もめり込みもない状態に保つ。
   * 攻撃中の側は踏ん張り、よろけている側がより大きく押し戻される（＝押しているのが見える）。
   */
  private resolveContact(delta: number) {
    const A = this.fighterAoi;
    const E = this.fighterEmili;
    const solid = (f: Fighter) => f.state === 'ready' || f.state === 'attack' || f.state === 'stumble';
    if (!solid(A) || !solid(E)) {
      A.pressAmount = 0;
      E.pressAmount = 0;
      return;
    }

    const mobility = (f: Fighter) => {
      if (f.state === 'attack') {
        const cfg = f.currentAttackType ? ATTACK_CONFIGS[f.currentAttackType] : ATTACK_CONFIGS.normal;
        return f.stateTimer < cfg.impactTime + 0.3 ? 0.15 : 0.5;
      }
      return f.state === 'stumble' ? 1.0 : 0.5;
    };

    const gap = A.rearZ - E.rearZ;
    if (gap < 0) {
      const depth = -gap;
      const wA = mobility(A), wE = mobility(E);
      const total = wA + wE;
      A.shiftRootZ(depth * (wA / total));
      E.shiftRootZ(-depth * (wE / total));
    }

    const press = THREE.MathUtils.clamp(1 - Math.max(0, gap) / 0.06, 0, 1);
    A.pressAmount = A.state === 'ready' ? press : 0;
    E.pressAmount = E.state === 'ready' ? press : 0;
    void delta;
  }

  /** ヒップアタックの接触判定と多段階リアクション */
  private checkHipCollision() {
    const A = this.fighterAoi;
    const E = this.fighterEmili;

    // 接触: お尻の後端が触れていて（resolveContact で隙間なし）、横のずれが小さい
    const gap = A.rearZ - E.rearZ;
    const touching = gap <= 0.012 && Math.abs(A.position.x - E.position.x) < 0.40;

    const aoiCfg = A.currentAttackType ? ATTACK_CONFIGS[A.currentAttackType] : null;
    const emiliCfg = E.currentAttackType ? ATTACK_CONFIGS[E.currentAttackType] : null;

    // インパクトのタイミング（突き出しの勢いが乗った段階以降で、未ヒット）
    const aoiCanHit = A.state === 'attack' && !A.hasHit && aoiCfg && A.stateTimer >= aoiCfg.impactTime * 0.60;
    const emiliCanHit = E.state === 'attack' && !E.hasHit && emiliCfg && E.stateTimer >= emiliCfg.impactTime * 0.60;

    if (!touching || !(aoiCanHit || emiliCanHit)) return;

    /** 押し出す: 相手の安定度・島の縁への近さ・長引き具合で、飛ぶ距離が変わる */
    const shove = (attacker: Fighter, victim: Fighter, cfg: AttackConfig, scale = 1) => {
      const dir = attacker.id === 'aoi' ? -1 : 1; // 相手が押される向き（Z）
      const edge = THREE.MathUtils.clamp((Math.hypot(victim.position.x, victim.position.z) - 0.6) / 0.9, 0, 1);
      const mult = (1.4 - victim.balance * 0.55) * (1 + edge * 0.35) * (0.85 + Math.random() * 0.3) * this.fightIntensity * scale;
      const v0 = cfg.pushPower * 0.34 * mult;
      victim.takeHit(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, dir * v0), cfg.severity);
      // 当たった音（強い技ほど大きく鳴らす）
      this.sound.play('attack', cfg.severity === 'heavy' ? 1 : cfg.severity === 'spin' ? 0.9 : cfg.severity === 'normal' ? 0.8 : 0.65);
      // 押した側も、反動で腰が少し戻る。当てた側はそのまま畳みかけやすい
      attacker.recoilImpulse(-dir * v0 * 0.25);
      if (Math.random() < 0.4) attacker.attackCooldown = Math.min(attacker.attackCooldown, 0.35 + Math.random() * 0.35);
      this.island.applyImpulse(new THREE.Vector3(0, cfg.impulseY, dir * cfg.pushPower * 0.8), victim.position);
      const strength = cfg.severity === 'heavy' ? 1.3 : cfg.severity === 'spin' ? 1.1 : 0.85;
      this.water.triggerImpactSplash(victim.position, strength);
      this.triggerCameraShake(cfg.severity === 'heavy' ? 0.65 : cfg.severity === 'spin' ? 0.52 : 0.40);
    };

    if (aoiCanHit && !emiliCanHit && aoiCfg) {
      A.hasHit = true;
      this.hitStopTimer = 0.08;
      shove(A, E, aoiCfg);
    } else if (emiliCanHit && !aoiCanHit && emiliCfg) {
      E.hasHit = true;
      this.hitStopTimer = 0.08;
      shove(E, A, emiliCfg);
    } else if (aoiCanHit && emiliCanHit && aoiCfg && emiliCfg) {
      // ヒップ相殺（激突）
      A.hasHit = true;
      E.hasHit = true;
      this.hitStopTimer = 0.10;
      const midPos = A.position.clone().lerp(E.position, 0.5);
      this.water.triggerImpactSplash(midPos);

      if (Math.abs(aoiCfg.pushPower - emiliCfg.pushPower) < 0.6) {
        // 同等威力: 両者とも弾かれる
        this.sound.play('attack', 0.7);
        A.takeHit(new THREE.Vector3(0, 0, 1.1), 'light');
        E.takeHit(new THREE.Vector3(0, 0, -1.1), 'light');
        this.island.applyImpulse(new THREE.Vector3(0, -2.8, 0), this.island.group.position);
        this.triggerCameraShake(0.35);
      } else if (aoiCfg.pushPower > emiliCfg.pushPower) {
        shove(A, E, aoiCfg, 0.8);
      } else {
        shove(E, A, emiliCfg, 0.8);
      }
    }
  }

  /** 決着の効果音。水の音はフェードアウト */
  private onRoundFinished() {
    this.sound.play('finish');
    this.sound.stopLoop('water', 1.2);
  }

  /** リングアウト（落下）判定 */
  private checkRingOut() {
    // 同じフレームで両方が水に落ちた場合は、あとから落ち始めたほうの勝ち
    if (this.gameState === 'fight' && this.fighterAoi.state === 'in_water' && this.fighterEmili.state === 'in_water') {
      const aoiLater = this.fallStartedAt.get('aoi')! >= (this.fallStartedAt.get('emili') ?? 0);
      const loser = aoiLater ? this.fighterEmili : this.fighterAoi;
      const winner = aoiLater ? this.fighterAoi : this.fighterEmili;
      // 負けた側だけが水に残り、勝った側は島に引き戻して勝利ポーズにする
      winner.position.copy(winner.config.initialPos);
      winner.state = 'ready';
      void loser;
    }
    if (this.fighterAoi.state === 'in_water' && this.fighterEmili.state !== 'in_water' && this.gameState === 'fight') {
      this.gameState = 'round_end';
      this.roundTimer = 0;
      this.scoreEmili++;
      if (this.scoreEmiliElem) this.scoreEmiliElem.textContent = String(this.scoreEmili);
      if (this.matchStatusElem) this.matchStatusElem.textContent = 'エミリ勝利';
      this.fighterEmili.triggerWin();
      this.onRoundFinished();
      this.showBanner('EMILI WIN!', 2200);
      this.showPredictionResult('emili');
    } else if (this.fighterEmili.state === 'in_water' && this.fighterAoi.state !== 'in_water' && this.gameState === 'fight') {
      this.gameState = 'round_end';
      this.roundTimer = 0;
      this.scoreAoi++;
      if (this.scoreAoiElem) this.scoreAoiElem.textContent = String(this.scoreAoi);
      if (this.matchStatusElem) this.matchStatusElem.textContent = 'アオイ勝利';
      this.fighterAoi.triggerWin();
      this.onRoundFinished();
      this.showBanner('AOI WIN!', 2200);
      this.showPredictionResult('aoi');
    }
  }

  /** カメラワーク制御 */
  private updateCamera(delta: number) {
    if (this.cameraMode === 'dramatic') {
      const isPredict = this.gameState === 'predict';
      const isRoundEnd = this.gameState === 'round_end';
      const winner = this.fighterAoi.state === 'won' ? this.fighterAoi : this.fighterEmili.state === 'won' ? this.fighterEmili : null;

      // 0. 着水のしぶきを見せる：落ちたキャラの横から、着水地点をやや引きで映す
      if (this.splashCamTimer > 0 && this.splashCamTarget && !isPredict) {
        this.splashCamTimer -= delta;
        const v = this.splashCamTarget.position;
        let rx = v.x, rz = v.z;
        const rl = Math.hypot(rx, rz);
        if (rl < 0.01) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
        const targetCam = new THREE.Vector3(v.x - rz * 2.4 + rx * 1.3, 0.9, v.z + rx * 2.4 + rz * 1.3);
        const targetLook = new THREE.Vector3(v.x, 0.5, v.z);
        if (this.splashCamCut) {
          // 島の真ん中を横切らないよう、最初はカットで切り替える
          this.splashCamCut = false;
          this.camera.position.copy(targetCam);
          this.controls.target.copy(targetLook);
        } else {
          this.camera.position.lerp(targetCam, delta * 3.2);
          this.controls.target.lerp(targetLook, delta * 4.5);
        }
      }
      // 1. 予想フェーズ：カードにフォーカスしたキャラクターを美しく映す
      else if (isPredict) {
        if (this.predictFocus === 'aoi') {
          // アオイにフォーカス（正面 +Z 側から、頭頂部が見切れない美しいバストアップ構図）
          const pos = this.fighterAoi.position;
          const targetLook = new THREE.Vector3(pos.x, pos.y + 0.82, pos.z);
          const targetCam = new THREE.Vector3(pos.x - 0.28, pos.y + 0.94, pos.z + 1.55);
          this.camera.position.lerp(targetCam, delta * 4.0);
          this.controls.target.lerp(targetLook, delta * 4.5);
        } else if (this.predictFocus === 'emili') {
          // エミリにフォーカス（正面 -Z 側から、頭頂部が見切れない美しいバストアップ構図）
          const pos = this.fighterEmili.position;
          const targetLook = new THREE.Vector3(pos.x, pos.y + 0.82, pos.z);
          const targetCam = new THREE.Vector3(pos.x + 0.28, pos.y + 0.94, pos.z - 1.55);
          this.camera.position.lerp(targetCam, delta * 4.0);
          this.controls.target.lerp(targetLook, delta * 4.5);
        } else {
          // 初期状態：2人全体が見える構図
          const targetLook = new THREE.Vector3(0, 0.85, 0);
          const targetCam = new THREE.Vector3(3.4, 1.30, 0.6);
          this.camera.position.lerp(targetCam, delta * 2.5);
          this.controls.target.lerp(targetLook, delta * 3.5);
        }
      }
      // 2. 勝敗決定時：勝者アバターへのドラマチックなクローズアップ（バストアップ〜ウェストアップ）
      else if (isRoundEnd && winner) {
        // 勝者の顔・胸元（Y = 1.08m）を注視点にする
        const winnerPos = winner.position;
        const targetLook = new THREE.Vector3(winnerPos.x, winnerPos.y + 1.08, winnerPos.z);
        this.controls.target.lerp(targetLook, delta * 3.5);

        // 勝者の正面やや斜め前方（距離約 1.85m、高さ 1.22m）から表情と勝利ポーズを綺麗に捉える
        // アオイの正面は +Z 側、エミリの正面は -Z 側
        const frontDir = winner.id === 'aoi' ? 1 : -1;
        const targetCam = new THREE.Vector3(
          winnerPos.x + (winner.id === 'aoi' ? -0.35 : 0.35),
          winnerPos.y + 1.22,
          winnerPos.z + frontDir * 1.85
        );
        this.camera.position.lerp(targetCam, delta * 3.5);
      }
      // 2. 対戦中のダイナミック・アクション演出カメラ
      else {
        const attacker = this.fighterAoi.state === 'attack' ? this.fighterAoi : this.fighterEmili.state === 'attack' ? this.fighterEmili : null;
        const victim = this.fighterAoi.state === 'stumble' ? this.fighterAoi : this.fighterEmili.state === 'stumble' ? this.fighterEmili : null;
        const midX = (this.fighterAoi.position.x + this.fighterEmili.position.x) / 2;
        const midZ = (this.fighterAoi.position.z + this.fighterEmili.position.z) / 2;

        if (attacker) {
          // 攻撃中：カメラが攻撃側の斜め後ろから相手へ突進する迫力のアングルへドリーイン！
          const attackDir = attacker.id === 'aoi' ? -1 : 1; // 突き出し方向
          const targetCam = new THREE.Vector3(
            attacker.position.x + 1.9,
            0.95 + this.island.offsetY,
            attacker.position.z - attackDir * 1.3
          );
          const targetLook = new THREE.Vector3(midX, 0.75 + this.island.offsetY, midZ);
          this.camera.position.lerp(targetCam, delta * 4.5);
          this.controls.target.lerp(targetLook, delta * 5.0);
        } else if (victim) {
          // 被弾中：吹っ飛んだキャラクターを少し引いたアングルから追従
          const targetCam = new THREE.Vector3(
            victim.position.x + 2.6,
            1.1 + this.island.offsetY,
            midZ + 0.8
          );
          const targetLook = new THREE.Vector3(victim.position.x, 0.70 + this.island.offsetY, victim.position.z);
          this.camera.position.lerp(targetCam, delta * 3.5);
          this.controls.target.lerp(targetLook, delta * 4.0);
        } else {
          // 通常時（構え・間合い詰め）：浮島の周りを滑らかに周回・旋回（オービット）
          const time = this.elapsedTime * 0.45;
          const orbitRadius = 3.2 + Math.sin(time * 0.6) * 0.35;
          const targetCamX = Math.cos(time + 0.8) * orbitRadius;
          const targetCamZ = Math.sin(time + 0.8) * orbitRadius;
          const targetCamY = 1.25 + Math.sin(time * 1.1) * 0.20;

          const targetCam = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);
          const targetLook = new THREE.Vector3(midX, 0.75 + this.island.offsetY, midZ);
          this.camera.position.lerp(targetCam, delta * 2.5);
          this.controls.target.lerp(targetLook, delta * 3.5);
        }
      }
    } else if (this.cameraMode === 'side') {
      this.camera.position.lerp(new THREE.Vector3(3.6, 1.2, 0), delta * 3.0);
      this.controls.target.lerp(new THREE.Vector3(0, 0.8, 0), delta * 4.0);
    }

    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.z += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake -= delta * 1.2;
      if (this.cameraShake < 0) this.cameraShake = 0;
    }

    this.controls.update();
  }

  private onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const targetW = Math.floor(width * pixelRatio);
    const targetH = Math.floor(height * pixelRatio);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.hairShadow.setSize(targetW, targetH);
    this.characterMask.setSize(targetW, targetH);
    this.lightWrapPass.uniforms['uResolution'].value.set(targetW, targetH);
    this.cinematicAnimePass.uniforms['uResolution'].value.set(targetW, targetH);
    this.smaaPass.setSize(targetW, targetH);
    this.lensDroplets.setSize(targetW, targetH);
    this.water.setSize(targetW, targetH);
  };
}
