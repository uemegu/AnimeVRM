import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { applyToonShader, ToonShaderController } from '../ToonShader';
import { AudioLipSync, LipSyncStats, Phoneme, PHONEMES } from '../AudioLipSync';
import { resolveAssetUrl } from '../utils/path';

// --- Types & Constants ---
interface AudioTrackOption {
  label: string;
  url: string;
  gender: 'female' | 'male';
  isVowels?: boolean;
}

const SAMPLE_TRACKS: AudioTrackOption[] = [
  // Irodori-TTS Female Samples
  { label: '🌟 [Irodori-TTS] あーいーうーえーおー (女性)', url: '/voices/lipsync_vowels_female.wav', gender: 'female', isVowels: true },
  { label: '🌟 [Irodori-TTS] あーーーーー (女性)', url: '/voices/lipsync_female_a.wav', gender: 'female' },
  { label: '🌟 [Irodori-TTS] いーーーーー (女性)', url: '/voices/lipsync_female_i.wav', gender: 'female' },
  { label: '🌟 [Irodori-TTS] うーーーーー (女性)', url: '/voices/lipsync_female_u.wav', gender: 'female' },
  { label: '🌟 [Irodori-TTS] えーーーーー (女性)', url: '/voices/lipsync_female_e.wav', gender: 'female' },
  { label: '🌟 [Irodori-TTS] おーーーーー (女性)', url: '/voices/lipsync_female_o.wav', gender: 'female' },
  // Existing Female Samples
  { label: '👧 アオイ会話: 「今日はいい天気だね！」 (date_aoi_01)', url: '/voices/date_aoi_01.wav', gender: 'female' },
  { label: '👧 アオイ告白: 「来てくれたんだ！」 (confess_intro_1)', url: '/voices/confess_intro_1.wav', gender: 'female' },
  { label: '👧 アオイ決め台詞: 「大好き！」 (pv_cut9_daisuki)', url: '/voices/pv_cut9_daisuki.wav', gender: 'female' },
  { label: '👱‍♀️ エミリ会話: 「カフェに寄っていこうよ」 (chat_cafe_1)', url: '/voices/chat_cafe_1.wav', gender: 'female' },
  { label: '💤 シオン解説: 「投資信託とは…」 (nisa_01)', url: '/voices/nisa_01.wav', gender: 'female' },

  // Irodori-TTS Male Samples
  { label: '🌟 [Irodori-TTS] あーいーうーえーおー (男性)', url: '/voices/lipsync_vowels_male.wav', gender: 'male', isVowels: true },
  { label: '🌟 [Irodori-TTS] あーーーーー (男性)', url: '/voices/lipsync_male_a.wav', gender: 'male' },
  { label: '🌟 [Irodori-TTS] いーーーーー (男性)', url: '/voices/lipsync_male_i.wav', gender: 'male' },
  { label: '🌟 [Irodori-TTS] うーーーーー (男性)', url: '/voices/lipsync_male_u.wav', gender: 'male' },
  { label: '🌟 [Irodori-TTS] えーーーーー (男性)', url: '/voices/lipsync_male_e.wav', gender: 'male' },
  { label: '🌟 [Irodori-TTS] おーーーーー (男性)', url: '/voices/lipsync_male_o.wav', gender: 'male' },
];

const PHONEME_LABEL_MAP: Record<string, { char: string; name: string }> = {
  aa: { char: 'あ', name: 'aa (あ)' },
  ih: { char: 'い', name: 'ih (い)' },
  ou: { char: 'う', name: 'ou (う)' },
  ee: { char: 'え', name: 'ee (え)' },
  oh: { char: 'お', name: 'oh (お)' },
  nn: { char: '-', name: 'SILENCE (無音)' },
};

// --- Application State ---
let currentGender: 'female' | 'male' = 'female';
let currentVRM: VRM | null = null;
let toonController: ToonShaderController | null = null;
let currentCameraPreset: 'mouth' | 'face' | 'bust' = 'mouth';
let mouthWorldPos = new THREE.Vector3(0, 1.35, 0);
let headWorldPos = new THREE.Vector3(0, 1.42, 0);
let currentModelUrl = '/models/aoi/aoi-school.vrm';
let customObjectUrl: string | null = null;

