import * as THREE from 'three';

/**
 * Last touches on the characters, in display space (after the colour grading),
 * using the character mask:
 *
 * - Backlight rim: a crisp band of light along the silhouette on the side
 *   facing a light behind the character (e.g. fireworks bursting behind her).
 *   MToon lights the whole figure with any light, even one from behind, so a
 *   backlight cannot be a real light: the 3D set publishes it on
 *   `scene.userData.characterRim` (see `CharacterRim`) and this pass draws it.
 * - Highlight cap: the brightest parts of the characters are rolled off just
 *   under white, so a burst of light never blows the face out. The background
 *   is not touched (lanterns and fireworks may still clip).
 */
export type CharacterRim = {
  /** Colour times strength (display space); black when there is no backlight. */
  color: THREE.Color;
  /** Where the light is on screen (0..1 uv; may lie outside the frame). */
  screen: THREE.Vector2;
};

export const CharacterFinishShader = {
  name: 'CharacterFinishShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tMask: { value: null as THREE.Texture | null },
    tEye: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uRimColor: { value: new THREE.Color(0, 0, 0) },
    uRimScreen: { value: new THREE.Vector2(0.5, 1.5) },
    /** Rim width in pixels at 1080 lines. */
    uRimWidth: { value: 3.5 },
    /** Highlight cap: the knee and the ceiling of the roll-off (1, 1 = off). */
    uCapKnee: { value: 1 },
    uCapTop: { value: 1 },
    uEyeCare: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tMask, tEye;
    uniform vec2 uResolution, uRimScreen;
    uniform vec3 uRimColor;
    uniform float uRimWidth, uCapKnee, uCapTop, uEyeCare;
    varying vec2 vUv;

    float characterAt(vec2 uv) { return step(texture2D(tMask, uv).r, 0.99999); }
    float eyeAt(vec2 uv) {
      float eyeDepth = texture2D(tEye, uv).r;
      return uEyeCare * step(eyeDepth, 0.99999) * step(eyeDepth, texture2D(tMask, uv).r + 0.000002);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      if (characterAt(vUv) < 0.5) {
        gl_FragColor = color;
        return;
      }
      float aspect = uResolution.x / uResolution.y;

      // Backlight rim: find the outward direction of the silhouette from the mask around this pixel.
      if (dot(uRimColor, vec3(1.0)) > 0.001) {
        float radius = uRimWidth * uResolution.y / 1080.0;
        vec2 outward = vec2(0.0);
        float outside = 0.0;
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 0.39269908;
          vec2 d = vec2(cos(a), sin(a));
          float o = 1.0 - characterAt(vUv + d * radius / uResolution);
          outward += d * o;
          outside += o;
        }
        outside /= 16.0;
        if (outside > 0.0) {
          vec2 toLight = (uRimScreen - vUv) * vec2(aspect, 1.0);
          float facing = dot(normalize(outward + 1e-5), normalize(toLight + 1e-5));
          // Brightest right at the edge and fading inwards; the light is hot, so its colour runs towards white.
          float rim = smoothstep(0.02, 0.3, outside) * smoothstep(-0.1, 0.5, facing) * (1.0 - eyeAt(vUv));
          vec3 light = mix(uRimColor, vec3(max(max(uRimColor.r, uRimColor.g), uRimColor.b)), 0.45);
          color.rgb = 1.0 - (1.0 - color.rgb) * (1.0 - clamp(light * rim, 0.0, 1.0));
        }
      }

      // Highlight cap: roll the brightest channel off between the knee and the ceiling, keeping the hue.
      float m = max(max(color.r, color.g), color.b);
      if (m > uCapKnee) {
        float span = max(uCapTop - uCapKnee, 1e-4);
        float rolled = uCapKnee + span * (1.0 - exp(-(m - uCapKnee) / span));
        color.rgb *= rolled / m;
      }
      gl_FragColor = color;
    }
  `,
};
