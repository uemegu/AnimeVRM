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
 * 6. Smart Sharpening (Digital anime crispness / CAS-like)
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

    // 6. Smart Sharpening
    uSharpenEnabled: { value: 1.0 },
    uSharpenAmount: { value: 0.22 },
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

    // Smart Sharpening
    uniform float uSharpenEnabled;
    uniform float uSharpenAmount;

    varying vec2 vUv;

    // Relative luminance
    float getLuma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
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

        vec3 glow = 1.0 - (1.0 - color) * (1.0 - blur * 0.85);
        color = mix(color, glow, clamp(uDiffusionStrength * 0.7, 0.0, 1.0));
      }

      // ----------------------------------------------------
      // 3. Color Grading (Split Toning, S-Curve & Gamma)
      // ----------------------------------------------------
      if (uColorGradingEnabled > 0.5 && uGradingStrength > 0.0) {
        vec3 graded = color;

        if (uGamma != 1.0) {
          graded = pow(max(graded, vec3(0.0)), vec3(1.0 / max(uGamma, 0.001)));
        }

        graded = applySCurve(graded, uGradingContrast);

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
      if (uBrightness != 0.0) {
        color += vec3(uBrightness);
      }

      if (uContrast != 0.0) {
        color = (color - 0.5) * (1.0 + uContrast) + 0.5;
      }

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
        color = mix(color * uVignetteColor, color, vignette);
      }

      // ----------------------------------------------------
      // 6. Smart Sharpening
      // ----------------------------------------------------
      if (uSharpenEnabled > 0.5 && uSharpenAmount > 0.001) {
        vec2 px = 1.0 / uResolution;
        vec3 colN = texture2D(tDiffuse, uv + vec2(0.0, -px.y)).rgb;
        vec3 colS = texture2D(tDiffuse, uv + vec2(0.0,  px.y)).rgb;
        vec3 colW = texture2D(tDiffuse, uv + vec2(-px.x, 0.0)).rgb;
        vec3 colE = texture2D(tDiffuse, uv + vec2( px.x, 0.0)).rgb;

        vec3 minNeighbor = min(min(colN, colS), min(colW, colE));
        vec3 maxNeighbor = max(max(colN, colS), max(colW, colE));

        vec3 unsharp = (colN + colS + colW + colE) * 0.25;
        vec3 delta = color - unsharp;

        vec3 sharpened = color + delta * (uSharpenAmount * 1.6);
        color = clamp(sharpened, minNeighbor * 0.95, maxNeighbor * 1.05);
      }

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), baseColor.a);
    }
  `,
};