// Lip-sync weights smoothing
const currentWeights: Record<Phoneme, number> = {
  aa: 0,
  ee: 0,
  ih: 0,
  oh: 0,
  ou: 0,
};

// --- DOM Elements ---
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('app');
const hudBox = $<HTMLDivElement>('active-phoneme-hud');
const hudChar = $<HTMLDivElement>('hud-phoneme-char');
const hudTag = $<HTMLDivElement>('hud-phoneme-tag');
const hudF1 = $<HTMLElement>('hud-f1');
const hudF2 = $<HTMLElement>('hud-f2');

const btnEngineWasm = $<HTMLButtonElement>('btn-engine-wasm');
const btnEngineLegacy = $<HTMLButtonElement>('btn-engine-legacy');
const engineBadge = $<HTMLSpanElement>('engine-badge');
const engineDesc = $<HTMLDivElement>('engine-desc');

const btnGenderFemale = $<HTMLButtonElement>('btn-gender-female');
const btnGenderMale = $<HTMLButtonElement>('btn-gender-male');
const selectModel = $<HTMLSelectElement>('select-model');
const inputVrmFile = $<HTMLInputElement>('input-vrm-file');
const vrmFileName = $<HTMLSpanElement>('vrm-file-name');

const tabBtnSample = $<HTMLButtonElement>('tab-btn-sample');
const tabBtnMic = $<HTMLButtonElement>('tab-btn-mic');
const tabBtnFile = $<HTMLButtonElement>('tab-btn-file');
const tabContentSample = $<HTMLDivElement>('tab-content-sample');
const tabContentMic = $<HTMLDivElement>('tab-content-mic');
const tabContentFile = $<HTMLDivElement>('tab-content-file');

const selectAudioTrack = $<HTMLSelectElement>('select-audio-track');
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnStop = $<HTMLButtonElement>('btn-stop');
const checkLoop = $<HTMLInputElement>('check-loop');
const audioSeekSlider = $<HTMLInputElement>('audio-seek-slider');
const audioCurrentTime = $<HTMLSpanElement>('audio-current-time');
const audioTotalTime = $<HTMLSpanElement>('audio-total-time');

const btnMicToggle = $<HTMLButtonElement>('btn-mic-toggle');
const micBtnText = $<HTMLSpanElement>('mic-btn-text');
const micLevelFill = $<HTMLDivElement>('mic-level-fill');
const sliderMicGain = $<HTMLInputElement>('slider-mic-gain');
const valMicGain = $<HTMLSpanElement>('val-mic-gain');
const sliderMicHold = $<HTMLInputElement>('slider-mic-hold');
const valMicHold = $<HTMLSpanElement>('val-mic-hold');

const inputAudioFile = $<HTMLInputElement>('input-audio-file');
const audioFileName = $<HTMLSpanElement>('audio-file-name');
const fileTransport = $<HTMLDivElement>('file-transport');
const btnFilePlay = $<HTMLButtonElement>('btn-file-play');
const btnFileStop = $<HTMLButtonElement>('btn-file-stop');
const checkFileLoop = $<HTMLInputElement>('check-file-loop');

const btnResetStats = $<HTMLButtonElement>('btn-reset-stats');
const statCurrent = $<HTMLSpanElement>('stat-current');
const statAvg = $<HTMLSpanElement>('stat-avg');
const statMin = $<HTMLSpanElement>('stat-min');
const statMax = $<HTMLSpanElement>('stat-max');
const statCount = $<HTMLSpanElement>('stat-count');
const statRms = $<HTMLSpanElement>('stat-rms');

const camPresetMouth = $<HTMLButtonElement>('cam-preset-mouth');
const camPresetFace = $<HTMLButtonElement>('cam-preset-face');
const camPresetBust = $<HTMLButtonElement>('cam-preset-bust');
const camReset = $<HTMLButtonElement>('cam-reset');

// --- Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.15;
controls.maxDistance = 4.0;
controls.target.set(0, 1.35, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xfff8ee, 2.0);
mainLight.position.set(0.8, 1.8, 1.5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xccddff, 1.0);
fillLight.position.set(-1.0, 1.2, -0.5);
scene.add(fillLight);

