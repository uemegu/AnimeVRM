import * as THREE from 'three';

/**
 * Gran Turismo (GT) / Filmic Tone Mapping Shader
 * Based on the Uchimura / GT tone mapping curve used in high-end anime rendering.
 * Preserves vibrant midtones (skin tones) while cleanly rolling off high exposure & bloom.
 */
export const GTToneMappingShader = {
  name: 'GTToneMappingShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uEnabled: { value: 1.0 },
    uMaxLuminance: { value: 1.0 },
    uContrast: { value: 1.0 },
    uLinearSection: { value: 0.22 },
    uLinearLength: { value: 0.4 },
    uBlackTightness: { value: 1.33 },
    uPedestal: { value: 0.0 },
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
    uniform float uMaxLuminance;
    uniform float uContrast;
    uniform float uLinearSection;
    uniform float uLinearLength;
    uniform float uBlackTightness;
    uniform float uPedestal;
    varying vec2 vUv;

    // Gran Turismo (Uchimura) Tone Mapping Function
    // P = max luminance, a = contrast, m = linear section start, l = linear length, c = black tightness, b = pedestal
    vec3 granTurismoToneMapping(vec3 x, float P, float a, float m, float l, float c, float b) {
      float l0 = ((P - m) * l) / a;
      float S0 = m + l0;
      float S1 = m + a * l0;
      float C2 = (a * P) / (P - S1);
      float CP = -C2 / P;

      vec3 w0 = vec3(1.0) - smoothstep(vec3(0.0), vec3(m), x);
      vec3 w2 = step(vec3(m + l0), x);
      vec3 w1 = vec3(1.0) - w0 - w2;

      vec3 T = m * pow(max(x / m, vec3(0.0)), vec3(c)) + b;
      vec3 S = x - (m - S0);
      vec3 H = P - (P - S1) * exp(CP * (x - S0));

      return T * w0 + S * w1 + H * w2;
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      if (uEnabled <= 0.0) {
        gl_FragColor = tex;
        return;
      }

      vec3 color = max(tex.rgb, vec3(0.0));
      vec3 mapped = granTurismoToneMapping(
        color,
        max(uMaxLuminance, 0.1),
        max(uContrast, 0.1),
        max(uLinearSection, 0.01),
        max(uLinearLength, 0.01),
        max(uBlackTightness, 0.1),
        uPedestal
      );

      gl_FragColor = vec4(mapped, tex.a);
    }
  `,
};
