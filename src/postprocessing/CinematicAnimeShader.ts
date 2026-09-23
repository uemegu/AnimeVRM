import * as THREE from 'three';

/**
 * Cinematic Anime Post-Processing Shader (Uber Shader)
 *
 * Integrates multiple post-processing effects into a SINGLE fullscreen pass:
 * 1. Chromatic Aberration (subtle lens RGB fringe towards corners)
 * 2. Soft Diffusion Glow (anime film style diffusion / paraffin glow)
 * 3. Color Grading (Split-Toning shadows/highlights, gentle S-curve, Gamma)
 * 4. Saturation / Brightness / Contrast adjustments
 * 5. Cinematic Vignette (colored edge darkening)
 * 6. Procedural Film Grain (organic micro-grain for theatrical film texture)
 */
export const CinematicAnimeShader = {
  name: 'CinematicAnimeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uTime: { value: 0.0 },

    // 1. Chromatic Aberration
    uChromaticAberrationEnabled: { value: 1.0 },
    uChromaticAberrationOffset: { value: 0.0015 },

    // 2. Diffusion / Soft Glow
    uDiffusionEnabled: { value: 1.0 },
    uDiffusionStrength: { value: 0.25 },
    uDiffusionRadius: { value: 1.8 },

    // 3. Color Grading（OutputPass の後の sRGB 空間で使うため、色は sRGB の値で持つ）
    uColorGradingEnabled: { value: 1.0 },
    uShadowTint: { value: new THREE.Color('#3d61ff').convertLinearToSRGB() },
    uHighlightTint: { value: new THREE.Color('#99c0ff').convertLinearToSRGB() },
    uGradingStrength: { value: 0.28 },
    uGradingContrast: { value: 0.31 },
    uGamma: { value: 0.84 },

    // 4. Basic Adjustments
    uSaturation: { value: 0.26 },
    uBrightness: { value: 0.0 },
    uContrast: { value: 0.0 },

    // 5. Vignette
    uVignetteEnabled: { value: 1.0 },
    uVignetteOffset: { value: 1.15 },
    uVignetteDarkness: { value: 0.08 },
    uVignetteColor: { value: new THREE.Color('#1a1829').convertLinearToSRGB() },

    // 6. Film Grain (Default OFF for clean digital anime look)
    uFilmGrainEnabled: { value: 0.0 },
    uFilmGrainStrength: { value: 0.035 },
    uFilmGrainSpeed: { value: 1.0 },

    // 7. Smart Sharpening (Digital anime crispness / CAS-like)
    uSharpenEnabled: { value: 1.0 },
    uSharpenAmount: { value: 0.22 },

    // 8. Fisheye Lens Distortion
    uFisheyeEnabled: { value: 0.0 },
    uFisheyeStrength: { value: 0.5 },
    uFisheyeZoom: { value: 1.0 },
    uFisheyeCircular: { value: 0.0 },
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
    uniform float uTime;

    // Chromatic Aberration
    uniform float uChromaticAberrationEnabled;
    uniform float uChromaticAberrationOffset;

    // Diffusion
    uniform float uDiffusionEnabled;
    uniform float uDiffusionStrength;
    uniform float uDiffusionRadius;

    // Color Grading
    uniform float uColorGradingEnabled;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uGradingStrength;
    uniform float uGradingContrast;
    uniform float uGamma;

    // Basic Adjustments
    uniform float uSaturation;
    uniform float uBrightness;
    uniform float uContrast;

    // Vignette
    uniform float uVignetteEnabled;
    uniform float uVignetteOffset;
    uniform float uVignetteDarkness;
    uniform vec3 uVignetteColor;

    // Film Grain
    uniform float uFilmGrainEnabled;
    uniform float uFilmGrainStrength;
    uniform float uFilmGrainSpeed;

    // Smart Sharpening
    uniform float uSharpenEnabled;
    uniform float uSharpenAmount;

    // Fisheye Lens Distortion
    uniform float uFisheyeEnabled;
    uniform float uFisheyeStrength;
    uniform float uFisheyeZoom;
    uniform float uFisheyeCircular;

    varying vec2 vUv;

    // Relative luminance
    float getLuma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    // Pseudo-random hash
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // S-curve contrast
    vec3 applySCurve(vec3 c, float contrast) {
      if (contrast <= 0.0) return c;
      return mix(c, smoothstep(0.0, 1.0, c), contrast);
    }

    // Hue / Saturation adjustment (perceptual)
    vec3 applySaturation(vec3 rgb, float adjustment) {
      float l = getLuma(rgb);
      return mix(vec3(l), rgb, 1.0 + adjustment);
    }

    void main() {
      vec2 uv = vUv;
      float fisheyeMask = 1.0;

      // ----------------------------------------------------
      // 0. Fisheye Lens Distortion (Barrel / Curvature)
      // ----------------------------------------------------
      if (uFisheyeEnabled > 0.5 && uFisheyeStrength > 0.001) {
        float aspect = uResolution.x / uResolution.y;
        vec2 p = uv - vec2(0.5);
        p.x *= aspect;

        float r = length(p);

        if (uFisheyeCircular > 0.5) {
          // --- 円周魚眼 (Circular Fisheye: ドアスコープ / 球面レンズ風) ---
          float circleRadius = 0.48;
          float rn = clamp(r / circleRadius, 0.0, 1.0);

          // 樽型歪み（中心部を拡大し、周辺に向かって自然に圧縮）
          float distortion = 1.0 + uFisheyeStrength * (rn * rn * 0.45 + pow(rn, 4.0) * 0.35);

          // 円の境界 (rn = 1.0) でもテクスチャ範囲 (y: 0.5) を絶対に超えないよう自動スケール補正
          float maxDistortion = 1.0 + uFisheyeStrength * 0.8;
          float autoFit = 0.47 / (circleRadius * maxDistortion);
          float scale = autoFit * uFisheyeZoom;

          vec2 distortedP = p * distortion * scale;
          distortedP.x /= aspect;
          uv = distortedP + vec2(0.5);

          // ドアスコープの金属鏡胴（円周ブラックアウト＆ソフトエッジ）
          float edgeFade = 0.02;
          fisheyeMask = 1.0 - smoothstep(circleRadius - edgeFade, circleRadius, r);

          // 境界外ピクセルが線状に引き伸ばされるのを100%防止（テクスチャ外は完全黒マスク）
          float uvMargin = 0.002;
          if (uv.x < uvMargin || uv.x > (1.0 - uvMargin) || uv.y < uvMargin || uv.y > (1.0 - uvMargin)) {
            fisheyeMask = 0.0;
          }
        } else {
          // --- 対角線魚眼 (Full-frame Fisheye: 広角アクションカメラ / アニメ迫力魚眼) ---
          float maxRadius = length(vec2(0.5 * aspect, 0.5));
          float rn = r / maxRadius;

          float k1 = 0.55 * uFisheyeStrength;
          float k2 = 0.25 * uFisheyeStrength;
          float distortion = 1.0 + (rn * rn * k1 + pow(rn, 4.0) * k2);

          // 四隅がテクスチャ内に綺麗に収まるスケール補正
          float cornerDistortion = 1.0 + (k1 + k2);
          float autoFit = 1.0 / cornerDistortion;
          float totalScale = autoFit * uFisheyeZoom;

          vec2 distortedP = p * distortion * totalScale;
          distortedP.x /= aspect;
          uv = distortedP + vec2(0.5);

          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            fisheyeMask = 0.0;
          }
        }
      }

      vec2 centerCoord = uv - vec2(0.5);
      float distToCenter = length(centerCoord);

      // ----------------------------------------------------
      // 1. Chromatic Aberration (RGB shift towards corners)
      // ----------------------------------------------------
      vec4 baseColor;
      if (uChromaticAberrationEnabled > 0.5 && uChromaticAberrationOffset > 0.0) {
        vec2 dir = normalize(centerCoord + 0.00001);
        float shift = uChromaticAberrationOffset * distToCenter * 2.0;
        float r = texture2D(tDiffuse, uv + dir * shift).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - dir * shift).b;
        float a = texture2D(tDiffuse, uv).a;
        baseColor = vec4(r, g, b, a);
      } else {
        baseColor = texture2D(tDiffuse, uv);
      }

      vec3 color = baseColor.rgb;

      // ----------------------------------------------------
      // 2. Soft Diffusion Glow (Anime Film Paraffin Glow)
      // ----------------------------------------------------
      if (uDiffusionEnabled > 0.5 && uDiffusionStrength > 0.001) {
        vec2 texel = (1.0 / uResolution) * uDiffusionRadius;
        // 9-tap cross/diagonal sampling for soft diffusion glow
        vec3 blur = vec3(0.0);
        blur += texture2D(tDiffuse, uv + vec2(-texel.x, -texel.y) * 1.5).rgb * 0.08;
        blur += texture2D(tDiffuse, uv + vec2( 0.0,     -texel.y) * 2.0).rgb * 0.12;
        blur += texture2D(tDiffuse, uv + vec2( texel.x, -texel.y) * 1.5).rgb * 0.08;
        blur += texture2D(tDiffuse, uv + vec2(-texel.x,  0.0    ) * 2.0).rgb * 0.12;
        blur += texture2D(tDiffuse, uv                                 ).rgb * 0.20;
        blur += texture2D(tDiffuse, uv + vec2( texel.x,  0.0    ) * 2.0).rgb * 0.12;
        blur += texture2D(tDiffuse, uv + vec2(-texel.x,  texel.y) * 1.5).rgb * 0.08;
        blur += texture2D(tDiffuse, uv + vec2( 0.0,      texel.y) * 2.0).rgb * 0.12;
        blur += texture2D(tDiffuse, uv + vec2( texel.x,  texel.y) * 1.5).rgb * 0.08;

        // Soft screen/lighten blend to give the characteristic anime glowing air look
        vec3 glow = 1.0 - (1.0 - color) * (1.0 - blur * 0.85);
        color = mix(color, glow, clamp(uDiffusionStrength * 0.7, 0.0, 1.0));
      }

      // ----------------------------------------------------
      // 3. Color Grading (Split Toning, S-Curve & Gamma)
      // ----------------------------------------------------
      if (uColorGradingEnabled > 0.5 && uGradingStrength > 0.0) {
        vec3 graded = color;

        // Gamma adjustment
        if (uGamma != 1.0) {
          graded = pow(max(graded, vec3(0.0)), vec3(1.0 / max(uGamma, 0.001)));
        }

        // S-Curve contrast
        graded = applySCurve(graded, uGradingContrast);

        // 3-Way Split Toning
        float luma = getLuma(graded);
        float shadowWeight = clamp((0.5 - luma) * 2.0, 0.0, 1.0);
        vec3 shadowColor = graded * (uShadowTint * 2.0);

        float highlightWeight = clamp((luma - 0.5) * 2.0, 0.0, 1.0);
        vec3 highlightColor = graded * uHighlightTint;

        vec3 splitColor = graded;
        splitColor = mix(splitColor, shadowColor, shadowWeight * 0.45);
        splitColor = mix(splitColor, highlightColor, highlightWeight * 0.35);

        color = mix(color, splitColor, clamp(uGradingStrength, 0.0, 1.0));
      }

      // ----------------------------------------------------
      // 4. Basic Adjustments (Brightness, Contrast, Saturation)
      // ----------------------------------------------------
      // Brightness
      if (uBrightness != 0.0) {
        color += vec3(uBrightness);
      }

      // Contrast
      if (uContrast != 0.0) {
        color = (color - 0.5) * (1.0 + uContrast) + 0.5;
      }

      // Saturation
      if (uSaturation != 0.0) {
        color = applySaturation(color, uSaturation);
      }

      // ----------------------------------------------------
      // 5. Cinematic Vignette (Edge Darkening & Tint)
      // ----------------------------------------------------
      if (uVignetteEnabled > 0.5 && uVignetteDarkness > 0.0) {
        vec2 vUvNorm = (uv - 0.5) * 2.0;
        float vDist = dot(vUvNorm, vUvNorm);
        float vignette = 1.0 - smoothstep(uVignetteOffset * 0.6, uVignetteOffset * 1.5, vDist) * uVignetteDarkness;
        // Blend towards stylized vignette color instead of flat black
        color = mix(color * uVignetteColor, color, vignette);
      }

      // ----------------------------------------------------
      // 6. Film Grain (Organic micro-grain)
      // ----------------------------------------------------
      if (uFilmGrainEnabled > 0.5 && uFilmGrainStrength > 0.0) {
        float timeOffset = floor(uTime * 24.0 * uFilmGrainSpeed);
        float noise = (hash(gl_FragCoord.xy + vec2(timeOffset * 17.1, timeOffset * 31.7)) - 0.5) * 2.0;
        // Grain is most visible in midtones, less in extreme blacks/whites
        float lum = getLuma(color);
        float grainMask = 1.0 - 2.0 * abs(lum - 0.5);
        grainMask = clamp(grainMask, 0.2, 1.0);
        color += noise * uFilmGrainStrength * grainMask;
      }

      // ----------------------------------------------------
      // 7. Smart Sharpening (Contrast-Adaptive Line & Texture Enhancement)
      // ----------------------------------------------------
      if (uSharpenEnabled > 0.5 && uSharpenAmount > 0.001) {
        vec2 px = 1.0 / uResolution;
        vec3 colN = texture2D(tDiffuse, uv + vec2(0.0, -px.y)).rgb;
        vec3 colS = texture2D(tDiffuse, uv + vec2(0.0,  px.y)).rgb;
        vec3 colW = texture2D(tDiffuse, uv + vec2(-px.x, 0.0)).rgb;
        vec3 colE = texture2D(tDiffuse, uv + vec2( px.x, 0.0)).rgb;

        vec3 minNeighbor = min(min(colN, colS), min(colW, colE));
        vec3 maxNeighbor = max(max(colN, colS), max(colW, colE));

        // Adaptive high-pass unsharp masking
        vec3 unsharp = (colN + colS + colW + colE) * 0.25;
        vec3 delta = color - unsharp;

        // Apply sharpness clamped to local contrast range to avoid haloing
        vec3 sharpened = color + delta * (uSharpenAmount * 1.6);
        color = clamp(sharpened, minNeighbor * 0.95, maxNeighbor * 1.05);
      }

      // ----------------------------------------------------
      // 8. Fisheye Vignette / Masking
      // ----------------------------------------------------
      if (uFisheyeEnabled > 0.5 && uFisheyeStrength > 0.001) {
        color = mix(vec3(0.0), color, fisheyeMask);
      }

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), baseColor.a * fisheyeMask);
    }
  `,
};
