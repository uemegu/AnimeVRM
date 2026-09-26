import{Jt as e,S as t,ht as n,jt as r,rt as i}from"./three-vrm.module-BSB1WpUY.js";var a=class{material=new r({depthTest:!1,depthWrite:!1,uniforms:{uPainting:{value:null},uTime:{value:0},uSkyGlow:{value:.85},uInteriorShadowStrength:{value:0},uExposure:{value:1},uRepeat:{value:new e(1,1)},uOffset:{value:new e},uZenith:{value:new t(`#078fff`)},uHorizon:{value:new t(`#9ce9ff`)},uCloudLight:{value:new t(`#fff9eb`)},uCloudShade:{value:new t(`#9ebdd6`)}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,fragmentShader:`
      uniform sampler2D uPainting;
      uniform float uTime, uSkyGlow, uInteriorShadowStrength, uExposure;
      uniform vec2 uRepeat, uOffset;
      uniform vec3 uZenith, uHorizon, uCloudLight, uCloudShade;
      varying vec2 vUv;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
      }
      float cloudField(vec2 p) {
        return noise(p) * 0.57 + noise(p * 2.07) * 0.28
             + noise(p * 4.13) * 0.11 + noise(p * 8.21) * 0.04;
      }
      void main() {
        vec2 uv = vUv * uRepeat + uOffset;
        vec3 sky = mix(uHorizon, uZenith, smoothstep(0.35, 1.05, uv.y));
        vec2 p = vec2(uv.x * 7.0 - uTime * 0.012, uv.y * 10.0);
        float body = cloudField(p);
        float clouds = smoothstep(0.49, 0.59, body);
        float light = smoothstep(-0.06, 0.09, body - cloudField(p + vec2(0.05, 0.15)));
        vec3 cloud = mix(uCloudShade, uCloudLight, light);
        float cloudHeight = smoothstep(0.35, 0.65, uv.y);
        sky = mix(sky, cloud, clouds * cloudHeight);
        // Broad cloud-edge glow and a soft sun halo, composited UNDER the painting.
        // This stays local to the sky even when the scene-wide bloom is disabled.
        float cloudHalo = smoothstep(0.38, 0.59, body) * cloudHeight;
        vec2 sunDelta = (uv - vec2(0.70, 1.03)) * vec2(1.7778, 1.0);
        float sunHalo = exp(-dot(sunDelta, sunDelta) / 0.025);
        float sunCore = exp(-dot(sunDelta, sunDelta) / 0.0018);
        sky *= 1.0 + 0.22 * uSkyGlow;
        sky += uCloudLight * uSkyGlow * (
          0.27 * cloudHalo + 0.55 * clouds * light * cloudHeight
          + 0.48 * sunHalo + 1.1 * sunCore
        );
        vec4 painting = texture2D(uPainting, clamp(uv, 0.0, 1.0));
        float luminance = dot(painting.rgb, vec3(0.2126, 0.7152, 0.0722));
        // Optional image grading, disabled by default; independent of the shared sky.
        float interior = max(1.0 - smoothstep(0.34, 0.47, uv.x),
                             1.0 - smoothstep(0.20, 0.48, uv.y));
        float shadow = 1.0 - smoothstep(0.025, 0.40, luminance);
        vec3 room = painting.rgb * (1.0 - uInteriorShadowStrength * interior * shadow);
        // Values above 1 stay in the half-float target, so bloom can blow out a sunlit view
        gl_FragColor = vec4(mix(sky, room, painting.a) * uExposure, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `});mesh=new i(new n(2,2),this.material);constructor(e){this.mesh.name=`SkyBackground`,this.mesh.frustumCulled=!1,this.mesh.renderOrder=-1e3,this.mesh.visible=!1,e.add(this.mesh)}setTimeOfDay(e){let t=e===`divine`?[`#0f172a`,`#3b4252`,`#fed7aa`,`#1e293b`]:e===`evening`?[`#748bc1`,`#f9d4a5`,`#fff0d4`,`#b2a4c3`]:e===`dark_indoor`||e===`night`?[`#183655`,`#728b9f`,`#abb9ca`,`#566c8b`]:e===`rainy`?[`#748c9e`,`#bccbd1`,`#dbe2e5`,`#8a9eaf`]:[`#078fff`,`#9ce9ff`,`#fff9eb`,`#9ebdd6`];this.material.uniforms.uSkyGlow.value=e===`divine`?.35:e===`dark_indoor`||e===`night`?.12:e===`rainy`?.2:e===`evening`?.55:.85,[`uZenith`,`uHorizon`,`uCloudLight`,`uCloudShade`].forEach((e,n)=>{this.material.uniforms[e].value.set(t[n])})}setTransform(e){let t=1/Math.max(1,e?.zoomScale??1);this.material.uniforms.uRepeat.value.set(t,t),this.material.uniforms.uOffset.value.set((1-t)*.5-(e?.panOffsetX??0),(1-t)*.5-(e?.panOffsetY??0))}};export{a as t};