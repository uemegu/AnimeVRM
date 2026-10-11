import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * 雨の地面の映り込み（画面空間の反射）。
 *
 * 本描画の深度から各画素のワールド位置を求め、地面（高さ ~0）の画素だけ、鏡で反射した向きに光線を進めて、
 * 画面に映っているもの（建物・空・キャラ）にぶつかったらその色を足す。シーンを描き直さないので、
 * 平面反射より軽い。反射は路面のざらつきで縦に伸ばしてぼかし、浅い角度ほど強く（フレネル）、
 * 水たまりの中ほど強く映す。
 *
 * 本描画の深度（SceneRenderPass.depthTexture）を読むので、背景ぼかしなどと同じく RenderPass の近くに置く。
 */

/** 水たまりの形。地面を暗くする板（RainGround）と同じ式で、反射と暗さの範囲をそろえる */
export const PUDDLE_GLSL = /* glsl */ `
  float puddleHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float puddleNoise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( puddleHash( i ), puddleHash( i + vec2( 1, 0 ) ), f.x ), mix( puddleHash( i + vec2( 0, 1 ) ), puddleHash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  float puddleMask( vec2 p ) {
    float n = puddleNoise( p * 0.9 ) * 0.65 + puddleNoise( p * 2.3 + 7.0 ) * 0.35;
    return smoothstep( 0.40, 0.50, n );
  }
`;

const WetReflectionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uProj: { value: new THREE.Matrix4() },
    uProjInv: { value: new THREE.Matrix4() },
    uView: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uNearFar: { value: new THREE.Vector2(0.1, 100) },
    uTime: { value: 0 },
    uStrength: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 uProj, uProjInv, uView, uCamWorld;
    uniform vec2 uNearFar;
    uniform float uTime, uStrength;
    varying vec2 vUv;

    ${PUDDLE_GLSL}

    /** これより低い画素を地面とみなす（m） */
    const float GROUND_HEIGHT = 0.06;
    const int STEPS = 30;

    float viewDepth( float d ) { return -perspectiveDepthToViewZ( d, uNearFar.x, uNearFar.y ); }

    void main() {
      vec4 base = texture2D( tDiffuse, vUv );
      float depth = texture2D( tDepth, vUv ).x;
      if ( depth >= 0.9999 ) { gl_FragColor = base; return; }

      vec4 ndc = vec4( vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
      vec4 viewPos = uProjInv * ndc;
      viewPos /= viewPos.w;
      vec3 world = ( uCamWorld * viewPos ).xyz;
      if ( world.y > GROUND_HEIGHT ) { gl_FragColor = base; return; }

      vec3 camPos = uCamWorld[ 3 ].xyz;
      vec3 toCamera = normalize( camPos - world );
      vec3 refl = reflect( -toCamera, vec3( 0.0, 1.0, 0.0 ) );
      // 地面から見て、カメラの方へ戻る向きの反射は画面に映っていないので何もしない
      float cosT = clamp( toCamera.y, 0.0, 1.0 );
      float fresnel = 0.06 + 0.94 * pow( 1.0 - cosT, 3.0 );

      float puddle = puddleMask( world.xz );
      float gloss = 0.3 + 0.7 * puddle;

      // 水面のゆれ（たまりの中ほど大きく）
      vec2 wobble = ( vec2( puddleNoise( world.xz * 14.0 + uTime * 0.7 ), puddleNoise( world.xz * 14.0 - uTime * 0.6 + 5.0 ) ) - 0.5 ) * 0.006 * ( 0.4 + puddle );

      // 光線を進めて、画面に映っているものにぶつける
      vec3 color = vec3( 0.0 );
      float hit = 0.0;
      float t = 0.12;
      float stepLen = 0.12;
      vec2 lastUv = vUv;
      for ( int i = 0; i < STEPS; i++ ) {
        vec3 p = world + refl * t;
        vec4 clip = uProj * ( uView * vec4( p, 1.0 ) );
        if ( clip.w <= 0.0 ) break;
        vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
        if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) break;
        lastUv = uv;
        float d = texture2D( tDepth, uv ).x;
        float rayZ = -( uView * vec4( p, 1.0 ) ).z;
        // 空（深度なし）は無限に遠いので、画面内の空の画素に入ったら当たり
        if ( d >= 0.9999 ) { hit = 1.0; break; }
        float diff = rayZ - viewDepth( d );
        if ( diff > 0.0 && diff < 0.5 + t * 0.2 ) { hit = 1.0; break; }
        t += stepLen;
        stepLen *= 1.17;
      }
      // 当たらずに画面の外へ出たら、出る直前の画素の色をうすく映す
      float edge = smoothstep( 0.0, 0.08, min( min( lastUv.x, 1.0 - lastUv.x ), min( lastUv.y, 1.0 - lastUv.y ) ) );
      float amount = mix( 0.45 * edge, 1.0, hit );

      // 路面のざらつき: 反射を縦に引き伸ばしてぼかす
      float blur = 0.006 + 0.010 * ( 1.0 - puddle );
      vec2 uv0 = lastUv + wobble;
      vec3 sum = vec3( 0.0 );
      float wsum = 0.0;
      for ( int k = -3; k <= 3; k++ ) {
        float w = 1.0 - abs( float( k ) ) / 4.0;
        sum += texture2D( tDiffuse, uv0 + vec2( 0.0, float( k ) * blur * 0.5 ) ).rgb * w;
        wsum += w;
      }
      color = sum / wsum;

      // 反射した向きの空の暗さ（地平から離れるほど少し弱める）で、遠景のべったりした映り込みを抑える
      vec3 result = base.rgb + color * fresnel * gloss * amount * uStrength;
      gl_FragColor = vec4( result, base.a );
    }
  `,
};

export class WetReflectionPass extends Pass {
  private readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private time = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(WetReflectionShader.uniforms),
      vertexShader: WetReflectionShader.vertexShader,
      fragmentShader: WetReflectionShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    // カメラの行列は three が書き換えるので、参照のまま渡す
    const u = this.material.uniforms;
    u.uProj.value = camera.projectionMatrix;
    u.uProjInv.value = camera.projectionMatrixInverse;
    u.uView.value = camera.matrixWorldInverse;
    u.uCamWorld.value = camera.matrixWorld;
    this.camera = camera;
    this.quad = new FullScreenQuad(this.material);
    this.enabled = false;
  }

  private readonly camera: THREE.PerspectiveCamera;

  /** 本描画の深度（SceneRenderPass.depthTexture） */
  public sceneDepth: THREE.Texture | null = null;

  public update(delta: number): void {
    this.time += delta;
  }

  public render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = this.sceneDepth ?? readBuffer.depthTexture;
    u.uNearFar.value.set(this.camera.near, this.camera.far);
    u.uTime.value = this.time;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  public dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}
