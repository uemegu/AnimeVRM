import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Persona5CrowdController, DEFAULT_P5_CROWD_STYLE } from './Persona5CrowdController';
import { MORNING_SCHOOL_GATE_CROWD } from './SchoolGateCrowdPreset';
import { loadMixamoAnimation } from '../Avatar';
import { resolveAssetUrl } from '../utils/path';

async function init() {
  const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
  const container = document.querySelector<HTMLElement>('#canvas-container')!;
  const loadingBadge = document.querySelector<HTMLElement>('#loading-badge')!;

  // 1. Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#94a8c2');

  const camera = new THREE.PerspectiveCamera(
    32,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  camera.position.set(0, 1.35, 3.2);

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
  controls.target.set(0, 1.1, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.05;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.update();

  // 2. Background: Morning Sky Gradient + School Gate
  const loadCompositeBackground = async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolveAssetUrl('/textures/school-gate-far.avif');
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    // Morning Sky Gradient (fresh anime blue morning sky)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 1080);
    skyGrad.addColorStop(0.0, '#5a96d8');
    skyGrad.addColorStop(0.45, '#96c4ea');
    skyGrad.addColorStop(0.85, '#dbebf7');
    skyGrad.addColorStop(1.0, '#edf4fa');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1920, 1080);

    // Draw school gate on top
    if (img.width > 0) {
      ctx.drawImage(img, 0, 0, 1920, 1080);
    }

    const bgTexture = new THREE.CanvasTexture(canvas);
    bgTexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = bgTexture;
  };
  void loadCompositeBackground();

  // 3. Lighting (Warm Morning Light)
  const ambientLight = new THREE.AmbientLight(0xdbe7f5, 1.4);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff7e8, 1.6);
  sunLight.position.set(-2.5, 4.5, 3.5);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xb8d6f5, 0.7);
  fillLight.position.set(3, 2, -1);
  scene.add(fillLight);

  // 4. Main Hero Character (Shion - Colored to contrast with desaturated mobs)
  let mainMixer: THREE.AnimationMixer | null = null;
  let mainVrm: VRM | null = null;
  try {
    const gltfLoader = new GLTFLoader();
    gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await gltfLoader.loadAsync(resolveAssetUrl('/models/shion/shion-school.vrm'));
    mainVrm = gltf.userData.vrm as VRM;
    VRMUtils.rotateVRM0(mainVrm);

    mainVrm.scene.position.set(0, 0, 0);
    mainVrm.scene.rotation.y = 0;
    scene.add(mainVrm.scene);

    // Standing Idle
    mainMixer = new THREE.AnimationMixer(mainVrm.scene);
    const clip = await loadMixamoAnimation('/animations/Standing Idle.fbx', mainVrm);
    const action = mainMixer.clipAction(clip);
    action.play();

    // Expression
    mainVrm.expressionManager?.setValue('happy', 0.6);
  } catch (err) {
    console.warn('Failed to load main hero model:', err);
  }

  // 5. Persona 5 Crowd Mobs
  const crowdController = new Persona5CrowdController(scene, {
    opacity: 0.78,
    skinColor: DEFAULT_P5_CROWD_STYLE.skinColor,
    hairColor: DEFAULT_P5_CROWD_STYLE.hairColor,
    clothColor: DEFAULT_P5_CROWD_STYLE.clothColor,
  });

  for (const memberConfig of MORNING_SCHOOL_GATE_CROWD) {
    try {
      await crowdController.addMember(memberConfig);
    } catch (e) {
      console.error(`Failed to add mob ${memberConfig.id}:`, e);
    }
  }

  if (loadingBadge) {
    loadingBadge.style.opacity = '0';
    setTimeout(() => loadingBadge.remove(), 400);
  }

  // 6. UI Controls
  const opacitySlider = document.querySelector<HTMLInputElement>('#opacity-slider');
  const opacityVal = document.querySelector<HTMLElement>('#opacity-val');
  if (opacitySlider && opacityVal) {
    opacitySlider.addEventListener('input', () => {
      const val = parseFloat(opacitySlider.value);
      opacityVal.textContent = val.toFixed(2);
      crowdController.setOpacity(val);
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

  const reloadBtn = document.querySelector<HTMLButtonElement>('#reload-btn');
  if (reloadBtn && opacitySlider && opacityVal) {
    reloadBtn.addEventListener('click', () => {
      camera.position.set(0, 1.35, 3.2);
      controls.target.set(0, 1.1, 0);
      controls.update();
      opacitySlider.value = '0.78';
      opacityVal.textContent = '0.78';
      crowdController.setOpacity(0.78);
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
  const updateTonePreset = async (style: typeof DEFAULT_P5_CROWD_STYLE) => {
    crowdController.clear();
    for (const memberConfig of MORNING_SCHOOL_GATE_CROWD) {
      await crowdController.addMember(memberConfig);
    }
    const currentOp = opacitySlider ? parseFloat(opacitySlider.value) : 0.78;
    crowdController.setOpacity(currentOp);
  };

  if (toneP5Btn && toneMonoBtn) {
    toneP5Btn.addEventListener('click', () => {
      toneP5Btn.classList.add('active');
      toneMonoBtn.classList.remove('active');
      void updateTonePreset(DEFAULT_P5_CROWD_STYLE);
    });

    toneMonoBtn.addEventListener('click', () => {
      toneMonoBtn.classList.add('active');
      toneP5Btn.classList.remove('active');
      void updateTonePreset({
        opacity: 0.78,
        skinColor: '#8a8a8a',
        hairColor: '#5c5c5c',
        clothColor: '#3a3a3a',
        outlineColor: '#1a1a1a',
      });
    });
  }

  // 7. Resize handling
  window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  // 8. Animation Loop
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    controls.update();

    if (mainMixer) {
      mainMixer.update(delta);
    }
    if (mainVrm) {
      mainVrm.update(delta);
    }

    crowdController.update(delta);

    renderer.render(scene, camera);
  }
  animate();
}

void init();
