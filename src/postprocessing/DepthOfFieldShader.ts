import * as THREE from 'three';

/**
 * High-quality Cinematic Depth of Field (DoF / Bokeh) Shader
 *
 * Specially tuned for anime/cel-shaded characters with creamy foreground blur
 * and sharp in-focus subject. Resolves foreground bleeding and eliminates jitter.
 */
export const DepthOfFieldShader = {
  name: 'DepthOfFieldShader',
  uniforms: {
    tColor: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uFocus: { value: 2.15 },     // Focal distance from camera in view-space units
    uAperture: { value: 0.045 }, // Bokeh blur strength
    uMaxBlur: { value: 0.022 },  // Clamped maximum blur radius in UV space
    uNear: { value: 0.1 },       // Camera near
    uFar: { value: 100.0 },      // Camera far
    uEnabled: { value: 0.0 },    // 0.0 = disabled, 1.0 = enabled
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #include <common>
    #include <packing>

    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uFocus;
    uniform float uAperture;
    uniform float uMaxBlur;
    uniform float uNear;
    uniform float uFar;
    uniform float uEnabled;

    varying vec2 vUv;

    // 32-sample smooth spiral disc to completely eliminate jitter and banding
    const int SAMPLES = 32;
    const float GOLDEN_ANGLE = 2.39996323;

    float getLinearDepth(vec2 coord) {
      float fragCoordZ = texture2D(tDepth, coord).x;
      // When depth buffer is at background/far or clear value
      if (fragCoordZ >= 0.99999) {
        return uFar;
      }
      float viewZ = perspectiveDepthToViewZ(fragCoordZ, uNear, uFar);
      return -viewZ; // positive distance from camera
    }

    void main() {
      vec4 centerColor = texture2D(tColor, vUv);

      if (uEnabled < 0.5 || uMaxBlur <= 0.0001 || uAperture <= 0.0001) {
        gl_FragColor = centerColor;
        return;
      }

      float centerDist = getLinearDepth(vUv);
      float centerCoC = clamp(abs(centerDist - uFocus) * uAperture, 0.0, uMaxBlur);

      vec2 aspect = vec2(1.0, uResolution.x / uResolution.y);
      vec4 accumColor = centerColor;
      float totalWeight = 1.0;

      // We determine max search radius: either centerCoC or max foreground blur radius
      // This ensures foreground objects (Emily) naturally bleed over background/in-focus pixels (Aoi)
      float searchRadius = max(centerCoC, uMaxBlur * 0.85);

      for (int i = 1; i <= SAMPLES; i++) {
        float fi = float(i);
        float r = sqrt(fi / float(SAMPLES));
        float theta = fi * GOLDEN_ANGLE;
        vec2 offset = vec2(cos(theta), sin(theta)) * (r * searchRadius) * aspect;

        vec2 sampleUv = vUv + offset;
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
          continue;
        }

        float sampleDist = getLinearDepth(sampleUv);
        float sampleCoC = clamp(abs(sampleDist - uFocus) * uAperture, 0.0, uMaxBlur);
        float distFromCenterUV = length(offset / aspect);

        // Foreground blur contribution:
        // A sample contributes if its blur circle (sampleCoC) reaches the center pixel
        float weight = 0.0;
        if (sampleDist < centerDist) {
          // Sample is in front of center pixel (Foreground bleed)
          if (sampleCoC >= distFromCenterUV * 0.8) {
            weight = smoothstep(1.0, 0.0, distFromCenterUV / max(sampleCoC, 0.001)) * 2.0;
          }
        } else {
          // Sample is behind or at same depth (Background blur)
          if (centerCoC >= distFromCenterUV * 0.8) {
            weight = smoothstep(1.0, 0.0, distFromCenterUV / max(centerCoC, 0.001));
          }
        }

        if (weight > 0.0) {
          accumColor += texture2D(tColor, sampleUv) * weight;
          totalWeight += weight;
        }
      }

      gl_FragColor = accumColor / totalWeight;
    }
  `,
};