// --- Audio Lip-Sync Setup ---
const audioLipSync = new AudioLipSync({
  onPhonemeChange: (phoneme) => {
    updateHudPhoneme(phoneme || 'nn');
  },
  onPlayStateChange: (isPlaying) => {
    btnPlay.textContent = isPlaying ? '⏸ 一時停止' : '▶ 再生';
    btnFilePlay.textContent = isPlaying ? '⏸ 一時停止' : '▶ 再生';
  },
  onTimeUpdate: (current, duration) => {
    const format = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };
    audioCurrentTime.textContent = format(current);
    audioTotalTime.textContent = format(duration);
    if (duration > 0) {
      audioSeekSlider.value = String((current / duration) * 100);
    }
  },
  onEnded: () => {
    btnPlay.textContent = '▶ 再生';
    btnFilePlay.textContent = '▶ 再生';
    updateHudPhoneme('nn');
  },
  onStatsUpdate: (stats: LipSyncStats) => {
    updateStatsUI(stats);
  },
});

audioLipSync.setVoiceGender(currentGender);
audioLipSync.setAudioDelay(0.04);

// --- VRM Loading & Camera Framing ---
const gltfLoader = new GLTFLoader();
gltfLoader.register((parser) => new VRMLoaderPlugin(parser));

function calculateMouthPosition(vrm: VRM): { mouth: THREE.Vector3; head: THREE.Vector3 } {
  const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
  const leftEyeNode = vrm.humanoid?.getNormalizedBoneNode('leftEye');
  const rightEyeNode = vrm.humanoid?.getNormalizedBoneNode('rightEye');

  const headWorld = new THREE.Vector3();
  if (headNode) {
    headNode.getWorldPosition(headWorld);
  } else {
    headWorld.set(0, 1.42, 0);
  }

  const eyeWorld = new THREE.Vector3();
  if (leftEyeNode && rightEyeNode) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    leftEyeNode.getWorldPosition(p1);
    rightEyeNode.getWorldPosition(p2);
    eyeWorld.addVectors(p1, p2).multiplyScalar(0.5);
  } else if (leftEyeNode) {
    leftEyeNode.getWorldPosition(eyeWorld);
  } else {
    eyeWorld.copy(headWorld).add(new THREE.Vector3(0, 0.08, 0.05));
  }

  // Mouth is typically ~6.8cm below eye level and slightly forward
  const mouthWorld = new THREE.Vector3(
    eyeWorld.x,
    eyeWorld.y - 0.068,
    eyeWorld.z + 0.035
  );

  return { mouth: mouthWorld, head: headWorld };
}

function applyCameraPreset(preset: 'mouth' | 'face' | 'bust', smooth = true) {
  currentCameraPreset = preset;
  [camPresetMouth, camPresetFace, camPresetBust].forEach((b) => b.classList.remove('active'));

  let target = mouthWorldPos.clone();
  let dist = 0.26;
  let fov = 20;

  if (preset === 'mouth') {
    camPresetMouth.classList.add('active');
    target = mouthWorldPos.clone();
    dist = 0.26; // Tight close-up on mouth
    fov = 20;
  } else if (preset === 'face') {
    camPresetFace.classList.add('active');
    target = mouthWorldPos.clone().add(new THREE.Vector3(0, 0.035, 0));
    dist = 0.55;
    fov = 24;
  } else if (preset === 'bust') {
    camPresetBust.classList.add('active');
    target = mouthWorldPos.clone().add(new THREE.Vector3(0, -0.15, 0));
    dist = 1.15;
    fov = 28;
  }

  camera.fov = fov;
  camera.updateProjectionMatrix();

  const camPos = new THREE.Vector3(target.x, target.y, target.z + dist);
  camera.position.copy(camPos);
  controls.target.copy(target);
  controls.update();
}

