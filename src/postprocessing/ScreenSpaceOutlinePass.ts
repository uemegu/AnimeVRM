import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export interface ScreenSpaceOutlineParams {
  enabled: boolean;
  color: string;
  depthThreshold: number;
  normalThreshold: number;
  edgeStrength: number;
  thickness: number;
}

const ScreenSpaceOutlineShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2() },
    uOutlineColor: { value: new THREE.Color('#1f2430') },
    uEdgeThreshold: { value: 0.15 },
    uEdgeStrength: { value: 0.8 },
    uThickness: { value: 1.0 },
    uEnabled: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform vec3 uOutlineColor;
    uniform float uEdgeThreshold;
    uniform float uEdgeStrength;
    uniform float uThickness;
    uniform float uEnabled;
    varying vec2 vUv;

    // Luminance calculation
    float getLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec4 baseColor = texture2D(tDiffuse, vUv);
      if (uEnabled <= 0.0 || uEdgeStrength <= 0.0) {
        gl_FragColor = baseColor;
        return;
      }

      vec2 texelSize = (1.0 / uResolution) * uThickness;

      // Sample 4 diagonal neighbor pixels (Roberts Cross filter)
      vec3 col0 = texture2D(tDiffuse, vUv + vec2(-texelSize.x, -texelSize.y)).rgb;
      vec3 col1 = texture2D(tDiffuse, vUv + vec2( texelSize.x, -texelSize.y)).rgb;
      vec3 col2 = texture2D(tDiffuse, vUv + vec2(-texelSize.x,  texelSize.y)).rgb;
      vec3 col3 = texture2D(tDiffuse, vUv + vec2( texelSize.x,  texelSize.y)).rgb;

      // Luminance & Color difference
      float l0 = getLuma(col0);
      float l1 = getLuma(col1);
      float l2 = getLuma(col2);
      float l3 = getLuma(col3);

      float diff0 = length(col0 - col3) + abs(l0 - l3) * 1.5;
      float diff1 = length(col1 - col2) + abs(l1 - l2) * 1.5;
      float edgeVal = sqrt(diff0 * diff0 + diff1 * diff1);

      // Edge factor with threshold
      float edgeFactor = smoothstep(uEdgeThreshold, uEdgeThreshold * 2.2, edgeVal) * uEdgeStrength;
      edgeFactor = clamp(edgeFactor, 0.0, 1.0);

      // Composite outline onto base color
      vec3 finalColor = mix(baseColor.rgb, uOutlineColor, edgeFactor);
      gl_FragColor = vec4(finalColor, baseColor.a);
    }
  `,
};

export class ScreenSpaceOutlinePass extends Pass {
  public params: ScreenSpaceOutlineParams;
  private material: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;

  constructor(scene: THREE.Scene, camera: THREE.Camera, width: number, height: number, params?: Partial<ScreenSpaceOutlineParams>) {
    super();

    this.params = {
      enabled: true,
      color: '#1f2430',
      depthThreshold: 0.12,
      normalThreshold: 0.35,
      edgeStrength: 0.6,
      thickness: 1.0,
      ...params,
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ScreenSpaceOutlineShader.uniforms),
      vertexShader: ScreenSpaceOutlineShader.vertexShader,
      fragmentShader: ScreenSpaceOutlineShader.fragmentShader,
    });

    this.material.uniforms.uResolution.value.set(width, height);
    this.material.uniforms.uOutlineColor.value.set(this.params.color);
    this.material.uniforms.uEdgeThreshold.value = this.params.depthThreshold ?? 0.12;
    this.material.uniforms.uEdgeStrength.value = this.params.edgeStrength;
    this.material.uniforms.uThickness.value = this.params.thickness;
    this.material.uniforms.uEnabled.value = this.params.enabled ? 1.0 : 0.0;

    this.fsQuad = new FullScreenQuad(this.material);
  }

  public setSize(width: number, height: number): void {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  public updateParams(newParams: Partial<ScreenSpaceOutlineParams>): void {
    Object.assign(this.params, newParams);
    if (newParams.enabled !== undefined) {
      this.material.uniforms.uEnabled.value = this.params.enabled ? 1.0 : 0.0;
    }
    if (newParams.color) {
      this.material.uniforms.uOutlineColor.value.set(this.params.color);
    }
    if (newParams.depthThreshold !== undefined) {
      this.material.uniforms.uEdgeThreshold.value = this.params.depthThreshold;
    }
    if (newParams.edgeStrength !== undefined) {
      this.material.uniforms.uEdgeStrength.value = this.params.edgeStrength;
    }
    if (newParams.thickness !== undefined) {
      this.material.uniforms.uThickness.value = this.params.thickness;
    }
  }

  public render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    if (!this.params.enabled || this.params.edgeStrength <= 0.0) {
      if (this.renderToScreen) {
        this.fsQuad.material = new THREE.MeshBasicMaterial({ map: readBuffer.texture });
        this.fsQuad.render(renderer);
      } else {
        renderer.setRenderTarget(writeBuffer);
        this.fsQuad.material = new THREE.MeshBasicMaterial({ map: readBuffer.texture });
        this.fsQuad.render(renderer);
      }
      return;
    }

    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.uOutlineColor.value.set(this.params.color);
    this.material.uniforms.uEdgeThreshold.value = this.params.depthThreshold ?? 0.12;
    this.material.uniforms.uEdgeStrength.value = this.params.edgeStrength;
    this.material.uniforms.uThickness.value = this.params.thickness;
    this.material.uniforms.uEnabled.value = 1.0;

    this.fsQuad.material = this.material;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  public dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
