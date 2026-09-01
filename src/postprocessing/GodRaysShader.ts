import * as THREE from 'three';

/**
 * Anime Volumetric Sun Shafts (God Rays) Post-Processing Shader
 * Generates radiant light beams beaming from the 2D projected sun position
 * with smooth decay, anime color tinting, and atmospheric shimmer.
 */
export const GodRaysShader = {
  name: 'GodRaysShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSunPosition: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVisibility: { value: 1.0 },
    uExposure: { value: 0.35 },
    uDecay: { value: 0.94 },
    uDensity: { value: 0.85 },
    uWeight: { value: 0.4 },
    uRayColor: { value: new THREE.Color('#fff2db') },
    uClampMax: { value: 1.0 },
    uTime: { value: 0.0 },
    uShimmer: { value: 0.5 },
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
    uniform vec2 uSunPosition;
    uniform float uSunVisibility;
    uniform float uExposure;
    uniform float uDecay;
    uniform float uDensity;
    uniform float uWeight;
    uniform vec3 uRayColor;
    uniform float uClampMax;
    uniform float uTime;
    uniform float uShimmer;
    varying vec2 vUv;

    // Pseudo-random hash for subtle dithering and shimmer noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // Relative luminance
    float getLuma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);

      if (uSunVisibility <= 0.001 || uExposure <= 0.001) {
        gl_FragColor = base;
        return;
      }

      // Vector from current pixel towards sun screen position
      vec2 deltaTexCoord = (vUv - uSunPosition);
      float distToSun = length(deltaTexCoord);

      const int NUM_SAMPLES = 45;
      vec2 step = deltaTexCoord * (1.0 / float(NUM_SAMPLES)) * uDensity;

      // Subtle sub-pixel dither offset to break banding artifacts without grain noise
      float dither = hash(gl_FragCoord.xy);
      vec2 coord = vUv - step * (dither * 0.25);

      float illuminationDecay = 1.0;
      vec3 accumulatedRays = vec3(0.0);

      // Shimmer / fluttering modulation (simulating foliage / wind / atmospheric dust)
      float angle = atan(deltaTexCoord.y, deltaTexCoord.x);
      float shimmerMod = 1.0;
      if (uShimmer > 0.01) {
        shimmerMod = 1.0 + 0.22 * sin(angle * 12.0 + uTime * 2.5) * uShimmer
                         + 0.12 * sin(angle * 26.0 - uTime * 1.8) * uShimmer;
      }

      // Atmospheric radial light beam streaks (woodland komorebi & sunbeams)
      float rayStreaks = pow(max(0.0, sin(angle * 7.0 + uTime * 0.25) * 0.5 + 0.5), 3.0) * 0.65
                       + pow(max(0.0, sin(angle * 15.0 - uTime * 0.4) * 0.5 + 0.5), 4.0) * 0.45;
      float radialBeam = rayStreaks / (1.0 + distToSun * 2.2);

      for (int i = 0; i < NUM_SAMPLES; i++) {
        coord -= step;

        if (coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0) {
          vec4 sampleColor = texture2D(tDiffuse, coord);

          // Extract highlights & bright contours
          float l = getLuma(sampleColor.rgb);
          float brightness = smoothstep(0.15, 0.85, l);
          vec3 sampleLight = sampleColor.rgb * brightness;

          sampleLight *= illuminationDecay * uWeight;
          accumulatedRays += sampleLight;
          illuminationDecay *= uDecay;
        }
      }

      // Combine scene-sampled rays with atmospheric beam streaks
      vec3 totalRays = (accumulatedRays + uRayColor * radialBeam * uWeight * 3.5);
      vec3 rays = totalRays * uRayColor * uExposure * uSunVisibility * shimmerMod;
      rays = min(rays, vec3(uClampMax));

      // Screen/Additive mix with anime soft look
      vec3 result = base.rgb + rays;

      gl_FragColor = vec4(result, base.a);
    }
  `,
};