async function loadVRMModel(url: string) {
  if (currentVRM) {
    scene.remove(currentVRM.scene);
    VRMUtils.deepDispose(currentVRM.scene);
    currentVRM = null;
    if (toonController) {
      toonController.dispose();
      toonController = null;
    }
  }

  try {
    const resolvedUrl = resolveAssetUrl(url);
    const gltf = await gltfLoader.loadAsync(resolvedUrl);
    const vrm = gltf.userData.vrm as VRM;
    if (!vrm) {
      throw new Error('No VRM found in loaded file');
    }

    currentVRM = vrm;
    VRMUtils.rotateVRM0(vrm);

    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.frustumCulled = false;
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });

    scene.add(vrm.scene);
    vrm.update(0);

    // Apply toon shader
    toonController = applyToonShader(vrm, scene, {
      bodyPattern: /Body.*SKIN|body|skin|肌|体/i,
      hairPattern: /Hair|hair|髪/i,
      clothPattern: /Cloth|Tops|Bottoms|Shoes|Onepiece|outfit|dress|jacket|shirt|skirt|shoes|服|靴/i,
      debug: false,
    });
    toonController.update();

    // Calculate mouth and head coordinates
    const positions = calculateMouthPosition(vrm);
    mouthWorldPos.copy(positions.mouth);
    headWorldPos.copy(positions.head);

    // Frame camera on mouth by default
    applyCameraPreset(currentCameraPreset, false);
  } catch (err) {
    console.error('Failed to load VRM:', err);
    alert('VRMモデルの読み込みに失敗しました: ' + (err instanceof Error ? err.message : String(err)));
  }
}

// --- UI Updates & Sync ---
function populateSampleTracks() {
  selectAudioTrack.innerHTML = '';
  const filtered = SAMPLE_TRACKS.filter((t) => t.gender === currentGender);
  filtered.forEach((track, idx) => {
    const opt = document.createElement('option');
    opt.value = track.url;
    opt.textContent = track.label;
    if (idx === 0) opt.selected = true;
    selectAudioTrack.appendChild(opt);
  });

  if (filtered.length > 0) {
    audioLipSync.loadAudioUrl(filtered[0].url, filtered[0].label);
  }
}

function updateHudPhoneme(phoneme: string) {
  const isSilence = phoneme === 'nn' || !phoneme;
  const info = PHONEME_LABEL_MAP[phoneme] || { char: phoneme, name: phoneme };

  hudChar.textContent = info.char;
  hudTag.textContent = isSilence ? 'SILENCE' : info.name;

  if (isSilence) {
    hudBox.classList.remove('active');
  } else {
    hudBox.classList.add('active');
  }

  // Update vowel row highlight
  PHONEMES.forEach((p) => {
    const row = document.querySelector(`.vowel-row[data-phoneme="${p}"]`);
    if (row) {
      if (p === phoneme) {
        row.classList.add('active');
      } else {
        row.classList.remove('active');
      }
    }
  });
}

function updateStatsUI(stats: LipSyncStats) {
  statCurrent.textContent = stats.processingTimeMs.toFixed(2);
  statAvg.textContent = stats.avgTimeMs.toFixed(2);
  statMin.textContent = stats.minTimeMs.toFixed(2);
  statMax.textContent = stats.maxTimeMs.toFixed(2);
  statCount.textContent = String(stats.count);
  statRms.textContent = stats.rms.toFixed(3);

  hudF1.textContent = String(Math.round(stats.f1));
  hudF2.textContent = String(Math.round(stats.f2));

  // Update distance bars (closer = higher score bar)
  // Distance is typically between 0.05 (exact match) to 1.5+ (far away)
  PHONEMES.forEach((p) => {
    const dist = stats.distances[p] ?? 99;
    const bar = document.getElementById(`bar-${p}`) as HTMLDivElement;
    const val = document.getElementById(`val-${p}`) as HTMLSpanElement;
    if (bar && val) {
      if (dist >= 90) {
        bar.style.width = '0%';
        val.textContent = '-';
      } else {
        // Map distance [0.0, 1.2] to [100%, 0%]
        const scorePct = Math.max(0, Math.min(100, (1.2 - dist) / 1.2 * 100));
        bar.style.width = `${scorePct.toFixed(0)}%`;
        val.textContent = dist.toFixed(2);
      }
    }
  });

  // Update microphone level meter if mic is active
  if (audioLipSync.isMicrophoneActive) {
    const levelPct = Math.min(100, (stats.rms / 0.15) * 100);
    micLevelFill.style.width = `${levelPct.toFixed(0)}%`;
  }
}

