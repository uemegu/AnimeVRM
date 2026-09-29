import * as THREE from 'three';
import { POOL_HALF, POOL_SIZE, POOL_DEPTH, WAVE_GLSL } from './WaterGLSL';

const RESOLUTION = 1024;
const GRID = 256;

/**
 * プール底の光の波紋（コースティクス）。
 * 水面の各格子点で太陽光を屈折させて底に落とし、格子の面積が縮んだ所ほど明るくなるものとして描く。
 * 面積比は隣のピクセルとの差分（dFdx/dFdy）で求める。結果はプール底の平面座標のテクスチャになる。
 */
export class Caustics {
  public readonly texture: THREE.Texture;

  private target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private material: THREE.ShaderMaterial;

  constructor(sim: THREE.Texture, sunDir: THREE.Vector3) {
    this.target = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.target.texture.anisotropy = 8;
    this.texture = this.target.texture;

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: {
        uTime: { value: 0 },
        uSim: { value: sim },
        uLightDir: { value: sunDir.clone().normalize() },
        uDepth: { value: POOL_DEPTH },
        uMicroGain: { value: 1.5 },
        uSimGain: { value: 1.6 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uSim;
        uniform vec3 uLightDir;
        uniform float uDepth;
        uniform float uMicroGain;
        uniform float uSimGain;
        varying vec3 vOld;
        varying vec3 vNew;
        ${WAVE_GLSL}

        void main() {
          // 板の局所 (x, y) をそのまま水面の (x, z) として使う
          vec2 xz = position.xy;
          vec2 gMacro;
          float hMacro = macroWave(xz, uTime, gMacro);
          vec2 gMicro = microGradient(xz, uTime) * uMicroGain;

          vec2 suv = (xz + ${POOL_HALF.toFixed(1)}) / ${POOL_SIZE.toFixed(1)};
          float e = 1.0 / ${GRID.toFixed(1)};
          float cell = ${POOL_SIZE.toFixed(1)} / ${GRID.toFixed(1)};
          float hS = texture2D(uSim, suv).r;
          float hL = texture2D(uSim, suv - vec2(e, 0.0)).r;
          float hR = texture2D(uSim, suv + vec2(e, 0.0)).r;
          float hD = texture2D(uSim, suv - vec2(0.0, e)).r;
          float hU = texture2D(uSim, suv + vec2(0.0, e)).r;
          vec2 gSim = vec2(hR - hL, hU - hD) / (2.0 * cell) * uSimGain;

          vec2 g = gMacro + gMicro + gSim;
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

          vec3 origin = vec3(xz.x, hMacro + hS, xz.y);
          vec3 refr = refract(-uLightDir, N, 1.0 / 1.333);
          float t = (-uDepth - origin.y) / refr.y;
          vec3 hit = origin + refr * t;

          vOld = vec3(xz.x, 0.0, xz.y);
          vNew = hit;
          gl_Position = vec4(hit.x / ${POOL_HALF.toFixed(1)}, hit.z / ${POOL_HALF.toFixed(1)}, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vOld;
        varying vec3 vNew;
        void main() {
          float oldArea = length(dFdx(vOld)) * length(dFdy(vOld));
          float newArea = length(dFdx(vNew)) * length(dFdy(vNew));
          float ratio = oldArea / max(newArea, 1e-7);
          gl_FragColor = vec4(vec3(min(ratio, 6.0)), 1.0);
        }
      `,
    });

    const geo = new THREE.PlaneGeometry(POOL_SIZE, POOL_SIZE, GRID - 1, GRID - 1);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  public render(renderer: THREE.WebGLRenderer, time: number) {
    this.material.uniforms.uTime.value = time;

    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);

    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.autoClear = prevAutoClear;
  }
}
