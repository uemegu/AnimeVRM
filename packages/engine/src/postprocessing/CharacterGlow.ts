import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/** Copy the original depth before DOF swaps buffers. A separate texture avoids
 * reading an attachment of the framebuffer the glow is currently writing to.
 */
class SceneDepthCapture extends Pass {
  private target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  });
  private material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tDepth: { value: null as THREE.Texture | null } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `#include <packing>
      uniform sampler2D tDepth; varying vec2 vUv;
      void main() { gl_FragColor = packDepthToRGBA(texture2D(tDepth, vUv).r); }`,
  });
  private quad = new FullScreenQuad(this.material);
  get texture(): THREE.Texture { return this.target.texture; }
  /** 本描画の深度（SceneRenderPass.depthTexture）。なければ read の深度を読む */
  sceneDepth: THREE.Texture | null = null;
  constructor() { super(); this.needsSwap = false; this.enabled = false; }
  setSize(width: number, height: number): void { this.target.setSize(width, height); }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDepth.value = this.sceneDepth ?? read.depthTexture;
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
  }
  dispose(): void { this.target.dispose(); this.material.dispose(); this.quad.dispose(); }
}

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Shared GLSL: which pixels are the visible character, and the visible eyes. */
const masks = /* glsl */ `
  #include <packing>
  uniform sampler2D tMask, tEye, tDepth;
  uniform float uEyeCare;
  float visibleCharacter(vec2 uv) {
    float characterDepth = texture2D(tMask, uv).r;
    float sceneDepth = unpackRGBAToDepth(texture2D(tDepth, uv));
    return step(characterDepth, 0.99999) * step(characterDepth, sceneDepth + 0.000002);
  }
  // The eyes where they are the frontmost surface (not hidden behind the bangs). Only with eye care.
  float eyeAt(vec2 uv) {
    float eyeDepth = texture2D(tEye, uv).r;
    return uEyeCare * step(eyeDepth, 0.99999) * step(eyeDepth, texture2D(tMask, uv).r + 0.000002);
  }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/**
 * Glow of the lit parts of the characters, in linear space, as in anime film
 * compositing: the bright parts of the visible characters are extracted at half
 * resolution, blurred with a separable Gaussian at quarter resolution, and laid
 * behind the figure, so the light spills softly out of the silhouette while the
 * character itself keeps its crisp cel shading (`uInside` of it lands on the figure).
 * A smooth blur matters: sparse taps over a wide radius left blotches on the
 * skin that looked painted on.
 *
 * Eye care (per location): the emissive eye highlights are far above white at
 * night and would bloom into glowing eyes; the visible eyes are held just under
 * white and kept out of the glow.
 */
export class CharacterGlowPass extends Pass {
  readonly depthCapture = new SceneDepthCapture();
  /** Live values; StageManager sets them. */
  readonly uniforms = {
    uStrength: { value: 0 }, uRadius: { value: 0.012 }, uThreshold: { value: 0.16 },
    uEyeCare: { value: 0 }, uEyeCap: { value: 0.75 },
    /** How much of the glow lands on the character itself (0: only around it). */
    uInside: { value: 0.05 },
  };
  private readonly half = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly blurA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly blurB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly size = new THREE.Vector2(1, 1);
  private readonly extract: THREE.ShaderMaterial;
  private readonly blur: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly quad = new FullScreenQuad();

  constructor(mask: THREE.Texture, eyeMask: THREE.Texture) {
    super();
    const shared = { tMask: { value: mask }, tEye: { value: eyeMask }, tDepth: { value: this.depthCapture.texture }, uEyeCare: this.uniforms.uEyeCare };
    this.extract = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { ...shared, tDiffuse: { value: null }, uThreshold: this.uniforms.uThreshold },
      vertexShader: fullscreenVertex,
      fragmentShader: /* glsl */ `
        ${masks}
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        varying vec2 vUv;
        void main() {
          vec3 c = max(texture2D(tDiffuse, vUv).rgb, vec3(0.0));
          // Soft knee: only the lit side glows, more the brighter it is.
          float bright = smoothstep(uThreshold, uThreshold * 2.0 + 0.1, luma(c));
          gl_FragColor = vec4(min(c, vec3(4.0)) * bright * visibleCharacter(vUv) * (1.0 - eyeAt(vUv)), 1.0);
        }`,
    });
    this.blur = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } },
      vertexShader: fullscreenVertex,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uStep;
        varying vec2 vUv;
        void main() {
          // 9-tap Gaussian (sigma ~ 2 steps) using linear filtering between taps.
          vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270;
          c += (texture2D(tDiffuse, vUv + uStep * 1.3846).rgb + texture2D(tDiffuse, vUv - uStep * 1.3846).rgb) * 0.3162;
          c += (texture2D(tDiffuse, vUv + uStep * 3.2308).rgb + texture2D(tDiffuse, vUv - uStep * 3.2308).rgb) * 0.0703;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.composite = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { ...shared, tDiffuse: { value: null }, tGlow: { value: this.blurB.texture }, uStrength: this.uniforms.uStrength, uEyeCap: this.uniforms.uEyeCap, uInside: this.uniforms.uInside },
      vertexShader: fullscreenVertex,
      fragmentShader: /* glsl */ `
        ${masks}
        uniform sampler2D tDiffuse, tGlow;
        uniform float uStrength, uEyeCap, uInside;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          float eyeHere = eyeAt(vUv);
          base.rgb = mix(base.rgb, min(base.rgb, vec3(uEyeCap)), eyeHere);
          // Any character pixel (not the depth test against the scene: its precision is not enough
          // for a face under the bangs, and the halo would leak onto the face in patches).
          float onCharacter = step(texture2D(tMask, vUv).r, 0.99999);
          // The glow sits behind the figure: it spills out of the silhouette into the background,
          // while the character itself stays crisp cel shading (only a faint lift on its lit parts).
          vec3 g = texture2D(tGlow, vUv).rgb * uStrength * mix(1.0, uInside, onCharacter) * (1.0 - eyeHere);
          // Screen-like add: bright parts approach white softly instead of blowing out.
          vec3 lit = clamp(base.rgb, 0.0, 1.0);
          gl_FragColor = vec4(base.rgb + g * (1.0 - lit * 0.8), base.a);
        }`,
    });
    this.enabled = false;
  }

  setSize(width: number, height: number): void {
    this.size.set(width, height);
    this.half.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
    this.blurA.setSize(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
    this.blurB.setSize(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
  }

  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    const draw = (material: THREE.Material, target: THREE.WebGLRenderTarget | null) => {
      this.quad.material = material;
      renderer.setRenderTarget(target);
      this.quad.render(renderer);
    };
    this.extract.uniforms.tDiffuse.value = read.texture;
    draw(this.extract, this.half);
    // Blur radius: uRadius is a fraction of the screen height; one 9-tap pass spreads ~4 steps.
    const quarterHeight = this.blurA.height;
    const stepPx = Math.max(0.5, this.uniforms.uRadius.value * quarterHeight / 6);
    let source: THREE.Texture = this.half.texture;
    for (let i = 0; i < 3; i++) {
      this.blur.uniforms.tDiffuse.value = source;
      this.blur.uniforms.uStep.value.set(stepPx / this.blurA.width, 0);
      draw(this.blur, this.blurA);
      this.blur.uniforms.tDiffuse.value = this.blurA.texture;
      this.blur.uniforms.uStep.value.set(0, stepPx / quarterHeight);
      draw(this.blur, this.blurB);
      source = this.blurB.texture;
    }
    this.composite.uniforms.tDiffuse.value = read.texture;
    draw(this.composite, this.renderToScreen ? null : write);
  }

  dispose(): void {
    this.depthCapture.dispose();
    [this.half, this.blurA, this.blurB].forEach((t) => t.dispose());
    [this.extract, this.blur, this.composite].forEach((m) => m.dispose());
    this.quad.dispose();
  }
}