// --- Event Handlers ---

// Engine toggle (A/B Testing: WASM vs Legacy)
btnEngineWasm.addEventListener('click', async () => {
  if (audioLipSync.engineMode === 'wasm') return;
  btnEngineWasm.classList.add('active');
  btnEngineLegacy.classList.remove('active');
  engineBadge.textContent = 'WASM (AudioWorklet)';
  engineBadge.className = 'badge wasm-badge';
  engineDesc.textContent = 'AudioWorkletスレッド上で極小WASMが並列動作。メインスレッド負荷ゼロで低遅延判定。';
  await audioLipSync.setEngineMode('wasm');
});

btnEngineLegacy.addEventListener('click', async () => {
  if (audioLipSync.engineMode === 'legacy') return;
  btnEngineLegacy.classList.add('active');
  btnEngineWasm.classList.remove('active');
  engineBadge.textContent = 'Legacy (Meyda)';
  engineBadge.className = 'badge legacy-badge';
  engineDesc.textContent = 'メインスレッド上で毎フレーム Meyda.extract(FFT/MFCC) を同期実行。従来の実装方式。';
  await audioLipSync.setEngineMode('legacy');
});

// Gender toggle
btnGenderFemale.addEventListener('click', () => {
  if (currentGender === 'female') return;
  currentGender = 'female';
  btnGenderFemale.classList.add('active');
  btnGenderMale.classList.remove('active');
  audioLipSync.setVoiceGender('female');
  populateSampleTracks();
});

btnGenderMale.addEventListener('click', () => {
  if (currentGender === 'male') return;
  currentGender = 'male';
  btnGenderMale.classList.add('active');
  btnGenderFemale.classList.remove('active');
  audioLipSync.setVoiceGender('male');
  populateSampleTracks();
});

// Model select
selectModel.addEventListener('change', () => {
  currentModelUrl = selectModel.value;
  vrmFileName.textContent = selectModel.options[selectModel.selectedIndex].text;
  loadVRMModel(currentModelUrl);
});

// Custom VRM file input
inputVrmFile.addEventListener('change', () => {
  const file = inputVrmFile.files?.[0];
  if (!file) return;
  if (customObjectUrl) {
    URL.revokeObjectURL(customObjectUrl);
  }
  customObjectUrl = URL.createObjectURL(file);
  vrmFileName.textContent = file.name;
  loadVRMModel(customObjectUrl);
});

// Tabs
function switchTab(tab: 'sample' | 'mic' | 'file') {
  [tabBtnSample, tabBtnMic, tabBtnFile].forEach((b) => b.classList.remove('active'));
  [tabContentSample, tabContentMic, tabContentFile].forEach((c) => c.classList.remove('active'));

  if (tab === 'sample') {
    tabBtnSample.classList.add('active');
    tabContentSample.classList.add('active');
    if (audioLipSync.isMicrophoneActive) {
      stopMicMode();
    }
  } else if (tab === 'mic') {
    tabBtnMic.classList.add('active');
    tabContentMic.classList.add('active');
    audioLipSync.pause();
  } else if (tab === 'file') {
    tabBtnFile.classList.add('active');
    tabContentFile.classList.add('active');
    if (audioLipSync.isMicrophoneActive) {
      stopMicMode();
    }
  }
}

tabBtnSample.addEventListener('click', () => switchTab('sample'));
tabBtnMic.addEventListener('click', () => switchTab('mic'));
tabBtnFile.addEventListener('click', () => switchTab('file'));

// Sample audio controls
selectAudioTrack.addEventListener('change', () => {
  audioLipSync.loadAudioUrl(selectAudioTrack.value);
  audioLipSync.setLoop(checkLoop.checked);
});

btnPlay.addEventListener('click', () => {
  if (audioLipSync.isPlaying) {
    audioLipSync.pause();
  } else {
    audioLipSync.setLoop(checkLoop.checked);
    audioLipSync.play();
  }
});

