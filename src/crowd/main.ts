import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Persona5CrowdController, DEFAULT_P5_CROWD_STYLE } from './Persona5CrowdController';
import { CORRIDOR_CROWD_PRESET } from './CorridorCrowdPreset';
import { MORNING_SCHOOL_GATE_CROWD } from './SchoolGateCrowdPreset';
import { loadMixamoAnimation } from '../Avatar';
import { resolveAssetUrl } from '../utils/path';

type LocationType = 'corridor' | 'school_gate';

async function init() {
  const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
  const container = document.querySelector<HTMLElement>('#canvas-container')!;
  const loadingBadge = document.querySelector<HTMLElement>('#loading-badge')!;
  const locationSubtitle = document.querySelector<HTMLElement>('#location-subtitle');

  let currentLocation: LocationType = 'corridor';
  let currentOpacity = 0.6;
  let currentTone = 'p5';

  // 1. Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ccd8e8');

  const camera = new THREE.PerspectiveCamera(
    32,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  camera.position.set(0.2, 1.35, 3.4);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0.1, 1.1, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.05;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.update();

  // 2. Lighting
  const ambientLight = new THREE.AmbientLight(0xdde8f8, 1.35);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff6eb, 1.5);
  sunLight.position.set(-2, 4, 3);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xb8d4f8, 0.7);
  fillLight.position.set(3, 2, -1);
  scene.add(fillLight);

  // Background Loader
  const textureLoader = new THREE.TextureLoader();
  const applyBackground = async (loc: LocationType) => {
    if (loc === 'corridor') {
      const tex = await textureLoader.loadAsync(resolveAssetUrl('/textures/school-corridor-far.avif'));
      tex.colorSpace = THREE.SRGBColorSpace;
      scene.background = tex;
    } else {
      // School gate with anime blue sky gradient
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = resolveAssetUrl('/textures/school-gate-far.avif');
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      });

      const cvs = document.createElement('canvas');
      cvs.width = 1920;
      cvs.height = 1080;
      const ctx = cvs.getContext('2d')!;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, 1080);
      skyGrad.addColorStop(0.0, '#5a96d8');
      skyGrad.addColorStop(0.45, '#96c4ea');
      skyGrad.addColorStop(0.85, '#dbebf7');
      skyGrad.addColorStop(1.0, '#edf4fa');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 1920, 1080);

      if (img.width > 0) {
        ctx.drawImage(img, 0, 0, 1920, 1080);
      }

      const bgTexture = new THREE.CanvasTexture(cvs);
      bgTexture.colorSpace = THREE.SRGBColorSpace;
      scene.background = bgTexture;
    }
  };
  await applyBackground('corridor');

  // 3. Main Hero Character (Aoi - Colored, front-stage)
  let mainMixer: THREE.AnimationMixer | null = null;
  let mainVrm: VRM | null = null;
  try {
    const gltfLoader = new GLTFLoader();
    gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await gltfLoader.loadAsync(resolveAssetUrl('/models/aoi/aoi-school.vrm'));
    mainVrm = gltf.userData.vrm as VRM;
    VRMUtils.rotateVRM0(mainVrm);

    mainVrm.scene.position.set(0.3, 0, -0.4);
    mainVrm.scene.rotation.y = -0.15;
    scene.add(mainVrm.scene);

    mainMixer = new THREE.AnimationMixer(mainVrm.scene);
    const clip = await loadMixamoAnimation('/animations/Standing Idle.fbx', mainVrm);
    const action = mainMixer.clipAction(clip);
    action.play();

    mainVrm.expressionManager?.setValue('happy', 1.0);
  } catch (err) {
    console.warn('Failed to load main hero model:', err);
  }

  // 4. Persona 5 Crowd Mobs Controller
  const crowdController = new Persona5CrowdController(scene, {
    opacity: currentOpacity,
    skinColor: DEFAULT_P5_CROWD_STYLE.skinColor,
    hairColor: DEFAULT_P5_CROWD_STYLE.hairColor,
    clothColor: DEFAULT_P5_CROWD_STYLE.clothColor,
  });

  const loadCrowdPreset = async (loc: LocationType) => {
    crowdController.clear();
    const preset = loc === 'corridor' ? CORRIDOR_CROWD_PRESET : MORNING_SCHOOL_GATE_CROWD;
    for (const memberConfig of preset) {
      try {
        await crowdController.addMember(memberConfig);
      } catch (e) {
        console.error(`Failed to add mob ${memberConfig.id}:`, e);
      }
    }
    crowdController.setOpacity(currentOpacity);
  };

  await loadCrowdPreset('corridor');

  if (loadingBadge) {
    loadingBadge.style.opacity = '0';
    setTimeout(() => loadingBadge.remove(), 400);
  }

  // 5. UI Controls
  const opacitySlider = document.querySelector<HTMLInputElement>('#opacity-slider');
  const opacityVal = document.querySelector<HTMLElement>('#opacity-val');
  if (opacitySlider && opacityVal) {
    opacitySlider.addEventListener('input', () => {
      currentOpacity = parseFloat(opacitySlider.value);
      opacityVal.textContent = currentOpacity.toFixed(2);
      crowdController.setOpacity(currentOpacity);
    });
  }

  const toggleBtn = document.querySelector<HTMLButtonElement>('#toggle-visible-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = !crowdController.getVisible();
      crowdController.setVisible(next);
      toggleBtn.textContent = next ? '表示中' : '非表示';
      toggleBtn.classList.toggle('active', next);
    });
  }

  // Location Switcher
  const locCorridorBtn = document.querySelector<HTMLButtonElement>('#loc-corridor-btn');
  const locGateBtn = document.querySelector<HTMLButtonElement>('#loc-gate-btn');

  const switchLocation = async (loc: LocationType) => {
    if (currentLocation === loc) return;
    currentLocation = loc;

    if (loc === 'corridor') {
      locCorridorBtn?.classList.add('active');
      locGateBtn?.classList.remove('active');
      if (locationSubtitle) locationSubtitle.textContent = '廊下・教室前 (School Corridor)';
      camera.position.set(0.2, 1.35, 3.4);
      controls.target.set(0.1, 1.1, 0);
    } else {
      locGateBtn?.classList.add('active');
      locCorridorBtn?.classList.remove('active');
      if (locationSubtitle) locationSubtitle.textContent = '朝の校門 (School Gate Morning)';
      camera.position.set(0, 1.35, 3.2);
      controls.target.set(0, 1.1, 0);
    }
    controls.update();

    await applyBackground(loc);
    await loadCrowdPreset(loc);
  };

  locCorridorBtn?.addEventListener('click', () => void switchLocation('corridor'));
  locGateBtn?.addEventListener('click', () => void switchLocation('school_gate'));

  const reloadBtn = document.querySelector<HTMLButtonElement>('#reload-btn');
  if (reloadBtn && opacitySlider && opacityVal) {
    reloadBtn.addEventListener('click', async () => {
      camera.position.set(0.2, 1.35, 3.4);
      controls.target.set(0.1, 1.1, 0);
      controls.update();
      opacitySlider.value = '0.60';
      opacityVal.textContent = '0.60';
      currentOpacity = 0.6;
      await loadCrowdPreset(currentLocation);
      crowdController.setVisible(true);
      if (toggleBtn) {
        toggleBtn.textContent = '表示中';
        toggleBtn.classList.add('active');
      }
    });
  }

  // Tone presets
  const toneP5Btn = document.querySelector<HTMLButtonElement>('#tone-p5-btn');
  const toneMonoBtn = document.querySelector<HTMLButtonElement>('#tone-mono-btn');
  if (toneP5Btn && toneMonoBtn) {
    toneP5Btn.addEventListener('click', async () => {
      toneP5Btn.classList.add('active');
      toneMonoBtn.classList.remove('active');
      currentTone = 'p5';
      await loadCrowdPreset(currentLocation);
    });

    toneMonoBtn.addEventListener('click', async () => {
      toneMonoBtn.classList.add('active');
      toneP5Btn.classList.remove('active');
      currentTone = 'mono';
      crowdController.clear();
      const preset = currentLocation === 'corridor' ? CORRIDOR_CROWD_PRESET : MORNING_SCHOOL_GATE_CROWD;
      for (const m of preset) {
        await crowdController.addMember({
          ...m,
        });
      }
      crowdController.setOpacity(currentOpacity);
    });
  }

  // 6. Resize handling
  window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  // 7. Animation Loop
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    controls.update();

    if (mainMixer) mainMixer.update(delta);
    if (mainVrm) mainVrm.update(delta);

    crowdController.update(delta);

    renderer.render(scene, camera);
  }
  animate();
}

void init();
