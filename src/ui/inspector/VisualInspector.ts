import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { t } from '../../i18n';
import { showToast } from '../components/Toast';
import { InspectorContext } from './InspectorManager';

export function setupVisualInspector(container: HTMLElement, ctx: InspectorContext, guis: GUI[]): void {
  const tr = t();
  const visualGui = new GUI({
    title: tr.render.detailedParamsTitle,
    container,
    autoPlace: false,
  });
  guis.push(visualGui);

  const {
    currentConfig,
    toggleState,
    viewerCore,
    avatarManager,
    audioLipSync,
    applyConfigToSceneAndRenderer,
  } = ctx;

  const getAvatar = () => avatarManager.avatarInstance;

  // Helper to add material folder
  const addMaterialFolder = (title: string, kind: 'body' | 'hair' | 'cloth') => {
    const folder = visualGui.addFolder(title);
    const params = currentConfig.materials[kind];
    const update = () => getAvatar()?.shaderController?.updateMaterialStyle(kind, params);

    folder.addColor(params, 'color').name(tr.gui.baseColor).onChange(update);
    folder.add(params, 'matcapEnabled').name(tr.gui.highlightMatcap).onChange(update);
    folder.add(params, 'emissiveIntensity', 0.0, 5.0, 0.1).name(tr.gui.emissiveIntensity).onChange(update);
    folder.add(params, 'shadowHueShift', -0.5, 0.5, 0.01).name(tr.gui.shadowHueShift).onChange(update);
    folder.add(params, 'shadowLightnessFactor', 0.02, 1.0, 0.01).name(tr.gui.shadowLightness).onChange(update);
    folder.add(params, 'shadowBoundaryTint', 0.0, 1.0, 0.02).name(tr.gui.shadowBoundaryTint).onChange(update);
    folder.add(params, 'shadingToonyFactor', 0, 1, 0.01).name(tr.gui.toonyFactor).onChange(update);
    folder.add(params, 'shadingShiftFactor', -1, 1, 0.01).name(tr.gui.shadingShift).onChange(update);
    folder.add(params, 'giEqualizationFactor', 0, 1, 0.01).name(tr.gui.giFactor).onChange(update);

    folder.add(params, 'rimEnabled').name(tr.gui.rimEnabled).onChange(update);
    folder.addColor(params, 'rimColor').name(tr.gui.rimColor).onChange(update);
    folder.add(params, 'parametricRimFresnelPowerFactor', 0, 10, 0.1).name(tr.gui.rimFresnelPower).onChange(update);
    folder.add(params, 'parametricRimLiftFactor', 0, 5, 0.01).name(tr.gui.rimLift).onChange(update);
    folder.add(params, 'rimLightingMixFactor', 0, 2, 0.01).name(tr.gui.rimMix).onChange(update);
    folder.add(params, 'outlineWidthFactor', 0, 0.01, 0.0002).name(tr.gui.outlineWidth).onChange(update);
    folder.close();
  };

  // 1. Material Folders
  addMaterialFolder(tr.gui.matBody, 'body');
  addMaterialFolder(tr.gui.matHair, 'hair');
  addMaterialFolder(tr.gui.matCloth, 'cloth');

  // 1.5 Eye Highlight Glow Folder
  if (!currentConfig.eyeGlow) {
    currentConfig.eyeGlow = { enabled: true, intensity: 1.25 };
  }
  const eyeFolder = visualGui.addFolder(tr.gui.eyeGlowFolder);
  eyeFolder
    .add(currentConfig.eyeGlow, 'enabled')
    .name(tr.gui.eyeGlowEnabled)
    .onChange((val: boolean) => {
      toggleState.eyeGlow = val;
      getAvatar()?.shaderController?.updateEyeGlow(currentConfig.eyeGlow);
    });
  eyeFolder
    .add(currentConfig.eyeGlow, 'intensity', 0.0, 3.0, 0.05)
    .name(tr.gui.eyeGlowIntensity)
    .onChange(() => {
      getAvatar()?.shaderController?.updateEyeGlow(currentConfig.eyeGlow);
    });
  eyeFolder.close();

  // 2. Outline Folder
  const outlineFolder = visualGui.addFolder(tr.gui.outlineFolder);
  outlineFolder
    .add(currentConfig.outline, 'enabled')
    .name(tr.gui.outlineInvertedHull)
    .onChange(() => getAvatar()?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'useSmoothNormal')
    .name(tr.gui.outlineSmoothNormal)
    .onChange(() => getAvatar()?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'screenSpaceWidth')
    .name(tr.gui.outlineScreenSpace)
    .onChange(() => getAvatar()?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'autoLineWeight')
    .name(tr.gui.outlineAutoWeight)
    .onChange(() => getAvatar()?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'darknessFactor', 0.01, 0.5, 0.02)
    .name(tr.gui.outlineDarkness)
    .onChange(() => getAvatar()?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'widthFactor', 0, 0.01, 0.0002)
    .name(tr.gui.outlineWidth)
    .onChange(() => getAvatar()?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder
    .add(currentConfig.outline, 'lightingMixFactor', 0, 1, 0.01)
    .name(tr.gui.outlineLightingMix)
    .onChange(() => getAvatar()?.shaderController?.updateOutline(currentConfig.outline));
  outlineFolder.close();

  // 3. Lighting Folder
  const lightFolder = visualGui.addFolder(tr.gui.lightFolder);
  lightFolder
    .add(currentConfig.lighting, 'castShadows')
    .name(tr.gui.castShadows)
    .onChange((enabled: boolean) => {
      viewerCore.renderer.shadowMap.enabled = enabled;
      viewerCore.dirLight.castShadow = enabled;
      const av = getAvatar();
      if (av?.vrm) {
        av.vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            (obj as THREE.Mesh).castShadow = enabled;
          }
        });
      }
    });

  // Directional Light
  lightFolder
    .add(currentConfig.lighting.directional, 'intensity', 0, 8, 0.1)
    .name(tr.gui.keyIntensity)
    .onChange((val: number) => (viewerCore.dirLight.intensity = val));
  lightFolder
    .addColor(currentConfig.lighting.directional, 'color')
    .name(tr.gui.keyColor)
    .onChange((val: string) => viewerCore.dirLight.color.set(val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posX', -10, 10, 0.1)
    .name(tr.gui.keyPosX)
    .onChange((val: number) => (viewerCore.dirLight.position.x = val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posY', -10, 10, 0.1)
    .name(tr.gui.keyPosY)
    .onChange((val: number) => (viewerCore.dirLight.position.y = val));
  lightFolder
    .add(currentConfig.lighting.directional, 'posZ', -10, 10, 0.1)
    .name(tr.gui.keyPosZ)
    .onChange((val: number) => (viewerCore.dirLight.position.z = val));

  // Ambient Light
  lightFolder
    .add(currentConfig.lighting.ambient, 'intensity', 0, 3, 0.05)
    .name(tr.gui.ambientIntensity)
    .onChange((val: number) => (viewerCore.ambientLight.intensity = val));
  lightFolder
    .addColor(currentConfig.lighting.ambient, 'color')
    .name(tr.gui.ambientColor)
    .onChange((val: string) => viewerCore.ambientLight.color.set(val));

  // Rim Light
  lightFolder
    .add(currentConfig.lighting.rim, 'enabled')
    .name(tr.gui.rimLightEnabled)
    .onChange((val: boolean) => {
      viewerCore.rimLight.visible = val;
      viewerCore.rimLight.intensity = val ? currentConfig.lighting.rim.intensity : 0;
    });
  lightFolder
    .add(currentConfig.lighting.rim, 'intensity', 0, 3, 0.05)
    .name(tr.gui.rimLightIntensity)
    .onChange((val: number) => {
      viewerCore.rimLight.intensity = currentConfig.lighting.rim.enabled !== false ? val : 0;
    });
  lightFolder
    .addColor(currentConfig.lighting.rim, 'color')
    .name(tr.gui.rimLightColor)
    .onChange((val: string) => viewerCore.rimLight.color.set(val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posX', -10, 10, 0.1)
    .name(tr.gui.rimLightPosX)
    .onChange((val: number) => (viewerCore.rimLight.position.x = val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posY', -10, 10, 0.1)
    .name(tr.gui.rimLightPosY)
    .onChange((val: number) => (viewerCore.rimLight.position.y = val));
  lightFolder
    .add(currentConfig.lighting.rim, 'posZ', -10, 10, 0.1)
    .name(tr.gui.rimLightPosZ)
    .onChange((val: number) => (viewerCore.rimLight.position.z = val));
  lightFolder.close();

  // 4. Sun & Atmosphere Folder
  const sunFolder = visualGui.addFolder(tr.gui.sunFolder);

  const sunPosFolder = sunFolder.addFolder(tr.gui.sunPosFolder);
  sunPosFolder
    .add(currentConfig.lighting.sunShafts, 'followDirectionalLight')
    .name(tr.gui.sunAutoFollow)
    .onChange((val: boolean) => {
      currentConfig.lighting.sunShafts.followDirectionalLight = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'x', -20, 20, 0.1)
    .name(tr.gui.sunPosX)
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.x = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'y', -5, 25, 0.1)
    .name(tr.gui.sunPosY)
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.y = val;
    });
  sunPosFolder
    .add(currentConfig.lighting.sunShafts.sunPosition, 'z', -20, 20, 0.1)
    .name(tr.gui.sunPosZ)
    .onChange((val: number) => {
      currentConfig.lighting.sunShafts.sunPosition.z = val;
    });
  sunPosFolder.close();

  // God Rays (Sun Shafts / Komorebi)
  const godRaysFolder = sunFolder.addFolder(tr.gui.godRaysFolder);
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'enabled')
    .name(tr.gui.godRaysEnabled)
    .onChange((enabled: boolean) => {
      viewerCore.godRaysPass.uniforms['uExposure'].value = enabled ? currentConfig.lighting.sunShafts.exposure : 0;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'exposure', 0.0, 1.5, 0.02)
    .name(tr.gui.godRaysExposure)
    .onChange((val: number) => {
      if (currentConfig.lighting.sunShafts.enabled) {
        viewerCore.godRaysPass.uniforms['uExposure'].value = val;
      }
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'decay', 0.8, 0.99, 0.005)
    .name(tr.gui.godRaysDecay)
    .onChange((val: number) => {
      viewerCore.godRaysPass.uniforms['uDecay'].value = val;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'density', 0.2, 1.8, 0.05)
    .name(tr.gui.godRaysDensity)
    .onChange((val: number) => {
      viewerCore.godRaysPass.uniforms['uDensity'].value = val;
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'weight', 0.05, 1.0, 0.02)
    .name(tr.gui.godRaysWeight)
    .onChange((val: number) => {
      viewerCore.godRaysPass.uniforms['uWeight'].value = val;
    });
  godRaysFolder
    .addColor(currentConfig.lighting.sunShafts, 'color')
    .name(tr.gui.godRaysColor)
    .onChange((hex: string) => {
      (viewerCore.godRaysPass.uniforms['uRayColor'].value as THREE.Color).set(hex);
    });
  godRaysFolder
    .add(currentConfig.lighting.sunShafts, 'shimmer', 0.0, 1.0, 0.05)
    .name(tr.gui.godRaysShimmer)
    .onChange((val: number) => {
      viewerCore.godRaysPass.uniforms['uShimmer'].value = val;
    });
  godRaysFolder.close();

  // Lens Flare
  const flareFolder = sunFolder.addFolder(tr.gui.flareFolder);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'enabled')
    .name(tr.gui.flareEnabled)
    .onChange((enabled: boolean) => {
      viewerCore.sunEffect.flareGroup.visible = enabled;
      viewerCore.sunEffect.sunGroup.visible = enabled;
    });
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'sunSize', 0.2, 3.0, 0.05)
    .name(tr.gui.flareSize);
  flareFolder
    .addColor(currentConfig.lighting.lensFlare, 'sunColor')
    .name(tr.gui.flareColor);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'glowIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareCorona);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'starburstIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareStarburst);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'anamorphicIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareAnamorphic);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'ghostIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareGhosts);
  flareFolder
    .add(currentConfig.lighting.lensFlare, 'haloIntensity', 0.0, 2.0, 0.05)
    .name(tr.gui.flareHalo);
  flareFolder.close();

  // Atmosphere / Far Fog
  const fogFolder = sunFolder.addFolder(tr.gui.fogFolder);
  fogFolder
    .add(currentConfig.environment, 'farFogEnabled')
    .name(tr.gui.fogEnabled)
    .onChange(() => viewerCore.updateBackgroundDisplay(currentConfig));
  fogFolder
    .addColor(currentConfig.environment, 'farFogColor')
    .name(tr.gui.fogColor)
    .onChange(() => viewerCore.updateBackgroundDisplay(currentConfig));
  fogFolder
    .add(currentConfig.environment, 'farFogIntensity', 0, 1, 0.02)
    .name(tr.gui.fogIntensity)
    .onChange(() => viewerCore.updateBackgroundDisplay(currentConfig));
  fogFolder.close();

  // Midground layer folder
  const midFolder = sunFolder.addFolder(tr.gui.midFolder);
  if (!currentConfig.environment.midgroundPosition) {
    currentConfig.environment.midgroundPosition = { x: 0, y: 1.05, z: -0.6 };
  }
  midFolder
    .add(currentConfig.environment, 'showMidground')
    .name(tr.gui.showMidground)
    .onChange(() => viewerCore.updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'x', -5, 5, 0.05)
    .name(tr.gui.midX)
    .onChange(() => viewerCore.updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'y', -2, 5, 0.05)
    .name(tr.gui.midY)
    .onChange(() => viewerCore.updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment.midgroundPosition, 'z', -5, 2, 0.05)
    .name(tr.gui.midZ)
    .onChange(() => viewerCore.updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment, 'midgroundScale', 0.5, 10, 0.1)
    .name(tr.gui.midScale)
    .onChange(() => viewerCore.updateMidgroundDisplay(currentConfig));
  midFolder
    .add(currentConfig.environment, 'midgroundOpacity', 0, 1, 0.05)
    .name(tr.gui.midOpacity)
    .onChange(() => viewerCore.updateMidgroundDisplay(currentConfig));
  midFolder.close();

  // Floor
  const floorFolder = sunFolder.addFolder(tr.gui.envFolder);
  floorFolder
    .add(currentConfig.environment, 'showFloor')
    .name(tr.gui.showFloor)
    .onChange((show: boolean) => {
      viewerCore.floor.visible = show;
    });
  floorFolder
    .addColor(currentConfig.environment, 'floorColor')
    .name(tr.gui.floorColor)
    .onChange((color: string) => {
      viewerCore.floorMat.color.set(color);
    });
  floorFolder.close();

  sunFolder.close();

  // 5. Post Processing Folder
  const postFolder = visualGui.addFolder(tr.gui.postFolder);
  postFolder
    .add(currentConfig.postProcessing, 'toneMappingMode', ['ACESFilmic', 'Reinhard', 'AgX', 'Linear', 'None'])
    .name(tr.gui.toneMapping)
    .onChange(() => {
      applyConfigToSceneAndRenderer(currentConfig);
    });

  postFolder
    .add(currentConfig.postProcessing, 'toneMappingExposure', 0.2, 2.5, 0.05)
    .name(tr.gui.exposure)
    .onChange((val: number) => (viewerCore.renderer.toneMappingExposure = val));

  // Antialiasing Folder
  const aaFolder = postFolder.addFolder(tr.gui.aaFolder);
  aaFolder
    .add(currentConfig.postProcessing.antialiasing, 'msaaSamples', [0, 2, 4, 8])
    .name(tr.gui.msaaSamples)
    .onChange((samples: number) => {
      if (viewerCore.composer.renderTarget1) viewerCore.composer.renderTarget1.samples = samples;
      if (viewerCore.composer.renderTarget2) viewerCore.composer.renderTarget2.samples = samples;
    });
  aaFolder
    .add(currentConfig.postProcessing.antialiasing, 'smaa')
    .name(tr.gui.smaaPass)
    .onChange((val: boolean) => {
      viewerCore.smaaPass.enabled = val;
    });
  aaFolder.close();

  // Bloom
  postFolder
    .add(currentConfig.postProcessing.bloom, 'enabled')
    .name(tr.gui.bloomEnabled)
    .onChange((enabled: boolean) => {
      viewerCore.bloomPass.strength = enabled ? currentConfig.postProcessing.bloom.strength : 0;
    });
  postFolder
    .add(currentConfig.postProcessing.bloom, 'strength', 0, 0.8, 0.01)
    .name(tr.gui.bloomStrength)
    .onChange((val: number) => {
      if (currentConfig.postProcessing.bloom.enabled) viewerCore.bloomPass.strength = val;
    });
  postFolder
    .add(currentConfig.postProcessing.bloom, 'threshold', 0.1, 1.0, 0.01)
    .name(tr.gui.bloomThreshold)
    .onChange((val: number) => (viewerCore.bloomPass.threshold = val));
  postFolder
    .add(currentConfig.postProcessing.bloom, 'radius', 0.0, 1.0, 0.02)
    .name(tr.gui.bloomRadius)
    .onChange((val: number) => (viewerCore.bloomPass.radius = val));

  // 3. Cinematic Film Effects Folder (映画風撮影処理)
  const cinFolder = postFolder.addFolder(tr.gui.cinematicFolder);
  const cin = currentConfig.postProcessing.cinematic;

  // Diffusion / Soft Glow
  const diffFolder = cinFolder.addFolder(tr.gui.diffusionFolder);
  diffFolder
    .add(cin.diffusion, 'enabled')
    .name(tr.gui.diffusionEnabled)
    .onChange((val: boolean) => {
      viewerCore.cinematicAnimePass.uniforms['uDiffusionEnabled'].value = val ? 1.0 : 0.0;
      toggleState.diffusion = val;
    });
  diffFolder
    .add(cin.diffusion, 'strength', 0.0, 1.0, 0.02)
    .name(tr.gui.diffusionStrength)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uDiffusionStrength'].value = val;
    });
  diffFolder
    .add(cin.diffusion, 'radius', 0.1, 5.0, 0.1)
    .name(tr.gui.diffusionRadius)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uDiffusionRadius'].value = val;
    });
  diffFolder.close();

  // Film Grain
  const grainFolder = cinFolder.addFolder(tr.gui.filmGrainFolder);
  grainFolder
    .add(cin.filmGrain, 'enabled')
    .name(tr.gui.filmGrainEnabled)
    .onChange((val: boolean) => {
      viewerCore.cinematicAnimePass.uniforms['uFilmGrainEnabled'].value = val ? 1.0 : 0.0;
      toggleState.filmGrain = val;
    });
  grainFolder
    .add(cin.filmGrain, 'strength', 0.0, 0.15, 0.005)
    .name(tr.gui.filmGrainStrength)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uFilmGrainStrength'].value = val;
    });
  grainFolder
    .add(cin.filmGrain, 'speed', 0.0, 3.0, 0.1)
    .name(tr.gui.filmGrainSpeed)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uFilmGrainSpeed'].value = val;
    });
  grainFolder.close();

  // Vignette
  const vigFolder = cinFolder.addFolder(tr.gui.vignetteFolder);
  vigFolder
    .add(cin.vignette, 'enabled')
    .name(tr.gui.vignetteEnabled)
    .onChange((val: boolean) => {
      viewerCore.cinematicAnimePass.uniforms['uVignetteEnabled'].value = val ? 1.0 : 0.0;
      toggleState.vignette = val;
    });
  vigFolder
    .add(cin.vignette, 'offset', 0.2, 2.0, 0.05)
    .name(tr.gui.vignetteOffset)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uVignetteOffset'].value = val;
    });
  vigFolder
    .add(cin.vignette, 'darkness', 0.0, 1.0, 0.02)
    .name(tr.gui.vignetteDarkness)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uVignetteDarkness'].value = val;
    });
  vigFolder
    .addColor(cin.vignette, 'color')
    .name(tr.gui.vignetteColor)
    .onChange((hex: string) => {
      (viewerCore.cinematicAnimePass.uniforms['uVignetteColor'].value as THREE.Color).set(hex);
    });
  vigFolder.close();

  // Chromatic Aberration
  const caFolder = cinFolder.addFolder(tr.gui.chromaticAberrationFolder);
  caFolder
    .add(cin.chromaticAberration, 'enabled')
    .name(tr.gui.chromaticAberrationEnabled)
    .onChange((val: boolean) => {
      viewerCore.cinematicAnimePass.uniforms['uChromaticAberrationEnabled'].value = val ? 1.0 : 0.0;
      toggleState.chromaticAberration = val;
    });
  caFolder
    .add(cin.chromaticAberration, 'offset', 0.0, 0.008, 0.0002)
    .name(tr.gui.chromaticAberrationOffset)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uChromaticAberrationOffset'].value = val;
    });
  caFolder.close();

  // Smart Sharpening
  const shpFolder = cinFolder.addFolder(tr.gui.sharpenFolder);
  shpFolder
    .add(cin.sharpening, 'enabled')
    .name(tr.gui.sharpenEnabled)
    .onChange((val: boolean) => {
      viewerCore.cinematicAnimePass.uniforms['uSharpenEnabled'].value = val ? 1.0 : 0.0;
      toggleState.sharpening = val;
    });
  shpFolder
    .add(cin.sharpening, 'amount', 0.0, 1.0, 0.02)
    .name(tr.gui.sharpenAmount)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uSharpenAmount'].value = val;
    });
  shpFolder.close();

  cinFolder.close();

  // Color Grading
  const cgFolder = postFolder.addFolder(tr.gui.cgFolder);
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'enabled')
    .name(tr.gui.cgEnabled)
    .onChange((enabled: boolean) => {
      viewerCore.cinematicAnimePass.uniforms['uColorGradingEnabled'].value = enabled ? 1.0 : 0.0;
    });
  cgFolder
    .addColor(currentConfig.postProcessing.colorGrading, 'shadowTint')
    .name(tr.gui.cgShadowTint)
    .onChange((hex: string) => {
      (viewerCore.cinematicAnimePass.uniforms['uShadowTint'].value as THREE.Color).set(hex);
    });
  cgFolder
    .addColor(currentConfig.postProcessing.colorGrading, 'highlightTint')
    .name(tr.gui.cgHighlightTint)
    .onChange((hex: string) => {
      (viewerCore.cinematicAnimePass.uniforms['uHighlightTint'].value as THREE.Color).set(hex);
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'strength', 0, 1, 0.02)
    .name(tr.gui.cgStrength)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uGradingStrength'].value = val;
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'contrast', 0, 0.5, 0.01)
    .name(tr.gui.cgContrast)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uGradingContrast'].value = val;
    });
  cgFolder
    .add(currentConfig.postProcessing.colorGrading, 'gamma', 0.7, 1.4, 0.02)
    .name(tr.gui.cgGamma)
    .onChange((val: number) => {
      viewerCore.cinematicAnimePass.uniforms['uGamma'].value = val;
    });
  cgFolder.close();

  // Basic Grading
  postFolder
    .add(currentConfig.postProcessing, 'saturation', -1.0, 1.0, 0.02)
    .name(tr.gui.saturation)
    .onChange((val: number) => (viewerCore.cinematicAnimePass.uniforms['uSaturation'].value = val));
  postFolder
    .add(currentConfig.postProcessing, 'brightness', -0.5, 0.5, 0.01)
    .name(tr.gui.brightness)
    .onChange((val: number) => (viewerCore.cinematicAnimePass.uniforms['uBrightness'].value = val));
  postFolder
    .add(currentConfig.postProcessing, 'contrast', -0.5, 0.5, 0.01)
    .name(tr.gui.contrast)
    .onChange((val: number) => (viewerCore.cinematicAnimePass.uniforms['uContrast'].value = val));
  postFolder.close();

  // 6. Manga Emotion Effect Text Folder
  const effectTextFolder = visualGui.addFolder(tr.character.emotionEffectText);
  const effectTextState = {
    text: 'ワナワナ',
    preset: 'wanawana',
    mode: 'auto',
    anchor: 'head',
    duration: 1.8,
    scale: 1.0,
    offsetX: 0.0,
    offsetY: 0.04,
    offsetZ: 0.04,
    show: () => {
      const av = getAvatar();
      if (!av) return;
      const modeParam = effectTextState.mode === 'auto' ? undefined : (effectTextState.mode as any);
      av.showEffectText({
        text: effectTextState.text || 'ワナワナ',
        stylePreset: effectTextState.preset,
        mode: modeParam,
        anchor: effectTextState.anchor as any,
        offset: {
          x: effectTextState.offsetX,
          y: effectTextState.offsetY,
          z: effectTextState.offsetZ,
        },
        duration: effectTextState.duration,
        scale: effectTextState.scale,
      });
      showToast(`💬 「${effectTextState.text}」`);
    },
    showMulti: () => {
      const av = getAvatar();
      if (!av?.effectTextManager || !av.vrm) return;
      av.effectTextManager.showMultiple([
        {
          text: 'ガーン',
          target: av.vrm,
          anchor: 'head',
          stylePreset: 'gaan',
          offset: { x: 0, y: 0.22, z: 0.04 },
        },
        {
          text: '・・・・',
          target: av.vrm,
          anchor: 'head',
          stylePreset: 'shiin',
          offset: { x: 0.22, y: 0.12, z: 0 },
        },
        {
          text: 'イライラ',
          target: av.vrm,
          anchor: 'rightHand',
          stylePreset: 'iraira',
          offset: { x: 0.14, y: 0.08, z: 0 },
        },
      ]);
      showToast('💥 複数エフェクト文字表示');
    },
    clearAll: () => {
      const av = getAvatar();
      av?.effectTextManager?.clear();
      showToast('🧹 全てのエフェクト文字をクリアしました');
    },
  };

  effectTextFolder.add(effectTextState, 'text').name(tr.gui.text);
  effectTextFolder
    .add(effectTextState, 'preset', {
      '🟣 ワナワナ (wanawana)': 'wanawana',
      '🔴 イライラ (iraira)': 'iraira',
      '💖 ドキドキ (doki)': 'doki',
      '🔵 ガーン (gaan)': 'gaan',
      '⚪ しーん (shiin)': 'shiin',
      '✨ キラキラ (kirakira)': 'kirakira',
      '⚡ ビクッ (biku)': 'biku',
    })
    .name('プリセット (Preset)');
  effectTextFolder
    .add(effectTextState, 'mode', {
      '自動 (Auto)': 'auto',
      '連続湧き上がり (Stream)': 'stream',
      '単一・中央表示 (Single)': 'single',
    })
    .name('表示モード (Mode)');
  effectTextFolder
    .add(effectTextState, 'anchor', {
      '頭 (Head)': 'head',
      '首 (Neck)': 'neck',
      '胸 (Chest)': 'chest',
      '腰 (Hips)': 'hips',
      '左肩 (Left Shoulder)': 'leftShoulder',
      '右肩 (Right Shoulder)': 'rightShoulder',
      '左手 (Left Hand)': 'leftHand',
      '右手 (Right Hand)': 'rightHand',
    })
    .name('追従ボーン (Anchor)');
  effectTextFolder.add(effectTextState, 'duration', 0.5, 5.0, 0.1).name(tr.gui.cutDuration);
  effectTextFolder.add(effectTextState, 'scale', 0.3, 2.5, 0.05).name(tr.gui.size);
  effectTextFolder.add(effectTextState, 'offsetX', -1.5, 1.5, 0.02).name('X');
  effectTextFolder.add(effectTextState, 'offsetY', -1.5, 1.5, 0.02).name('Y');
  effectTextFolder.add(effectTextState, 'offsetZ', -1.5, 1.5, 0.02).name('Z');
  effectTextFolder.add(effectTextState, 'show').name(`▶ ${tr.character.show}`);
  effectTextFolder.add(effectTextState, 'clearAll').name(`✕ ${tr.character.clearAll}`);
  effectTextFolder.close();

  // 7. Glowing Tears Effect Folder
  const tearFolder = visualGui.addFolder('💧 涙・発光筋エフェクト (Glowing Tears)');
  const tearState = {
    enabled: false,
    side: 'left',
    speed: 0.45,
    glowIntensity: 1.8,
    trailLength: 1.0,
    tearColor: '#c8f0ff',
    glowColor: '#ffffff',
    width: 0.0032,
    loop: false,
    leftOffsetX: 0.054,
    leftOffsetY: 0.047,
    leftOffsetZ: 0.085,
    restart: () => {
      const av = getAvatar();
      if (av?.tearEffect) {
        av.tearEffect.restart();
        showToast('💧 涙がスーッと流れます');
      }
    },
    toggleSadExpression: () => {
      const av = getAvatar();
      if (!av) return;
      av.setExpression('sad', 1.0);
      tearState.enabled = true;
      av.setTearsEnabled(true);
      av.restartTears();
      tearFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      showToast('😢 悲しい表情 + 涙を一筋流しました');
    },
  };

  const updateTearConfig = () => {
    const av = getAvatar();
    if (!av?.tearEffect) return;
    av.setTearConfig({
      enabled: tearState.enabled,
      side: tearState.side as any,
      speed: tearState.speed,
      glowIntensity: tearState.glowIntensity,
      trailLength: tearState.trailLength,
      tearColor: tearState.tearColor,
      glowColor: tearState.glowColor,
      width: tearState.width,
      loop: tearState.loop,
      leftEyeOffset: { x: tearState.leftOffsetX, y: tearState.leftOffsetY, z: tearState.leftOffsetZ },
      rightEyeOffset: { x: -tearState.leftOffsetX, y: tearState.leftOffsetY, z: tearState.leftOffsetZ },
    });
  };

  tearFolder
    .add(tearState, 'enabled')
    .name('涙エフェクト ON/OFF')
    .onChange((val: boolean) => {
      const av = getAvatar();
      if (av?.tearEffect) {
        tearState.leftOffsetX = av.tearEffect.config.leftEyeOffset.x;
        tearState.leftOffsetY = av.tearEffect.config.leftEyeOffset.y;
        tearState.leftOffsetZ = av.tearEffect.config.leftEyeOffset.z;
        tearFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      }
      av?.setTearsEnabled(val);
      if (val) {
        if (!currentConfig.postProcessing.bloom.enabled) {
          currentConfig.postProcessing.bloom.enabled = true;
          viewerCore.bloomPass.strength = currentConfig.postProcessing.bloom.strength;
          showToast('💧 涙を光らせるため Bloom を有効化しました');
        }
      }
    });

  tearFolder
    .add(tearState, 'side', {
      '左目から一筋 (Left)': 'left',
      '右目から一筋 (Right)': 'right',
      '両目 (Both)': 'both',
    })
    .name('流す位置 (Side)')
    .onChange(updateTearConfig);

  tearFolder.add(tearState, 'toggleSadExpression').name('😢 泣き顔プリセット');
  tearFolder.add(tearState, 'restart').name('🔄 最初から流す');

  tearFolder.add(tearState, 'speed', 0.1, 1.5, 0.05).name('流れる速度').onChange(updateTearConfig);
  tearFolder.add(tearState, 'glowIntensity', 0.5, 5.0, 0.1).name('発光強度').onChange(updateTearConfig);
  tearFolder.add(tearState, 'trailLength', 0.2, 1.0, 0.05).name('残る筋の長さ').onChange(updateTearConfig);
  tearFolder.add(tearState, 'width', 0.001, 0.015, 0.0005).name('涙の太さ').onChange(updateTearConfig);
  tearFolder.addColor(tearState, 'tearColor').name('涙の基本色').onChange(updateTearConfig);
  tearFolder.addColor(tearState, 'glowColor').name('発光色').onChange(updateTearConfig);
  tearFolder.add(tearState, 'loop').name(tr.common.loop).onChange(updateTearConfig);

  const posFolder = tearFolder.addFolder('📍 位置微調整 (Eye Offset)');
  posFolder.add(tearState, 'leftOffsetX', 0.01, 0.1, 0.001).name('目の左右間隔 (X)').onChange(updateTearConfig);
  posFolder.add(tearState, 'leftOffsetY', 0.0, 0.15, 0.001).name('目の上下高さ (Y)').onChange(updateTearConfig);
  posFolder.add(tearState, 'leftOffsetZ', 0.02, 0.2, 0.001).name('顔の表面奥行き (Z)').onChange(updateTearConfig);
  posFolder.close();
  tearFolder.close();

  // 8. Sweat (Manga Mark) Effect Folder
  const sweatFolder = visualGui.addFolder('💦 漫符汗エフェクト (焦り / じとー)');
  const sweatState = {
    enabled: false,
    mode: 'fly4',
    side: 'right',
    scale: 0.045,
    jitoScale: 0.04,
    flySpeed: 1.0,
    gravity: 1.8,
    spawnInterval: 0.38,
    dripSpeed: 0.025,
    duration: 3.0,
    loop: false,
    color: '#38bdf8',
    accentColor: '#0284c7',
    originX: 0.0,
    originY: 0.18,
    originZ: 0.06,
    jitoOffsetX: 0.1,
    jitoOffsetY: 0.07,
    jitoOffsetZ: 0.085,
    toggleNervousExpression: () => {
      const av = getAvatar();
      if (!av) return;
      av.setExpression('surprised', 1.0);
      sweatState.enabled = true;
      sweatState.mode = 'fly4';
      av.setSweatEnabled(true);
      av.restartSweat('fly4', sweatState.duration);
      sweatFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      showToast('💦 焦り表情 ＋ 4方向放物線汗マークを発動しました');
    },
    toggleJitoExpression: () => {
      const av = getAvatar();
      if (!av) return;
      av.setExpression('relaxed', 1.0);
      sweatState.enabled = true;
      sweatState.mode = 'jito';
      av.setSweatEnabled(true);
      av.restartSweat('jito', sweatState.duration);
      sweatFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      showToast('😑 ジト目表情 ＋ こめかみ冷や汗（タラーッ…）を発動しました');
    },
    restart: () => {
      const av = getAvatar();
      if (av?.sweatEffect) {
        av.sweatEffect.restart(sweatState.mode as any, sweatState.duration);
        showToast(sweatState.mode === 'jito' ? '😑 こめかみ冷や汗を再生しました' : '💦 4方向に汗マークを噴出しました');
      }
    },
  };

  const updateSweatConfig = () => {
    const av = getAvatar();
    if (!av?.sweatEffect) return;
    av.setSweatConfig({
      enabled: sweatState.enabled,
      mode: sweatState.mode as any,
      side: sweatState.side as any,
      scale: sweatState.scale,
      jitoScale: sweatState.jitoScale,
      flySpeed: sweatState.flySpeed,
      gravity: sweatState.gravity,
      spawnInterval: sweatState.spawnInterval,
      dripSpeed: sweatState.dripSpeed,
      duration: sweatState.duration,
      loop: sweatState.loop,
      color: sweatState.color,
      accentColor: sweatState.accentColor,
      originOffset: { x: sweatState.originX, y: sweatState.originY, z: sweatState.originZ },
      jitoRightOffset: { x: sweatState.jitoOffsetX, y: sweatState.jitoOffsetY, z: sweatState.jitoOffsetZ },
      jitoLeftOffset: { x: -sweatState.jitoOffsetX, y: sweatState.jitoOffsetY, z: sweatState.jitoOffsetZ },
    });
  };

  sweatFolder
    .add(sweatState, 'enabled')
    .name('汗エフェクト ON/OFF')
    .onChange((val: boolean) => {
      const av = getAvatar();
      if (av?.sweatEffect) {
        sweatState.originX = av.sweatEffect.config.originOffset.x;
        sweatState.originY = av.sweatEffect.config.originOffset.y;
        sweatState.originZ = av.sweatEffect.config.originOffset.z;
        sweatState.jitoOffsetX = av.sweatEffect.config.jitoRightOffset.x;
        sweatState.jitoOffsetY = av.sweatEffect.config.jitoRightOffset.y;
        sweatState.jitoOffsetZ = av.sweatEffect.config.jitoRightOffset.z;
        sweatFolder.controllersRecursive().forEach((c) => c.updateDisplay());
      }
      av?.setSweatEnabled(val);
    });

  sweatFolder
    .add(sweatState, 'mode', {
      '4方向放物線 (焦り)': 'fly4',
      'こめかみタラーッ (じとー)': 'jito',
    })
    .name('演出モード (Mode)')
    .onChange(updateSweatConfig);

  sweatFolder
    .add(sweatState, 'side', {
      '右こめかみ (Right)': 'right',
      '左こめかみ (Left)': 'left',
      '両側 (Both)': 'both',
    })
    .name('じとー表示側 (Side)')
    .onChange(updateSweatConfig);

  sweatFolder.add(sweatState, 'toggleNervousExpression').name('💦 焦り顔プリセット');
  sweatFolder.add(sweatState, 'toggleJitoExpression').name('😑 じとー顔プリセット');
  sweatFolder.add(sweatState, 'restart').name('🔄 最初から再生');

  sweatFolder.add(sweatState, 'scale', 0.01, 0.15, 0.005).name('焦り汗のサイズ').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'jitoScale', 0.01, 0.15, 0.005).name('じとー汗のサイズ').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'flySpeed', 0.4, 2.5, 0.1).name('飛び散る勢い (速度)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'gravity', 0.5, 4.0, 0.1).name('重力 (落下の強さ)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'spawnInterval', 0.15, 1.0, 0.02).name('噴出間隔 (秒)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'dripSpeed', 0.005, 0.08, 0.005).name('タラーッと垂れる距離').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'duration', 0.5, 10.0, 0.5).name('表示秒数 (Duration)').onChange(updateSweatConfig);
  sweatFolder.add(sweatState, 'loop').name(tr.common.loop).onChange(updateSweatConfig);
  sweatFolder.addColor(sweatState, 'color').name('汗のメイン色').onChange(updateSweatConfig);
  sweatFolder.addColor(sweatState, 'accentColor').name('汗の濃い色').onChange(updateSweatConfig);

  const sweatPosFolder = sweatFolder.addFolder('📍 位置微調整 (Offset)');
  sweatPosFolder.add(sweatState, 'originY', 0.0, 0.35, 0.005).name('頭上の高さ (Y: fly4)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'originZ', -0.2, 0.2, 0.005).name('頭上の前後 (Z: fly4)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'jitoOffsetX', 0.02, 0.2, 0.005).name('こめかみ横幅 (X: jito)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'jitoOffsetY', -0.05, 0.2, 0.005).name('こめかみ高さ (Y: jito)').onChange(updateSweatConfig);
  sweatPosFolder.add(sweatState, 'jitoOffsetZ', -0.05, 0.2, 0.005).name('こめかみ前後 (Z: jito)').onChange(updateSweatConfig);
  sweatPosFolder.close();
  sweatFolder.close();

  // 9. Lip Sync Folder
  const lipFolder = visualGui.addFolder(tr.gui.lipSyncFolder);
  lipFolder.add(currentConfig.lipSync, 'enabled').name(tr.gui.lipSyncEnabled);
  lipFolder
    .add(currentConfig.lipSync, 'voiceGender', {
      '女性 / 高音 (Female)': 'female',
      '男性 / 低音 (Male)': 'male',
    })
    .name(tr.gui.lipSyncGender)
    .onChange((val: 'female' | 'male') => {
      audioLipSync.setVoiceGender(val);
    });
  lipFolder.add(currentConfig.lipSync, 'gain', 0.0, 1.5, 0.05).name(tr.gui.lipSyncGain);
  lipFolder.add(currentConfig.lipSync, 'smoothing', 0.05, 0.6, 0.01).name(tr.gui.lipSyncSmoothing);
  lipFolder
    .add(currentConfig.lipSync, 'audioDelay', 0.0, 0.2, 0.005)
    .name(tr.gui.lipSyncAudioDelay)
    .onChange((val: number) => {
      audioLipSync.setAudioDelay(val);
    });
  lipFolder
    .add(currentConfig.lipSync, 'rmsThreshold', 0.001, 0.05, 0.001)
    .name(tr.gui.lipSyncRmsThreshold)
    .onChange((val: number) => {
      audioLipSync.rmsThreshold = val;
    });
  lipFolder.close();

  visualGui.folders.forEach((folder) => folder.close());
}
