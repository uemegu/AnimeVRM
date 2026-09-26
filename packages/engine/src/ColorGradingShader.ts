import * as THREE from 'three';

/**
 * Anime-style Color Grading Shader
 * Provides split-toning (cool blue-purple shadows, warm ivory highlights)
 * and smooth S-curve contrast grading.
 */
export const ColorGradingShader = {
  name: 'ColorGradingShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uEnabled: { value: 1.0 },
    uShadowTint: { value: new THREE.Color('#2d3559') },
    uHighlightTint: { value: new THREE.Color('#fffbf2') },
    uStrength: { value: 0.45 },
    uGradingContrast: { value: 0.12 },
    uGamma: { value: 1.0 },
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
    uniform float uEnabled;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uStrength;
    uniform float uGradingContrast;
    uniform float uGamma;
    varying vec2 vUv;

    // Luminance calculation
    float getLuma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    // S-curve contrast
    vec3 applySCurve(vec3 c, float contrast) {
      if (contrast <= 0.0) return c;
      // Smooth Hermite interpolation for gentle filmic S-curve
      return mix(c, smoothstep(0.0, 1.0, c), contrast);
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uEnabled <= 0.0 || uStrength <= 0.0) {
        gl_FragColor = base;
        return;
      }

      vec3 color = base.rgb;

      // 1. Gamma adjustment
      if (uGamma != 1.0) {
        color = pow(max(color, vec3(0.0)), vec3(1.0 / max(uGamma, 0.001)));
      }

      // 2. S-Curve contrast
      color = applySCurve(color, uGradingContrast);

      // 3. 3-Way Split Toning (Shadows -> uShadowTint, Highlights -> uHighlightTint)
      float luma = getLuma(color);

      // Shadow tint (affects dark regions below luma 0.5)
      float shadowWeight = clamp((0.5 - luma) * 2.0, 0.0, 1.0);
      vec3 shadowColor = color * (uShadowTint * 2.0);

      // Highlight tint (affects bright regions above luma 0.5)
      float highlightWeight = clamp((luma - 0.5) * 2.0, 0.0, 1.0);
      vec3 highlightColor = color * uHighlightTint;

      vec3 graded = color;
      graded = mix(graded, shadowColor, shadowWeight * 0.45);
      graded = mix(graded, highlightColor, highlightWeight * 0.35);

      // Blend with original by uStrength
      color = mix(base.rgb, graded, clamp(uStrength, 0.0, 1.0));

      gl_FragColor = vec4(color, base.a);
    }
  `,
};