btnStop.addEventListener('click', () => {
  audioLipSync.stop();
  audioSeekSlider.value = '0';
  audioCurrentTime.textContent = '0:00';
});

checkLoop.addEventListener('change', () => {
  audioLipSync.setLoop(checkLoop.checked);
});

audioSeekSlider.addEventListener('input', () => {
  const pct = parseFloat(audioSeekSlider.value);
  const dur = audioLipSync.audioElement.duration || 0;
  audioLipSync.seek((pct / 100) * dur);
});

// Microphone toggle
async function startMicMode() {
  try {
    await audioLipSync.startMicrophone();
    btnMicToggle.classList.add('recording');
    micBtnText.textContent = 'マイク入力を停止';
  } catch (err) {
    console.error('Mic access error:', err);
    alert('マイクへのアクセスに失敗しました: ' + (err instanceof Error ? err.message : String(err)));
  }
}

function stopMicMode() {
  audioLipSync.stopMicrophone();
  btnMicToggle.classList.remove('recording');
  micBtnText.textContent = 'マイク入力を開始';
  micLevelFill.style.width = '0%';
  updateHudPhoneme('nn');
}

btnMicToggle.addEventListener('click', () => {
  if (audioLipSync.isMicrophoneActive) {
    stopMicMode();
  } else {
    startMicMode();
  }
});

sliderMicGain.addEventListener('input', () => {
  const gain = parseFloat(sliderMicGain.value);
  valMicGain.textContent = `${gain.toFixed(1)}x`;
  audioLipSync.setMicGain(gain);
});

sliderMicHold.addEventListener('input', () => {
  const holdMs = parseInt(sliderMicHold.value, 10);
  valMicHold.textContent = `${holdMs}ms`;
  audioLipSync.setHoldTime(holdMs);
});

// Custom audio file input
inputAudioFile.addEventListener('change', () => {
  const file = inputAudioFile.files?.[0];
  if (!file) return;
  audioFileName.textContent = file.name;
  fileTransport.style.display = 'flex';
  audioLipSync.loadAudioFile(file);
  audioLipSync.setLoop(checkFileLoop.checked);
});

btnFilePlay.addEventListener('click', () => {
  if (audioLipSync.isPlaying) {
    audioLipSync.pause();
  } else {
    audioLipSync.setLoop(checkFileLoop.checked);
    audioLipSync.play();
  }
});

btnFileStop.addEventListener('click', () => {
  audioLipSync.stop();
});

checkFileLoop.addEventListener('change', () => {
  audioLipSync.setLoop(checkFileLoop.checked);
});

// Latency Reset
btnResetStats.addEventListener('click', () => {
  audioLipSync.resetStats();
});

// Camera preset buttons
camPresetMouth.addEventListener('click', () => applyCameraPreset('mouth'));
camPresetFace.addEventListener('click', () => applyCameraPreset('face'));
camPresetBust.addEventListener('click', () => applyCameraPreset('bust'));
camReset.addEventListener('click', () => applyCameraPreset(currentCameraPreset, false));

// Resize listener
function onWindowResize() {
  const wrapper = $('viewport-wrapper');
  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', onWindowResize);

// --- Animation Loop ---
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  controls.update();

  if (currentVRM) {
    // Smooth morph transitions for mouth
    const activePhoneme = audioLipSync.currentPhoneme;
    const gain = 1.0;
    const smoothRate = 0.35;

    PHONEMES.forEach((p) => {
      const target = activePhoneme === p ? 1.0 : 0.0;
      const current = currentWeights[p];
      // Fast attack for mouth opening, smooth decay for natural close
      const effectiveSmooth = target > current ? 0.6 : smoothRate;
      currentWeights[p] += effectiveSmooth * (target - current);
      if (currentWeights[p] < 0.002) currentWeights[p] = 0;

      currentVRM!.expressionManager?.setValue(p, currentWeights[p] * gain);
    });

    currentVRM.update(delta);
  }

  renderer.render(scene, camera);
}

// --- Initialization ---
function init() {
  onWindowResize();
  populateSampleTracks();
  loadVRMModel(currentModelUrl);
  animate();
}

init();
