import{c as e,d as t,f as n,l as r,m as i,o as a,p as o,r as s,s as c,u as l}from"./ToonShader-Cj87AYvl.js";import{A as u,At as d,B as f,Bt as p,C as m,Ct as h,D as g,Dt as _,Et as v,G as y,H as b,Ht as x,I as S,It as ee,Jt as C,K as te,Kt as w,L as T,N as ne,Ot as E,Qt as D,S as O,St as re,Tt as ie,Ut as ae,V as oe,W as se,Wt as ce,Yt as k,_ as A,_t as le,b as ue,c as de,ct as fe,dt as pe,et as j,ft as me,g as M,h as N,ht as P,it as F,j as he,jt as I,k as ge,l as _e,lt as ve,o as ye,pt as be,rt as L,st as xe,u as Se,v as R,x as Ce,z as we,zt as Te}from"./three-vrm.module-BSB1WpUY.js";import{t as z}from"./path-C-vF2-aM.js";import{c as Ee,l as De,o as Oe,s as ke,t as Ae}from"./Avatar-DJzAC5r9.js";import{t as je}from"./OrbitControls-DUqRtP5w.js";import{t as Me}from"./SkyBackground-DvC5Gggo.js";import{i as Ne,n as Pe,t as Fe}from"./SchoolGateCrowdPreset-DmZ189RO.js";import{a as Ie,i as Le,r as Re}from"./PaintedClassroom-Z1OIbhsq.js";import{n as ze,r as Be}from"./PaintedLibrary-BQPpZYfk.js";var Ve={enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110},He=`
  attribute float aTail;
  attribute float aSpeed;
  attribute float aLength;
  attribute vec3 aOffset;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uLength;
  uniform float uAngleRad;
  uniform vec3 uBoxSize;
  uniform vec3 uBoxCenter;

  varying float vAlpha;

  void main() {
    float dropSpeed = uSpeed * aSpeed;
    float boxH = uBoxSize.y;
    float boxW = uBoxSize.x;
    float boxD = uBoxSize.z;

    // 1. 雨粒の基準点（Base point）の計算
    // 上から下への循環落下
    float totalFall = uTime * dropSpeed + aOffset.y * 3.7;
    float fallInBox = mod(totalFall, boxH);
    float baseY = (uBoxCenter.y + boxH * 0.5) - fallInBox;

    // 傾き（風・重力）によるX方向のドリフト
    float xDrift = sin(uAngleRad) * fallInBox;

    // 雨粒の基準点に対してのみボックス内ラップ（mod）を実行
    // これにより head と tail が境界で引き裂かれる（横線バグ）のを 100% 防止
    float baseX = mod(aOffset.x + xDrift - uBoxCenter.x + boxW * 0.5, boxW) + uBoxCenter.x - boxW * 0.5;
    float baseZ = mod(aOffset.z - uBoxCenter.z + boxD * 0.5, boxD) + uBoxCenter.z - boxD * 0.5;

    // 2. 雨筋ベクトル（下向き基準、尾部 aTail=1.0 は斜め上方向へ）
    float actualLength = uLength * aLength;
    vec3 streakVector = vec3(sin(uAngleRad), cos(uAngleRad), 0.0) * actualLength;

    // 3. 頂点位置 = 基準点 + (aTail * 雨筋ベクトル)
    vec3 pos = vec3(baseX, baseY, baseZ) + streakVector * aTail;

    // 4. アルファフェード
    // 尾部フェードアウト (頭部=1.0, 尾部=0.15)
    float alpha = mix(1.0, 0.15, aTail);

    // 上下端での滑らかなフェードアウト
    float yRel = (baseY - (uBoxCenter.y - boxH * 0.5)) / boxH;
    if (yRel < 0.08) {
      alpha *= smoothstep(0.0, 0.08, yRel);
    } else if (yRel > 0.92) {
      alpha *= smoothstep(1.0, 0.92, yRel);
    }

    // 地面付近でのフェードアウト (y < 0.05)
    if (pos.y < 0.05) {
      alpha *= max(0.0, pos.y / 0.05);
    }

    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`,Ue=`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vAlpha);
  }
`,We=`
  attribute vec3 aSplashPos;
  attribute float aPhase;
  attribute float aScale;

  uniform float uTime;
  uniform float uSplashSpeed;

  varying float vLife;

  void main() {
    // 0.0 〜 1.0 のライフサイクル
    float progress = mod(uTime * uSplashSpeed + aPhase, 1.0);
    vLife = progress;

    // 外側へ広がりながら少し跳ね上がる
    float angle = aPhase * 6.2831853;
    float radius = progress * 0.06 * aScale;
    float yOffset = sin(progress * 3.1415926) * 0.04 * aScale;

    vec3 pos = aSplashPos;
    pos.x += cos(angle) * radius;
    pos.z += sin(angle) * radius;
    pos.y += yOffset;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (1.0 - progress) * 16.0 * aScale * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`,Ge=`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vLife;

  void main() {
    // 丸いパーティクル
    vec2 coord = gl_PointCoord - vec2(0.5);
    if (length(coord) > 0.5) discard;

    float alpha = (1.0 - vLife) * uOpacity * 0.8;
    gl_FragColor = vec4(uColor, alpha);
  }
`,Ke=class{group;lineSegments=null;splashPoints=null;rainMaterial;splashMaterial;boxSize=new k(8,5.5,8);boxCenter=new k(0,1.8,0);config;currentCount=0;currentSplashCount=0;constructor(e,t={}){this.config={...Ve,...t},this.group=new S,this.group.name=`RainEffectGroup`,this.rainMaterial=new I({vertexShader:He,fragmentShader:Ue,uniforms:{uTime:{value:0},uSpeed:{value:this.config.speed},uLength:{value:this.config.length},uAngleRad:{value:this.config.angle*Math.PI/180},uBoxSize:{value:this.boxSize},uBoxCenter:{value:this.boxCenter},uColor:{value:new O(this.config.color)},uOpacity:{value:this.config.opacity}},transparent:!0,depthWrite:!1,blending:1}),this.splashMaterial=new I({vertexShader:We,fragmentShader:Ge,uniforms:{uTime:{value:0},uSplashSpeed:{value:3.5},uColor:{value:new O(this.config.color)},uOpacity:{value:this.config.opacity}},transparent:!0,depthWrite:!1,blending:1}),this.rebuildRainMesh(),this.rebuildSplashMesh(),e.add(this.group),this.group.visible=this.config.enabled}rebuildRainMesh(){this.lineSegments&&=(this.group.remove(this.lineSegments),this.lineSegments.geometry.dispose(),null);let e=this.config.count;this.currentCount=e;let t=e*2,n=new Float32Array(t*3),r=new Float32Array(t),i=new Float32Array(t),a=new Float32Array(t),o=new Float32Array(t*3);for(let t=0;t<e;t++){let e=t*2,s=(Math.random()-.5)*this.boxSize.x+this.boxCenter.x,c=(Math.random()-.5)*this.boxSize.y+this.boxCenter.y,l=(Math.random()-.5)*this.boxSize.z+this.boxCenter.z,u=.85+Math.random()*.3,d=.8+Math.random()*.4;n[e*3]=s,n[e*3+1]=c,n[e*3+2]=l,o[e*3]=s,o[e*3+1]=c,o[e*3+2]=l,r[e]=0,i[e]=u,a[e]=d,n[(e+1)*3]=s,n[(e+1)*3+1]=c,n[(e+1)*3+2]=l,o[(e+1)*3]=s,o[(e+1)*3+1]=c,o[(e+1)*3+2]=l,r[e+1]=1,i[e+1]=u,a[e+1]=d}let s=new A;s.setAttribute(`position`,new M(n,3)),s.setAttribute(`aTail`,new M(r,1)),s.setAttribute(`aSpeed`,new M(i,1)),s.setAttribute(`aLength`,new M(a,1)),s.setAttribute(`aOffset`,new M(o,3)),this.lineSegments=new y(s,this.rainMaterial),this.lineSegments.frustumCulled=!1,this.group.add(this.lineSegments)}rebuildSplashMesh(){if(this.splashPoints&&=(this.group.remove(this.splashPoints),this.splashPoints.geometry.dispose(),null),!this.config.splashEnabled)return;let e=this.config.splashCount;this.currentSplashCount=e;let t=new Float32Array(e*3),n=new Float32Array(e*3),r=new Float32Array(e),i=new Float32Array(e);for(let a=0;a<e;a++){let e=(Math.random()-.5)*this.boxSize.x*.9+this.boxCenter.x,o=.02+Math.random()*.03,s=(Math.random()-.5)*this.boxSize.z*.9+this.boxCenter.z;t[a*3]=e,t[a*3+1]=o,t[a*3+2]=s,n[a*3]=e,n[a*3+1]=o,n[a*3+2]=s,r[a]=Math.random(),i[a]=.7+Math.random()*.6}let a=new A;a.setAttribute(`position`,new M(t,3)),a.setAttribute(`aSplashPos`,new M(n,3)),a.setAttribute(`aPhase`,new M(r,1)),a.setAttribute(`aScale`,new M(i,1)),this.splashPoints=new le(a,this.splashMaterial),this.splashPoints.frustumCulled=!1,this.group.add(this.splashPoints)}updateConfig(e){let t=this.config.count,n=this.config.splashCount,r=this.config.splashEnabled;Object.assign(this.config,e),this.group.visible=!!this.config.enabled,this.config.enabled&&(this.config.count!==t&&this.rebuildRainMesh(),(this.config.splashCount!==n||this.config.splashEnabled!==r)&&this.rebuildSplashMesh(),this.rainMaterial.uniforms.uSpeed.value=this.config.speed,this.rainMaterial.uniforms.uLength.value=this.config.length,this.rainMaterial.uniforms.uAngleRad.value=this.config.angle*Math.PI/180,this.rainMaterial.uniforms.uColor.value.set(this.config.color),this.rainMaterial.uniforms.uOpacity.value=this.config.opacity,this.splashMaterial.uniforms.uColor.value.set(this.config.color),this.splashMaterial.uniforms.uOpacity.value=this.config.opacity)}update(e){this.config.enabled&&(this.rainMaterial.uniforms.uTime.value=e,this.splashMaterial.uniforms.uTime.value=e)}setCameraPosition(e){this.boxCenter.x=e.x,this.boxCenter.z=e.z,this.rainMaterial.uniforms.uBoxCenter.value.copy(this.boxCenter)}dispose(){this.lineSegments&&=(this.group.remove(this.lineSegments),this.lineSegments.geometry.dispose(),null),this.splashPoints&&=(this.group.remove(this.splashPoints),this.splashPoints.geometry.dispose(),null),this.rainMaterial.dispose(),this.splashMaterial.dispose()}},qe={enabled:!0,proximityTriggerEnabled:!1,basePath:`/reference-live2d/`,triggerDistance:1.55,restoreDistance:1.75,blurAmount:12,targetModelSubstrings:[`aoi-school`],fadeOutDurationMs:160,holdDurationMs:50,fadeInDurationMs:180,characterScale:1.04,characterOffsetY:-.09,backgroundZoomScale:1.22},B={enabled:!0,topOpacity:.3,bottomOpacity:.05,desaturate:.2,tintAmount:1},Je={name:`ParaShader`,uniforms:{tDiffuse:{value:null},tMask:{value:null},uEnabled:{value:1},uTopOpacity:{value:B.topOpacity},uBottomOpacity:{value:B.bottomOpacity},uDesaturate:{value:B.desaturate},uTintAmount:{value:B.tintAmount}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tMask;
    uniform float uEnabled;
    uniform float uTopOpacity;
    uniform float uBottomOpacity;
    uniform float uDesaturate;
    uniform float uTintAmount;
    varying vec2 vUv;

    const int GRID_X = 8;
    const int GRID_Y = 6;

    float characterAt(vec2 uv) {
      return step(texture2D(tMask, uv).r, 0.99999);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      if (uEnabled < 0.5 || characterAt(vUv) < 0.5) {
        gl_FragColor = color;
        return;
      }

      // 空気の色: キャラ以外の背景を格子状にサンプルして平均する
      vec3 air = vec3(0.0);
      float weight = 0.0;
      for (int y = 0; y < GRID_Y; y++) {
        for (int x = 0; x < GRID_X; x++) {
          vec2 uv = (vec2(float(x), float(y)) + 0.5) / vec2(float(GRID_X), float(GRID_Y));
          float isBackground = 1.0 - characterAt(uv);
          air += texture2D(tDiffuse, uv).rgb * isBackground;
          weight += isBackground;
        }
      }
      if (weight < 0.5) {
        gl_FragColor = color;
        return;
      }
      air /= weight;
      air = mix(air, vec3(dot(air, vec3(0.2126, 0.7152, 0.0722))), uDesaturate);

      // 画面の上ほど強いグラデーションで重ねる
      float opacity = mix(uBottomOpacity, uTopOpacity, vUv.y);
      vec3 screen = 1.0 - (1.0 - clamp(color.rgb, 0.0, 1.0)) * (1.0 - air);
      // 色合わせ: 空気の色を明るさ 1 に正規化して掛ける（明るさはほぼ保ち、色味だけ寄せる）
      float airLuma = max(dot(air, vec3(0.2126, 0.7152, 0.0722)), 0.05);
      vec3 tinted = clamp(color.rgb * (air / airLuma), 0.0, 1.0);
      color.rgb = mix(color.rgb, mix(screen, tinted, uTintAmount), opacity);
      gl_FragColor = color;
    }
  `};function Ye(e,t){t.enabled!==void 0&&(e.uEnabled.value=t.enabled?1:0),t.topOpacity!==void 0&&(e.uTopOpacity.value=t.topOpacity),t.bottomOpacity!==void 0&&(e.uBottomOpacity.value=t.bottomOpacity),t.desaturate!==void 0&&(e.uDesaturate.value=t.desaturate),t.tintAmount!==void 0&&(e.uTintAmount.value=t.tintAmount)}var Xe={activeScene:{presetId:`day_park`,timeOfDay:`day`,location:`modern_park`},materials:{body:{color:`#ffffff`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.9895,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.994,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.997,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},eyeGlow:{enabled:!0,intensity:1.25},bottomGradient:{enabled:!0,startY:2,endY:1,intensity:.1,shadowWeight:1,color:`#101018`},hairShadow:{enabled:!0,offset:.006,downBias:.002,strength:1,depthBias:.002,maxDepthDiff:.12},hairRing:{...n},faceSdf:{...l},lightWrap:{...c},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/modern-park-far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!0,midgroundImageUrl:z(`/textures/modern-park-mid.avif`),midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffffff`,farFogIntensity:.12},lighting:{castShadows:!1,hairRingTint:`#f2f5ff`,ambient:{color:`#b30071`,intensity:1},directional:{color:`#ffffff`,intensity:3.2,posX:-.7,posY:1.5,posZ:2.6},rim:{enabled:!1,color:`#dde8ff`,intensity:.05,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!0,followDirectionalLight:!1,sunPosition:{x:3.2,y:4.3,z:-3.8},exposure:.22,decay:.83,density:.35,weight:.08,color:`#fff2db`,shimmer:.25},lensFlare:{enabled:!0,sunSize:1.3,sunColor:`#fffbf5`,glowIntensity:.95,starburstIntensity:.05,anamorphicIntensity:1.15,ghostIntensity:.35,haloIntensity:.5}},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.07,radius:.7,threshold:.9},colorGrading:{enabled:!0,shadowTint:`#0b1b60`,highlightTint:`#9a8518`,strength:.5,contrast:.13,gamma:1},saturation:.26,brightness:0,contrast:0,cinematic:{diffusion:{enabled:!0,strength:.12,radius:2},filmGrain:{enabled:!1,strength:.035,speed:1},vignette:{enabled:!0,offset:1.15,darkness:.08,color:`#1a1829`},chromaticAberration:{enabled:!0,offset:.0015},sharpening:{enabled:!1,amount:.22},fisheye:{enabled:!1,strength:.5,zoom:1,circular:!1}}},camera:{fov:30,position:{x:0,y:1.1,z:2.65},target:{x:0,y:1.15,z:0},minDistance:.5,maxDistance:10},lipSync:{enabled:!0,gain:.65,smoothing:.17,rmsThreshold:.008,audioDelay:.05,voiceGender:`female`},shortAnimation:{cuts:[{enabled:!0,duration:1.5,startAngle:`farFront`,cameraDistance:1.8,cameraPreset:`pushIn`,cameraStrength:1.2,motion:z(`/animations/Walking.fbx`),backText:{text:`AnimeVRM`,animationPreset:`slideLeft`,x:50,y:35,fontSize:14,color:`#ffffff`,fontWeight:800},frontText:{text:`MOTION`,animationPreset:`scaleIn`,x:50,y:72,fontSize:8,color:`#818cf8`,fontWeight:800}},{enabled:!0,duration:2,startAngle:`right`,cameraDistance:1.2,cameraPreset:`orbitLeftHalf`,cameraStrength:1,motion:z(`/animations/Idle.fbx`),backText:{text:`THREE.JS`,animationPreset:`fade`,x:50,y:30,fontSize:13,color:`#f43f5e`,fontWeight:800},frontText:{text:`GROOVE`,animationPreset:`slideRight`,x:50,y:75,fontSize:9,color:`#ffffff`,fontWeight:700}},{enabled:!0,duration:1.5,startAngle:`lowAngle`,cameraDistance:1,cameraPreset:`lowAngleUp`,cameraStrength:1,motion:z(`/animations/Idle.fbx`),backText:{text:`POWER`,animationPreset:`slideUp`,x:50,y:38,fontSize:12,color:`#ffffff`,fontWeight:800},frontText:{text:`FEATURING`,animationPreset:`static`,x:50,y:68,fontSize:7,color:`#38bdf8`,fontWeight:700}},{enabled:!0,duration:3,startAngle:`front`,cameraDistance:1,cameraPreset:`punchIn`,cameraStrength:1,motion:z(`/animations/Standing Greeting.fbx`),backText:{text:`CLIMAX`,animationPreset:`punch`,x:50,y:35,fontSize:16,color:`#fbbf24`,fontWeight:900},frontText:{text:`VRM TOON`,animationPreset:`punch`,x:50,y:75,fontSize:9,color:`#ffffff`,fontWeight:800}}]},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{...Ve},fastMotion:{...De},live2d:{...qe}};function Ze(e){return JSON.parse(JSON.stringify(e))}function V(e,t){for(let n of Object.keys(t))t[n]!==null&&typeof t[n]==`object`&&!Array.isArray(t[n])?((!e[n]||typeof e[n]!=`object`||Array.isArray(e[n]))&&(e[n]={}),V(e[n],t[n])):Array.isArray(t[n])?e[n]=JSON.parse(JSON.stringify(t[n])):e[n]=t[n];return e}function Qe(e){return JSON.stringify(e,null,2)}function $e(e,t=`avatar-config.json`){let n=Qe(e),r=new Blob([n],{type:`application/json`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=t,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(i)}async function et(e){try{let t=Qe(e);return await navigator.clipboard.writeText(t),!0}catch{return!1}}var tt={calm:{name:`calm`,label:`🍃 無風 (Calm)`,config:{enabled:!1,speed:0,turbulence:0,gustStrength:0,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}}},breeze:{name:`breeze`,label:`🌸 そよ風 (Gentle Breeze)`,config:{enabled:!0,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}}},strong:{name:`strong`,label:`💨 強風 (Strong Wind)`,config:{enabled:!0,speed:1.5,direction:70,elevation:10,turbulence:.5,gustFrequency:.4,gustStrength:.8,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}}},gusty:{name:`gusty`,label:`🌪️ 突風・嵐 (Gusty Storm)`,config:{enabled:!0,speed:1.2,direction:120,elevation:12,turbulence:.8,gustFrequency:.6,gustStrength:1.5,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}}},anemo:{name:`anemo`,label:`✨ 原神風・疾風 (Anemo Gale)`,config:{enabled:!0,speed:1.2,direction:215,elevation:15,turbulence:.6,gustFrequency:.5,gustStrength:1.2,particles:{enabled:!1,count:160,size:.035,color:`#d4fbe8`,opacity:.85,speedFactor:1}}}},nt=class{currentWindVector=new k;currentWindSpeed=0;cachedJoints=new Map;lastVrm=null;_baseDir=new k;_turbVec=new k;_effGravity=new k;constructor(){}resetModel(){this.cachedJoints.clear(),this.lastVrm=null}cacheSpringBones(e){if(this.lastVrm===e&&this.cachedJoints.size>0)return;this.cachedJoints.clear(),this.lastVrm=e;let t=e.springBoneManager?.joints;t&&t.forEach(e=>{this.cachedJoints.set(e,{origGravityDir:e.settings.gravityDir?e.settings.gravityDir.clone():new k(0,-1,0),origGravityPower:e.settings.gravityPower===void 0?0:e.settings.gravityPower})})}calculateWindVector(e,t){if(!e.enabled||e.speed<=0)return this.currentWindVector.set(0,0,0),this.currentWindSpeed=0,this.currentWindVector;let n=j.degToRad(e.direction),r=j.degToRad(e.elevation);this._baseDir.set(Math.sin(n)*Math.cos(r),Math.sin(r),Math.cos(n)*Math.cos(r)).normalize();let i=t,a=Math.sin(i*2.3)*.5+Math.sin(i*4.9+1.2)*.3+Math.sin(i*.9+2.4)*.2,o=Math.sin(i*1.8+.5)*.4+Math.sin(i*3.7+2.1)*.3,s=Math.cos(i*2.1+.8)*.5+Math.sin(i*5.3+.4)*.3;this._turbVec.set(a,o,s).multiplyScalar(e.turbulence*.5);let c=e.gustFrequency,l=Math.sin(i*c*1.2)*.6+Math.sin(i*c*2.7+1.1)*.4,u=Math.max(0,l*l*Math.sign(l))*e.gustStrength,d=Math.max(0,e.speed+u);return this.currentWindSpeed=d,this.currentWindVector.copy(this._baseDir).multiplyScalar(d).add(this._turbVec),this.currentWindVector}update(e,t,n){if(!e)return;this.cacheSpringBones(e),this.calculateWindVector(t,n);let r=e.springBoneManager?.joints;if(!r)return;let i=t.enabled&&this.currentWindSpeed>.001;r.forEach(e=>{let t=this.cachedJoints.get(e);if(t)if(!i)e.settings.gravityDir.copy(t.origGravityDir),e.settings.gravityPower=t.origGravityPower;else{this._effGravity.copy(t.origGravityDir).multiplyScalar(t.origGravityPower).add(this.currentWindVector);let n=this._effGravity.length();n>1e-6?(e.settings.gravityDir.copy(this._effGravity).divideScalar(n),e.settings.gravityPower=n):(e.settings.gravityDir.set(0,-1,0),e.settings.gravityPower=0)}})}static applyPreset(e,t){let n=tt[t];return!n||!n.config?!1:(n.config.enabled!==void 0&&(e.enabled=n.config.enabled),n.config.speed!==void 0&&(e.speed=n.config.speed),n.config.direction!==void 0&&(e.direction=n.config.direction),n.config.elevation!==void 0&&(e.elevation=n.config.elevation),n.config.turbulence!==void 0&&(e.turbulence=n.config.turbulence),n.config.gustFrequency!==void 0&&(e.gustFrequency=n.config.gustFrequency),n.config.gustStrength!==void 0&&(e.gustStrength=n.config.gustStrength),n.config.particles&&Object.assign(e.particles,n.config.particles),!0)}},rt={common:{title:`AnimeVRM Studio`,loadingModel:`モデル読み込み中...`,close:`最小化`,openSettings:`設定パネルを開く`,cancel:`キャンセル`,apply:`適用`,copy:`コピー`,save:`保存`,load:`読込`,reset:`リセット`,play:`再生`,stop:`停止`,loop:`ループ`,none:`なし`,success:`成功`,copied:`コピーしました`,copyFailed:`コピーに失敗しました`,language:`言語`,selectLanguage:`言語切替`},tabs:{character:`Character`,stage:`Stage`,visual:`Settings`,system:`Others`},geminiLiveChat:{title:`AIアバターリアルタイム会話 (Gemini Live)`,description:`Gemini Multimodal Live API (gemini-3.8-live) による低遅延双方向対話。音声応答と表情・モーション合成ツールの自動実行に対応。`,apiKeyLabel:`Gemini APIキー`,apiKeyPlaceholder:`AI StudioのAPIキーを入力 (保存されません)`,apiKeyNote:`※ APIキーはブラウザのメモリ内のみに保持され、localStorage等には一切保存されません。`,modelLabel:`モデル`,voiceLabel:`音声 (ボイス)`,ardyEnabled:`ardy-mini で会話に合わせた動きを生成`,ardyNote:`初回は約653〜685 MiBをダウンロードしてキャッシュします。WebGPU対応ブラウザーとHTTPSまたはlocalhostが必要です。動作生成は端末内で実行します。切断中に方式を変更できます。`,ardyAutonomous:`話していない間も自律的に動く`,ardyAutonomousNote:`接続中は次の動作を先読みします。下記モデルへ同じAPIキーで追加リクエストします。会話中でもOFFにできます。`,ardyPlannerModel:`自律動作を考える Gemini モデル`,ardyTerms:`モデル利用条件`,ardyLoad:`モデルを読み込む`,ardyPreview:`動きを試す`,ardyPrompt:`動作の説明（英語）`,ardyStates:{unloaded:`未読込`,loading:`モデル読込中`,ready:`準備完了`,generating:`動作生成中`,error:`読み込みエラー`},startChat:`🎙️ 接続して会話を開始`,stopChat:`⏹️ 切断する`,micOn:`🎤 マイクON`,micMuted:`🔇 マイクOFF`,statusDisconnected:`未接続`,statusConnecting:`接続中...`,statusConnected:`接続完了 (待機中)`,statusListening:`待機中 (お話しください)`,statusSpeaking:`アバター発話中...`,statusError:`エラー`,emptyHistory:`APIキーを入力して「接続して会話を開始」を押すと、マイクまたはテキストでリアルタイムに対話できます。`,textPlaceholder:`テキストでも話しかけられます (Enterで送信)...`,send:`送信`},histogram:{title:`色合いヒストグラム`,description:`現在の画面描画のRGB各チャンネルおよび輝度分布を表示します。`,refresh:`🔄 再取得`,channelMode:`表示チャンネル`,channelAll:`RGB + 輝度`,channelRgb:`RGB重ね合わせ`,channelR:`Red (赤)`,channelG:`Green (緑)`,channelB:`Blue (青)`,channelLuminance:`輝度 (Lum)`,scaleMode:`スケール`,linearScale:`リニア (Linear)`,logScale:`対数 (Log)`,statistics:`色・輝度 統計情報`,meanR:`平均 R`,meanG:`平均 G`,meanB:`平均 B`,meanLuminance:`平均輝度`,shadowClip:`黒つぶれ率 (Level 0)`,highlightClip:`白飛び率 (Level 255)`,resolution:`解像度`,samplePixels:`総ピクセル数`,peakCount:`最大ピーク画素数`},character:{modelSwitch:`👤 モデル切替 (VRM Model)`,selectFile:`📁 ファイル選択`,selectMotionFile:`📁 FBX選択`,motion:`💃 モーション (Motion)`,motions:{idle:`待機`,standingIdle:`立ち待機`,standingPose:`立ちポーズ`,walking:`歩行`,jogging:`ジョギング`,greeting:`挨拶`,bow:`お辞儀`,acknowledging:`うなずく`,dismissing:`手を振る`,salute:`敬礼`,excited:`喜ぶ`,angry:`怒り`,punching:`パンチ`,stop:`停止`},expression:`😄 表情 (Expression)`,morphTargets:{title:`MorphTarget 調整`,enable:`手動調整を有効にする`,hint:`0〜1で組み合わせを試せます。同名の項目は顔・アイラインで連動します。調整中はまばたき・口パクの変形を固定。OFFまたは表情ボタンで通常の動作に戻ります。`,capture:`現在の表情を取り込む`,reset:`すべて0に戻す`,search:`MorphTarget名で検索`,category:`部位で絞り込み`,all:`すべての部位`,brows:`眉`,eyes:`目`,mouth:`口・歯`,other:`全体・その他`,activeOnly:`0以外のみ`,count:`表示`,nonzero:`0以外`,empty:`操作できるMorphTargetがありません。モデルの読み込みを確認してください。`,noMatches:`条件に一致するMorphTargetがありません。`,name:`候補の表情名`,preset:`設定JSON（0以外の値）`,copy:`設定JSONをコピー`,copied:`コピーしました。表情を追加するときにこのJSONを使えます。`,copyFailed:`コピーできませんでした。選択されたJSONを手動でコピーしてください。`},faceOverlays:{title:`顔の重ね表示`,blush:`赤らめ`,sweat:`汗`,anger:`怒りマーク`,hint:`通常・怒りなどの表情と併用できます。複数のマークも同時に表示できます。`,loadError:`顔の重ね表示を読み込めませんでした。モデルと画像を確認してください。`},expressions:{neutral:`通常`,happy:`笑顔`,angry:`怒り`,sad:`悲しみ`,surprised:`驚き`,relaxed:`リラックス`,nima:`ニマニマ`,aa:`あ`,ee:`え`,oh:`お`},emotionEffectText:`💬 感情エフェクト文字 (3D漫符)`,clearAll:`全消去`,customTextPlaceholder:`自由な文字 (例: ぷんぷん)`,show:`表示`,presets:{wanawana:`🟣 ワナワナ`,iraira:`🔴 イライラ`,gaan:`🔵 ガーン`,kirakira:`✨ キラキラ`,shiin:`⚪ しーん`,doki:`💖 ドキドキ`,nima:`😏 ニマニマ`,biku:`⚡ ビクッ！`,yatta:`🎉 やったー！`,zoku:`🥶 ゾクッ…`,sweat:`💦 汗 (焦り)`,jito:`😑 じとー (冷や汗)`},lipSyncTitle:`🎵 音声リップシンク ＆ プレイヤー`,openAudioFile:`📁 音声を開く`,detectedPhoneme:`判定音素:`,phonemeClosed:`閉`},scenario:{rooftopNapTitle:`🏫 屋上の昼寝と覗き込みハプニング (Live2D 2.5D Rig連動)`,playRooftopNap:`🏫 屋上シナリオ再生 (Live2D連動)`,rooftopNapDesc:`※屋上で昼寝中、遠くから歩いて近づいてきたアオイがしゃがみ込み覗き込んできます。超至近距離でLive2Dモードにシームレス突入！赤面＆激怒ハプニング。`,confessionTitle:`🌸 告白イベントシナリオ (話者ズーム・分岐・漫符・音声)`,playConfession:`🌸 告白シナリオ再生`,stopScenario:`■ 停止`,confessionDesc:`※クリックで会話送り。話者へのカメラ＆背景ズーム演出、モデル表情・感情漫符が連動します。`,townWalkTitle:`🚶‍♀️ 歩き会話シナリオ (並木道スライド背景＆背景ぼかし)`,playTownWalk:`🚶‍♀️ 歩き会話シナリオ再生`,townWalkDesc:`※横にいるアオイと自キャラが歩きながら会話（2枚板ループスライド＆背景ボケ）、後半で立ち止まり会話へ移行します。`,twoGirlsTitle:`👥 2人会話シナリオ (話者ズーム・girl & girl2 掛け合い)`,playTwoGirls:`👥 2人会話シナリオ再生`,twoGirlsDesc:`※アオイとエミリが同時に登場し、話しているキャラへダイナミックにカメラ＆背景ズームしながら会話します。`,trioTitle:`💬 3人会話シナリオ (注意向け・バストアップ・交互トーク)`,playTrio:`💬 3人会話シナリオ再生`,trioDesc:`※アオイ・エミリ・自キャラの3人会話。バストアップ距離で話者や会話相手へ自然に注意（首振り・視線）が向き合います。`,haremTitle:`💘 4人会話シナリオ〜一体誰が本命なのよ〜 (3体アバター配置＆選択肢)`,playHarem:`💘 本命裁判シナリオ再生`,haremDesc:`※アオイ(左)・シオン/ダウナー少女(中)・エミリ(右)の3体が勢揃い！あなたを囲んで「一体誰が本命なのよ〜」と問い詰められる4人会話ラブコメシナリオです。`,behindYouTitle:`😱 振り返りシナリオ〜背後のエミリ〜 (180°カメラ旋回演出)`,playBehindYou:`😱 背後のエミリ シナリオ再生`,behindYouDesc:`※アオイとエミリの噂話をしていたら背後から声が……！ 恐る恐る後ろを振り返るとそこにエミリが立っている360°カメラ旋回シナリオです。`,nisaTitle:`📈 オルカンの憂鬱 (夕方の校門・バストアップ・涙エフェクト)`,playNisa:`📈 NISAの悩みを再生`,nisaDesc:`※放課後の夕暮れの校門。深刻な面持ちで呼び出された主人公に、葵が新NISAと全世界株式（オルカン）への不安を涙ながらに打ち明けるネタシナリオ。`,fastMotionTitle:`⚡ 高速アクション特訓〜スピード線・残像検証〜`,playFastMotion:`⚡ 高速アクション特訓を再生`,fastMotionDesc:`※アオイの高速手振りとエミリの鋭いパンチ！手足を素早く動かした瞬間だけ、アニメ風のスピード線・残像・逆方向アウトラインブラーが発生する作画エフェクト検証シナリオです。`,doorPeepTitle:`🚪 覗き穴の訪問者〜深夜のヤンデレ〜 (円周魚眼・ドアスコープ演出)`,playDoorPeep:`🚪 覗き穴のヤンデレを再生`,doorPeepDesc:`※深夜2時のアパート前。ドアの覗き穴（円周魚眼レンズ）越しに外を見ると、光の消えた虚ろな瞳の少女が顔をガラスに密着させて叫び出すサイコホラーシナリオです。`,privateDateTitle:`👗 休日デートシナリオ (私服モデル3体・全6幕ストーリー)`,playPrivateDate:`👗 休日デートを再生`,privateDateDesc:`※朝の準備からエミリのお迎え、並木道での歩き会話、街でのシオン遭遇、カフェでのアオイ遭遇、そして夕暮れの公園告白まで続く休日プライベートデート長編シナリオです。`,teacherGateTitle:`👩‍🏫 校門の邂逅 〜シオンと桐島先生の秘密の推し〜`,playTeacherGate:`👩‍🏫 校門の邂逅を再生`,teacherGateDesc:`※眠そうに登校するシオンと校門で待ち受けるクールな桐島先生。2人がまさかのニッチな古生物トークで意気投合する朝の登校＆校門シナリオです。`,liveStatus:`📊 実行中シナリオステータス`,sceneId:`シーンID:`,speaker:`話者:`,acquiredFlags:`獲得フラグ:`,noneFlags:`なし`,waiting:`（待機中）`,externalJsonTitle:`📥 外部シナリオJSON読み込み・実行`,selectJsonFile:`📂 シナリオJSONファイルを選択して再生`,conversationTitle:`🎭 会話連動シーケンス (セリフ1〜3)`,playSequence:`▶ シーケンス再生`,playing:`再生中...`,shortAnimTitle:`🎬 ショートアニメーション演出`,playAnim:`▶ アニメーション再生`,autoMode:`AUTO`,endScenario:`シナリオ終了`,thinkingTime:`Thinking Time`,steps:{step1Title:`Step 1: 手を振る`,step2Title:`Step 2: 待機`,step3Title:`Step 3: うなずく`}},scenes:{lightingPresetsTitle:`🌅 時間帯・シーン設定`,timeOfDayTitle:`⏰ 時間帯・ライティング (Time of Day)`,locationTitle:`🏞️ 場所・背景 (Location)`,park:`🌳 公園`,schoolGate:`🏫 校門`,indoor:`🏠 室内 (教室)`,morningEvening:`朝 / 昼 / 夕`,brightDark:`明るい / 暗い`,morning:`🌅 朝`,day:`☀️ 昼`,evening:`🌇 夕方`,rainy:`🌧️ 雨`,night:`🏮 夜`,bright:`💡 室内・明`,dark:`🌙 室内・暗`,dark2:`室内・暗2`,divine:`神聖・後光`,backgroundTitle:`🌄 背景 (Background)`,backgrounds:{modernPark:`🌳 近代公園`,schoolGate:`🏫 校門`,classroom:`🏫 教室`,schoolRooftop:`🏫 屋上`,parkWithSea:`🌊 海の見える公園`,nightFestival:`🏮 夏祭り`,oldPark:`🌲 旧公園`,cafe:`☕ カフェ`,cafeIndoor:`カフェ店内`,town:`🏙️ 街`,apartmentDoor:`🚪 アパート前`,myroom:`🛏️ 自室`,divineRealm:`聖域・神界`,offSingleColor:`OFF (単色)`,selectFarImage:`📁 画像を選択 (Far)`},avatarFramingTitle:`📷 アバター位置 (構図)`,avatarFramingDesc:`アバターの表示構図を切り替えます。カフェでは「バストアップ」がおすすめです。`,avatarFraming:{full:`全身`,bust:`バストアップ`,close:`近い`},presetMorningParkTip:`透明感のある朝陽・バイオレットトーン`,presetDayParkTip:`青空・強い太陽光・昼光フレア`,presetEveningParkTip:`茜色夕日・西日光条・夕焼けフレア`,presetRainyParkTip:`雨雲の柔らかな拡散光・雨霧・濡れ感・雨粒`,presetNightParkTip:`お祭りの夜のような十分な明るさと華やかさのある夜間ライティング`,presetMorningSchoolTip:`澄んだ朝陽・校門`,presetDaySchoolTip:`明るい昼光・校門`,presetEveningSchoolTip:`茜色夕焼け・西日・校門`,presetRainySchoolTip:`しっとりとした雨天・雨の校門`,presetNightSchoolTip:`夜の校門・十分な明るさのある夜間照明`,presetBrightIndoorTip:`教室背景・均一で明るい室内照明`,presetDarkIndoorTip:`教室背景・薄暗い間接照明・夜光`,presetDarkIndoor2Tip:`カフェ店内・温かみのあるアンビエントと柔らかな明暗`,presetDivineTip:`神聖な後光（薄明光線）と黄金の輪郭光・逆光シルエット`},render:{detailedParamsTitle:`⚙️ 詳細パラメータ調整 (トゥーン・マテリアル・光・風)`,importModalTitle:`📥 設定JSONの読み込み`,importModalDesc:`設定JSONコードを貼り付けて「適用」を押してください。`,applyConfig:`設定を適用`,parseError:`JSONのパースに失敗しました。書式をご確認ください。`},masters:{overviewTitle:`🗄️ 登録マスターデータ概要`,characterCount:`👤 キャラクター:`,motionCount:`💃 モーション:`,soundCount:`🎙️ 音声・サウンド:`,sceneCount:`🌅 シーン環境:`,unitCount:`体`,unitType:`種`,batchTitle:`💾 マスターJSONの一括保存 / 読込`,saveMasters:`💾 masters.json 保存`,copyMasters:`📋 コピー`,loadMasters:`📥 masters.json 読み込み・適用`,resetMasters:`🔄 デフォルトマスターにリセット`},toasts:{sceneChanged:`🌅 シーンを変更しました: `,configCopied:`📋 設定JSONをクリップボードにコピーしました！`,configSaved:`💾 avatar-config.json をダウンロードしました`,configImported:`✓ 設定JSONを正常に適用しました！`,configReset:`🔄 デフォルト設定にリセットしました`,mastersDownloaded:`💾 masters.json をダウンロードしました`,mastersCopied:`📋 masters.json をコピーしました`,mastersImported:`📥 マスターデータをインポートしました！`,mastersImportFailed:`❌ JSONの解析に失敗しました`,mastersReset:`🔄 マスターデータを初期状態にリセットしました`,scenarioStarted:`🌸 シナリオを開始しました: `,scenarioJsonFailed:`❌ シナリオJSONの読み込みに失敗しました`,animStarted:`🎬 ショートアニメーションを再生します`,animStopped:`⏹ アニメーションを停止しました`,rooftopNapStarted:`🏫 屋上の昼寝と覗き込みハプニングシナリオを開始しました`,confessionStarted:`🌸 告白イベントシナリオを開始しました`,twoGirlsStarted:`👥 2人会話シナリオを開始しました`,trioStarted:`💬 3人会話シナリオを開始しました`,haremStarted:`💘 4人会話シナリオ（本命裁判）を開始しました`,townWalkStarted:`🚶‍♀️ 歩き会話シナリオを開始しました`,behindYouStarted:`😱 振り返りシナリオ（背後のエミリ）を開始しました`,doorPeepStarted:`🚪 覗き穴の訪問者シナリオを開始しました`,nisaStarted:`📈 オルカンの憂鬱シナリオを開始しました`,fastMotionStarted:`⚡ 高速アクション特訓シナリオを開始しました`,privateDateStarted:`👗 休日デートシナリオを開始しました`,teacherGateStarted:`👩‍🏫 校門の邂逅シナリオを開始しました`,scenarioStopped:`シナリオ再生を停止しました`,motionLoaded:`💃 モーションを読み込みました: `,motionLoadFailed:`❌ モーションの読み込みに失敗しました`},gui:{detailedTitle:`詳細パラメータ`,panoramaFolder:`🌐 360°パノラマ背景 (360° Panorama)`,panoramaEnabled:`パノラマ表示 (Panorama ON)`,panoramaTestClassroom:`🏫 教室360°お試し (Classroom 360°)`,panoramaReset:`🔄 正面リセット (Reset View)`,panoramaDemo:`🎬 カメラ演出デモ (Play Camera Demo)`,panoramaSensitivity:`操作感度 (Sensitivity)`,panoramaInvertDrag:`ドラッグ方向反転 (Invert Drag)`,panoramaIdleMotion:`待機微動 (Idle Motion)`,panoramaFov:`視野角 FOV (Zoom)`,panoramaYaw:`水平角度 Yaw (°)`,panoramaPitch:`垂直角度 Pitch (°)`,panoramaCameraY:`カメラ高さ (Camera Y)`,panoramaAvatarFolder:`👤 アバター配置 (Avatar Position)`,panoramaAvatarFront:`股・ウエスト寄り (Mid -1.0m)`,panoramaAvatarClose:`胸元アップ (Close -0.7m)`,panoramaAvatarFar:`少し引き (Far -1.6m)`,panoramaAvatarSide:`横に並ぶ (Side by Side)`,panoramaAvatarOrigin:`原点に戻す (Origin 0,0,0)`,panoramaAvatarVisible:`アバター表示 (Visible)`,panoramaAvatarX:`左右 X (m)`,panoramaAvatarY:`上下 Y (m)`,panoramaAvatarZ:`前後 Z (m)`,panoramaAvatarRot:`アバター向き Y (°)`,sceneFolder:`🌅 シーン・ライティング一括プリセット (Scene Presets)`,sceneSelect:`シーン選択`,quickSwitchFolder:`クイック切り替えボタン`,animCutFolder:`🎬 ショートアニメーション各Cut設定`,cutEnabled:`有効`,cutDuration:`再生時間 (秒)`,startAngle:`開始アングル (Jump)`,cameraDistance:`カメラ距離倍率 (Distance)`,camera:`カメラ`,cameraStrength:`カメラ強度`,motion:`モーション (Motion)`,backTextFolder:`Back Text (背景側)`,frontTextFolder:`Front Text (前面側)`,text:`テキスト`,animation:`アニメーション`,size:`サイズ (vw)`,textColor:`文字色`,fontWeight:`太さ`,togglesFolder:`⚡ 各機能 個別 ON/OFF トグル (Feature Toggles)`,toggleColorGrading:`🎬 アニメカラーグレーディング`,toggleBloom:`🌟 ブルーム (Bloom)`,toggleWind:`🍃 風・揺れもの物理 (Wind Effect)`,toggleSmoothNormal:`✨ スムーズ法線アウトライン`,toggleScreenSpaceWidth:`📐 画面固定線幅 (NDC)`,toggleRimBody:`💡 リムライト (肌/体)`,toggleRimCloth:`💡 リムライト (衣装)`,toggleRimLight:`💡 補助環境リム光`,toggleDiffusion:`✨ ディフュージョン / 軟光 (Diffusion)`,toggleFilmGrain:`🎞️ フィルムグレイン (Film Grain)`,toggleVignette:`📷 シネマティックヴィネット (Vignette)`,toggleChromaticAberration:`🌈 レンズ色収差 (Chromatic Aberration)`,toggleSharpening:`🔪 スマートシャープネス (Adaptive Sharpening)`,toggleFisheye:`🐟 魚眼レンズ歪み (Fisheye Lens)`,toggleEyeGlow:`👀 瞳のキラキラ (Eye Glow)`,eyeGlowFolder:`👀 瞳の輝き・ハイライト (Eye Highlight Glow)`,eyeGlowEnabled:`瞳のキラキラ有効`,eyeGlowIntensity:`輝き・発光強度 (Intensity)`,matBody:`体・肌マテリアル (Body / Skin)`,matHair:`髪マテリアル (Hair)`,matCloth:`衣装マテリアル (Cloth / Shoes)`,baseColor:`基本色・血色感 (Base Color / Tint)`,highlightMatcap:`✨ ハイライト表示 (Highlight / MatCap)`,emissiveIntensity:`🌟 発光強度 (Emissive / Bloom)`,shadeMultiply:`影の乗算色 (Shade Multiply)`,toonyFactor:`トゥーン度 (Toony)`,shadingShift:`明暗境界シフト (Shift)`,giFactor:`環境光均一化 (GI)`,rimEnabled:`リムライト有効 (Rim ON)`,rimColor:`リムライト色 (Rim Color)`,rimFresnelPower:`リム急峻度 (Fresnel Power)`,rimLift:`リム持ち上げ (Lift)`,rimMix:`リム光合成比率 (Mix)`,outlineWidth:`輪郭線の太さ (Outline Width)`,outlineFolder:`輪郭線・アウトライン (Outline)`,outlineInvertedHull:`外周線表示 (Inverted Hull)`,outlineSmoothNormal:`✨ スムーズ法線 (Smooth Normal)`,outlineScreenSpace:`📐 画面固定線幅 (Screen-Space)`,outlineAutoWeight:`✒️ 線の抑揚自動調整 (Auto Weight)`,outlineDarkness:`線の暗さ (Darkness)`,outlineLightingMix:`光影響比率 (Lighting Mix)`,bottomGradientFolder:`足元グラデーション・接地感 (Bottom Gradient)`,bottomGradientEnabled:`グラデーション有効 (Enable)`,bottomGradientStartY:`開始高さ・腰 (Start Height)`,bottomGradientEndY:`終了高さ・足元 (End Height)`,bottomGradientIntensity:`暗さ強度 (Intensity)`,bottomGradientShadowWeight:`影部強調度 (Shadow Weight)`,bottomGradientColor:`シャドウ色 (Shadow Color)`,hairShadowFolder:`前髪の影 (Hair Shadow)`,hairShadowEnabled:`前髪の影 有効 (Enable)`,hairShadowOffset:`光方向へのずらし量 m (Offset)`,hairShadowDownBias:`下方向へのずらし量 m (Down Bias)`,hairShadowStrength:`影の濃さ (Strength)`,hairShadowDepthBias:`深度バイアス m (Depth Bias)`,hairShadowMaxDepthDiff:`影を落とす最大距離 m (Max Depth Diff)`,faceSdfFolder:`顔の陰影マップ (Face Shadow SDF)`,faceSdfEnabled:`顔の陰影マップ 有効 (Enable)`,faceSdfSoftness:`境目のぼかし 度 (Softness)`,faceSdfNoseSize:`鼻の影の大きさ (Nose Size)`,faceSdfNoseStart:`鼻の影が出る角度 度 (Nose Start)`,faceSdfSkipStart:`飛ばす角度の開始 度 (Skip From)`,faceSdfSkipEnd:`飛ばす角度の終了 度 (Skip To)`,faceSdfSkipBlend:`切り替えの幅 度 (Skip Blend)`,hairRingFolder:`天使の輪 (Hair Ring)`,hairRingEnabled:`天使の輪 有効 (Enable)`,hairRingHeight:`輪の高さ m (Height)`,hairRingWidth:`輪の太さ m (Width)`,hairRingSoftness:`境界のぼかし m (Softness)`,hairRingFacingFade:`輪を出す範囲 (Facing Fade)`,hairRingTint:`輪の色・時間帯 (Tint)`,hairRingLighten:`輪の色へ寄せる量 (Lighten)`,hairRingDesaturate:`彩度を落とす量 (Desaturate)`,hairRingStrength:`輪の濃さ (Strength)`,hairRingStrandJitter:`毛束感の揺らぎ m (Strand Jitter)`,hairRingHeadCenterOffset:`頭の中心の高さ m (Head Center)`,hairRingJagAmplitude:`毛先の長さ m (Tip Length)`,hairRingJagCount:`毛先の数 (Tip Count)`,hairRingViewShift:`視点による上下 m (View Shift)`,hairRingArc:`弧の反り m (Arc)`,hairRingGapCount:`途切れの区切り数 (Gap Count)`,hairRingGapRate:`途切れる割合 (Gap Rate)`,lightWrapFolder:`ライトラップ (Light Wrap)`,lightWrapEnabled:`ライトラップ 有効 (Enable)`,lightWrapRadius:`にじむ幅・画面比 (Radius)`,lightWrapStrength:`強さ (Strength)`,lightWrapEdgePower:`輪郭からの減衰 (Edge Power)`,lightWrapBodyStrength:`髪以外の強さの倍率 (Body Strength)`,paraFolder:`パラ・空気感 (Para)`,paraEnabled:`パラ 有効 (Enable)`,paraTopOpacity:`上端の濃さ (Top Opacity)`,paraBottomOpacity:`下端の濃さ (Bottom Opacity)`,paraDesaturate:`空気の色の彩度を落とす量 (Desaturate)`,paraTintAmount:`色合わせの割合 (Tint Amount)`,envFolder:`環境・多層背景・床 (Environment / Layers)`,farFolder:`🌄 遠景・背景画像 (Far Background)`,selectFarImage:`📁 画像ファイルを選択...`,showBgImage:`遠景背景表示 (Show Background)`,bgColor:`単色背景 (Background Color)`,fogFolder:`🌫️ 遠景大気フォグ (Far Fog / Haze)`,fogEnabled:`フォグ有効化 (Enable Fog)`,fogColor:`空気色 (Fog Color)`,fogIntensity:`霞み強度 (Intensity)`,midFolder:`🌳 中景レイヤー (Midground Layer)`,showMidground:`中景の表示 (Show Midground)`,midX:`X位置 (Pos X)`,midY:`Y高さ (Pos Y)`,midZ:`Z深度 (Pos Z / Depth)`,midScale:`サイズ (Scale)`,midOpacity:`不透明度 (Opacity)`,selectMidImage:`画像ファイルを選択 (Mid)...`,nearFolder:`☕ 近景レイヤー (Nearground Layer)`,showNearground:`近景の表示 (Show Nearground)`,nearX:`X位置 (Pos X)`,nearY:`Y高さ (Pos Y)`,nearScale:`サイズ (Scale)`,nearOpacity:`不透明度 (Opacity)`,showFloor:`床の表示 (Show Floor)`,floorColor:`床の色 (Floor Color)`,lightFolder:`ライティング (Lighting)`,castShadows:`落ち影 (Cast Shadows)`,keyIntensity:`主光強度 (Key Intensity)`,keyColor:`主光色 (Key Color)`,keyPosX:`主光 位置 X`,keyPosY:`主光 位置 Y`,keyPosZ:`主光 位置 Z`,ambientIntensity:`環境光強度 (Ambient Int)`,ambientColor:`環境光色 (Ambient Color)`,rimLightEnabled:`補助光有効 (Rim ON)`,rimLightIntensity:`補助光強度 (Rim Int)`,rimLightColor:`補助光色 (Rim Color)`,rimLightPosX:`補助光 位置 X`,rimLightPosY:`補助光 位置 Y`,rimLightPosZ:`補助光 位置 Z`,sunFolder:`☀️ 太陽・サンシャフト・フレア (Sun & God Rays)`,sunPosFolder:`📍 太陽位置 (Sun Position)`,sunAutoFollow:`主光の向きに自動追従`,sunPosX:`太陽 位置 X`,sunPosY:`太陽 位置 Y`,sunPosZ:`太陽 位置 Z`,godRaysFolder:`✨ サンシャフト / 木漏れ日 (God Rays)`,godRaysEnabled:`サンシャフト有効`,godRaysExposure:`光条強度 (Exposure)`,godRaysDecay:`光条長さ・減衰 (Decay)`,godRaysDensity:`光線密度 (Density)`,godRaysWeight:`光線寄与率 (Weight)`,godRaysColor:`光条カラー (Ray Color)`,godRaysShimmer:`木漏れ日揺らめき (Shimmer)`,flareFolder:`🌟 太陽本体・レンズフレア (Sun & Lens Flare)`,flareEnabled:`太陽・フレア表示有効`,flareSize:`太陽サイズ (Sun Size)`,flareColor:`フレア光色 (Sun Color)`,flareCorona:`コロナグロー (Corona Glow)`,flareStarburst:`星型光芒 (Starburst)`,flareAnamorphic:`横光条 (Anamorphic Streak)`,flareGhosts:`ゴースト (Ghosts)`,flareHalo:`光輪 (Ring Halo)`,postFolder:`ポストプロセス (Post Processing)`,toneMapping:`トーンマッピング方式`,exposure:`露出 (Exposure)`,aaFolder:`✨ アンチエイリアス (Anti-Aliasing)`,msaaSamples:`MSAA サンプル数 (輪郭線/幾何)`,smaaPass:`SMAA パス有効 (画面全体)`,bloomEnabled:`ブルーム有効 (Bloom)`,bloomStrength:`ブルーム強度 (Strength)`,bloomThreshold:`ブルーム閾値 (Threshold)`,bloomRadius:`ブルーム半径 (Radius)`,cgFolder:`🎬 アニメカラーグレーディング (Color Grading)`,cgEnabled:`グレーディング有効`,cgShadowTint:`シャドウ色味 (Shadow Tint)`,cgHighlightTint:`ハイライト色味 (Highlight Tint)`,cgStrength:`適用強度 (Strength)`,cgContrast:`コントラスト強調 (Contrast)`,cgGamma:`ガンマ補正 (Gamma)`,saturation:`彩度 (Saturation)`,brightness:`明度 (Brightness)`,contrast:`コントラスト (Contrast)`,cinematicFolder:`🎬 映画風撮影処理 (Cinematic Film Effects)`,diffusionFolder:`✨ ディフュージョン・軟光 (Diffusion)`,diffusionEnabled:`ディフュージョン有効`,diffusionStrength:`滲み強度 (Strength)`,diffusionRadius:`光の拡散半径 (Radius)`,filmGrainFolder:`🎞️ フィルムグレイン (Film Grain)`,filmGrainEnabled:`フィルムグレイン有効`,filmGrainStrength:`粒子強度 (Strength)`,filmGrainSpeed:`粒子の揺らぎ速度 (Speed)`,vignetteFolder:`📷 シネマティックヴィネット (Vignette)`,vignetteEnabled:`ヴィネット有効`,vignetteOffset:`効果範囲 (Offset)`,vignetteDarkness:`減光強度 (Darkness)`,vignetteColor:`ヴィネット色味 (Color)`,chromaticAberrationFolder:`🌈 レンズ色収差 (Chromatic Aberration)`,chromaticAberrationEnabled:`色収差有効`,chromaticAberrationOffset:`色ズレ量 (Offset)`,sharpenFolder:`🔪 スマートシャープネス (Adaptive Sharpening)`,sharpenEnabled:`シャープネス有効`,sharpenAmount:`線のクッキリ強度 (Amount)`,fisheyeFolder:`🐟 魚眼レンズ歪み (Fisheye Distortion)`,fisheyeEnabled:`魚眼レンズ有効`,fisheyeStrength:`歪み強度 (Strength)`,fisheyeZoom:`画角ズーム補正 (Zoom)`,fisheyeCircular:`円周魚眼マスク (Circular Mask)`,cameraFov:`連動カメラ画角 FOV (Wide)`,windFolder:`🍃 風・揺れもの物理 (Wind Effect)`,windEnabled:`風を有効化 (Enable Wind)`,windSpeed:`風速 (Wind Speed)`,windDirection:`風向 (Direction: 0-360°)`,windElevation:`上下角 (Elevation: -45~45°)`,windTurbulence:`乱気流・揺らぎ (Turbulence)`,windGustFreq:`突風頻度 (Gust Frequency)`,windGustStrength:`突風強度 (Gust Strength)`,particlesFolder:`🍃 風エフェクトパーティクル (Wind Particles)`,particlesEnabled:`パーティクル表示 (Show Particles)`,particlesCount:`個数 (Count)`,particlesSize:`サイズ (Size)`,particlesColor:`色 (Color)`,particlesOpacity:`不透明度 (Opacity)`,particlesSpeed:`速度倍率 (Speed)`,cameraFolder:`📷 カメラ (Camera)`,fov:`視野角 (FOV)`,minDistance:`最小ズーム距離`,maxDistance:`最大ズーム距離`,lipSyncFolder:`🎙️ 音声リップシンク設定 (Lip-Sync)`,lipSyncEnabled:`リップシンク有効`,lipSyncGain:`感度ゲイン (Gain)`,lipSyncSmoothing:`口形状スムーズ化 (Smoothing)`,lipSyncRmsThreshold:`発話検知閾値 (RMS Threshold)`,lipSyncAudioDelay:`発話遅延補正秒 (Audio Delay)`,lipSyncGender:`声質タイプ (Voice Gender)`,actionsFolder:`🔧 各種アクション (Actions)`,resetCamera:`📷 カメラ視点初期化`,exportJson:`📋 設定JSONを書き出し`}},it={common:{title:`AnimeVRM Studio`,loadingModel:`Loading VRM Model...`,close:`Minimize`,openSettings:`Open Settings Panel`,cancel:`Cancel`,apply:`Apply`,copy:`Copy`,save:`Save`,load:`Load`,reset:`Reset`,play:`Play`,stop:`Stop`,loop:`Loop`,none:`None`,success:`Success`,copied:`Copied to clipboard`,copyFailed:`Failed to copy`,language:`Language`,selectLanguage:`Language`},tabs:{character:`Character`,stage:`Stage`,visual:`Settings`,system:`Others`},geminiLiveChat:{title:`AI Avatar Live Chat (Gemini Live)`,description:`Real-time bidirectional conversation powered by Gemini Multimodal Live API (gemini-3.8-live), featuring instant audio output, expressions, and dynamic motion mixing tools.`,apiKeyLabel:`Gemini API Key`,apiKeyPlaceholder:`Enter AI Studio API Key (Not saved)`,apiKeyNote:`※ The API key is kept in browser memory only and never saved to localStorage.`,modelLabel:`Model`,voiceLabel:`Voice`,ardyEnabled:`Generate conversational motion with ardy-mini`,ardyNote:`Downloads and caches about 653–685 MiB on first use. Requires WebGPU and HTTPS or localhost. Motion generation runs on your device. Disconnect to change modes.`,ardyAutonomous:`Move autonomously between replies`,ardyAutonomousNote:`Prefetches the next motion while connected, using additional Gemini requests with the same API key and the model below. Can be turned off during a conversation.`,ardyPlannerModel:`Gemini model for autonomous motion`,ardyTerms:`Model terms`,ardyLoad:`Load model`,ardyPreview:`Try motion`,ardyPrompt:`Motion description (English)`,ardyStates:{unloaded:`Not loaded`,loading:`Loading model`,ready:`Ready`,generating:`Generating motion`,error:`Loading error`},startChat:`🎙️ Connect & Start Chat`,stopChat:`⏹️ Disconnect`,micOn:`🎤 Mic ON`,micMuted:`🔇 Mic OFF`,statusDisconnected:`Disconnected`,statusConnecting:`Connecting...`,statusConnected:`Connected (Idle)`,statusListening:`Listening (Speak now)`,statusSpeaking:`Avatar speaking...`,statusError:`Error`,emptyHistory:`Enter your API key and click "Connect & Start Chat" to talk with Aoi in real-time via mic or text.`,textPlaceholder:`Type a message here (Press Enter to send)...`,send:`Send`},histogram:{title:`Color Histogram`,description:`Displays the RGB channel and luminance distributions of the current canvas rendering.`,refresh:`🔄 Refresh`,channelMode:`Channels`,channelAll:`RGB + Lum`,channelRgb:`RGB Overlaid`,channelR:`Red`,channelG:`Green`,channelB:`Blue`,channelLuminance:`Luminance`,scaleMode:`Scale`,linearScale:`Linear`,logScale:`Logarithmic`,statistics:`Color & Tone Statistics`,meanR:`Mean R`,meanG:`Mean G`,meanB:`Mean B`,meanLuminance:`Mean Luminance`,shadowClip:`Shadow Clip (Level 0)`,highlightClip:`Highlight Clip (Level 255)`,resolution:`Resolution`,samplePixels:`Sampled Pixels`,peakCount:`Peak Pixel Count`},character:{modelSwitch:`👤 Model Switch (VRM Model)`,selectFile:`📁 Select File`,selectMotionFile:`📁 Select FBX`,motion:`💃 Motion`,motions:{idle:`Idle`,standingIdle:`Standing Idle`,standingPose:`Standing Pose`,walking:`Walking`,jogging:`Jogging`,greeting:`Greeting`,bow:`Bow`,acknowledging:`Nod`,dismissing:`Wave Hand`,salute:`Salute`,excited:`Excited`,angry:`Angry`,punching:`Punch`,stop:`Stop`},expression:`😄 Expression`,morphTargets:{title:`MorphTarget editor`,enable:`Enable manual preview`,hint:`Combine weights from 0 to 1. Matching targets on the face and eyelines move together. Blinking and lip sync are held during preview. Turn off or select an expression to resume.`,capture:`Capture current expression`,reset:`Set all to 0`,search:`Search MorphTarget names`,category:`Filter by region`,all:`All regions`,brows:`Brows`,eyes:`Eyes`,mouth:`Mouth / teeth`,other:`Whole face / other`,activeOnly:`Nonzero only`,count:`Shown`,nonzero:`Nonzero`,empty:`No editable MorphTargets. Check that the model has loaded.`,noMatches:`No MorphTargets match the filters.`,name:`Candidate expression name`,preset:`Preset JSON (nonzero weights)`,copy:`Copy preset JSON`,copied:`Copied. Use this JSON when adding the expression.`,copyFailed:`Copy failed. Copy the selected JSON manually.`},faceOverlays:{title:`Face overlays`,blush:`Blush`,sweat:`Sweat`,anger:`Anger mark`,hint:`Combine with any expression. Multiple marks can be shown together.`,loadError:`Could not load the face overlay. Check the model and image.`},expressions:{neutral:`Neutral`,happy:`Happy`,angry:`Angry`,sad:`Sad`,surprised:`Surprised`,relaxed:`Relaxed`,nima:`Smirk`,aa:`Aa`,ee:`Ee`,oh:`Oh`},emotionEffectText:`💬 3D Emotion Text (Manga FX)`,clearAll:`Clear All`,customTextPlaceholder:`Custom text (e.g. Wow!)`,show:`Show`,presets:{wanawana:`🟣 Tremble`,iraira:`🔴 Annoyed`,gaan:`🔵 Shock`,kirakira:`✨ Sparkle`,shiin:`⚪ Silence`,doki:`💖 Thump`,nima:`😏 Smirk`,biku:`⚡ Gasp!`,yatta:`🎉 Yay!`,zoku:`🥶 Shiver...`,sweat:`💦 Sweat (Nervous)`,jito:`😑 Cold Sweat (Stare)`},lipSyncTitle:`🎵 Audio Lip-Sync & Player`,openAudioFile:`📁 Open Audio`,detectedPhoneme:`Phoneme:`,phonemeClosed:`Close`},scenario:{rooftopNapTitle:`🏫 Rooftop Nap & Peeking Mishap (Live2D 2.5D Rig Transition)`,playRooftopNap:`🏫 Play Rooftop Nap Scenario (Live2D)`,rooftopNapDesc:`※ Napping on the school rooftop, Aoi walks up and crouches to peek at you. Seamlessly cuts into Live2D 2.5D Rig at close range with blush & angry reaction!`,confessionTitle:`🌸 Confession Event Scenario (Speaker Zoom/Branching/FX/Voice)`,playConfession:`🌸 Play Confession Scenario`,stopScenario:`■ Stop`,confessionDesc:`※ Click to advance dialogue. Dynamic camera and background zooms follow the speaker with expressions and manga FX.`,townWalkTitle:`🚶‍♀️ Walking Dialogue Scenario (Scrolling Avenue & Background Blur)`,playTownWalk:`🚶‍♀️ Play Walking Scenario`,townWalkDesc:`※ Walk alongside Aoi while chatting with seamless 2-plane scrolling background and anime blur, then transition to standing chat.`,twoGirlsTitle:`👥 2-Girl Dialogue Scenario (Speaker Zoom / Aoi & Emiri Chat)`,playTwoGirls:`👥 Play 2-Girl Scenario`,twoGirlsDesc:`※ Aoi and Emiri appear side-by-side with dynamic speaker camera & background zooms during conversation.`,trioTitle:`💬 3-Person Dialogue Scenario (Attention LookAt / Bust-up / Turn-taking)`,playTrio:`💬 Play 3-Person Scenario`,trioDesc:`※ 3-way conversation between Aoi, Emiri, and You. Natural head and eye attention dynamically tracks the speaker at bust-up distance.`,haremTitle:`💘 4-Person Dialogue Scenario: Who is Your True Love? (3-Avatar Placement & Choice)`,playHarem:`💘 Play True Love Trial`,haremDesc:`※ Aoi (Left), Shion / Downer Girl (Center), and Emiri (Right) corner you to ask: "Who is your true love?!" A 4-way romantic comedy scenario with interactive choices.`,behindYouTitle:`😱 Behind You Scenario: Secrets in the Classroom (180° Turnaround)`,playBehindYou:`😱 Play Behind You Scenario`,behindYouDesc:`※ Gossip about Emily with Aoi until a voice speaks from right behind you! A dramatic 180° camera turn reveals Emily standing behind.`,nisaTitle:`📈 All-Country ETF Anxiety (Sunset School Gate/Bust-up/Tears)`,playNisa:`📈 Play NISA Consultation`,nisaDesc:`※ School gate at sunset. Aoi calls you over with a dead-serious face, only to burst into tears worrying about her All-Country ETF in NISA.`,fastMotionTitle:`⚡ Fast Action Training (Speed Lines & Afterimages Test)`,playFastMotion:`⚡ Play Fast Action Showcase`,fastMotionDesc:`※ Rapid hand waving by Aoi and sharp straight punches by Emily! Tests anime-style motion effects (speed ribbons, limb afterimages, and trailing directional outline blur) triggered on fast limb movement.`,doorPeepTitle:`🚪 The Peep-hole Visitor: Midnight Yandere (Circular Fisheye Lens)`,playDoorPeep:`🚪 Play Peep-hole Yandere Scenario`,doorPeepDesc:`※ 2:00 AM at the apartment door. Looking through the peephole (circular fisheye), a lifeless-eyed girl presses her face directly against the glass in this psychological thriller scenario.`,privateDateTitle:`👗 Holiday Date Scenario (3 Casual Outfits / 6-Scene Story)`,playPrivateDate:`👗 Play Holiday Date Scenario`,privateDateDesc:`※ Full 6-scene holiday date scenario with casual outfits: preparation at room, Emily picking you up, town walk, Shion encounter, cafe meeting with Aoi, and romantic park sunset confession.`,teacherGateTitle:`👩‍🏫 Encounter at the School Gate ~Shion & Ms. Kirishima~`,playTeacherGate:`👩‍🏫 Play School Gate Scenario`,teacherGateDesc:`※ Shion walks to school half-asleep and meets the cool Ms. Kirishima at the gate, bonding unexpectedly over rare Cambrian fossils.`,liveStatus:`📊 Live Scenario Status`,sceneId:`Scene ID:`,speaker:`Speaker:`,acquiredFlags:`Flags:`,noneFlags:`None`,waiting:`(Idle)`,externalJsonTitle:`📥 Load & Play External Scenario JSON`,selectJsonFile:`📂 Select Scenario JSON to Play`,conversationTitle:`🎭 Dialogue Sequence (Lines 1-3)`,playSequence:`▶ Play Sequence`,playing:`Playing...`,shortAnimTitle:`🎬 Short Animation Performance`,playAnim:`▶ Play Animation`,autoMode:`AUTO`,endScenario:`End Scenario`,thinkingTime:`Thinking Time`,steps:{step1Title:`Step 1: Wave Hand`,step2Title:`Step 2: Idle`,step3Title:`Step 3: Nod`}},scenes:{lightingPresetsTitle:`🌅 Time of Day & Scene Settings`,timeOfDayTitle:`⏰ Time of Day & Lighting`,locationTitle:`🏞️ Location & Background`,park:`🌳 Park`,schoolGate:`🏫 School Gate`,indoor:`🏠 Classroom`,morningEvening:`Morning / Day / Evening`,brightDark:`Bright / Dark`,morning:`🌅 Morning`,day:`☀️ Day`,evening:`🌇 Evening`,rainy:`🌧️ Rainy`,night:`🏮 Night`,bright:`💡 Indoor (Bright)`,dark:`🌙 Indoor (Dark)`,dark2:`Indoor (Dark 2)`,divine:`Divine / Backlight`,backgroundTitle:`🌄 Background`,backgrounds:{modernPark:`🌳 Modern Park`,schoolGate:`🏫 School Gate`,classroom:`🏫 Classroom`,schoolRooftop:`🏫 Rooftop`,parkWithSea:`🌊 Seaside Park`,nightFestival:`🏮 Summer Festival`,oldPark:`🌲 Classic Park`,cafe:`☕ Café`,cafeIndoor:`Cafe Indoor`,town:`🏙️ Town`,apartmentDoor:`🚪 Apartment Door`,myroom:`🛏️ My Room`,divineRealm:`Divine Realm`,offSingleColor:`OFF (Solid Color)`,selectFarImage:`📁 Select Image (Far)`},avatarFramingTitle:`📷 Avatar Framing`,avatarFramingDesc:`Switch camera framing. "Bust-up" is recommended for the café scene.`,avatarFraming:{full:`Full Body`,bust:`Bust-up`,close:`Close-up`},presetMorningParkTip:`Crisp morning light and soft violet-blue atmosphere`,presetDayParkTip:`Bright blue sky and strong anime daylight lighting`,presetEveningParkTip:`Dramatic sunset, golden hour god rays & flare`,presetRainyParkTip:`Soft diffuse rain lighting, fog, wet rims & rain drops`,presetNightParkTip:`Festive night lighting with ample illumination and vibrant atmosphere`,presetMorningSchoolTip:`Clear morning sky at school gate`,presetDaySchoolTip:`Bright midday lighting at school gate`,presetEveningSchoolTip:`Afterschool golden hour sunset at school gate`,presetRainySchoolTip:`Moody overcast & rainy day at school gate`,presetNightSchoolTip:`Night school gate with ample night illumination`,presetBrightIndoorTip:`Bright classroom with soft daylight illumination`,presetDarkIndoorTip:`Night classroom with atmospheric ambient lighting`,presetDarkIndoor2Tip:`Café interior with warm ambient and soft highlights`,presetDivineTip:`Radiant sun shafts and brilliant golden rim light with deep silhouette`},render:{detailedParamsTitle:`⚙️ Fine Parameter Tuning (Toon, Material, Light, Wind)`,importModalTitle:`📥 Import Config JSON`,importModalDesc:`Paste your configuration JSON below and click "Apply".`,applyConfig:`Apply Settings`,parseError:`Failed to parse JSON. Please verify the syntax.`},masters:{overviewTitle:`🗄️ Registered Master Data Overview`,characterCount:`👤 Characters:`,motionCount:`💃 Motions:`,soundCount:`🎙️ Sounds / Voices:`,sceneCount:`🌅 Scene Presets:`,unitCount:`items`,unitType:`items`,batchTitle:`💾 Master JSON Export & Import`,saveMasters:`💾 Save masters.json`,copyMasters:`📋 Copy`,loadMasters:`📥 Load & Apply masters.json`,resetMasters:`🔄 Reset to Default Masters`},toasts:{sceneChanged:`🌅 Scene changed to: `,configCopied:`📋 Config JSON copied to clipboard!`,configSaved:`💾 Downloaded avatar-config.json`,configImported:`✓ Config JSON successfully applied!`,configReset:`🔄 Reset to default configuration`,mastersDownloaded:`💾 Downloaded masters.json`,mastersCopied:`📋 Copied masters.json to clipboard`,mastersImported:`📥 Master data successfully imported!`,mastersImportFailed:`❌ Failed to parse JSON`,mastersReset:`🔄 Reset master data to defaults`,scenarioStarted:`🌸 Started scenario: `,scenarioJsonFailed:`❌ Failed to load scenario JSON`,animStarted:`🎬 Playing short animation`,animStopped:`⏹ Stopped Animation`,rooftopNapStarted:`🏫 Started Rooftop Nap & Peeking Mishap scenario`,confessionStarted:`🌸 Started Confession Scenario`,twoGirlsStarted:`👥 Started 2-girl dialogue scenario`,trioStarted:`💬 Started 3-person dialogue scenario`,haremStarted:`💘 Started 4-person dialogue scenario (True Love Trial)`,townWalkStarted:`🚶‍♀️ Started town walk scenario`,behindYouStarted:`😱 Behind You Scenario started`,doorPeepStarted:`🚪 The Peep-hole Visitor scenario started`,nisaStarted:`📈 All-Country ETF Anxiety scenario started`,fastMotionStarted:`⚡ Started Fast Action Training scenario`,privateDateStarted:`👗 Started Holiday Date scenario`,teacherGateStarted:`👩‍🏫 Started School Gate scenario`,scenarioStopped:`⏹ Scenario stopped`,motionLoaded:`💃 Motion loaded: `,motionLoadFailed:`❌ Failed to load motion`},gui:{detailedTitle:`Detailed Parameters`,panoramaFolder:`🌐 360° Panorama Background`,panoramaEnabled:`Panorama Enabled`,panoramaTestClassroom:`🏫 Test Classroom 360°`,panoramaReset:`🔄 Reset View`,panoramaDemo:`🎬 Play Camera Demo`,panoramaSensitivity:`Sensitivity`,panoramaInvertDrag:`Invert Drag`,panoramaIdleMotion:`Idle Motion`,panoramaFov:`Field of View (FOV)`,panoramaYaw:`Yaw (°)`,panoramaPitch:`Pitch (°)`,panoramaCameraY:`Camera Height (Y)`,panoramaAvatarFolder:`👤 Avatar Position`,panoramaAvatarFront:`Mid Shot / Waist (-1.0m)`,panoramaAvatarClose:`Close Up / Chest (-0.7m)`,panoramaAvatarFar:`Slightly Far (-1.6m)`,panoramaAvatarSide:`Side by Side`,panoramaAvatarOrigin:`Reset to Origin (0,0,0)`,panoramaAvatarVisible:`Avatar Visible`,panoramaAvatarX:`Position X (m)`,panoramaAvatarY:`Position Y (m)`,panoramaAvatarZ:`Position Z (m)`,panoramaAvatarRot:`Avatar Rotation Y (°)`,sceneFolder:`🌅 Scene & Lighting Presets`,sceneSelect:`Select Scene`,quickSwitchFolder:`Quick Switch Buttons`,animCutFolder:`🎬 Short Animation Cuts`,cutEnabled:`Enabled`,cutDuration:`Duration (sec)`,startAngle:`Start Angle (Jump)`,cameraDistance:`Camera Distance Scale`,camera:`Camera Preset`,cameraStrength:`Camera Strength`,motion:`Motion`,backTextFolder:`Back Text (Background)`,frontTextFolder:`Front Text (Foreground)`,text:`Text Content`,animation:`Text Animation`,size:`Font Size (vw)`,textColor:`Text Color`,fontWeight:`Font Weight`,togglesFolder:`⚡ Feature Toggles (ON / OFF)`,toggleColorGrading:`🎬 Anime Color Grading`,toggleBloom:`🌟 Bloom Glow`,toggleWind:`🍃 Wind Physics Simulation`,toggleSmoothNormal:`✨ Smooth Normal Outline`,toggleScreenSpaceWidth:`📐 Screen-Space Outline Width`,toggleRimBody:`💡 Rim Light (Body/Skin)`,toggleRimCloth:`💡 Rim Light (Cloth)`,toggleRimLight:`💡 Ambient Rim Light`,toggleDiffusion:`✨ Soft Diffusion Glow`,toggleFilmGrain:`🎞️ Film Grain Texture`,toggleVignette:`📷 Cinematic Vignette`,toggleChromaticAberration:`🌈 Chromatic Aberration`,toggleSharpening:`🔪 Smart Sharpening (Crisp Lines)`,toggleFisheye:`🐟 Fisheye Lens Distortion`,toggleEyeGlow:`👀 Eye Highlight Glow`,eyeGlowFolder:`👀 Eye Highlight Glow`,eyeGlowEnabled:`Eye Glow Enabled`,eyeGlowIntensity:`Glow Intensity`,matBody:`Body & Skin Material`,matHair:`Hair Material`,matCloth:`Cloth & Shoes Material`,baseColor:`Base Color / Tint`,highlightMatcap:`✨ Highlight (MatCap)`,emissiveIntensity:`🌟 Emissive Intensity (Bloom)`,shadeMultiply:`Shade Multiply`,toonyFactor:`Toon Shading Factor`,shadingShift:`Shading Border Shift`,giFactor:`GI Equalization`,rimEnabled:`Rim Light Enabled`,rimColor:`Rim Color`,rimFresnelPower:`Rim Fresnel Power`,rimLift:`Rim Lift`,rimMix:`Rim Light Mix`,outlineWidth:`Outline Width Factor`,outlineFolder:`Outline & Contours`,outlineInvertedHull:`Inverted Hull Outline`,outlineSmoothNormal:`✨ Smooth Normal`,outlineScreenSpace:`📐 Screen-Space Width`,outlineAutoWeight:`✒️ Auto Line Weight Modulation`,outlineDarkness:`Line Darkness`,outlineLightingMix:`Lighting Mix Factor`,bottomGradientFolder:`Bottom Gradient / Grounding`,bottomGradientEnabled:`Enable Gradient`,bottomGradientStartY:`Start Height (Waist)`,bottomGradientEndY:`End Height (Feet)`,bottomGradientIntensity:`Darkness Intensity`,bottomGradientShadowWeight:`Shadow Weight`,bottomGradientColor:`Shadow Color`,hairShadowFolder:`Hair Shadow`,hairShadowEnabled:`Enable Hair Shadow`,hairShadowOffset:`Light Offset (m)`,hairShadowDownBias:`Down Bias (m)`,hairShadowStrength:`Strength`,hairShadowDepthBias:`Depth Bias (m)`,hairShadowMaxDepthDiff:`Max Depth Diff (m)`,faceSdfFolder:`Face Shadow Map (SDF)`,faceSdfEnabled:`Enable Face Shadow Map`,faceSdfSoftness:`Edge Softness (deg)`,faceSdfNoseSize:`Nose Shadow Size`,faceSdfNoseStart:`Nose Shadow Start (deg)`,faceSdfSkipStart:`Skip From (deg)`,faceSdfSkipEnd:`Skip To (deg)`,faceSdfSkipBlend:`Skip Switch Width (deg)`,hairRingFolder:`Hair Ring (Angel Ring)`,hairRingEnabled:`Enable Hair Ring`,hairRingHeight:`Height (m)`,hairRingWidth:`Width (m)`,hairRingSoftness:`Edge Softness (m)`,hairRingFacingFade:`Facing Fade`,hairRingTint:`Tint (per time of day)`,hairRingLighten:`Lighten`,hairRingDesaturate:`Desaturate`,hairRingStrength:`Strength`,hairRingStrandJitter:`Strand Jitter (m)`,hairRingHeadCenterOffset:`Head Center Offset (m)`,hairRingJagAmplitude:`Tip Length (m)`,hairRingJagCount:`Tip Count`,hairRingViewShift:`View Shift (m)`,hairRingArc:`Arc (m)`,hairRingGapCount:`Gap Segments`,hairRingGapRate:`Gap Rate`,lightWrapFolder:`Light Wrap`,lightWrapEnabled:`Enable Light Wrap`,lightWrapRadius:`Radius (screen height ratio)`,lightWrapStrength:`Strength`,lightWrapEdgePower:`Edge Power`,lightWrapBodyStrength:`Body (non-hair) Strength`,paraFolder:`Para (Atmosphere)`,paraEnabled:`Enable Para`,paraTopOpacity:`Top Opacity`,paraBottomOpacity:`Bottom Opacity`,paraDesaturate:`Desaturate Air Color`,paraTintAmount:`Tint Amount (0 = screen, 1 = tint)`,envFolder:`Environment & Background Layers`,farFolder:`🌄 Far Background`,selectFarImage:`📁 Select Image File...`,showBgImage:`Show Far Background`,bgColor:`Background Color`,fogFolder:`🌫️ Atmospheric Far Fog / Haze`,fogEnabled:`Enable Fog`,fogColor:`Fog Color`,fogIntensity:`Fog Intensity`,midFolder:`🌳 Midground Layer`,showMidground:`Show Midground`,midX:`Position X`,midY:`Position Y`,midZ:`Depth Z`,midScale:`Scale`,midOpacity:`Opacity`,selectMidImage:`Select Image File (Mid)...`,nearFolder:`☕ Nearground Layer`,showNearground:`Show Nearground`,nearX:`Position X`,nearY:`Position Y`,nearScale:`Scale`,nearOpacity:`Opacity`,showFloor:`Show Floor Plane`,floorColor:`Floor Color`,lightFolder:`Lighting & Shadows`,castShadows:`Cast Shadows`,keyIntensity:`Key Light Intensity`,keyColor:`Key Light Color`,keyPosX:`Key Pos X`,keyPosY:`Key Pos Y`,keyPosZ:`Key Pos Z`,ambientIntensity:`Ambient Intensity`,ambientColor:`Ambient Color`,rimLightEnabled:`Rim Light Enabled`,rimLightIntensity:`Rim Intensity`,rimLightColor:`Rim Color`,rimLightPosX:`Rim Pos X`,rimLightPosY:`Rim Pos Y`,rimLightPosZ:`Rim Pos Z`,sunFolder:`☀️ Sun, God Rays & Lens Flare`,sunPosFolder:`📍 Sun Position`,sunAutoFollow:`Auto Track Key Light`,sunPosX:`Sun Pos X`,sunPosY:`Sun Pos Y`,sunPosZ:`Sun Pos Z`,godRaysFolder:`✨ God Rays / Sun Shafts`,godRaysEnabled:`God Rays Enabled`,godRaysExposure:`Ray Exposure`,godRaysDecay:`Ray Decay`,godRaysDensity:`Ray Density`,godRaysWeight:`Ray Weight`,godRaysColor:`Ray Color`,godRaysShimmer:`Komorebi Shimmer`,flareFolder:`🌟 Sun & Lens Flare`,flareEnabled:`Sun & Flare Enabled`,flareSize:`Sun Size`,flareColor:`Sun Color`,flareCorona:`Corona Glow`,flareStarburst:`Starburst`,flareAnamorphic:`Anamorphic Streak`,flareGhosts:`Ghosts`,flareHalo:`Ring Halo`,postFolder:`Post-Processing`,toneMapping:`Tone Mapping Mode`,exposure:`Exposure`,aaFolder:`✨ Anti-Aliasing`,msaaSamples:`MSAA Samples (Geometry)`,smaaPass:`SMAA Pass (Full Scene)`,bloomEnabled:`Bloom Enabled`,bloomStrength:`Bloom Strength`,bloomThreshold:`Bloom Threshold`,bloomRadius:`Bloom Radius`,cgFolder:`🎬 Anime Color Grading`,cgEnabled:`Color Grading Enabled`,cgShadowTint:`Shadow Tint`,cgHighlightTint:`Highlight Tint`,cgStrength:`Grading Strength`,cgContrast:`Contrast Boost`,cgGamma:`Gamma`,saturation:`Saturation`,brightness:`Brightness`,contrast:`Contrast`,cinematicFolder:`🎬 Cinematic Film Effects`,diffusionFolder:`✨ Diffusion & Soft Glow`,diffusionEnabled:`Enable Diffusion Glow`,diffusionStrength:`Diffusion Strength`,diffusionRadius:`Diffusion Radius`,filmGrainFolder:`🎞️ Film Grain`,filmGrainEnabled:`Enable Film Grain`,filmGrainStrength:`Grain Strength`,filmGrainSpeed:`Grain Dynamic Speed`,vignetteFolder:`📷 Cinematic Vignette`,vignetteEnabled:`Enable Vignette`,vignetteOffset:`Vignette Range / Offset`,vignetteDarkness:`Vignette Darkness`,vignetteColor:`Vignette Color`,chromaticAberrationFolder:`🌈 Chromatic Aberration`,chromaticAberrationEnabled:`Chromatic Aberration Enabled`,chromaticAberrationOffset:`Offset Amount`,sharpenFolder:`🔪 Smart Sharpening (Adaptive)`,sharpenEnabled:`Sharpening Enabled`,sharpenAmount:`Line Sharpness (Amount)`,fisheyeFolder:`🐟 Fisheye Lens Distortion`,fisheyeEnabled:`Fisheye Enabled`,fisheyeStrength:`Distortion Strength`,fisheyeZoom:`Zoom / Crop Scale`,fisheyeCircular:`Circular Fisheye Mask`,cameraFov:`Camera FOV (Wide-angle)`,windFolder:`🍃 Wind Physics & Sway`,windEnabled:`Enable Wind Physics`,windSpeed:`Wind Speed`,windDirection:`Direction (0-360°)`,windElevation:`Elevation (-45~45°)`,windTurbulence:`Turbulence`,windGustFreq:`Gust Frequency`,windGustStrength:`Gust Strength`,particlesFolder:`🍃 Wind Particle FX`,particlesEnabled:`Show Particles`,particlesCount:`Particle Count`,particlesSize:`Size`,particlesColor:`Color`,particlesOpacity:`Opacity`,particlesSpeed:`Speed Multiplier`,cameraFolder:`📷 Camera`,fov:`Field of View (FOV)`,minDistance:`Min Zoom Distance`,maxDistance:`Max Zoom Distance`,lipSyncFolder:`🎙️ Audio Lip-Sync Settings`,lipSyncEnabled:`Lip-Sync Enabled`,lipSyncGain:`Sensitivity Gain`,lipSyncSmoothing:`Mouth Smoothing`,lipSyncRmsThreshold:`RMS Threshold`,lipSyncAudioDelay:`Audio Delay (sec)`,lipSyncGender:`Voice Gender Type`,actionsFolder:`🔧 Actions`,resetCamera:`📷 Reset Camera View`,exportJson:`📋 Export Config JSON`}},at=`animevrm_language`,ot={ja:rt,en:it},st=`ja`,ct=new Set;function lt(){try{let e=localStorage.getItem(at);if(e===`ja`||e===`en`)return e}catch{}return typeof navigator<`u`&&navigator.language?navigator.language.toLowerCase().startsWith(`ja`)?`ja`:`en`:`ja`}st=lt();function H(){return st}function ut(e){if(st!==e){st=e;try{localStorage.setItem(at,e)}catch{}document.documentElement.lang=e,ct.forEach(t=>t(e))}}function dt(e){return ct.add(e),()=>{ct.delete(e)}}var U=()=>ot[st]||ot.ja,ft={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},W=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},pt=new me(-1,1,1,-1,0,1),mt=new class extends A{constructor(){super(),this.setAttribute(`position`,new ne([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new ne([0,2,0,0,2,0],2))}},ht=class{constructor(e){this._mesh=new L(mt,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,pt)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},gt=class extends W{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof I?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=w.clone(e.uniforms),this.material=new I({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new ht(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},_t=class extends W{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},vt=class extends W{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},yt=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new C);this._width=n.width,this._height=n.height,t=new D(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:T}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new gt(ft),this.copyPass.material.blending=0,this.timer=new ce}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}_t!==void 0&&(r instanceof _t?n=!0:r instanceof vt&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new C);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},bt=class extends W{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new O}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},xt={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new O(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},St=class e extends W{constructor(e,t=1,n,r){super(),this.strength=t,this.radius=n,this.threshold=r,this.resolution=e===void 0?new C(256,256):new C(e.x,e.y),this.clearColor=new O(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new D(i,a,{type:T}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new D(i,a,{type:T});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new D(i,a,{type:T});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),i=Math.round(i/2),a=Math.round(a/2)}let o=xt;this.highPassUniforms=w.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new I({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let s=[6,10,14,18,22];i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(s[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new C(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new k(1,1,1),new k(1,1,1),new k(1,1,1),new k(1,1,1),new k(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=w.clone(ft.uniforms),this.blendMaterial=new I({uniforms:this.copyUniforms,vertexShader:ft.vertexShader,fragmentShader:ft.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new O,this._oldClearAlpha=1,this._basic=new F,this._fsQuad=new ht(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new C(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(t,n,r,i,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[n]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[n]),t.clear(),this._fsQuad.render(t),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(r),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);return new I({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new C(.5,.5)},direction:{value:new C(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {

					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;

					for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {

						float x = float( i );
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * w;

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new I({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};St.BlurDirectionX=new C(1,0),St.BlurDirectionY=new C(0,1);var Ct={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},wt=class extends W{constructor(){super(),this.isOutputPass=!0,this.uniforms=w.clone(Ct.uniforms),this.material=new h({name:Ct.name,uniforms:this.uniforms,vertexShader:Ct.vertexShader,fragmentShader:Ct.fragmentShader}),this._fsQuad=new ht(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},m.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},Tt={name:`SMAAEdgesShader`,defines:{SMAA_THRESHOLD:`0.1`},uniforms:{tDiffuse:{value:null},resolution:{value:new C(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		void SMAAEdgeDetectionVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0,  1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4(  1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 2 ] = texcoord.xyxy + resolution.xyxy * vec4( -2.0, 0.0, 0.0,  2.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAAEdgeDetectionVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		vec4 SMAAColorEdgeDetectionPS( vec2 texcoord, vec4 offset[3], sampler2D colorTex ) {
			vec2 threshold = vec2( SMAA_THRESHOLD, SMAA_THRESHOLD );

			// Calculate color deltas:
			vec4 delta;
			vec3 C = texture2D( colorTex, texcoord ).rgb;

			vec3 Cleft = texture2D( colorTex, offset[0].xy ).rgb;
			vec3 t = abs( C - Cleft );
			delta.x = max( max( t.r, t.g ), t.b );

			vec3 Ctop = texture2D( colorTex, offset[0].zw ).rgb;
			t = abs( C - Ctop );
			delta.y = max( max( t.r, t.g ), t.b );

			// We do the usual threshold:
			vec2 edges = step( threshold, delta.xy );

			// Then discard if there is no edge:
			if ( dot( edges, vec2( 1.0, 1.0 ) ) == 0.0 )
				discard;

			// Calculate right and bottom deltas:
			vec3 Cright = texture2D( colorTex, offset[1].xy ).rgb;
			t = abs( C - Cright );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Cbottom  = texture2D( colorTex, offset[1].zw ).rgb;
			t = abs( C - Cbottom );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the maximum delta in the direct neighborhood:
			float maxDelta = max( max( max( delta.x, delta.y ), delta.z ), delta.w );

			// Calculate left-left and top-top deltas:
			vec3 Cleftleft  = texture2D( colorTex, offset[2].xy ).rgb;
			t = abs( C - Cleftleft );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Ctoptop = texture2D( colorTex, offset[2].zw ).rgb;
			t = abs( C - Ctoptop );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the final maximum delta:
			maxDelta = max( max( maxDelta, delta.z ), delta.w );

			// Local contrast adaptation in action:
			edges.xy *= step( 0.5 * maxDelta, delta.xy );

			return vec4( edges, 0.0, 0.0 );
		}

		void main() {

			gl_FragColor = SMAAColorEdgeDetectionPS( vUv, vOffset, tDiffuse );

		}`},Et={name:`SMAAWeightsShader`,defines:{SMAA_MAX_SEARCH_STEPS:`8`,SMAA_AREATEX_MAX_DISTANCE:`16`,SMAA_AREATEX_PIXEL_SIZE:`( 1.0 / vec2( 160.0, 560.0 ) )`,SMAA_AREATEX_SUBTEX_SIZE:`( 1.0 / 7.0 )`},uniforms:{tDiffuse:{value:null},tArea:{value:null},tSearch:{value:null},resolution:{value:new C(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];
		varying vec2 vPixcoord;

		void SMAABlendingWeightCalculationVS( vec2 texcoord ) {
			vPixcoord = texcoord / resolution;

			// We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.25, 0.125, 1.25, 0.125 ); // WebGL port note: Changed sign in Y and W components
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.125, 0.25, -0.125, -1.25 ); // WebGL port note: Changed sign in Y and W components

			// And these for the searches, they indicate the ends of the loops:
			vOffset[ 2 ] = vec4( vOffset[ 0 ].xz, vOffset[ 1 ].yw ) + vec4( -2.0, 2.0, -2.0, 2.0 ) * resolution.xxyy * float( SMAA_MAX_SEARCH_STEPS );

		}

		void main() {

			vUv = uv;

			SMAABlendingWeightCalculationVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#define SMAASampleLevelZeroOffset( tex, coord, offset ) texture2D( tex, coord + float( offset ) * resolution, 0.0 )

		uniform sampler2D tDiffuse;
		uniform sampler2D tArea;
		uniform sampler2D tSearch;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[3];
		varying vec2 vPixcoord;

		#if __VERSION__ == 100
		vec2 round( vec2 x ) {
			return sign( x ) * floor( abs( x ) + 0.5 );
		}
		#endif

		float SMAASearchLength( sampler2D searchTex, vec2 e, float bias, float scale ) {
			// Not required if searchTex accesses are set to point:
			// float2 SEARCH_TEX_PIXEL_SIZE = 1.0 / float2(66.0, 33.0);
			// e = float2(bias, 0.0) + 0.5 * SEARCH_TEX_PIXEL_SIZE +
			//     e * float2(scale, 1.0) * float2(64.0, 32.0) * SEARCH_TEX_PIXEL_SIZE;
			e.r = bias + e.r * scale;
			return 255.0 * texture2D( searchTex, e, 0.0 ).r;
		}

		float SMAASearchXLeft( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			/**
				* @PSEUDO_GATHER4
				* This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
				* sample between edge, thus fetching four edges in a row.
				* Sampling with different offsets in each direction allows to disambiguate
				* which edges are active from the four fetched ones.
				*/
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x > end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			// We correct the previous (-0.25, -0.125) offset we applied:
			texcoord.x += 0.25 * resolution.x;

			// The searches are bias by 1, so adjust the coords accordingly:
			texcoord.x += resolution.x;

			// Disambiguate the length added by the last step:
			texcoord.x += 2.0 * resolution.x; // Undo last step
			texcoord.x -= resolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);

			return texcoord.x;
		}

		float SMAASearchXRight( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x < end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			texcoord.x -= 0.25 * resolution.x;
			texcoord.x -= resolution.x;
			texcoord.x -= 2.0 * resolution.x;
			texcoord.x += resolution.x * SMAASearchLength( searchTex, e, 0.5, 0.5 );

			return texcoord.x;
		}

		float SMAASearchYUp( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y > end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y -= 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y; // WebGL port note: Changed sign
			texcoord.y -= 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y * SMAASearchLength( searchTex, e.gr, 0.0, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		float SMAASearchYDown( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y < end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y += 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y; // WebGL port note: Changed sign
			texcoord.y += 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y * SMAASearchLength( searchTex, e.gr, 0.5, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		vec2 SMAAArea( sampler2D areaTex, vec2 dist, float e1, float e2, float offset ) {
			// Rounding prevents precision errors of bilinear filtering:
			vec2 texcoord = float( SMAA_AREATEX_MAX_DISTANCE ) * round( 4.0 * vec2( e1, e2 ) ) + dist;

			// We do a scale and bias for mapping to texel space:
			texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + ( 0.5 * SMAA_AREATEX_PIXEL_SIZE );

			// Move to proper place, according to the subpixel offset:
			texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;

			return texture2D( areaTex, texcoord, 0.0 ).rg;
		}

		vec4 SMAABlendingWeightCalculationPS( vec2 texcoord, vec2 pixcoord, vec4 offset[ 3 ], sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices ) {
			vec4 weights = vec4( 0.0, 0.0, 0.0, 0.0 );

			vec2 e = texture2D( edgesTex, texcoord ).rg;

			if ( e.g > 0.0 ) { // Edge at north
				vec2 d;

				// Find the distance to the left:
				vec2 coords;
				coords.x = SMAASearchXLeft( edgesTex, searchTex, offset[ 0 ].xy, offset[ 2 ].x );
				coords.y = offset[ 1 ].y; // offset[1].y = texcoord.y - 0.25 * resolution.y (@CROSSING_OFFSET)
				d.x = coords.x;

				// Now fetch the left crossing edges, two at a time using bilinear
				// filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
				// discern what value each edge has:
				float e1 = texture2D( edgesTex, coords, 0.0 ).r;

				// Find the distance to the right:
				coords.x = SMAASearchXRight( edgesTex, searchTex, offset[ 0 ].zw, offset[ 2 ].y );
				d.y = coords.x;

				// We want the distances to be in pixel units (doing this here allow to
				// better interleave arithmetic and memory accesses):
				d = d / resolution.x - pixcoord.x;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the right crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 1, 0 ) ).r;

				// Ok, we know how this pattern looks like, now it is time for getting
				// the actual area:
				weights.rg = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.y ) );
			}

			if ( e.r > 0.0 ) { // Edge at west
				vec2 d;

				// Find the distance to the top:
				vec2 coords;

				coords.y = SMAASearchYUp( edgesTex, searchTex, offset[ 1 ].xy, offset[ 2 ].z );
				coords.x = offset[ 0 ].x; // offset[1].x = texcoord.x - 0.25 * resolution.x;
				d.x = coords.y;

				// Fetch the top crossing edges:
				float e1 = texture2D( edgesTex, coords, 0.0 ).g;

				// Find the distance to the bottom:
				coords.y = SMAASearchYDown( edgesTex, searchTex, offset[ 1 ].zw, offset[ 2 ].w );
				d.y = coords.y;

				// We want the distances to be in pixel units:
				d = d / resolution.y - pixcoord.y;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the bottom crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 0, 1 ) ).g;

				// Get the area for this direction:
				weights.ba = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.x ) );
			}

			return weights;
		}

		void main() {

			gl_FragColor = SMAABlendingWeightCalculationPS( vUv, vPixcoord, vOffset, tDiffuse, tArea, tSearch, ivec4( 0.0 ) );

		}`},Dt={name:`SMAABlendShader`,uniforms:{tDiffuse:{value:null},tColor:{value:null},resolution:{value:new C(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		void SMAANeighborhoodBlendingVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0, 1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAANeighborhoodBlendingVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform sampler2D tColor;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		vec4 SMAANeighborhoodBlendingPS( vec2 texcoord, vec4 offset[ 2 ], sampler2D colorTex, sampler2D blendTex ) {
			// Fetch the blending weights for current pixel:
			vec4 a;
			a.xz = texture2D( blendTex, texcoord ).xz;
			a.y = texture2D( blendTex, offset[ 1 ].zw ).g;
			a.w = texture2D( blendTex, offset[ 1 ].xy ).a;

			// Is there any blending weight with a value greater than 0.0?
			if ( dot(a, vec4( 1.0, 1.0, 1.0, 1.0 )) < 1e-5 ) {
				return texture2D( colorTex, texcoord, 0.0 );
			} else {
				// Up to 4 lines can be crossing a pixel (one through each edge). We
				// favor blending by choosing the line with the maximum weight for each
				// direction:
				vec2 offset;
				offset.x = a.a > a.b ? a.a : -a.b; // left vs. right
				offset.y = a.g > a.r ? -a.g : a.r; // top vs. bottom // WebGL port note: Changed signs

				// Then we go in the direction that has the maximum weight:
				if ( abs( offset.x ) > abs( offset.y )) { // horizontal vs. vertical
					offset.y = 0.0;
				} else {
					offset.x = 0.0;
				}

				// Fetch the opposite color and lerp by hand:
				vec4 C = texture2D( colorTex, texcoord, 0.0 );
				texcoord += sign( offset ) * resolution;
				vec4 Cop = texture2D( colorTex, texcoord, 0.0 );
				float s = abs( offset.x ) > abs( offset.y ) ? abs( offset.x ) : abs( offset.y );

				// WebGL port note: Added gamma correction
				C.xyz = pow(C.xyz, vec3(2.2));
				Cop.xyz = pow(Cop.xyz, vec3(2.2));
				vec4 mixed = mix(C, Cop, s);
				mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));

				return mixed;
			}
		}

		void main() {

			gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );

		}`},Ot=class extends W{constructor(){super(),this._edgesRT=new D(1,1,{depthBuffer:!1,type:T}),this._edgesRT.texture.name=`SMAAPass.edges`,this._weightsRT=new D(1,1,{depthBuffer:!1,type:T}),this._weightsRT.texture.name=`SMAAPass.weights`;let e=this,t=new Image;t.src=this._getAreaTexture(),t.onload=function(){e._areaTexture.needsUpdate=!0},this._areaTexture=new x,this._areaTexture.name=`SMAAPass.area`,this._areaTexture.image=t,this._areaTexture.minFilter=te,this._areaTexture.generateMipmaps=!1,this._areaTexture.flipY=!1;let n=new Image;n.src=this._getSearchTexture(),n.onload=function(){e._searchTexture.needsUpdate=!0},this._searchTexture=new x,this._searchTexture.name=`SMAAPass.search`,this._searchTexture.image=n,this._searchTexture.magFilter=ve,this._searchTexture.minFilter=ve,this._searchTexture.generateMipmaps=!1,this._searchTexture.flipY=!1,this._uniformsEdges=w.clone(Tt.uniforms),this._materialEdges=new I({defines:Object.assign({},Tt.defines),uniforms:this._uniformsEdges,vertexShader:Tt.vertexShader,fragmentShader:Tt.fragmentShader}),this._uniformsWeights=w.clone(Et.uniforms),this._uniformsWeights.tDiffuse.value=this._edgesRT.texture,this._uniformsWeights.tArea.value=this._areaTexture,this._uniformsWeights.tSearch.value=this._searchTexture,this._materialWeights=new I({defines:Object.assign({},Et.defines),uniforms:this._uniformsWeights,vertexShader:Et.vertexShader,fragmentShader:Et.fragmentShader}),this._uniformsBlend=w.clone(Dt.uniforms),this._uniformsBlend.tDiffuse.value=this._weightsRT.texture,this._materialBlend=new I({uniforms:this._uniformsBlend,vertexShader:Dt.vertexShader,fragmentShader:Dt.fragmentShader}),this._fsQuad=new ht(null)}render(e,t,n){this._uniformsEdges.tDiffuse.value=n.texture,this._fsQuad.material=this._materialEdges,e.setRenderTarget(this._edgesRT),this.clear&&e.clear(),this._fsQuad.render(e),this._fsQuad.material=this._materialWeights,e.setRenderTarget(this._weightsRT),this.clear&&e.clear(),this._fsQuad.render(e),this._uniformsBlend.tColor.value=n.texture,this._fsQuad.material=this._materialBlend,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(),this._fsQuad.render(e))}setSize(e,t){this._edgesRT.setSize(e,t),this._weightsRT.setSize(e,t),this._materialEdges.uniforms.resolution.value.set(1/e,1/t),this._materialWeights.uniforms.resolution.value.set(1/e,1/t),this._materialBlend.uniforms.resolution.value.set(1/e,1/t)}dispose(){this._edgesRT.dispose(),this._weightsRT.dispose(),this._areaTexture.dispose(),this._searchTexture.dispose(),this._materialEdges.dispose(),this._materialWeights.dispose(),this._materialBlend.dispose(),this._fsQuad.dispose()}_getAreaTexture(){return`data:image/png;base64,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`}_getSearchTexture(){return`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII=`}},kt=function(){var e=0,t=document.createElement(`div`);t.style.cssText=`position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000`,t.addEventListener(`click`,function(n){n.preventDefault(),r(++e%t.children.length)},!1);function n(e){return t.appendChild(e.dom),e}function r(n){for(var r=0;r<t.children.length;r++)t.children[r].style.display=r===n?`block`:`none`;e=n}var i=(performance||Date).now(),a=i,o=0,s=n(new kt.Panel(`FPS`,`#0ff`,`#002`)),c=n(new kt.Panel(`MS`,`#0f0`,`#020`));if(self.performance&&self.performance.memory)var l=n(new kt.Panel(`MB`,`#f08`,`#201`));return r(0),{REVISION:16,dom:t,addPanel:n,showPanel:r,begin:function(){i=(performance||Date).now()},end:function(){o++;var e=(performance||Date).now();if(c.update(e-i,200),e>=a+1e3&&(s.update(o*1e3/(e-a),100),a=e,o=0,l)){var t=performance.memory;l.update(t.usedJSHeapSize/1048576,t.jsHeapSizeLimit/1048576)}return e},update:function(){i=this.end()},domElement:t,setMode:r}};kt.Panel=function(e,t,n){var r=1/0,i=0,a=Math.round,o=a(window.devicePixelRatio||1),s=80*o,c=48*o,l=3*o,u=2*o,d=3*o,f=15*o,p=74*o,m=30*o,h=document.createElement(`canvas`);h.width=s,h.height=c,h.style.cssText=`width:80px;height:48px`;var g=h.getContext(`2d`);return g.font=`bold `+9*o+`px Helvetica,Arial,sans-serif`,g.textBaseline=`top`,g.fillStyle=n,g.fillRect(0,0,s,c),g.fillStyle=t,g.fillText(e,l,u),g.fillRect(d,f,p,m),g.fillStyle=n,g.globalAlpha=.9,g.fillRect(d,f,p,m),{dom:h,update:function(c,_){r=Math.min(r,c),i=Math.max(i,c),g.fillStyle=n,g.globalAlpha=1,g.fillRect(0,0,s,f),g.fillStyle=t,g.fillText(a(c)+` `+e+` (`+a(r)+`-`+a(i)+`)`,l,u),g.drawImage(h,d+o,f,p-o,m,d,f,p-o,m),g.fillRect(d+p-o,f,o,m),g.fillStyle=n,g.globalAlpha=.9,g.fillRect(d+p-o,f,o,a((1-c/_)*m))}}};var At={name:`CinematicAnimeShader`,uniforms:{tDiffuse:{value:null},uResolution:{value:new C(1920,1080)},uTime:{value:0},uChromaticAberrationEnabled:{value:1},uChromaticAberrationOffset:{value:.0015},uDiffusionEnabled:{value:1},uDiffusionStrength:{value:.25},uDiffusionRadius:{value:1.8},uColorGradingEnabled:{value:1},uShadowTint:{value:new O(`#3d61ff`).convertLinearToSRGB()},uHighlightTint:{value:new O(`#99c0ff`).convertLinearToSRGB()},uGradingStrength:{value:.28},uGradingContrast:{value:.31},uGamma:{value:.84},uSaturation:{value:.26},uBrightness:{value:0},uContrast:{value:0},uVignetteEnabled:{value:1},uVignetteOffset:{value:1.15},uVignetteDarkness:{value:.08},uVignetteColor:{value:new O(`#1a1829`).convertLinearToSRGB()},uFilmGrainEnabled:{value:0},uFilmGrainStrength:{value:.035},uFilmGrainSpeed:{value:1},uSharpenEnabled:{value:1},uSharpenAmount:{value:.22},uFisheyeEnabled:{value:0},uFisheyeStrength:{value:.5},uFisheyeZoom:{value:1},uFisheyeCircular:{value:0}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
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
  `},jt={name:`GodRaysShader`,uniforms:{tDiffuse:{value:null},tMask:{value:null},uUseMask:{value:0},uSunPosition:{value:new C(.5,.5)},uSunVisibility:{value:1},uExposure:{value:.35},uDecay:{value:.94},uDensity:{value:.85},uWeight:{value:.4},uRayColor:{value:new O(`#fff2db`)},uClampMax:{value:1},uTime:{value:0},uShimmer:{value:.5}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tMask;
    uniform float uUseMask;
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
          // キャラの画素は光源にしない（光をさえぎる）
          if (uUseMask > 0.5 && texture2D(tMask, coord).r < 0.99999) {
            sampleLight = vec3(0.0);
          }

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
  `},Mt=class{caches=new WeakMap;intersectObjects(e,t){let n=[],r=new Set;try{for(let e of t){let t=e;if(!t.isSkinnedMesh||r.has(t))continue;r.add(t);let i=t.geometry.attributes.position.count,a=this.caches.get(t);(!a||a.valid.length!==i)&&(a={positions:new Float64Array(i*3),valid:new Uint8Array(i)},this.caches.set(t,a)),a.valid.fill(0);let{positions:o,valid:s}=a,c=t.getVertexPosition,l=Object.getOwnPropertyDescriptor(t,`getVertexPosition`);n.push(()=>{l?Object.defineProperty(t,`getVertexPosition`,l):Reflect.deleteProperty(t,`getVertexPosition`)}),t.getVertexPosition=function(e,t){let n=e*3;if(s[e])return t.fromArray(o,n);let r=c.call(this,e,t);return r.toArray(o,n),s[e]=1,r}}return e.intersectObjects(t,!1)}finally{for(let e of n)e()}}};function Nt(){let e=document.createElement(`canvas`);e.width=512,e.height=512;let t=e.getContext(`2d`),n=t.createRadialGradient(512/2,512/2,0,512/2,512/2,512/2);n.addColorStop(0,`rgba(255, 255, 255, 1.0)`),n.addColorStop(.1,`rgba(255, 250, 230, 0.95)`),n.addColorStop(.3,`rgba(255, 220, 150, 0.6)`),n.addColorStop(.6,`rgba(255, 180, 80, 0.15)`),n.addColorStop(1,`rgba(255, 150, 50, 0.0)`),t.fillStyle=n,t.fillRect(0,0,512,512);let r=new R(e);return r.colorSpace=E,r}function Pt(){let e=document.createElement(`canvas`);e.width=512,e.height=512;let t=e.getContext(`2d`);t.save(),t.translate(256,256);for(let e=0;e<6;e++){t.rotate(Math.PI*2/6);let e=t.createLinearGradient(0,0,256,0);e.addColorStop(0,`rgba(255, 255, 255, 0.9)`),e.addColorStop(.2,`rgba(255, 245, 200, 0.6)`),e.addColorStop(.7,`rgba(255, 200, 100, 0.15)`),e.addColorStop(1,`rgba(255, 180, 50, 0.0)`),t.fillStyle=e,t.beginPath(),t.moveTo(0,-3),t.lineTo(256*.95,0),t.lineTo(0,3),t.closePath(),t.fill(),t.beginPath(),t.moveTo(0,-3),t.lineTo(-256*.95,0),t.lineTo(0,3),t.closePath(),t.fill()}let n=t.createRadialGradient(0,0,0,0,0,256*.35);n.addColorStop(0,`rgba(255, 255, 255, 1.0)`),n.addColorStop(.4,`rgba(255, 235, 180, 0.6)`),n.addColorStop(1,`rgba(255, 200, 100, 0.0)`),t.fillStyle=n,t.beginPath(),t.arc(0,0,256*.35,0,Math.PI*2),t.fill(),t.restore();let r=new R(e);return r.colorSpace=E,r}function Ft(){let e=1024,t=document.createElement(`canvas`);t.width=e,t.height=128;let n=t.getContext(`2d`);e/2;let r=n.createRadialGradient(512,64,0,512,64,e/2);r.addColorStop(0,`rgba(255, 255, 255, 1.0)`),r.addColorStop(.15,`rgba(200, 230, 255, 0.7)`),r.addColorStop(.5,`rgba(160, 200, 255, 0.3)`),r.addColorStop(1,`rgba(100, 160, 255, 0.0)`),n.fillStyle=r,n.fillRect(0,0,e,128);let i=new R(t);return i.colorSpace=E,i}function It(){let e=document.createElement(`canvas`);e.width=512,e.height=512;let t=e.getContext(`2d`),n=512*.38,r=t.createRadialGradient(256,256,n-20,256,256,n+20);r.addColorStop(0,`rgba(255, 255, 255, 0.0)`),r.addColorStop(.3,`rgba(255, 180, 150, 0.25)`),r.addColorStop(.5,`rgba(255, 240, 200, 0.55)`),r.addColorStop(.7,`rgba(160, 220, 255, 0.35)`),r.addColorStop(1,`rgba(120, 180, 255, 0.0)`),t.fillStyle=r,t.fillRect(0,0,512,512);let i=new R(e);return i.colorSpace=E,i}function Lt(e=!1){let t=document.createElement(`canvas`);t.width=256,t.height=256;let n=t.getContext(`2d`),r=256*.42;if(e){n.save(),n.translate(128,128),n.beginPath();for(let e=0;e<6;e++){let t=e*Math.PI/3,i=r*Math.cos(t),a=r*Math.sin(t);e===0?n.moveTo(i,a):n.lineTo(i,a)}n.closePath();let e=n.createRadialGradient(0,0,0,0,0,r);e.addColorStop(0,`rgba(255, 240, 200, 0.1)`),e.addColorStop(.7,`rgba(200, 230, 255, 0.35)`),e.addColorStop(.95,`rgba(160, 200, 255, 0.6)`),e.addColorStop(1,`rgba(120, 180, 255, 0.0)`),n.fillStyle=e,n.fill(),n.restore()}else{let e=n.createRadialGradient(128,128,0,128,128,r);e.addColorStop(0,`rgba(255, 255, 255, 0.5)`),e.addColorStop(.6,`rgba(255, 220, 180, 0.3)`),e.addColorStop(.9,`rgba(180, 210, 255, 0.4)`),e.addColorStop(1,`rgba(150, 180, 255, 0.0)`),n.fillStyle=e,n.fillRect(0,0,256,256)}let i=new R(t);return i.colorSpace=E,i}var Rt=class{scene;sunGroup;flareGroup;sunCoronaSprite;sunCoronaMat;starburstSprite;starburstMat;streakSprite;streakMat;haloSprite;haloMat;ghosts=[];sunWorldPosition=new k;sunScreenPosition=new C(.5,.5);sunVisibility=1;currentOcclusion=0;raycaster=new ie;occlusionRaycaster=new Mt;constructor(e){this.scene=e,this.sunGroup=new S,this.sunGroup.name=`SunEffectGroup`,this.flareGroup=new S,this.flareGroup.name=`LensFlareGroup`,this.sunCoronaMat=new p({map:Nt(),color:16774635,transparent:!0,blending:2,depthWrite:!1,depthTest:!1}),this.sunCoronaSprite=new Te(this.sunCoronaMat),this.sunCoronaSprite.renderOrder=9990,this.sunCoronaSprite.scale.set(6,6,1),this.sunGroup.add(this.sunCoronaSprite),this.starburstMat=new p({map:Pt(),color:16773341,transparent:!0,blending:2,depthWrite:!1,depthTest:!1}),this.starburstSprite=new Te(this.starburstMat),this.starburstSprite.renderOrder=9991,this.starburstSprite.scale.set(9,9,1),this.sunGroup.add(this.starburstSprite),this.streakMat=new p({map:Ft(),color:16777215,transparent:!0,blending:2,depthWrite:!1,depthTest:!1}),this.streakSprite=new Te(this.streakMat),this.streakSprite.renderOrder=9992,this.streakSprite.scale.set(24,2,1),this.sunGroup.add(this.streakSprite),this.haloMat=new p({map:It(),color:16773856,transparent:!0,blending:2,depthWrite:!1,depthTest:!1}),this.haloSprite=new Te(this.haloMat),this.haloSprite.renderOrder=9995,this.haloSprite.scale.set(8,8,1),this.flareGroup.add(this.haloSprite);let t=Lt(!1),n=Lt(!0),r=[{tex:n,offset:.6,scale:2.2,opacity:.35,color:9491967},{tex:t,offset:.35,scale:1.4,opacity:.45,color:16765320},{tex:n,offset:.15,scale:.8,opacity:.3,color:11534272},{tex:t,offset:-.2,scale:1.8,opacity:.25,color:16752816},{tex:n,offset:-.45,scale:3,opacity:.2,color:7387391},{tex:t,offset:-.7,scale:1.2,opacity:.3,color:16767376}];for(let e of r){let t=new p({map:e.tex,color:e.color,transparent:!0,blending:2,depthWrite:!1,depthTest:!1}),n=new Te(t);n.renderOrder=9996,n.scale.set(e.scale,e.scale,1),this.flareGroup.add(n),this.ghosts.push({sprite:n,material:t,posOffset:e.offset,baseScale:e.scale,baseOpacity:e.opacity})}this.scene.add(this.sunGroup),this.scene.add(this.flareGroup)}update(e,t,n,r,i,a){let o=r.lighting.sunShafts,s=r.lighting.lensFlare;if(!(o.enabled||s.enabled))return this.sunGroup.visible=!1,this.flareGroup.visible=!1,this.sunVisibility=0,{sunScreenPosition:this.sunScreenPosition,sunVisibility:0,sunWorldPosition:this.sunWorldPosition};if(o.followDirectionalLight){let e=i.position.clone().normalize();this.sunWorldPosition.copy(e.multiplyScalar(8))}else this.sunWorldPosition.set(o.sunPosition.x,o.sunPosition.y,o.sunPosition.z);this.sunGroup.position.copy(this.sunWorldPosition);let c=new k;e.getWorldDirection(c);let l=this.sunWorldPosition.clone().sub(e.position).normalize(),u=c.dot(l)>0,d=this.sunWorldPosition.clone().project(e),f=(d.x+1)*.5,p=(d.y+1)*.5;this.sunScreenPosition.set(f,p);let m=0;if(u){let e=Math.sqrt(d.x*d.x+d.y*d.y);m=Math.max(.25,Math.min(1,(3.6-e)/2.2))}this.sunGroup.visible=s.enabled&&u&&m>.1,this.flareGroup.visible=s.enabled&&u&&m>.1;let h=0;if(u&&m>.01&&a&&a.length>0){let t=e.position.clone(),n=this.sunWorldPosition.clone().sub(t).normalize(),r=this.sunWorldPosition.distanceTo(t);this.raycaster.camera=e,this.raycaster.set(t,n),this.raycaster.far=r;let i=[];for(let e of a)e.traverse(e=>{e.isMesh&&!e.isSprite&&i.push(e)});this.occlusionRaycaster.intersectObjects(this.raycaster,i).length>0&&(h=.7)}this.currentOcclusion=j.damp(this.currentOcclusion,h,12,t),this.sunVisibility=u?m*(1-this.currentOcclusion):0;let g=new O(s.sunColor),_=s.sunSize;if(this.sunCoronaMat.color.copy(g),this.sunCoronaMat.opacity=s.glowIntensity*(.7+.3*this.sunVisibility),this.sunCoronaSprite.scale.set(3.8*_,3.8*_,1),this.starburstMat.color.copy(g),this.starburstMat.opacity=s.starburstIntensity*this.sunVisibility,this.starburstSprite.scale.set(5.5*_,5.5*_,1),this.starburstSprite.material.rotation=n*.04,this.streakMat.color.copy(g),this.streakMat.opacity=s.anamorphicIntensity*this.sunVisibility,this.streakSprite.scale.set(16*_,1.4*_,1),s.enabled&&u&&this.sunVisibility>.01){let t=new k;e.getWorldDirection(t);let n=e.position,r=1.6,i=new k(1,0,0).applyQuaternion(e.quaternion),a=new k(0,1,0).applyQuaternion(e.quaternion),o=d.x,c=d.y;r*.85;let l=n.clone().addScaledVector(t,1.36).addScaledVector(i,o*.3).addScaledVector(a,c*.3);this.haloSprite.position.copy(l),this.haloSprite.quaternion.copy(e.quaternion),this.haloMat.opacity=s.haloIntensity*this.sunVisibility*.85,this.haloSprite.scale.set(2.2*_,2.2*_,1);for(let l of this.ghosts){let u=n.clone().addScaledVector(t,r).addScaledVector(i,-o*l.posOffset*.65).addScaledVector(a,-c*l.posOffset*.65);l.sprite.position.copy(u),l.sprite.quaternion.copy(e.quaternion),l.material.opacity=l.baseOpacity*s.ghostIntensity*this.sunVisibility;let d=l.baseScale*.3*_;l.sprite.scale.set(d,d,1)}}else{this.haloMat.opacity=0;for(let e of this.ghosts)e.material.opacity=0}return{sunScreenPosition:this.sunScreenPosition,sunVisibility:this.sunVisibility,sunWorldPosition:this.sunWorldPosition}}dispose(){this.scene.remove(this.sunGroup),this.scene.remove(this.flareGroup),this.sunCoronaMat.dispose(),this.starburstMat.dispose(),this.streakMat.dispose(),this.haloMat.dispose();for(let e of this.ghosts)e.material.dispose()}};function zt(){let e=new A;return e.setAttribute(`position`,new ne([0,-.018,.001,-.009,-.006,.0025,-.014,.009,.004,-.008,.022,.002,0,.028,5e-4,.008,.022,.002,.014,.009,.004,.009,-.006,.0025,0,.006,-.002],3)),e.setIndex([0,1,8,1,2,8,2,3,8,3,4,8,4,5,8,5,6,8,6,7,8,7,0,8]),e.computeVertexNormals(),e}var Bt=class{group;petalMesh=null;sparkleMesh=null;petalMaterial;sparkleMaterial;particles=[];dummy=new pe;count=160;boxSize={x:4.5,y:3.2,z:4.5};boxCenter={x:0,y:1.3,z:0};constructor(e){this.group=new S,this.group.name=`WindParticlesGroup`,this.petalMaterial=new F({color:new O(`#ffe4eb`),transparent:!0,opacity:.85,side:2,depthWrite:!1}),this.sparkleMaterial=new F({color:new O(`#ffffff`),transparent:!0,opacity:.7,blending:2,depthWrite:!1}),this.rebuild(160),e.add(this.group)}rebuild(e){this.petalMesh&&=(this.group.remove(this.petalMesh),this.petalMesh.geometry.dispose(),null),this.sparkleMesh&&=(this.group.remove(this.sparkleMesh),this.sparkleMesh.geometry.dispose(),null),this.count=Math.max(10,Math.min(600,e));let t=Math.floor(this.count*.8),n=this.count-t;this.petalMesh=new oe(zt(),this.petalMaterial,t),this.petalMesh.instanceMatrix.setUsage(u),this.group.add(this.petalMesh),this.sparkleMesh=new oe(new ee(.008,4,4),this.sparkleMaterial,n),this.sparkleMesh.instanceMatrix.setUsage(u),this.group.add(this.sparkleMesh),this.particles=[];for(let e=0;e<this.count;e++)this.particles.push(this.createParticle(!0))}createParticle(e=!1){let t=this.boxCenter.x-this.boxSize.x*.5,n=this.boxCenter.x+this.boxSize.x*.5,r=this.boxCenter.y-this.boxSize.y*.5,i=this.boxCenter.y+this.boxSize.y*.5,a=this.boxCenter.z-this.boxSize.z*.5,o=this.boxCenter.z+this.boxSize.z*.5,s=2+Math.random()*2.5,c=e?Math.random()*s:0;return{position:new k(t+Math.random()*(n-t),r+Math.random()*(i-r),a+Math.random()*(o-a)),velocity:new k,life:c,maxLife:s,scale:.5+Math.random()*.7,rotX:Math.random()*Math.PI*2,rotY:Math.random()*Math.PI*2,rotZ:Math.random()*Math.PI*2,rotSpeedX:(Math.random()-.5)*4,rotSpeedY:(Math.random()-.5)*5,rotSpeedZ:(Math.random()-.5)*3.5,flutterPhase:Math.random()*Math.PI*2,flutterFreq:2+Math.random()*3,flutterAmp:.12+Math.random()*.18}}respawnWindward(e,t){e.life=0,e.maxLife=2+Math.random()*2.5,e.scale=.5+Math.random()*.7,e.rotX=Math.random()*Math.PI*2,e.rotY=Math.random()*Math.PI*2,e.rotZ=Math.random()*Math.PI*2,e.rotSpeedX=(Math.random()-.5)*4,e.rotSpeedY=(Math.random()-.5)*5,e.rotSpeedZ=(Math.random()-.5)*3.5;let n=this.boxSize.x*.5,r=this.boxSize.y*.5,i=this.boxSize.z*.5;e.position.set(this.boxCenter.x+(Math.random()-.5)*this.boxSize.x-t.x*n*.85,this.boxCenter.y+(Math.random()-.5)*this.boxSize.y-t.y*r*.85,this.boxCenter.z+(Math.random()-.5)*this.boxSize.z-t.z*i*.85)}update(e,t,n,r){let i=n.enabled&&n.particles.enabled&&r.lengthSq()>1e-4;if(this.group.visible=i,!i)return;n.particles.count!==this.count&&this.rebuild(n.particles.count),this.petalMaterial.color.set(n.particles.color),this.petalMaterial.opacity=n.particles.opacity*.9,this.sparkleMaterial.color.set(n.particles.color),this.sparkleMaterial.opacity=n.particles.opacity*.75;let a=r.length(),o=a>.001?r.clone().normalize():new k(1,0,0),s=n.particles.speedFactor*1.2,c=n.particles.size,l=Math.floor(this.count*.8),u=this.boxSize.x*.5,d=this.boxSize.y*.5,f=this.boxSize.z*.5,p=new k(0,1,0),m=new k().crossVectors(o,p).normalize();m.lengthSq()<.01&&m.set(1,0,0);for(let n=0;n<this.particles.length;n++){let i=this.particles[n];i.life+=e,i.life>=i.maxLife&&this.respawnWindward(i,o);let p=t*i.flutterFreq+i.flutterPhase,h=Math.sin(p)*i.flutterAmp,g=Math.cos(p*1.3)*(i.flutterAmp*.6)-.04;i.velocity.copy(r).multiplyScalar(s).addScaledVector(m,h).add(new k(0,g,0)),i.position.addScaledVector(i.velocity,e),(Math.abs(i.position.x-this.boxCenter.x)>u||Math.abs(i.position.y-this.boxCenter.y)>d||Math.abs(i.position.z-this.boxCenter.z)>f)&&this.respawnWindward(i,o);let _=i.life/i.maxLife,v=1;_<.15?v=_/.15:_>.75&&(v=(1-_)/.25),v=Math.max(0,Math.min(1,v));let y=i.scale*(c*25)*v*.45;if(this.dummy.position.copy(i.position),n<l){let t=1+a*.8;i.rotX+=i.rotSpeedX*t*e,i.rotY+=i.rotSpeedY*t*e,i.rotZ+=i.rotSpeedZ*t*e,this.dummy.rotation.set(i.rotX,i.rotY,i.rotZ),this.dummy.scale.set(y,y,y),this.dummy.updateMatrix(),this.petalMesh&&this.petalMesh.setMatrixAt(n,this.dummy.matrix)}else{let e=n-l;this.dummy.rotation.set(0,0,0);let t=y*.6;this.dummy.scale.set(t,t,t),this.dummy.updateMatrix(),this.sparkleMesh&&this.sparkleMesh.setMatrixAt(e,this.dummy.matrix)}}this.petalMesh&&(this.petalMesh.instanceMatrix.needsUpdate=!0),this.sparkleMesh&&(this.sparkleMesh.instanceMatrix.needsUpdate=!0)}dispose(){this.petalMesh&&(this.group.remove(this.petalMesh),this.petalMesh.geometry.dispose()),this.sparkleMesh&&(this.group.remove(this.sparkleMesh),this.sparkleMesh.geometry.dispose()),this.petalMaterial.dispose(),this.sparkleMaterial.dispose()}},Vt=class{scene;camera;controls;domElement;textureLoader=new ae;currentTexture=null;isActive=!1;sensitivity=.003;invertDrag=!1;idleMotionEnabled=!0;lerpFactor=.12;cameraY=1.1;targetYaw=0;targetPitch=0;currentYaw=0;currentPitch=0;targetFov=60;currentFov=60;maxPitch=j.degToRad(80);minFov=35;maxFov=80;isDragging=!1;previousPointerX=0;previousPointerY=0;activePointerId=null;lastUserInteractionTime=0;activeTouchPointers=new Map;initialPinchDistance=0;initialPinchFov=60;isAnimating=!1;animStartTime=0;animDuration=0;animStartYaw=0;animStartPitch=0;animStartFov=60;animTargetYaw=0;animTargetPitch=0;animTargetFov=60;animOnComplete=null;savedCameraPosition=new k;savedCameraRotation=new he;savedCameraFov=60;savedControlsEnabled=!0;savedBackground=null;onStateChange;isCameraControlEnabled=!0;constructor(e){this.scene=e.scene,this.camera=e.camera,this.controls=e.controls,this.domElement=e.domElement,this.onStateChange=e.onStateChange,this.bindEvents()}setCameraControlEnabled(e){this.isCameraControlEnabled=e,e||(this.isDragging=!1,this.activeTouchPointers.clear(),this.activePointerId=null)}get cameraControlEnabled(){return this.isCameraControlEnabled}bindEvents(){this.onPointerDown=this.onPointerDown.bind(this),this.onPointerMove=this.onPointerMove.bind(this),this.onPointerUp=this.onPointerUp.bind(this),this.onPointerCancel=this.onPointerCancel.bind(this),this.onWheel=this.onWheel.bind(this),this.domElement.addEventListener(`pointerdown`,this.onPointerDown),this.domElement.addEventListener(`pointermove`,this.onPointerMove),this.domElement.addEventListener(`pointerup`,this.onPointerUp),this.domElement.addEventListener(`pointercancel`,this.onPointerCancel),this.domElement.addEventListener(`wheel`,this.onWheel,{passive:!1})}unbindEvents(){this.domElement.removeEventListener(`pointerdown`,this.onPointerDown),this.domElement.removeEventListener(`pointermove`,this.onPointerMove),this.domElement.removeEventListener(`pointerup`,this.onPointerUp),this.domElement.removeEventListener(`pointercancel`,this.onPointerCancel),this.domElement.removeEventListener(`wheel`,this.onWheel)}async load(e){let t=await this.textureLoader.loadAsync(e.imageUrl);return t.colorSpace=E,t.mapping=303,this.activate(t,e),t}activate(e,t){this.isActive||(this.savedCameraPosition.copy(this.camera.position),this.savedCameraRotation.copy(this.camera.rotation),this.savedCameraFov=this.camera.fov,this.savedControlsEnabled=this.controls.enabled,this.savedBackground=this.scene.background,this.controls.enabled=!1,this.camera.position.set(0,this.cameraY,0)),this.currentTexture&&this.currentTexture!==e&&this.currentTexture.dispose(),this.currentTexture=e,this.scene.background=e;let n=t?.initialYaw??0,r=t?.initialPitch??0,i=t?.initialFov??60;this.targetYaw=n,this.currentYaw=n,this.targetPitch=j.clamp(r,-this.maxPitch,this.maxPitch),this.currentPitch=this.targetPitch,this.targetFov=j.clamp(i,this.minFov,this.maxFov),this.currentFov=this.targetFov,this.camera.fov=this.currentFov,this.camera.rotation.order=`YXZ`,this.camera.rotation.y=this.currentYaw,this.camera.rotation.x=this.currentPitch,this.camera.rotation.z=0,this.camera.updateProjectionMatrix(),this.isActive=!0,this.lastUserInteractionTime=performance.now(),this.onStateChange?.(!0)}deactivate(){this.isActive&&(this.isActive=!1,this.isDragging=!1,this.isAnimating=!1,this.activeTouchPointers.clear(),this.currentTexture&&=(this.currentTexture.dispose(),null),this.scene.background=this.savedBackground,this.camera.position.copy(this.savedCameraPosition),this.camera.rotation.copy(this.savedCameraRotation),this.camera.fov=this.savedCameraFov,this.camera.updateProjectionMatrix(),this.controls.enabled=this.savedControlsEnabled,this.onStateChange?.(!1))}lookAt(e){return new Promise(t=>{this.isAnimating=!0,this.animStartTime=performance.now(),this.animDuration=e.duration??1e3,this.animStartYaw=this.currentYaw,this.animStartPitch=this.currentPitch,this.animStartFov=this.currentFov,this.animTargetYaw=e.yaw,this.animTargetPitch=j.clamp(e.pitch??this.currentPitch,-this.maxPitch,this.maxPitch),this.animTargetFov=j.clamp(e.fov??this.currentFov,this.minFov,this.maxFov),this.animOnComplete=()=>{this.isAnimating=!1,e.onComplete?.(),t()}})}async playDemoAnimation(){if(!this.isActive)return;let e=this.targetYaw;await this.lookAt({yaw:e,pitch:0,fov:60,duration:800}),this.isActive&&(await this.lookAt({yaw:e-j.degToRad(80),pitch:j.degToRad(5),fov:55,duration:1500}),this.isActive&&(await new Promise(e=>setTimeout(e,800)),this.isActive&&await this.lookAt({yaw:e,pitch:0,fov:60,duration:1200})))}resetView(e=0,t=0,n=60){this.targetYaw=e,this.targetPitch=j.clamp(t,-this.maxPitch,this.maxPitch),this.targetFov=j.clamp(n,this.minFov,this.maxFov),this.currentYaw=this.targetYaw,this.currentPitch=this.targetPitch,this.currentFov=this.targetFov,this.camera.fov=this.currentFov,this.camera.updateProjectionMatrix()}onPointerDown(e){if(!(!this.isActive||!this.isCameraControlEnabled)){if(this.activeTouchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.activeTouchPointers.size===1){this.isDragging=!0,this.activePointerId=e.pointerId,this.previousPointerX=e.clientX,this.previousPointerY=e.clientY,this.isAnimating=!1,this.lastUserInteractionTime=performance.now();try{this.domElement.setPointerCapture(e.pointerId)}catch{}}else if(this.activeTouchPointers.size===2){this.isDragging=!1;let e=Array.from(this.activeTouchPointers.values()),t=e[0].x-e[1].x,n=e[0].y-e[1].y;this.initialPinchDistance=Math.hypot(t,n),this.initialPinchFov=this.targetFov}}}onPointerMove(e){if(!this.isActive||!this.isCameraControlEnabled)return;if(this.activeTouchPointers.has(e.pointerId)&&this.activeTouchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.activeTouchPointers.size===2){let e=Array.from(this.activeTouchPointers.values()),t=e[0].x-e[1].x,n=e[0].y-e[1].y,r=Math.hypot(t,n);if(this.initialPinchDistance>0){let e=r/this.initialPinchDistance,t=this.initialPinchFov/e;this.targetFov=j.clamp(t,this.minFov,this.maxFov)}this.lastUserInteractionTime=performance.now();return}if(!this.isDragging||e.pointerId!==this.activePointerId)return;let t=e.clientX-this.previousPointerX,n=e.clientY-this.previousPointerY;this.previousPointerX=e.clientX,this.previousPointerY=e.clientY;let r=this.invertDrag?1:-1;this.targetYaw+=r*t*this.sensitivity,this.targetPitch+=r*n*this.sensitivity,this.targetPitch=j.clamp(this.targetPitch,-this.maxPitch,this.maxPitch),this.lastUserInteractionTime=performance.now()}onPointerUp(e){if(!(!this.isActive||!this.isCameraControlEnabled)){if(this.activeTouchPointers.delete(e.pointerId),this.activePointerId===e.pointerId){this.isDragging=!1,this.activePointerId=null;try{this.domElement.releasePointerCapture(e.pointerId)}catch{}}if(this.activeTouchPointers.size===1){let e=Array.from(this.activeTouchPointers.keys())[0],t=this.activeTouchPointers.get(e);this.activePointerId=e,this.previousPointerX=t.x,this.previousPointerY=t.y,this.isDragging=!0}this.lastUserInteractionTime=performance.now()}}onPointerCancel(e){this.onPointerUp(e)}onWheel(e){!this.isActive||!this.isCameraControlEnabled||(e.preventDefault(),this.targetFov+=e.deltaY*.02,this.targetFov=j.clamp(this.targetFov,this.minFov,this.maxFov),this.lastUserInteractionTime=performance.now())}update(e,t){if(!this.isActive||!this.isCameraControlEnabled)return;if(this.isAnimating){let e=performance.now(),t=Math.min(1,(e-this.animStartTime)/Math.max(1,this.animDuration)),n=t<.5?4*t*t*t:1-(-2*t+2)**3/2;if(this.currentYaw=j.lerp(this.animStartYaw,this.animTargetYaw,n),this.currentPitch=j.lerp(this.animStartPitch,this.animTargetPitch,n),this.currentFov=j.lerp(this.animStartFov,this.animTargetFov,n),this.targetYaw=this.currentYaw,this.targetPitch=this.currentPitch,this.targetFov=this.currentFov,t>=1){let e=this.animOnComplete;this.animOnComplete=null,this.isAnimating=!1,e?.()}}else this.currentYaw=j.lerp(this.currentYaw,this.targetYaw,this.lerpFactor),this.currentPitch=j.lerp(this.currentPitch,this.targetPitch,this.lerpFactor),this.currentFov=j.lerp(this.currentFov,this.targetFov,this.lerpFactor);let n=0,r=0,i=(performance.now()-this.lastUserInteractionTime)/1e3;if(this.idleMotionEnabled&&!this.isDragging&&!this.isAnimating&&i>.5){let e=Math.min(1,(i-.5)*1.5);n=Math.sin(t*.25)*j.degToRad(.2)*e,r=Math.sin(t*.17)*j.degToRad(.12)*e}this.camera.position.set(0,this.cameraY,0),this.camera.rotation.order=`YXZ`,this.camera.rotation.y=this.currentYaw+n,this.camera.rotation.x=this.currentPitch+r,this.camera.rotation.z=0,Math.abs(this.camera.fov-this.currentFov)>.01&&(this.camera.fov=this.currentFov,this.camera.updateProjectionMatrix())}dispose(){this.unbindEvents(),this.currentTexture&&=(this.currentTexture.dispose(),null)}};function Ht(e){switch(e){case`Linear`:return 1;case`Reinhard`:return 2;case`Cineon`:return 3;case`ACESFilmic`:return 4;case`AgX`:return 6;case`Neutral`:return 7;default:return 0}}function Ut(){let e=document.getElementById(`viewport-wrapper`),t=window.innerWidth,n=window.innerHeight;if(e){let r=e.getBoundingClientRect();r.width>0&&r.height>0&&(t=r.width,n=r.height)}let r=n>t,i=!r&&n<=520;if(r){let e=Math.min(210,Math.max(140,Math.floor(n*.24))),r=Math.floor(t);return{width:r,height:Math.max(100,Math.floor(n-e)),containerWidth:r,containerHeight:Math.floor(n),isPortrait:!0,isLandscapeMobile:!1,messageHeight:e}}let a=16/9,o=t/n,s,c;return o>a?(c=Math.floor(n),s=Math.floor(c*a)):(s=Math.floor(t),c=Math.floor(s/a)),{width:s,height:c,containerWidth:s,containerHeight:c,isPortrait:!1,isLandscapeMobile:i,messageHeight:0}}function Wt(e,t){let n=t.postProcessing,r=n.cinematic;e.uniforms.uChromaticAberrationEnabled.value=r?.chromaticAberration?.enabled??!1?1:0,e.uniforms.uChromaticAberrationOffset.value=r?.chromaticAberration?.offset??.0015,e.uniforms.uDiffusionEnabled.value=r?.diffusion?.enabled??!1?1:0,e.uniforms.uDiffusionStrength.value=r?.diffusion?.strength??.25,e.uniforms.uDiffusionRadius.value=r?.diffusion?.radius??1.8,n.colorGrading&&(e.uniforms.uColorGradingEnabled.value=n.colorGrading.enabled?1:0,e.uniforms.uShadowTint.value.set(n.colorGrading.shadowTint).convertLinearToSRGB(),e.uniforms.uHighlightTint.value.set(n.colorGrading.highlightTint).convertLinearToSRGB(),e.uniforms.uGradingStrength.value=n.colorGrading.strength,e.uniforms.uGradingContrast.value=n.colorGrading.contrast,e.uniforms.uGamma.value=n.colorGrading.gamma),e.uniforms.uSaturation.value=n.saturation,e.uniforms.uBrightness.value=n.brightness,e.uniforms.uContrast.value=n.contrast,e.uniforms.uVignetteEnabled.value=r?.vignette?.enabled??!1?1:0,e.uniforms.uVignetteOffset.value=r?.vignette?.offset??1.1,e.uniforms.uVignetteDarkness.value=r?.vignette?.darkness??.35,r?.vignette?.color&&e.uniforms.uVignetteColor.value.set(r.vignette.color).convertLinearToSRGB(),e.uniforms.uFilmGrainEnabled.value=r?.filmGrain?.enabled??!1?1:0,e.uniforms.uFilmGrainStrength.value=r?.filmGrain?.strength??.035,e.uniforms.uFilmGrainSpeed.value=r?.filmGrain?.speed??1,e.uniforms.uSharpenEnabled.value=r?.sharpening?.enabled??!1?1:0,e.uniforms.uSharpenAmount.value=r?.sharpening?.amount??.22,e.uniforms.uFisheyeEnabled.value=r?.fisheye?.enabled??!1?1:0,e.uniforms.uFisheyeStrength.value=r?.fisheye?.strength??.5,e.uniforms.uFisheyeZoom.value=r?.fisheye?.zoom??1,e.uniforms.uFisheyeCircular.value=r?.fisheye?.circular??!1?1:0}var Gt=class{canvas;renderer;scene;camera;controls;effectTextScene;sharedEffectTextManager;skyBackground;backgroundRequest=0;panoramaController;windParticles;rainEffect;ambientLight;dirLight;rimLight;sunEffect;floorGeo;floorMat;floor;composer;renderPass;bloomPass;godRaysPass;cinematicAnimePass;smaaPass;hairShadow;characterMask;lightWrapPass;paraPass;stats;perfBadge;isPerformanceMonitorVisible=!1;textureLoader=new ae;backgroundTextureCache=new Map;midgroundTextureCache=new Map;neargroundTextureCache=new Map;midgroundMat;midgroundMesh;neargroundMat;neargroundMesh;initialControlsTarget;framingAnimationId=null;constructor(t,n){this.canvas=t;let i=Ut(),o=document.getElementById(`viewport-container`);o&&(o.style.width=`${i.width}px`,o.style.height=`${i.height}px`),this.renderer=new _e({canvas:this.canvas,antialias:!1,alpha:!0,powerPreference:`high-performance`,preserveDrawingBuffer:!0}),this.renderer.setSize(i.width,i.height,!0),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.toneMapping=Ht(n.postProcessing.toneMappingMode),this.renderer.toneMappingExposure=n.postProcessing.toneMappingExposure,this.renderer.shadowMap.enabled=n.lighting.castShadows,this.renderer.shadowMap.type=1,this.stats=new kt,this.stats.showPanel(0),this.stats.dom.id=`stats-panel`,this.stats.dom.style.position=`absolute`,this.stats.dom.style.top=`10px`,this.stats.dom.style.left=`10px`,this.stats.dom.style.zIndex=`100`,this.stats.dom.style.display=`none`,document.body.appendChild(this.stats.dom),this.perfBadge=document.createElement(`div`),this.perfBadge.id=`perf-badge`,this.perfBadge.style.position=`absolute`,this.perfBadge.style.top=`62px`,this.perfBadge.style.left=`10px`,this.perfBadge.style.padding=`4px 8px`,this.perfBadge.style.backgroundColor=`rgba(15, 23, 42, 0.75)`,this.perfBadge.style.backdropFilter=`blur(4px)`,this.perfBadge.style.color=`#94a3b8`,this.perfBadge.style.fontFamily=`monospace`,this.perfBadge.style.fontSize=`11px`,this.perfBadge.style.borderRadius=`4px`,this.perfBadge.style.pointerEvents=`none`,this.perfBadge.style.zIndex=`100`,this.perfBadge.style.display=`none`,this.perfBadge.textContent=`Calls: 0 | Tris: 0`,document.body.appendChild(this.perfBadge),this.scene=new d,this.skyBackground=new Me(this.scene),this.effectTextScene=new d,this.sharedEffectTextManager=new Ee(this.effectTextScene),this.windParticles=new Bt(this.scene),this.rainEffect=new Ke(this.scene,n.rain),this.midgroundMat=new F({transparent:!0,opacity:1,depthWrite:!1,depthTest:!0,side:2}),this.midgroundMesh=new L(new P(16/9,1),this.midgroundMat),this.midgroundMesh.renderOrder=-1,this.midgroundMesh.visible=!1,this.scene.add(this.midgroundMesh),this.neargroundMat=new F({transparent:!0,opacity:1,depthWrite:!1,depthTest:!0,side:2}),this.neargroundMesh=new L(new P(16/9,1),this.neargroundMat),this.neargroundMesh.renderOrder=2,this.neargroundMesh.visible=!1,this.scene.add(this.neargroundMesh),this.initialControlsTarget=new k(Xe.camera.target.x,Xe.camera.target.y,Xe.camera.target.z),this.camera=new be(n.camera.fov,16/9,.05,100),this.camera.position.set(n.camera.position.x,n.camera.position.y,n.camera.position.z),this.controls=new je(this.camera,this.canvas),this.controls.target.set(n.camera.target.x,n.camera.target.y,n.camera.target.z),this.controls.enableDamping=!0,this.controls.dampingFactor=.05,this.controls.screenSpacePanning=!0,this.controls.minDistance=.1,this.controls.maxDistance=10,this.controls.maxPolarAngle=Math.PI/2+.1,this.camera.lookAt(this.controls.target),this.controls.update(),this.panoramaController=new Vt({scene:this.scene,camera:this.camera,controls:this.controls,domElement:this.canvas,onStateChange:e=>{e?(this.backgroundRequest++,this.skyBackground.mesh.visible=!1,this.floor.visible=!1,this.midgroundMesh.visible=!1,this.neargroundMesh.visible=!1):(this.updateBackgroundDisplay(n),this.floor.visible=n.environment.showFloor,this.updateMidgroundDisplay(n),this.updateNeargroundDisplay(n))}}),this.ambientLight=new Se(n.lighting.ambient.color,n.lighting.ambient.intensity),this.scene.add(this.ambientLight),this.dirLight=new ge(n.lighting.directional.color,n.lighting.directional.intensity),this.dirLight.position.set(n.lighting.directional.posX,n.lighting.directional.posY,n.lighting.directional.posZ),this.scene.add(this.dirLight),this.rimLight=new ge(n.lighting.rim.color,n.lighting.rim.intensity),this.rimLight.position.set(n.lighting.rim.posX,n.lighting.rim.posY,n.lighting.rim.posZ),this.scene.add(this.rimLight),this.sunEffect=new Rt(this.scene),this.floorGeo=new P(10,10),this.floorMat=new xe({color:n.environment.floorColor,roughness:.8}),this.floor=new L(this.floorGeo,this.floorMat),this.floor.rotation.x=-Math.PI/2,this.floor.position.y=0,this.floor.receiveShadow=!0,this.floor.visible=n.environment.showFloor,this.scene.add(this.floor);let c=Math.min(window.devicePixelRatio,2),l=new D(window.innerWidth*c,window.innerHeight*c,{type:T,format:re,samples:n.postProcessing.antialiasing.msaaSamples});this.composer=new yt(this.renderer,l),this.composer.setPixelRatio(c),this.renderPass=new bt(this.scene,this.camera),this.composer.addPass(this.renderPass),this.characterMask=new a(Math.floor(window.innerWidth*c),Math.floor(window.innerHeight*c)),this.lightWrapPass=new gt(e),this.lightWrapPass.uniforms.uResolution.value.set(window.innerWidth*c,window.innerHeight*c),this.lightWrapPass.uniforms.tMask.value=this.characterMask.texture,n.lightWrap&&r(this.lightWrapPass.uniforms,n.lightWrap),this.composer.addPass(this.lightWrapPass),this.bloomPass=new St(new C(window.innerWidth*c,window.innerHeight*c),n.postProcessing.bloom.strength,n.postProcessing.bloom.radius,n.postProcessing.bloom.threshold),this.composer.addPass(this.bloomPass),this.godRaysPass=new gt(jt),this.godRaysPass.uniforms.uExposure.value=n.lighting.sunShafts?.enabled?n.lighting.sunShafts.exposure:0,this.godRaysPass.uniforms.uDecay.value=n.lighting.sunShafts?.decay??.94,this.godRaysPass.uniforms.uDensity.value=n.lighting.sunShafts?.density??.85,this.godRaysPass.uniforms.uWeight.value=n.lighting.sunShafts?.weight??.4,this.godRaysPass.uniforms.uRayColor.value.set(n.lighting.sunShafts?.color??`#fff2db`),this.godRaysPass.uniforms.uShimmer.value=n.lighting.sunShafts?.shimmer??.4,this.godRaysPass.uniforms.tMask.value=this.characterMask.texture,this.godRaysPass.uniforms.uUseMask.value=1,this.composer.addPass(this.godRaysPass),this.composer.addPass(new wt),this.paraPass=new gt(Je),this.paraPass.uniforms.tMask.value=this.characterMask.texture,n.postProcessing.para&&Ye(this.paraPass.uniforms,n.postProcessing.para),this.composer.addPass(this.paraPass),this.cinematicAnimePass=new gt(At),this.cinematicAnimePass.uniforms.uResolution.value.set(window.innerWidth*c,window.innerHeight*c),Wt(this.cinematicAnimePass,n),this.composer.addPass(this.cinematicAnimePass),this.smaaPass=new Ot,this.smaaPass.enabled=n.postProcessing.antialiasing.smaa,this.composer.addPass(this.smaaPass),this.hairShadow=new s(Math.floor(window.innerWidth*c),Math.floor(window.innerHeight*c),n.hairShadow),this.lightWrapPass.uniforms.tHair.value=this.hairShadow.depthTexture,this.hairShadow.setEnabled(n.hairShadow?.enabled??!0),window.addEventListener(`resize`,()=>this.onResize());let u=document.getElementById(`viewport-wrapper`);u&&typeof ResizeObserver<`u`&&new ResizeObserver(()=>{this.onResize()}).observe(u),this.onResize()}loadAtmosphericBackground(e,t,n,r){let i=`${e}_fog_${t}_${n}_${r.toFixed(2)}`;return this.backgroundTextureCache.has(i)?Promise.resolve(this.backgroundTextureCache.get(i)):!t||r<=0?this.textureLoader.loadAsync(e).then(e=>(e.colorSpace=E,this.backgroundTextureCache.set(i,e),e)):new Promise(t=>{let a=new Image;!e.startsWith(`blob:`)&&!e.startsWith(`data:`)&&(a.crossOrigin=`anonymous`),a.onload=()=>{let o=document.createElement(`canvas`);o.width=a.naturalWidth||a.width,o.height=a.naturalHeight||a.height;let s=o.getContext(`2d`);if(!s){let n=this.textureLoader.load(e);n.colorSpace=E,this.backgroundTextureCache.set(i,n),t(n);return}s.drawImage(a,0,0);let c=s.createLinearGradient(0,0,0,o.height),l=new O(n),u=Math.round(l.r*255),d=Math.round(l.g*255),f=Math.round(l.b*255);c.addColorStop(0,`rgba(${u}, ${d}, ${f}, ${(r*.25).toFixed(3)})`),c.addColorStop(.35,`rgba(${u}, ${d}, ${f}, ${(r*.55).toFixed(3)})`),c.addColorStop(.65,`rgba(${u}, ${d}, ${f}, ${(r*1).toFixed(3)})`),c.addColorStop(1,`rgba(${u}, ${d}, ${f}, ${(r*.8).toFixed(3)})`),s.globalCompositeOperation=`source-atop`,s.fillStyle=c,s.fillRect(0,0,o.width,o.height);let p=new R(o);p.colorSpace=E,p.needsUpdate=!0,this.backgroundTextureCache.set(i,p),t(p)},a.onerror=()=>{let n=this.textureLoader.load(e);n.colorSpace=E,this.backgroundTextureCache.set(i,n),t(n)},a.src=e})}hideSkyBackground(){this.backgroundRequest++,this.skyBackground.mesh.visible=!1}updateBackgroundDisplay(e){if(this.panoramaController?.isActive)return;let t=++this.backgroundRequest;this.skyBackground.mesh.visible=!1;let n=document.getElementById(`viewport-container`),r=e.environment.backgroundImageUrl;if(e.environment.showBackgroundImage&&r){let i=/(?:^|\/)cafe_far\.(?:avif|png)(?:[?#]|$)/.test(r);this.skyBackground.setTimeOfDay(e.activeScene?.timeOfDay),this.skyBackground.material.uniforms.uInteriorShadowStrength.value=i?.34:0,this.skyBackground.material.uniforms.uExposure.value=e.environment.backgroundExposure??1,n&&(n.style.backgroundColor=`#000000`),this.loadAtmosphericBackground(r,e.environment.farFogEnabled!==!1,e.environment.farFogColor||`#ffffff`,e.environment.farFogIntensity??.24).then(e=>{t!==this.backgroundRequest||this.panoramaController?.isActive||(this.skyBackground.material.uniforms.uPainting.value=e,this.skyBackground.mesh.visible=!0,this.scene.background=null)}).catch(n=>{console.error(`Failed to load background`,n),t===this.backgroundRequest&&(this.scene.background=new O(e.environment.backgroundColor))})}else this.scene.background=new O(e.environment.backgroundColor),n&&(n.style.backgroundColor=e.environment.backgroundColor)}loadTransparentKeyedTexture(e,t=238,n=18){return this.midgroundTextureCache.has(e)?Promise.resolve(this.midgroundTextureCache.get(e)):new Promise((r,i)=>{let a=new Image;!e.startsWith(`blob:`)&&!e.startsWith(`data:`)&&(a.crossOrigin=`anonymous`),a.onload=()=>{let i=document.createElement(`canvas`);i.width=a.width,i.height=a.height;let o=i.getContext(`2d`);if(!o){r(new x(a));return}o.drawImage(a,0,0);let s=o.getImageData(0,0,i.width,i.height),c=s.data,l=!1;for(let e=3;e<c.length;e+=4)if(c[e]<250){l=!0;break}if(!l){for(let e=0;e<c.length;e+=4){let r=c[e],i=c[e+1],a=c[e+2],o=Math.min(r,i,a);if(o>=t)c[e+3]=0;else if(o>t-n){let r=(t-o)/n;c[e+3]=Math.round(c[e+3]*r)}}o.putImageData(s,0,0)}let u=new R(i);u.colorSpace=E,u.needsUpdate=!0,this.midgroundTextureCache.set(e,u),r(u)},a.onerror=e=>i(e),a.src=e})}updateBackgroundZoom(e){if(this.panoramaController?.isActive||(this.skyBackground.setTransform(e),!this.scene.background||!(this.scene.background instanceof x)))return;let t=this.scene.background;if(e){t.wrapS!==1e3&&(t.wrapS=v,t.needsUpdate=!0);let n=1/Math.max(1,e.zoomScale);t.center.set(.5,.5),t.repeat.set(n,n),t.offset.set((1-n)*.5-e.panOffsetX,(1-n)*.5-e.panOffsetY)}else (t.repeat.x!==1||t.repeat.y!==1||t.offset.x!==0||t.offset.y!==0)&&(t.center.set(0,0),t.repeat.set(1,1),t.offset.set(0,0))}updateMidgroundTransform(e,t){if(!this.midgroundMesh.visible)return;let n=e.environment,r=n.midgroundPosition?.x??0,i=(n.midgroundPosition?.y??1.35)-1.35,a=n.midgroundScale??1.15,o=1,s=0,c=0;t&&(o=t.zoomScale,s=t.panOffsetX,c=t.panOffsetY);let l=a*o;this.controls.target.x-this.initialControlsTarget.x,this.controls.target.y-this.initialControlsTarget.y;let u=new k;this.camera.getWorldDirection(u);let d=new k().crossVectors(u,this.camera.up).normalize(),f=new k().crossVectors(d,u).normalize(),p=this.camera.position.distanceTo(this.controls.target),m=Math.max(p+.3,2.1),h=this.camera.position.clone().addScaledVector(u,m).addScaledVector(d,r+s*.8).addScaledVector(f,i+c*.8);this.midgroundMesh.position.copy(h),this.midgroundMesh.quaternion.copy(this.camera.quaternion);let g=j.degToRad(this.camera.fov),_=2*m*Math.tan(g/2),v=this.renderer.domElement.clientWidth||window.innerWidth,y=this.renderer.domElement.clientHeight||window.innerHeight,b=v/Math.max(y,1),x=Math.max(1,b/(16/9)),S=_*l*x;this.midgroundMesh.scale.set(S,S,1)}updateMidgroundDisplay(e){let t=e.environment.showBackgroundImage&&!!e.environment.showMidground&&!!e.environment.midgroundImageUrl;this.midgroundMesh.visible=t,!(!t||!e.environment.midgroundImageUrl)&&(this.midgroundMat.opacity=e.environment.midgroundOpacity??1,this.loadTransparentKeyedTexture(e.environment.midgroundImageUrl).then(e=>{this.midgroundMat.map=e,this.midgroundMat.needsUpdate=!0}),this.updateMidgroundTransform(e))}loadNeargroundTexture(e){return this.neargroundTextureCache.has(e)?Promise.resolve(this.neargroundTextureCache.get(e)):new Promise((t,n)=>{this.textureLoader.load(e,n=>{n.colorSpace=E,n.needsUpdate=!0,this.neargroundTextureCache.set(e,n),t(n)},void 0,e=>n(e))})}updateNeargroundTransform(e,t){if(!this.neargroundMesh.visible)return;let n=e.environment,r=n.neargroundPosition?.x??0,i=n.neargroundPosition?.y??0,a=n.neargroundScale??1,o=1,s=0,c=0;t&&(o=t.zoomScale,s=t.panOffsetX,c=t.panOffsetY);let l=a*o;this.controls.target.x-this.initialControlsTarget.x,this.controls.target.y-this.initialControlsTarget.y;let u=new k;this.camera.getWorldDirection(u);let d=new k().crossVectors(u,this.camera.up).normalize(),f=new k().crossVectors(d,u).normalize(),p=this.camera.position.distanceTo(this.controls.target),m=Math.max(p*.65,.4),h=j.degToRad(this.camera.fov),g=2*m*Math.tan(h/2),_=16/9*g,v=this.neargroundMat.map,y=v&&v.image&&v.image.width&&v.image.height?v.image.width/v.image.height:1448/1086,b=_/(16/9)*(16/9)*l,x=b/y,S=-.0852136*g,ee=this.camera.position.clone().addScaledVector(u,m).addScaledVector(d,r+s*.8).addScaledVector(f,S+i+c*.8);this.neargroundMesh.position.copy(ee),this.neargroundMesh.quaternion.copy(this.camera.quaternion),this.neargroundMesh.scale.set(b/(16/9),x,1)}updateNeargroundDisplay(e){let t=e.environment.showBackgroundImage&&!!e.environment.showNearground&&!!e.environment.neargroundImageUrl;this.neargroundMesh.visible=t,!(!t||!e.environment.neargroundImageUrl)&&(this.neargroundMat.opacity=e.environment.neargroundOpacity??1,this.loadNeargroundTexture(e.environment.neargroundImageUrl).then(t=>{this.neargroundMat.map=t,this.neargroundMat.needsUpdate=!0,this.updateNeargroundTransform(e)}),this.updateNeargroundTransform(e))}setCameraFraming(e,t=.35){this.framingAnimationId!==null&&(cancelAnimationFrame(this.framingAnimationId),this.framingAnimationId=null);let n=this.controls.target.clone(),r=this.camera.position.clone(),i,a;switch(e){case`full`:i=new k(0,.85,0),a=new k(0,.85,3);break;case`bust`:i=new k(0,1.2549,0),a=new k(0,1.2549,1.196);break;case`close`:i=new k(0,1.3,0),a=new k(0,1.3,.85);break}let o=performance.now(),s=e=>{let c=(e-o)/1e3,l=Math.min(c/t,1),u=1-(1-l)**3;this.controls.target.lerpVectors(n,i,u),this.camera.position.lerpVectors(r,a,u),this.camera.lookAt(this.controls.target),this.controls.update(),l<1?this.framingAnimationId=requestAnimationFrame(s):(this.framingAnimationId=null,this.initialControlsTarget.copy(i))};this.framingAnimationId=requestAnimationFrame(s)}onResize(){let{width:e,height:t,containerWidth:n,containerHeight:r,isPortrait:i,isLandscapeMobile:a,messageHeight:o}=Ut(),s=Math.min(window.devicePixelRatio,2);document.body.classList.toggle(`is-portrait`,i),document.body.classList.toggle(`is-landscape-mobile`,a),document.documentElement.style.setProperty(`--adv-msg-height`,`${o}px`);let c=document.getElementById(`viewport-container`);c&&(c.style.width=`${n}px`,c.style.height=`${r}px`,i?c.style.aspectRatio=`unset`:c.style.aspectRatio=`16 / 9`);let l=document.getElementById(`app`);l&&(i?(l.style.setProperty(`height`,`${t}px`,`important`),l.style.setProperty(`max-height`,`${t}px`,`important`)):(l.style.height=``,l.style.maxHeight=``)),this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.renderer.setSize(e,t,!0),this.renderer.setPixelRatio(s),this.composer.setPixelRatio(s),this.composer.setSize(e,t);let u=e*s,d=t*s;this.cinematicAnimePass&&this.cinematicAnimePass.uniforms.uResolution.value.set(u,d),this.smaaPass&&this.smaaPass.setSize(u,d),this.hairShadow&&this.hairShadow.setSize(Math.floor(u),Math.floor(d)),this.characterMask&&(this.characterMask.setSize(Math.floor(u),Math.floor(d)),this.lightWrapPass.uniforms.uResolution.value.set(u,d))}setMsaaSamples(e){if((this.composer.renderTarget1?.samples??0)===e)return;let t=Math.min(window.devicePixelRatio,2),n=this.renderer.getSize(new C),r=new D(Math.floor(n.width*t),Math.floor(n.height*t),{type:T,format:re,samples:e});this.composer.reset(r)}applyConfig(e){this.updateBackgroundDisplay(e),this.updateMidgroundDisplay(e),this.updateNeargroundDisplay(e),this.floor.visible=e.environment.showFloor,this.floorMat.color.set(e.environment.floorColor),this.renderer.shadowMap.enabled=e.lighting.castShadows,this.dirLight.castShadow=e.lighting.castShadows,this.smaaPass.enabled=e.postProcessing.antialiasing.smaa,this.setMsaaSamples(e.postProcessing.antialiasing.msaaSamples),this.renderer.toneMapping=Ht(e.postProcessing.toneMappingMode),this.renderer.toneMappingExposure=e.postProcessing.toneMappingExposure,this.bloomPass.strength=e.postProcessing.bloom.enabled?e.postProcessing.bloom.strength:0,this.bloomPass.radius=e.postProcessing.bloom.radius,this.bloomPass.threshold=e.postProcessing.bloom.threshold,Wt(this.cinematicAnimePass,e),e.hairShadow&&(this.hairShadow.setEnabled(e.hairShadow.enabled),this.hairShadow.setParams(e.hairShadow)),e.hairRing&&o(e.hairRing),e.faceSdf&&t(e.faceSdf),e.lightWrap&&r(this.lightWrapPass.uniforms,e.lightWrap),e.postProcessing.para&&Ye(this.paraPass.uniforms,e.postProcessing.para),i(e.lighting.hairRingTint),e.lighting.sunShafts&&(this.godRaysPass.uniforms.uExposure.value=e.lighting.sunShafts.enabled?e.lighting.sunShafts.exposure:0,this.godRaysPass.uniforms.uDecay.value=e.lighting.sunShafts.decay,this.godRaysPass.uniforms.uDensity.value=e.lighting.sunShafts.density,this.godRaysPass.uniforms.uWeight.value=e.lighting.sunShafts.weight,this.godRaysPass.uniforms.uRayColor.value.set(e.lighting.sunShafts.color),this.godRaysPass.uniforms.uShimmer.value=e.lighting.sunShafts.shimmer),this.ambientLight.color.set(e.lighting.ambient.color),this.ambientLight.intensity=e.lighting.ambient.intensity,this.dirLight.color.set(e.lighting.directional.color),this.dirLight.intensity=e.lighting.directional.intensity,this.dirLight.position.set(e.lighting.directional.posX,e.lighting.directional.posY,e.lighting.directional.posZ),this.rimLight.visible=e.lighting.rim.enabled!==!1,this.rimLight.color.set(e.lighting.rim.color),this.rimLight.intensity=e.lighting.rim.enabled===!1?0:e.lighting.rim.intensity,this.rimLight.position.set(e.lighting.rim.posX,e.lighting.rim.posY,e.lighting.rim.posZ),e.rain?this.rainEffect.updateConfig(e.rain):this.rainEffect.updateConfig({enabled:!1})}render(e,t,n,r){let i=this.sunEffect.update(this.camera,e,t,n,this.dirLight,r),a=n.lighting.sunShafts?.enabled??!1;if(this.godRaysPass.enabled=a,a&&(this.godRaysPass.uniforms.uSunPosition.value.copy(i.sunScreenPosition),this.godRaysPass.uniforms.uSunVisibility.value=i.sunVisibility,this.godRaysPass.uniforms.uExposure.value=n.lighting.sunShafts.exposure,this.godRaysPass.uniforms.uDecay.value=n.lighting.sunShafts.decay,this.godRaysPass.uniforms.uDensity.value=n.lighting.sunShafts.density,this.godRaysPass.uniforms.uWeight.value=n.lighting.sunShafts.weight,this.godRaysPass.uniforms.uRayColor.value.set(n.lighting.sunShafts.color),this.godRaysPass.uniforms.uShimmer.value=n.lighting.sunShafts.shimmer,this.godRaysPass.uniforms.uTime.value=t),this.cinematicAnimePass.uniforms.uTime.value=t,this.skyBackground.material.uniforms.uTime.value=t,this.hairShadow.render(this.renderer,this.scene,this.camera,this.dirLight),(this.lightWrapPass.uniforms.uEnabled.value>.5||this.paraPass.uniforms.uEnabled.value>.5||this.godRaysPass.enabled)&&this.characterMask.render(this.renderer,this.scene,this.camera),this.composer.render(),this.effectTextScene.children.length>0&&(this.renderer.autoClear=!1,this.renderer.clearDepth(),this.renderer.render(this.effectTextScene,this.camera),this.renderer.autoClear=!0),this.isPerformanceMonitorVisible&&this.renderer.info.render.frame%6==0){let e=this.renderer.info.render.calls,t=this.renderer.info.render.triangles,n=t>=1e3?`${(t/1e3).toFixed(1)}k`:`${t}`;this.perfBadge.textContent=`Calls: ${e} | Tris: ${n}`}}setPerformanceMonitorVisible(e){this.isPerformanceMonitorVisible=e;let t=e?`block`:`none`;this.stats?.dom&&(this.stats.dom.style.display=t),this.perfBadge&&(this.perfBadge.style.display=t)}captureAndRenderHistogram(e,t){e.computeHistogram(this.canvas)}},Kt={diffusion:{enabled:!0,strength:.12,radius:2},filmGrain:{enabled:!1,strength:.035,speed:1},vignette:{enabled:!0,offset:1.15,darkness:.08,color:`#1a1829`},chromaticAberration:{enabled:!0,offset:.0015},sharpening:{enabled:!1,amount:.22},fisheye:{enabled:!1,strength:.5,zoom:1,circular:!1}},G={morning:{id:`morning`,name:`朝`,description:`澄んだ朝陽と淡い光条、透明感あふれるブルー・バイオレットのグラデーション`,materials:{body:{color:`#ffffff`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.9895,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.994,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.997,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},eyeGlow:{enabled:!0,intensity:1.25},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},lighting:{hairRingTint:`#f2f5ff`,castShadows:!1,ambient:{color:`#c379a8`,intensity:.35},directional:{color:`#ffffff`,intensity:3.2,posX:1.1,posY:2.5,posZ:2.3},rim:{enabled:!1,color:`#dde8ff`,intensity:.05,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!0,followDirectionalLight:!1,sunPosition:{x:3.2,y:4.3,z:-3.8},exposure:.24,decay:.82,density:.35,weight:.14,color:`#dcdbff`,shimmer:.4},lensFlare:{enabled:!0,sunSize:1.25,sunColor:`#fff8ee`,glowIntensity:1.15,starburstIntensity:.05,anamorphicIntensity:1.1,ghostIntensity:.3,haloIntensity:.5}},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.07,radius:.7,threshold:.9},colorGrading:{enabled:!0,shadowTint:`#3d61ff`,highlightTint:`#99c0ff`,strength:.28,contrast:.31,gamma:.84},saturation:.26,brightness:0,contrast:0,cinematic:{...Kt}},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},day:{id:`day`,name:`昼`,description:`青空と強い太陽光、抜けの良い昼光サンシャフトと華やかなアニメフレア`,materials:{body:{color:`#ffffff`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.9895,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.994,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.997,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},eyeGlow:{enabled:!0,intensity:1.25},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},lighting:{hairRingTint:`#f2f5ff`,castShadows:!1,ambient:{color:`#776e74`,intensity:1},directional:{color:`#ffffff`,intensity:3.2,posX:-1.9,posY:1.5,posZ:2.6},rim:{enabled:!1,color:`#dde8ff`,intensity:.05,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!0,followDirectionalLight:!1,sunPosition:{x:3.2,y:4.3,z:-3.8},exposure:.22,decay:.83,density:.35,weight:.08,color:`#fff2db`,shimmer:.25},lensFlare:{enabled:!0,sunSize:1.3,sunColor:`#fffbf5`,glowIntensity:.95,starburstIntensity:.05,anamorphicIntensity:1.15,ghostIntensity:.35,haloIntensity:.5}},environment:{farFogIntensity:.12},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.07,radius:.7,threshold:.9},colorGrading:{enabled:!0,shadowTint:`#0b1b60`,highlightTint:`#9a8518`,strength:.5,contrast:.13,gamma:1},saturation:.26,brightness:0,contrast:0,cinematic:{...Kt}},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},evening:{id:`evening`,name:`夕方`,description:`ドラマチックな茜色の夕日、西日のサンシャフトと夕焼けレンズフレア`,materials:{body:{color:`#fff6f0`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.9865,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!0,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.991,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.9955,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},lighting:{hairRingTint:`#ffc58a`,castShadows:!1,ambient:{color:`#3e407a`,intensity:.5},directional:{color:`#fffbf0`,intensity:1.8,posX:-2.2,posY:.2,posZ:1.3},rim:{enabled:!0,color:`#ffaa60`,intensity:.3,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!0,followDirectionalLight:!1,sunPosition:{x:-5.5,y:1.6,z:-3.5},exposure:.56,decay:.885,density:.25,weight:.2,color:`#ff7826`,shimmer:.3},lensFlare:{enabled:!0,sunSize:1.05,sunColor:`#ff6222`,glowIntensity:1.15,starburstIntensity:1.05,anamorphicIntensity:.95,ghostIntensity:.95,haloIntensity:.3}},environment:{farFogEnabled:!0,farFogColor:`#ffe5e5`,farFogIntensity:.28},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.07,radius:.7,threshold:.9},colorGrading:{enabled:!0,shadowTint:`#391752`,highlightTint:`#ffad70`,strength:.65,contrast:.18,gamma:.95},saturation:.26,brightness:0,contrast:.02,cinematic:{diffusion:{enabled:!0,strength:.12,radius:2.2},filmGrain:{enabled:!1,strength:.04,speed:1},vignette:{enabled:!0,offset:1.15,darkness:.12,color:`#2a1435`},chromaticAberration:{enabled:!0,offset:.002},sharpening:{enabled:!1,amount:.24}}},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},rainy:{id:`rainy`,name:`雨`,description:`しっとりとした雨天・雨雲越しの柔らかな拡散光と雨粒パーティクル`,materials:{body:{color:`#fff6f0`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.9925,shadingShiftFactor:.02,giEqualizationFactor:.88,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.9955,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.9985,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},lighting:{hairRingTint:`#e6ebf5`,castShadows:!1,ambient:{color:`#f5f8ff`,intensity:.65},directional:{color:`#ffffff`,intensity:1.8,posX:.4,posY:1,posZ:.7},rim:{enabled:!1,color:`#fff0f7`,intensity:1,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!1,followDirectionalLight:!1,sunPosition:{x:0,y:5,z:0},exposure:0,decay:.9,density:.5,weight:.1,color:`#ffffff`,shimmer:0},lensFlare:{enabled:!1,sunSize:.8,sunColor:`#ffffff`,glowIntensity:0,starburstIntensity:0,anamorphicIntensity:0,ghostIntensity:0,haloIntensity:0}},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!1,strength:.05,radius:.12,threshold:.9},colorGrading:{enabled:!0,shadowTint:`#000000`,highlightTint:`#635e87`,strength:.5,contrast:.09,gamma:.9},saturation:.2,brightness:0,contrast:-.07,cinematic:{diffusion:{enabled:!0,strength:.28,radius:2},filmGrain:{enabled:!1,strength:.045,speed:1.2},vignette:{enabled:!0,offset:1.15,darkness:.1,color:`#161c28`},chromaticAberration:{enabled:!0,offset:.0018},sharpening:{enabled:!0,amount:.2}}},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},environment:{farFogEnabled:!0,farFogColor:`#292843`,farFogIntensity:.44},rain:{enabled:!0,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},night:{id:`night`,name:`夜`,description:`お祭りの夜のような十分な明るさと華やかさのある夜間ライティング`,materials:{body:{color:`#fff6f0`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.994,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.997,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.9985,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},eyeGlow:{enabled:!0,intensity:1.25},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},environment:{farFogEnabled:!0,farFogColor:`#ffe3cc`,farFogIntensity:.12},lighting:{hairRingTint:`#b8c4ff`,castShadows:!1,ambient:{color:`#ffebeb`,intensity:.5},directional:{color:`#ffffff`,intensity:3,posX:-3.5,posY:0,posZ:2},rim:{enabled:!1,color:`#8fa8db`,intensity:.22,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!1,followDirectionalLight:!1,sunPosition:{x:-3.5,y:2.2,z:-2},exposure:0,decay:.86,density:.55,weight:.18,color:`#7898d0`,shimmer:0},lensFlare:{enabled:!1,sunSize:.8,sunColor:`#8ca8db`,glowIntensity:0,starburstIntensity:0,anamorphicIntensity:0,ghostIntensity:0,haloIntensity:0}},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.1,radius:.26,threshold:.75},colorGrading:{enabled:!0,shadowTint:`#1c1c30`,highlightTint:`#324867`,strength:.9,contrast:.37,gamma:.78},saturation:.26,brightness:0,contrast:0,cinematic:{diffusion:{enabled:!0,strength:.2,radius:1.5},filmGrain:{enabled:!1,strength:.05,speed:.8},vignette:{enabled:!0,offset:1.15,darkness:.14,color:`#0d111d`},chromaticAberration:{enabled:!0,offset:.002},sharpening:{enabled:!1,amount:.22},fisheye:{enabled:!1,strength:.5,zoom:1,circular:!1}}},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},bright_indoor:{id:`bright_indoor`,name:`室内・明`,description:`均一で明るい室内照明、教室やオフィスに最適な自然なセルルック`,materials:{body:{color:`#ffffff`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.991,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.994,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.997,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},eyeGlow:{enabled:!0,intensity:1.25},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},environment:{showMidground:!1,farFogEnabled:!0,farFogColor:`#808080`,farFogIntensity:.18},lighting:{hairRingTint:`#fff8ee`,castShadows:!1,ambient:{color:`#ffcbc2`,intensity:.5},directional:{color:`#ffffff`,intensity:2.9,posX:-3.5,posY:0,posZ:1.8},rim:{enabled:!1,color:`#ffebeb`,intensity:.2,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!1,followDirectionalLight:!1,sunPosition:{x:0,y:5,z:0},exposure:0,decay:.9,density:.5,weight:.1,color:`#ffffff`,shimmer:0},lensFlare:{enabled:!1,sunSize:.8,sunColor:`#ffffff`,glowIntensity:0,starburstIntensity:0,anamorphicIntensity:0,ghostIntensity:0,haloIntensity:0}},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.01,radius:.12,threshold:.9},colorGrading:{enabled:!0,shadowTint:`#505068`,highlightTint:`#ffffff`,strength:.25,contrast:.08,gamma:1},saturation:.4,brightness:0,contrast:0,cinematic:{...Kt,diffusion:{enabled:!0,strength:.38,radius:2}}},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},dark_indoor:{id:`dark_indoor`,name:`室内・暗`,description:`窓からの夜光と落ち着いた間接照明、エモーショナルな夜間教室・室内`,materials:{body:{color:`#fff6f0`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.994,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:5,parametricRimLiftFactor:.1,rimLightingMixFactor:.1,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.997,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:.1,rimLightingMixFactor:.2,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.9985,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!0,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:4,parametricRimLiftFactor:.02,rimLightingMixFactor:1,outlineWidthFactor:.0016}},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},lighting:{hairRingTint:`#c4ccff`,castShadows:!1,ambient:{color:`#ffebeb`,intensity:.3},directional:{color:`#a0b6d9`,intensity:2.5,posX:-3.5,posY:0,posZ:2},rim:{enabled:!1,color:`#8fa8db`,intensity:.22,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!1,followDirectionalLight:!1,sunPosition:{x:-3.5,y:2.2,z:-2},exposure:0,decay:.86,density:.55,weight:.18,color:`#7898d0`,shimmer:0},lensFlare:{enabled:!1,sunSize:.8,sunColor:`#8ca8db`,glowIntensity:0,starburstIntensity:0,anamorphicIntensity:0,ghostIntensity:0,haloIntensity:0}},environment:{showMidground:!1,farFogEnabled:!0,farFogColor:`#262d5a`,farFogIntensity:.56},postProcessing:{para:{...B},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!1,strength:.12,radius:.2,threshold:.75},colorGrading:{enabled:!0,shadowTint:`#1c1c30`,highlightTint:`#9aacc6`,strength:.76,contrast:.3,gamma:.78},saturation:.26,brightness:0,contrast:0,cinematic:{diffusion:{enabled:!0,strength:.2,radius:1.5},filmGrain:{enabled:!1,strength:.05,speed:.8},vignette:{enabled:!0,offset:1.15,darkness:.14,color:`#0d111d`},chromaticAberration:{enabled:!0,offset:.002},sharpening:{enabled:!1,amount:.22}}},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},dark_indoor_2:{id:`dark_indoor_2`,name:`室内・暗2`,description:`温かみのあるアンビエントと柔らかな陰影、カフェ店内などのエモーショナルな室内光`,materials:{body:{color:`#ffffff`,shadeMultiply:`#d49ea3`,shadingToonyFactor:.991,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:0,rimLightingMixFactor:0,outlineWidthFactor:.0016},hair:{color:`#ffffff`,shadeMultiply:`#8474a4`,shadingToonyFactor:.994,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#ffffff`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:0,rimLightingMixFactor:0,outlineWidthFactor:.0016},cloth:{color:`#ffffff`,shadeMultiply:`#b8bcd8`,shadingToonyFactor:.997,shadingShiftFactor:-.05,giEqualizationFactor:.9,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!1,rimColor:`#202942`,parametricRimFresnelPowerFactor:0,parametricRimLiftFactor:0,rimLightingMixFactor:0,outlineWidthFactor:.0016}},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},lighting:{hairRingTint:`#fff8ee`,castShadows:!1,ambient:{color:`#4a536e`,intensity:.18},directional:{color:`#ffffff`,intensity:1,posX:2.5,posY:1.9,posZ:-3},rim:{enabled:!1,color:`#ffebeb`,intensity:0,posX:0,posY:1.5,posZ:2.5},sunShafts:{enabled:!1,followDirectionalLight:!1,sunPosition:{x:0,y:5,z:0},exposure:0,decay:.9,density:.5,weight:.1,color:`#ffffff`,shimmer:0},lensFlare:{enabled:!1,sunSize:1.05,sunColor:`#ffffff`,glowIntensity:.5,starburstIntensity:.55,anamorphicIntensity:.75,ghostIntensity:.8,haloIntensity:.75}},environment:{farFogEnabled:!0,farFogColor:`#c7b8b8`,farFogIntensity:.04},postProcessing:{para:{enabled:!0,topOpacity:.3,bottomOpacity:.05,desaturate:.2,tintAmount:1},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.2,radius:.12,threshold:.9},colorGrading:{enabled:!0,shadowTint:`#581818`,highlightTint:`#ffffff`,strength:.88,contrast:.31,gamma:.82},saturation:.4,brightness:0,contrast:0,cinematic:{diffusion:{enabled:!0,strength:.38,radius:2},filmGrain:{enabled:!0,strength:.01,speed:.2},vignette:{enabled:!0,offset:1.15,darkness:.08,color:`#1a1829`},chromaticAberration:{enabled:!0,offset:.0015},sharpening:{enabled:!1,amount:.22},fisheye:{enabled:!1,strength:.5,zoom:1,circular:!1}}},eyeGlow:{enabled:!1,intensity:0},bottomGradient:{enabled:!0,startY:2,endY:1,intensity:.1,shadowWeight:1,color:`#101018`},hairShadow:{enabled:!0,offset:.006,downBias:.002,strength:1,depthBias:.002,maxDepthDiff:.12},hairRing:{enabled:!0,height:.07,width:.009,softness:.0015,facingFade:.3,lighten:.5,desaturate:.1,strength:.85,strandJitter:.006,headCenterOffset:.08,jagAmplitude:.012,jagCount:48,viewShift:.01,arc:.04,gapCount:40,gapRate:.2},faceSdf:{enabled:!0,softness:0,noseSize:.5,noseStart:30,skipStart:45,skipEnd:135,skipBlend:4},lightWrap:{enabled:!0,radius:.012,strength:.4,edgePower:1.5,bodyStrength:.3},wind:{enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},rain:{enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110}},divine:{id:`divine`,name:`神聖・後光`,description:`背後からの強烈な後光（薄明光線）と神々しい黄金の輪郭光。手前は深い影となり神秘的な対峙空間を作り出す`,materials:{body:{color:`#080a12`,shadeMultiply:`#0d0608`,shadingToonyFactor:1,shadingShiftFactor:-1,giEqualizationFactor:0,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!0,rimColor:`#ffea9f`,parametricRimFresnelPowerFactor:4.2,parametricRimLiftFactor:0,rimLightingMixFactor:1,outlineWidthFactor:.0016},hair:{color:`#080a12`,shadeMultiply:`#0d0608`,shadingToonyFactor:1,shadingShiftFactor:-1,giEqualizationFactor:0,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!0,rimColor:`#ffea9f`,parametricRimFresnelPowerFactor:4.2,parametricRimLiftFactor:0,rimLightingMixFactor:1,outlineWidthFactor:.0016},cloth:{color:`#080a12`,shadeMultiply:`#0d0608`,shadingToonyFactor:1,shadingShiftFactor:-1,giEqualizationFactor:0,matcapEnabled:!1,emissiveIntensity:0,rimEnabled:!0,rimColor:`#ffea9f`,parametricRimFresnelPowerFactor:4.2,parametricRimLiftFactor:0,rimLightingMixFactor:1,outlineWidthFactor:.0016}},eyeGlow:{enabled:!1,intensity:0},outline:{enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:0,widthFactor:.001,lightingMixFactor:0},lighting:{hairRingTint:`#ffffff`,castShadows:!1,ambient:{color:`#05070d`,intensity:.02},directional:{color:`#fff5dc`,intensity:2,posX:0,posY:1.75,posZ:-3},rim:{enabled:!0,color:`#ffeab0`,intensity:7.5,posX:0,posY:1.7,posZ:-2.5},sunShafts:{enabled:!0,followDirectionalLight:!1,sunPosition:{x:0,y:1.58,z:-2.2},exposure:.42,decay:.9,density:.38,weight:.22,color:`#fff4db`,shimmer:.2},lensFlare:{enabled:!0,sunSize:.6,sunColor:`#fff9eb`,glowIntensity:.45,starburstIntensity:.8,anamorphicIntensity:.5,ghostIntensity:.1,haloIntensity:.6}},postProcessing:{para:{...B,enabled:!1},toneMappingMode:`None`,toneMappingExposure:1,antialiasing:{msaaSamples:4,smaa:!0},bloom:{enabled:!0,strength:.08,radius:.08,threshold:.6},colorGrading:{enabled:!0,shadowTint:`#0a0d18`,highlightTint:`#ffecc4`,strength:.4,contrast:.25,gamma:.9},saturation:.1,brightness:0,contrast:.1,cinematic:{diffusion:{enabled:!0,strength:.25,radius:1.8},filmGrain:{enabled:!1,strength:.02,speed:.5},vignette:{enabled:!0,offset:1.2,darkness:.25,color:`#05070e`},chromaticAberration:{enabled:!0,offset:.0018},sharpening:{enabled:!0,amount:.15}}},wind:{enabled:!1,speed:0,direction:0,elevation:0,turbulence:0,gustFrequency:0,gustStrength:0,particles:{enabled:!1,count:0,size:0,color:`#ffffff`,opacity:0,speedFactor:0}},rain:{enabled:!1,count:0,speed:0,length:0,angle:0,color:`#ffffff`,opacity:0,splashEnabled:!1,splashCount:0}}},K={modern_park:{id:`modern_park`,name:`近代公園 (多層)`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/modern-park-far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!0,midgroundImageUrl:z(`/textures/modern-park-mid.avif`),midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffffff`,farFogIntensity:.24}},school_gate:{id:`school_gate`,name:`校門`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/school-gate-far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffffff`,farFogIntensity:.15}},classroom:{id:`classroom`,name:`教室・廊下`,category:`indoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/school-corridor-far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!1,farFogColor:`#ffffff`,farFogIntensity:0}},school_rooftop:{id:`school_rooftop`,name:`屋上`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/school-rooftop-far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffffff`,farFogIntensity:.15}},park_with_sea:{id:`park_with_sea`,name:`海の見える公園`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/park-with-sea-far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffffff`,farFogIntensity:.2}},night_festival:{id:`night_festival`,name:`夏祭り`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/night-festival-far.avif`),backgroundColor:`#111122`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#1a1829`,farFogIntensity:.25}},old_park:{id:`old_park`,name:`旧公園`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/park-background.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!1,farFogColor:`#ffffff`,farFogIntensity:0}},cafe:{id:`cafe`,name:`カフェ`,category:`indoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/cafe_far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!0,neargroundImageUrl:z(`/textures/cafe_near.avif`),neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!1,farFogColor:`#808080`,farFogIntensity:0}},cafe_indoor:{id:`cafe_indoor`,name:`カフェ店内`,category:`indoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/cafe_indoor_far.avif`),backgroundExposure:1.3,backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!0,midgroundImageUrl:z(`/textures/cafe_indoor_mid.avif`),midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.38,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!1,farFogColor:`#808080`,farFogIntensity:0}},town:{id:`town`,name:`街`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/town_far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffffff`,farFogIntensity:.15}},apartment_door:{id:`apartment_door`,name:`アパート前`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/apartment_door_far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffffff`,farFogIntensity:.15}},myroom:{id:`myroom`,name:`自室`,category:`indoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/myroom_far.avif`),backgroundColor:`#ffffff`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!1,farFogColor:`#ffffff`,farFogIntensity:0}},none:{id:`none`,name:`単色背景 (OFF)`,category:`indoor`,environment:{showBackgroundImage:!1,backgroundImageUrl:``,backgroundColor:`#1a1a1a`,showFloor:!1,floorColor:`#ffffff`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!1,farFogColor:`#ffffff`,farFogIntensity:0}},divine_realm:{id:`divine_realm`,name:`聖域・神界`,category:`outdoor`,environment:{showBackgroundImage:!0,backgroundImageUrl:z(`/textures/park-with-sea-far.avif`),backgroundColor:`#0a0d18`,showFloor:!1,floorColor:`#0a0d18`,showMidground:!1,midgroundImageUrl:void 0,midgroundPosition:{x:0,y:1.35,z:-.25},midgroundScale:1.15,midgroundOpacity:1,showNearground:!1,neargroundImageUrl:void 0,neargroundPosition:{x:0,y:0,z:0},neargroundScale:1,neargroundOpacity:1,farFogEnabled:!0,farFogColor:`#ffeec9`,farFogIntensity:.28}}};function q(e,t,n){let r=Zt(t,n),i=G[t]||G.morning,a=K[n]||K.modern_park;return{id:e,name:`${i.name}・${a.name}`,category:a.category,description:i.description,...r}}var qt={morning_park:q(`morning_park`,`morning`,`modern_park`),day_park:q(`day_park`,`day`,`modern_park`),evening_park:q(`evening_park`,`evening`,`modern_park`),rainy_park:q(`rainy_park`,`rainy`,`modern_park`),morning_school:q(`morning_school`,`morning`,`school_gate`),day_school:q(`day_school`,`day`,`school_gate`),evening_school:q(`evening_school`,`evening`,`school_gate`),rainy_school:q(`rainy_school`,`rainy`,`school_gate`),bright_indoor:q(`bright_indoor`,`bright_indoor`,`cafe`),dark_indoor:q(`dark_indoor`,`dark_indoor`,`classroom`),dark_indoor_2:q(`dark_indoor_2`,`dark_indoor_2`,`cafe_indoor`),morning_outdoor:q(`morning_outdoor`,`morning`,`modern_park`),day_outdoor:q(`day_outdoor`,`day`,`modern_park`),evening_outdoor:q(`evening_outdoor`,`evening`,`modern_park`),rainy_outdoor:q(`rainy_outdoor`,`rainy`,`modern_park`),night_park:q(`night_park`,`night`,`modern_park`),night_school:q(`night_school`,`night`,`school_gate`),night_outdoor:q(`night_outdoor`,`night`,`modern_park`),night_festival:q(`night_festival`,`night`,`night_festival`),divine_encounter:q(`divine_encounter`,`divine`,`divine_realm`)};function Jt(e){return e in qt?qt[e]:qt.day_park}function Yt(e){return G[e]||G.morning}function Xt(e){return K[e]||K.modern_park}function Zt(e,t){let n=G[e]||G.morning,r=K[t]||K.modern_park,i={enabled:!0,useSmoothNormal:!0,screenSpaceWidth:!0,autoLineWeight:!0,darknessFactor:.1,widthFactor:.0016,lightingMixFactor:0},a={enabled:!1,speed:.1,direction:45,elevation:5,turbulence:.15,gustFrequency:.2,gustStrength:.15,particles:{enabled:!1,count:160,size:.035,color:`#ffd5e5`,opacity:.85,speedFactor:1}},o={enabled:!1,count:600,speed:9.5,length:.14,angle:2,color:`#cce2ff`,opacity:.45,splashEnabled:!1,splashCount:110};return{environment:JSON.parse(JSON.stringify({backgroundExposure:1,...r.environment,...n.environment||{}})),lighting:JSON.parse(JSON.stringify(n.lighting)),postProcessing:JSON.parse(JSON.stringify(n.postProcessing)),materials:JSON.parse(JSON.stringify(n.materials)),outline:JSON.parse(JSON.stringify(n.outline||i)),wind:JSON.parse(JSON.stringify(n.wind||a)),rain:JSON.parse(JSON.stringify(n.rain||o)),eyeGlow:n.eyeGlow?JSON.parse(JSON.stringify(n.eyeGlow)):void 0,bottomGradient:n.bottomGradient?JSON.parse(JSON.stringify(n.bottomGradient)):void 0,hairShadow:n.hairShadow?JSON.parse(JSON.stringify(n.hairShadow)):void 0,hairRing:n.hairRing?JSON.parse(JSON.stringify(n.hairRing)):void 0,faceSdf:n.faceSdf?JSON.parse(JSON.stringify(n.faceSdf)):void 0,lightWrap:n.lightWrap?JSON.parse(JSON.stringify(n.lightWrap)):void 0}}function J(e){let t=document.getElementById(`toast-msg`);t||(t=document.createElement(`div`),t.id=`toast-msg`,t.style.position=`fixed`,t.style.bottom=`24px`,t.style.left=`50%`,t.style.transform=`translateX(-50%)`,t.style.backgroundColor=`rgba(15, 23, 42, 0.9)`,t.style.color=`#ffffff`,t.style.padding=`10px 20px`,t.style.borderRadius=`8px`,t.style.fontSize=`14px`,t.style.fontWeight=`500`,t.style.boxShadow=`0 10px 25px rgba(0, 0, 0, 0.2)`,t.style.zIndex=`9999`,t.style.transition=`opacity 0.3s ease`,document.body.appendChild(t)),t.textContent=e,t.style.opacity=`1`,setTimeout(()=>{t&&(t.style.opacity=`0`)},2500)}var Qt=()=>{};function $t(e){Qt=e}function en(e){Qt(e)}function tn(e){let t=document.getElementById(`anim-play-btn`);t&&(t.textContent=e?`⏹ 再生中 (停止/再開)`:`▶ アニメーション再生`,t.style.background=e?`#ea580c`:`#4772b3`);let n=document.getElementById(`panel-container`),r=document.getElementById(`settings-open-btn`);e?(n&&(n.style.display=`none`),r&&(r.style.display=`none`)):en(!0)}function nn(e,t,n){let r=document.getElementById(`scenario-play-btn`),i=document.getElementById(`scenario-confession-btn`),a=document.getElementById(`scenario-twogirls-btn`),o=document.getElementById(`scenario-trio-btn`),s=document.getElementById(`scenario-harem-btn`),c=document.getElementById(`scenario-status-box`),l=document.getElementById(`panel-container`),u=document.getElementById(`settings-open-btn`),d=U();if(r&&(r.textContent=e?`⏹ ${d.common.stop}`:d.scenario.playSequence,r.style.background=e?`#ea580c`:`#4772b3`),i){let e=t&&!n;i.textContent=e?`⏹ ${d.common.stop}`:d.scenario.playConfession,i.style.background=e?`linear-gradient(135deg, #dc2626 0%, #991b1b 100%)`:`linear-gradient(135deg, #db2777 0%, #be185d 100%)`}if(a){let e=t&&n;a.textContent=e?`⏹ ${d.common.stop}`:d.scenario.playTwoGirls,a.style.background=e?`linear-gradient(135deg, #dc2626 0%, #991b1b 100%)`:`linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)`}if(o){let e=t&&n;o.textContent=e?`⏹ ${d.common.stop}`:d.scenario.playTrio,o.style.background=e?`linear-gradient(135deg, #dc2626 0%, #991b1b 100%)`:`linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)`}if(s){let e=t&&n;s.textContent=e?`⏹ ${d.common.stop}`:d.scenario.playHarem,s.style.background=e?`linear-gradient(135deg, #dc2626 0%, #991b1b 100%)`:`linear-gradient(135deg, #ec4899 0%, #be185d 100%)`}c&&(c.style.display=e?`block`:`none`),e||t?(l&&(l.style.display=`none`),u&&(u.style.display=`none`)):en(!0)}function rn(e,t){let n=document.getElementById(`scenario-current-step`),r=document.getElementById(`scenario-current-text`),i=U();n&&(n.textContent=[i.scenario.steps.step1Title,i.scenario.steps.step2Title,i.scenario.steps.step3Title][e]||`Step ${e+1}`),r&&(r.textContent=`「${t.text}」`)}function an(e,t){let n=document.getElementById(`scenario-engine-scene-id`),r=document.getElementById(`scenario-engine-speaker`),i=document.getElementById(`scenario-engine-flags`),a=document.getElementById(`scenario-engine-text`),o=U();if(n&&(n.textContent=e.id||`-`),r&&(r.textContent=e.speaker||(H()===`en`?`(Narration)`:`(地の文/ナレーション)`)),i){let e=Array.from(t.flags);i.textContent=e.length>0?e.join(`, `):o.scenario.noneFlags}a&&(a.textContent=e.text||``)}function on(e){return!Number.isFinite(e)||e<0?`0:00`:`${Math.floor(e/60)}:${Math.floor(e%60).toString().padStart(2,`0`)}`}function sn(e){document.querySelectorAll(`.phoneme-tag`).forEach(t=>{let n=t.getAttribute(`data-phoneme`);e===n||!e&&n===`nn`?t.classList.add(`active`):t.classList.remove(`active`)})}function cn(e){let t=document.getElementById(`audio-play-pause-btn`);t&&(t.textContent=e?`⏸ 一時停止`:`▶ 再生`,t.style.background=e?`#ea580c`:`#4772b3`)}function ln(e,t){let n=document.getElementById(`audio-time`),r=document.getElementById(`audio-seekbar`);n&&(n.textContent=`${on(e)} / ${on(t)}`),r&&t>0&&!r.matches(`:active`)&&(r.value=(e/t*100).toString())}function un(e,t){document.querySelectorAll(`.bg-btn`).forEach(n=>{let r=n.getAttribute(`data-bg`);e?n.classList.toggle(`active`,r===t):n.classList.toggle(`active`,r===`none`)})}var dn=class{config;onConfigChange;onInspectorsUpdate;constructor(e){this.config=e.config,this.onConfigChange=e.onConfigChange,this.onInspectorsUpdate=e.onInspectorsUpdate??(()=>{})}getActiveTimeOfDay(){let e=this.config.activeScene?.timeOfDay;return e&&e in G?e:`day`}getScenePresetIdFromState(e,t){if(t===`school_gate`){if(e===`morning`)return`morning_school`;if(e===`day`)return`day_school`;if(e===`evening`)return`evening_school`;if(e===`rainy`)return`rainy_school`;if(e===`night`)return`night_school`}else if(t===`classroom`||t===`cafe`||t===`cafe_indoor`||t===`myroom`)return e===`dark_indoor`?`dark_indoor`:e===`dark_indoor_2`?`dark_indoor_2`:`bright_indoor`;else if(t===`night_festival`){if(e===`night`)return`night_festival`}else if(t===`divine_realm`||e===`divine`)return`divine_encounter`;return e===`morning`?`morning_park`:e===`day`?`day_park`:e===`evening`?`evening_park`:e===`rainy`?`rainy_park`:e===`night`?`night_park`:e===`dark_indoor`?`dark_indoor`:e===`dark_indoor_2`?`dark_indoor_2`:e===`bright_indoor`?`bright_indoor`:`day_park`}getActivePresetId(){if(this.config.activeScene?.presetId&&this.config.activeScene.presetId in qt)return this.config.activeScene.presetId;let e=this.getActiveTimeOfDay(),t=this.config.activeScene?.location;return this.getScenePresetIdFromState(e,t)}syncTimeOfDayButtons(){let e=this.getActiveTimeOfDay();document.querySelectorAll(`.timeofday-btn`).forEach(t=>{let n=t.getAttribute(`data-timeofday`);t.classList.toggle(`active`,n===e)})}applySceneConfig(e){V(this.config.environment,e.environment),V(this.config.lighting,e.lighting),V(this.config.postProcessing,e.postProcessing),V(this.config.materials,e.materials),V(this.config.outline,e.outline),V(this.config.wind,e.wind),e.rain&&(this.config.rain?V(this.config.rain,e.rain):this.config.rain=JSON.parse(JSON.stringify(e.rain))),e.eyeGlow&&(this.config.eyeGlow?V(this.config.eyeGlow,e.eyeGlow):this.config.eyeGlow=JSON.parse(JSON.stringify(e.eyeGlow))),e.bottomGradient&&(this.config.bottomGradient?V(this.config.bottomGradient,e.bottomGradient):this.config.bottomGradient=JSON.parse(JSON.stringify(e.bottomGradient))),e.hairShadow&&(this.config.hairShadow?V(this.config.hairShadow,e.hairShadow):this.config.hairShadow=JSON.parse(JSON.stringify(e.hairShadow))),e.hairRing&&(this.config.hairRing?V(this.config.hairRing,e.hairRing):this.config.hairRing=JSON.parse(JSON.stringify(e.hairRing))),e.faceSdf&&(this.config.faceSdf?V(this.config.faceSdf,e.faceSdf):this.config.faceSdf=JSON.parse(JSON.stringify(e.faceSdf))),e.lightWrap&&(this.config.lightWrap?V(this.config.lightWrap,e.lightWrap):this.config.lightWrap=JSON.parse(JSON.stringify(e.lightWrap))),this.onConfigChange(this.config),this.onInspectorsUpdate(),this.syncTimeOfDayButtons(),un(this.config.environment.showBackgroundImage,this.config.environment.backgroundImageUrl)}switchTimeOfDay(e,t=!0){let n=this.config.activeScene?.location||`modern_park`;e===`divine`?n=`divine_realm`:n===`divine_realm`&&(n=`modern_park`);let r=this.getScenePresetIdFromState(e,n);this.config.activeScene={presetId:r,timeOfDay:e,location:n};let i=Zt(e,n);this.applySceneConfig(i);let a=Yt(e);t&&J(`${U().toasts.sceneChanged}${a.name}`)}switchLocation(e,t=!1){let n=this.config.activeScene?.timeOfDay||`day`,r=this.getScenePresetIdFromState(n,e);this.config.activeScene={presetId:r,timeOfDay:n,location:e};let i=Zt(n,e);this.applySceneConfig(i);let a=Xt(e);t&&J(`${a.name}`)}switchScene(e,t=!0){let n=Jt(e),r=e.startsWith(`morning`)?`morning`:e.startsWith(`day`)?`day`:e.startsWith(`evening`)?`evening`:e.startsWith(`rainy`)?`rainy`:e.startsWith(`night`)?`night`:e===`bright_indoor`?`bright_indoor`:e===`dark_indoor`?`dark_indoor`:e===`dark_indoor_2`?`dark_indoor_2`:`morning`,i=e.includes(`school`)?`school_gate`:e===`night_festival`?`night_festival`:e===`bright_indoor`?`cafe`:e===`dark_indoor_2`?`cafe_indoor`:e.includes(`indoor`)?`classroom`:`modern_park`;this.config.activeScene={presetId:e,location:i,timeOfDay:r};let a=Zt(r,i);this.applySceneConfig(a),t&&J(`${U().toasts.sceneChanged}${n.name}`)}};function fn(e){return 1-(1-e)**3}var pn=class{bgLayer;backLayer;frontLayer;backTextEl;frontTextEl;constructor(){let e=document.getElementById(`animation-background`);if(!e){e=document.createElement(`div`),e.id=`animation-background`;let t=document.getElementById(`app`);t&&t.parentNode?t.parentNode.insertBefore(e,t):document.body.prepend(e)}this.bgLayer=e;let t=document.getElementById(`animation-text-back`);if(!t){t=document.createElement(`div`),t.id=`animation-text-back`;let e=document.getElementById(`app`);e&&e.parentNode?e.parentNode.insertBefore(t,e):document.body.appendChild(t)}this.backLayer=t;let n=document.getElementById(`animation-text-front`);if(!n){n=document.createElement(`div`),n.id=`animation-text-front`;let e=document.getElementById(`app`);e&&e.parentNode?e.parentNode.insertBefore(n,e.nextSibling):document.body.appendChild(n)}this.frontLayer=n,this.backTextEl=document.createElement(`div`),this.backTextEl.className=`typography-item back-item`,this.backLayer.appendChild(this.backTextEl),this.frontTextEl=document.createElement(`div`),this.frontTextEl.className=`typography-item front-item`,this.frontLayer.appendChild(this.frontTextEl),this.clear()}enterTransparentMode(e){this.bgLayer.style.display=`block`,this.bgLayer.style.backgroundImage=`none`,this.bgLayer.style.backgroundColor=e.environment.backgroundColor||`#ffffff`}exitTransparentMode(){this.bgLayer.style.display=`none`,this.bgLayer.style.backgroundImage=`none`,this.clear()}clear(){this.backTextEl.style.display=`none`,this.backTextEl.textContent=``,this.frontTextEl.style.display=`none`,this.frontTextEl.textContent=``}update(e,t,n){let r=Math.max(0,Math.min(1,e));t&&t.text&&t.text.trim().length>0?this.renderText(this.backTextEl,t,r):this.backTextEl.style.display=`none`,n&&n.text&&n.text.trim().length>0?this.renderText(this.frontTextEl,n,r):this.frontTextEl.style.display=`none`}renderText(e,t,n){e.style.display=`block`,e.textContent=t.text,e.style.left=`${t.x}%`,e.style.top=`${t.y}%`,e.style.fontSize=`${t.fontSize}vw`,e.style.color=t.color,e.style.fontWeight=`${t.fontWeight}`;let{transform:r,opacity:i}=this.calculateMotion(t.animationPreset,n);e.style.transform=r,e.style.opacity=`${i}`}calculateMotion(e,t){switch(e){case`fade`:{let e=Math.min(t/.25,1),n=t>.85?(1-t)/.15:1,r=fn(e)*n;return{transform:`translate(-50%, -50%)`,opacity:Math.max(0,Math.min(1,r))}}case`slideLeft`:{let e=12*(1-fn(Math.min(t/.35,1)))+-3*t,n=Math.min(t/.15,1);return{transform:`translate(calc(-50% + ${e}vw), -50%)`,opacity:Math.max(0,Math.min(1,n))}}case`slideRight`:{let e=-12*(1-fn(Math.min(t/.35,1)))+3*t,n=Math.min(t/.15,1);return{transform:`translate(calc(-50% + ${e}vw), -50%)`,opacity:Math.max(0,Math.min(1,n))}}case`slideUp`:{let e=10*(1-fn(Math.min(t/.35,1)))+-2*t,n=Math.min(t/.15,1);return{transform:`translate(-50%, calc(-50% + ${e}vh))`,opacity:Math.max(0,Math.min(1,n))}}case`scaleIn`:{let e=.45+.55*fn(Math.min(t/.4,1)),n=Math.min(t/.15,1);return{transform:`translate(-50%, -50%) scale(${e.toFixed(3)})`,opacity:Math.max(0,Math.min(1,n))}}case`punch`:{let e;e=t<.2?1+.5*(1-t/.2):1;let n=Math.min(t/.08,1);return{transform:`translate(-50%, -50%) scale(${e.toFixed(3)})`,opacity:Math.max(0,Math.min(1,n))}}default:return{transform:`translate(-50%, -50%)`,opacity:1}}}dispose(){this.clear(),this.bgLayer.remove(),this.backLayer.remove(),this.frontLayer.remove()}};function Y(e){return e<.5?4*e*e*e:1-(-2*e+2)**3/2}function mn(e){return 1-(1-e)**3}var hn=class{camera;controls;overlay;getConfig;onEnterTransparent;onExitTransparent;onPlayStateChange;onPlayMotion;onRestoreMotion;_isPlaying=!1;activeCuts=[];currentCutIndex=0;cutElapsedTime=0;baseCameraState={position:new k,target:new k,fov:30};cutStartCameraState={position:new k,target:new k,fov:30};_dir=new k;_right=new k;_forward=new k;_rel=new k;_yAxis=new k(0,1,0);constructor(e){this.camera=e.camera,this.controls=e.controls,this.overlay=e.overlay,this.getConfig=e.getConfig,this.onEnterTransparent=e.onEnterTransparent,this.onExitTransparent=e.onExitTransparent,this.onPlayStateChange=e.onPlayStateChange,this.onPlayMotion=e.onPlayMotion,this.onRestoreMotion=e.onRestoreMotion}get isPlaying(){return this._isPlaying}play(){this._isPlaying&&this.stop();let e=this.getConfig();if(this.activeCuts=(e.shortAnimation?.cuts||[]).filter(e=>e.enabled&&e.duration>0),this.activeCuts.length===0){console.warn(`No active animation cuts enabled.`);return}this.baseCameraState.position.copy(this.camera.position),this.baseCameraState.target.copy(this.controls.target),this.baseCameraState.fov=this.camera.fov,this.controls.enabled=!1,this.onEnterTransparent(),this.overlay.enterTransparentMode(e),this._isPlaying=!0,this.currentCutIndex=0,this.cutElapsedTime=0,this.onPlayStateChange?.(!0);let t=this.activeCuts[0];this.setupCutStartCamera(t),t.motion&&t.motion!==`none`&&this.onPlayMotion?.(t.motion),this.applyCurrentFrame(0)}stop(){this._isPlaying&&(this._isPlaying=!1,this.camera.position.copy(this.baseCameraState.position),this.controls.target.copy(this.baseCameraState.target),this.camera.fov=this.baseCameraState.fov,this.camera.updateProjectionMatrix(),this.camera.lookAt(this.controls.target),this.controls.enabled=!1,this.controls.update(),this.overlay.exitTransparentMode(),this.onExitTransparent(),this.onRestoreMotion?.(),this.onPlayStateChange?.(!1))}update(e){if(!this._isPlaying)return;this.cutElapsedTime+=e;let t=this.activeCuts[this.currentCutIndex];if(!t){this.stop();return}if(this.cutElapsedTime>=t.duration){if(this.cutElapsedTime-=t.duration,this.currentCutIndex++,this.currentCutIndex>=this.activeCuts.length){this.stop();return}let e=this.activeCuts[this.currentCutIndex];this.setupCutStartCamera(e),e.motion&&e.motion!==`none`&&this.onPlayMotion?.(e.motion)}let n=this.activeCuts[this.currentCutIndex],r=Math.max(0,Math.min(1,this.cutElapsedTime/n.duration));this.applyCurrentFrame(r)}setupCutStartCamera(e){let t=e.startAngle||`continue`,n=Math.max(.2,e.cameraDistance??1);if(t===`continue`){this.cutStartCameraState.position.copy(this.camera.position),this.cutStartCameraState.target.copy(this.controls.target),this.cutStartCameraState.fov=this.camera.fov;return}let r=this.baseCameraState.position,i=this.baseCameraState.target,a=r.clone().sub(i),o=Math.max(.8,Math.sqrt(a.x*a.x+a.z*a.z))*n,s=a.y*n,c=i.clone(),l=r.clone();switch(t){case`farFront`:c.copy(i),l.set(i.x,i.y+s*1.2,i.z+o*2.2);break;case`front`:c.copy(i),l.set(i.x,i.y+s,i.z+o);break;case`right`:c.copy(i),l.set(i.x+o,i.y+s,i.z);break;case`left`:c.copy(i),l.set(i.x-o,i.y+s,i.z);break;case`back`:c.copy(i),l.set(i.x,i.y+s,i.z-o);break;case`lowAngle`:c.set(i.x,Math.max(.6,i.y*.75),i.z),l.set(i.x,.2*n,i.z+Math.max(1.1,o*.85));break;case`highAngle`:c.set(i.x,i.y*.8,i.z),l.set(i.x,Math.max(2.4,(i.y+1.2)*n),i.z+Math.max(1.6,o*1.1));break;case`closeUp`:c.set(i.x,i.y+.05,i.z),l.set(i.x,i.y+.05,i.z+Math.max(.65,o*.45));break}this.cutStartCameraState.position.copy(l),this.cutStartCameraState.target.copy(c),this.cutStartCameraState.fov=this.baseCameraState.fov,this.camera.position.copy(l),this.controls.target.copy(c),this.camera.lookAt(c)}applyCurrentFrame(e){let t=this.activeCuts[this.currentCutIndex];t&&(this.calculateCameraMotion(t.cameraPreset,t.cameraStrength??1,e),this.camera.lookAt(this.controls.target),this.overlay.update(e,t.backText,t.frontText))}calculateCameraMotion(e,t,n){let r=this.cutStartCameraState.position,i=this.cutStartCameraState.target;switch(e){case`pushIn`:{this._dir.subVectors(i,r);let e=.42*t*Y(n);this.camera.position.copy(r).addScaledVector(this._dir,e),this.controls.target.copy(i);break}case`pullOut`:{this._dir.subVectors(r,i);let e=.42*t*Y(n);this.camera.position.copy(r).addScaledVector(this._dir,e),this.controls.target.copy(i);break}case`panLeft`:{this.camera.getWorldDirection(this._forward),this._right.crossVectors(this._forward,this.camera.up).normalize();let e=.45*t*Y(n);this.camera.position.copy(r).addScaledVector(this._right,-e),this.controls.target.copy(i).addScaledVector(this._right,-e);break}case`panRight`:{this.camera.getWorldDirection(this._forward),this._right.crossVectors(this._forward,this.camera.up).normalize();let e=.45*t*Y(n);this.camera.position.copy(r).addScaledVector(this._right,e),this.controls.target.copy(i).addScaledVector(this._right,e);break}case`orbitLeft`:{this._rel.subVectors(r,i);let e=Math.PI/6*t*Y(n);this._rel.applyAxisAngle(this._yAxis,e),this.camera.position.copy(i).add(this._rel),this.controls.target.copy(i);break}case`orbitRight`:{this._rel.subVectors(r,i);let e=-(Math.PI/6)*t*Y(n);this._rel.applyAxisAngle(this._yAxis,e),this.camera.position.copy(i).add(this._rel),this.controls.target.copy(i);break}case`orbitLeftHalf`:{this._rel.subVectors(r,i);let e=Math.PI*t*Y(n);this._rel.applyAxisAngle(this._yAxis,e),this.camera.position.copy(i).add(this._rel),this.controls.target.copy(i);break}case`orbitRightHalf`:{this._rel.subVectors(r,i);let e=-Math.PI*t*Y(n);this._rel.applyAxisAngle(this._yAxis,e),this.camera.position.copy(i).add(this._rel),this.controls.target.copy(i);break}case`lowAngleUp`:{let e=.65*t*Y(n),a=.5*t*Y(n);this.camera.position.set(r.x,r.y+e,r.z),this.controls.target.set(i.x,i.y+a,i.z);break}case`riseUp`:{let e=.65*t*Y(n);this.camera.position.set(r.x,r.y+e,r.z),this.controls.target.set(i.x,i.y+e,i.z);break}case`diveDown`:{let e=.65*t*Y(n);this.camera.position.set(r.x,r.y-e,r.z),this.controls.target.set(i.x,i.y-e,i.z);break}case`spiralRise`:{let e=-.45*t*Y(n),a=.45*t*Y(n);this._rel.subVectors(r,i),this._rel.applyAxisAngle(this._yAxis,e),this.camera.position.copy(i).add(this._rel),this.camera.position.y+=a,this.controls.target.copy(i);break}case`punchIn`:{let e;e=n<.25?n/.25*1.35:1.35-.35*mn((n-.25)/.75),this._dir.subVectors(i,r);let a=.32*t*e;this.camera.position.copy(r).addScaledVector(this._dir,a),this.controls.target.copy(i);break}default:this.camera.position.copy(r),this.controls.target.copy(i);break}}};function gn(e){return e.includes(`Idle`)||e.includes(`Walking`)||e.includes(`Jogging`)||e.includes(`Pose`)}var _n=class{avatarInstance=null;currentModelUrl=z(`/models/aoi/aoi-school.vrm`);currentMotionUrl=z(`/animations/Idle.fbx`);customMotions=[];currentExprName=`neutral`;scenarioAvatars=new Map;isMultiAvatarScenarioActive=!1;controlledScenarioAvatarId=null;faceOverlayState={blush:!1,sweat:!1,anger:!1};typographyOverlay;animationPlayer;originalMotionUrlBeforeAnim=z(`/animations/Idle.fbx`);scene;camera;controls;sharedEffectTextManager;windController;getConfig;onAvatarLoaded;liveChatController;constructor(e){this.renderer=e.renderer??null,this.hairShadow=e.hairShadow,this.scene=e.scene,this.camera=e.camera,this.controls=e.controls,this.sharedEffectTextManager=e.sharedEffectTextManager,this.windController=e.windController,this.getConfig=e.getConfig,this.liveChatController=e.liveChatController,this.onAvatarLoaded=e.onAvatarLoaded,this.typographyOverlay=new pn,this.animationPlayer=new hn({camera:this.camera,controls:this.controls,overlay:this.typographyOverlay,getConfig:this.getConfig,onEnterTransparent:()=>{this.originalMotionUrlBeforeAnim=this.currentMotionUrl,e.onEnterTransparent()},onExitTransparent:()=>{e.onExitTransparent()},onPlayStateChange:e=>{tn(e)},onPlayMotion:e=>{if(this.avatarInstance){if(e===`stop`){this.avatarInstance.stopAnimation();return}if(e&&e!==`none`){let t=z(e),n=gn(t);this.avatarInstance.playAnimation(t,n)}}},onRestoreMotion:()=>{if(this.avatarInstance){if(this.originalMotionUrlBeforeAnim===`none`)this.avatarInstance.stopAnimation();else if(this.originalMotionUrlBeforeAnim){let e=gn(this.originalMotionUrlBeforeAnim);this.avatarInstance.playAnimation(this.originalMotionUrlBeforeAnim,e)}}}})}renderer=null;hairShadow;setRenderer(e){this.renderer=e,this.avatarInstance&&(this.avatarInstance.renderer=e);for(let t of this.scenarioAvatars.values())t.renderer=e}setLiveChatController(e){this.liveChatController=e}loadAvatarModel(e){this.currentModelUrl=e;let t=document.getElementById(`loading-status`);t&&(t.innerHTML=`モデル読み込み中... <span id="progress-text">0%</span>`),this.avatarInstance&&(this.avatarInstance.vrm&&(this.faceOverlayState=this.avatarInstance.getFaceOverlays()),this.avatarInstance.dispose(),this.avatarInstance=null,this.windController.resetModel());let n=this.getConfig();this.avatarInstance=new Ae(this.scene,this.camera,{modelUrl:e,defaultAnimationUrl:this.currentMotionUrl===`none`?void 0:this.currentMotionUrl,config:n,autoBlink:!0,lookAtCamera:!0,enableBreathing:!0,effectTextManager:this.sharedEffectTextManager,renderer:this.renderer??void 0,hairShadow:this.hairShadow,onProgress:e=>{let t=document.getElementById(`progress-text`);t&&(t.textContent=`${e.toFixed(0)}%`)},onLoaded:t=>{if(this.avatarInstance!==t||this.isMultiAvatarScenarioActive){t.dispose();return}this.liveChatController&&this.liveChatController.setAvatar(t),this.currentExprName!==`neutral`&&t.setExpression(this.currentExprName,1);for(let e of Oe)t.setFaceOverlay(e,this.faceOverlayState[e]).catch(console.error);this.solidColorState.enabled&&t.setSolidColorMode(!0,this.solidColorState.color),this.onAvatarLoaded&&this.onAvatarLoaded(t),window.dispatchEvent(new CustomEvent(`avatar-model-change`));let n=document.getElementById(`loading-status`);n&&(n.innerHTML=`<span style="color: #16a34a; font-weight: 600;">✓ ロード完了</span> (${e.startsWith(`blob:`)?`ローカルVRM`:e.split(`/`).pop()})`),J(`👤 モデルを読み込みました: ${e.startsWith(`blob:`)?`ローカルVRM`:e.split(`/`).pop()}`),document.querySelectorAll(`.model-btn`).forEach(t=>{let n=t.getAttribute(`data-model`);t.classList.toggle(`active`,n===e)})},onError:e=>{console.error(`Failed to load VRM avatar:`,e);let t=document.getElementById(`loading-status`);t&&(t.innerHTML=`<span style="color: #dc2626; font-weight: 600;">✗ ロード失敗</span>`),J(`❌ モデルの読み込みに失敗しました`)}}),window.dispatchEvent(new CustomEvent(`avatar-face-overlays-change`)),window.dispatchEvent(new CustomEvent(`avatar-model-change`))}getVrmMeshes(){let e=[];if(this.isMultiAvatarScenarioActive)for(let t of this.scenarioAvatars.values())t.vrm?.scene&&e.push(t.vrm.scene);else this.avatarInstance?.vrm?.scene&&e.push(this.avatarInstance.vrm.scene);return e}update(e,t,n,r,i){if(this.isMultiAvatarScenarioActive)for(let[a,o]of this.scenarioAvatars.entries()){let s=i?i===a:!0;n.lipSync.enabled&&s?o.updateLipSync(r.currentPhoneme,n.lipSync.gain,n.lipSync.smoothing,e):o.updateLipSync(void 0,n.lipSync.gain,n.lipSync.smoothing,e),o.update(e,t,()=>{this.windController.update(o.vrm??null,n.wind,t)},this.renderer??void 0)}else this.avatarInstance&&(n.lipSync.enabled&&this.avatarInstance.updateLipSync(r.currentPhoneme,n.lipSync.gain,n.lipSync.smoothing,e),this.avatarInstance.update(e,t,()=>{this.windController.update(this.avatarInstance?.vrm??null,n.wind,t)},this.renderer??void 0))}setAvatarPosition(e,t,n){this.getTransformTargetAvatar()?.setPosition(e,t,n)}getAvatarPosition(){let e=this.getTransformTargetAvatar();return e?.vrm?e.vrm.scene.position:new k(0,0,0)}setAvatarRotationY(e){this.getTransformTargetAvatar()?.setRotationY(e)}getAvatarRotationY(){let e=this.getTransformTargetAvatar();return e?.vrm?e.vrm.scene.rotation.y:0}setControlledScenarioAvatar(e){this.controlledScenarioAvatarId=e}getTransformTargetAvatar(){return this.controlledScenarioAvatarId&&this.scenarioAvatars.has(this.controlledScenarioAvatarId)?this.scenarioAvatars.get(this.controlledScenarioAvatarId)??null:this.avatarInstance}setAvatarVisible(e){this.avatarInstance?.vrm&&(this.avatarInstance.vrm.scene.visible=e)}getAvatarVisible(){return this.avatarInstance?.vrm?this.avatarInstance.vrm.scene.visible:!0}setYandereMode(e,t){this.avatarInstance&&this.avatarInstance.setYandereMode(e,t);for(let n of this.scenarioAvatars.values())n.setYandereMode(e,t)}isYandereMode(){return this.avatarInstance?.isYandereMode()??!1}getYandereConfig(){return this.avatarInstance?.getYandereConfig()??null}getFaceBlushTextureForModel(e){return ke.blush}getFaceOverlays(){return this.avatarInstance?.vrm?this.avatarInstance.getFaceOverlays():{...this.faceOverlayState}}async setFaceOverlay(e,t){this.faceOverlayState[e]=t;let n=new Set(this.scenarioAvatars.values());this.avatarInstance&&n.add(this.avatarInstance),await Promise.all([...n].map(n=>n.setFaceOverlay(e,t)))}setBlushMode(e,t){let n={faceTexture:this.getFaceBlushTextureForModel(),wateryEyes:!0,...t};this.avatarInstance&&this.avatarInstance.setBlushMode(e,n);for(let t of this.scenarioAvatars.values())t.setBlushMode(e,n)}isBlushMode(){return this.avatarInstance?.isBlushMode()??!1}getBlushConfig(){return this.avatarInstance?.getBlushConfig()??null}solidColorState={enabled:!1,color:16711680};getCharacterColor(e){if(!e)return null;let t=e.toLowerCase();return t.includes(`aoi`)||t===`girl_01`?`#f59e0b`:t.includes(`emili`)||t===`girl_02`?`#dc2626`:t.includes(`shion`)?`#2563eb`:null}setSolidColorMode(e,t=16711680){if(this.solidColorState={enabled:e,color:t},this.avatarInstance){let n=this.getCharacterColor(this.currentModelUrl)||t;this.avatarInstance.setSolidColorMode(e,n)}for(let[n,r]of this.scenarioAvatars.entries()){let i=this.getCharacterColor(n)||this.getCharacterColor(this.currentModelUrl)||t;r.setSolidColorMode(e,i)}}isSolidColorMode(){return this.solidColorState.enabled}getSolidColorState(){return{...this.solidColorState}}},X={characters:{girl_01:{id:`girl_01`,name:`👧 アオイ (aoi-school.vrm)`,modelUrl:`/models/aoi/aoi-school.vrm`,faceBlushTexture:`/textures/girl_face_blush.png`,defaultVoiceGender:`female`,description:`標準的な学生服スタイルのVRMキャラクター (アオイ)`},girl_02:{id:`girl_02`,name:`👱‍♀️ エミリ (emili.vrm)`,modelUrl:`/models/emili/emili.vrm`,faceBlushTexture:`/textures/girl_face_blush.png`,defaultVoiceGender:`female`,description:`ブロンドヘアのVRMキャラクター (エミリ)`},girl_03:{id:`girl_03`,name:`👩 アオイ [鞄付き] (aoi-school-with-bag.vrm)`,modelUrl:`/models/aoi/aoi-school-with-bag.vrm`,defaultVoiceGender:`female`,description:`学生鞄を携えたアオイのVRMキャラクター`},girl_04:{id:`girl_04`,name:`💤 シオン [制服] (shion-school.vrm)`,modelUrl:`/models/shion/shion-school.vrm`,defaultVoiceGender:`female`,description:`制服スタイルのダウナー系VRMキャラクター (シオン)`},girl_05:{id:`girl_05`,name:`💤 シオン [私服] (shion-private.vrm)`,modelUrl:`/models/shion/shion-private.vrm`,defaultVoiceGender:`female`,description:`私服スタイルのVRMキャラクター (シオン)`},teacher:{id:`teacher`,name:`👩‍🏫 桐島 先生 (teacher.vrm)`,modelUrl:`/models/teacher/teacher.vrm`,defaultVoiceGender:`female`,description:`凛とした佇まいの20代後半の女性教師 (桐島 先生)`},god:{id:`god`,name:`神様 (god.vrm)`,modelUrl:`/models/god.vrm`,defaultVoiceGender:`female`,description:`後光を背負い、顔が光と影に包まれた神格キャラクター`}},motions:{idle:{id:`idle`,name:`待機`,file:`/animations/Idle.fbx`,isLoop:!0,fadeInSec:.5,category:`idle`},standing_idle:{id:`standing_idle`,name:`立ち待機`,file:`/animations/Standing Idle.fbx`,isLoop:!0,fadeInSec:.5,category:`idle`},standing_pose:{id:`standing_pose`,name:`立ちポーズ`,file:`/animations/Female Standing Pose.fbx`,isLoop:!0,fadeInSec:.5,category:`idle`},walking:{id:`walking`,name:`歩行`,file:`/animations/Walking.fbx`,isLoop:!0,fadeInSec:.5,category:`action`},jogging:{id:`jogging`,name:`ジョギング`,file:`/animations/Jogging.fbx`,isLoop:!0,fadeInSec:.5,category:`action`},greeting:{id:`greeting`,name:`挨拶`,file:`/animations/Standing Greeting.fbx`,isLoop:!1,fadeInSec:.5,category:`greeting`},bow:{id:`bow`,name:`お辞儀`,file:`/animations/Quick Formal Bow.fbx`,isLoop:!1,fadeInSec:.5,category:`greeting`},acknowledging:{id:`acknowledging`,name:`うなずく`,file:`/animations/Acknowledging.fbx`,isLoop:!1,fadeInSec:.5,category:`greeting`},dismissing:{id:`dismissing`,name:`手を振る`,file:`/animations/Dismissing Gesture.fbx`,isLoop:!1,fadeInSec:.5,category:`greeting`},salute:{id:`salute`,name:`敬礼`,file:`/animations/Salute.fbx`,isLoop:!1,fadeInSec:.5,category:`action`},excited:{id:`excited`,name:`喜ぶ`,file:`/animations/Excited.fbx`,isLoop:!1,fadeInSec:.5,category:`emotion`},angry:{id:`angry`,name:`怒り`,file:`/animations/Angry.fbx`,isLoop:!1,fadeInSec:.5,category:`emotion`},punching:{id:`punching`,name:`パンチ`,file:`/animations/Punching.fbx`,isLoop:!1,fadeInSec:.4,category:`action`}},sounds:{bgm_main:{id:`bgm_main`,name:`日常・公園BGM`,type:`bgm`,file:`/bgm/bgm.mp3`,volume:.35},se_cicada:{id:`se_cicada`,name:`ヒグラシの鳴き声`,type:`se`,file:`/se/large_brown_cicada.mp3`,volume:.15},confess_intro_1:{id:`confess_intro_1`,name:`告白導入1: 来てくれたんだ`,type:`voice`,file:`/voices/confess_intro_1.wav`},confess_intro_2:{id:`confess_intro_2`,name:`告白導入2: 伝えたいことがあって`,type:`voice`,file:`/voices/confess_intro_2.wav`},confess_intro_3:{id:`confess_intro_3`,name:`告白導入3: どう思ってる？`,type:`voice`,file:`/voices/confess_intro_3.wav`},confess_love_1:{id:`confess_love_1`,name:`告白成功1: やったーっ！`,type:`voice`,file:`/voices/confess_love_1.wav`},confess_love_2:{id:`confess_love_2`,name:`告白成功2: すっごく嬉しい`,type:`voice`,file:`/voices/confess_love_2.wav`},confess_love_3:{id:`confess_love_3`,name:`告白成功3: これからもずっと隣にいてね`,type:`voice`,file:`/voices/confess_love_3.wav`},confess_money_1:{id:`confess_money_1`,name:`告白失敗1: え……？500円？`,type:`voice`,file:`/voices/confess_money_1.wav`},confess_money_2:{id:`confess_money_2`,name:`告白失敗2: ドキドキを返してよー！`,type:`voice`,file:`/voices/confess_money_2.wav`},confess_money_3:{id:`confess_money_3`,name:`告白失敗3: ほら500円！バカーッ！`,type:`voice`,file:`/voices/confess_money_3.wav`},confess_silent_2:{id:`confess_silent_2`,name:`告白沈黙2: なんで何も言わないの`,type:`voice`,file:`/voices/confess_silent_2.wav`},confess_silent_3:{id:`confess_silent_3`,name:`告白沈黙3: もう一回やり直してあげる`,type:`voice`,file:`/voices/confess_silent_3.wav`},scenario_01:{id:`scenario_01`,name:`シーケンス1: ストーカー？`,type:`voice`,file:`/voices/scenario_01.wav`},scenario_02:{id:`scenario_02`,name:`シーケンス2: 冗談だよ`,type:`voice`,file:`/voices/scenario_02.wav`},scenario_03:{id:`scenario_03`,name:`シーケンス3: 何してるの？`,type:`voice`,file:`/voices/scenario_03.wav`},girl4_ref:{id:`girl4_ref`,name:`ダウナー少女 (girl4): 眠いし`,type:`voice`,file:`/voices/girl4_ref.wav`}},scenes:qt},vn=class{db;onDatabaseChangeCallbacks=[];constructor(e){this.db={characters:{...X.characters,...e?.characters||{}},motions:{...X.motions,...e?.motions||{}},sounds:{...X.sounds,...e?.sounds||{}},scenes:{...X.scenes,...e?.scenes||{}}}}subscribe(e){return this.onDatabaseChangeCallbacks.push(e),()=>{this.onDatabaseChangeCallbacks=this.onDatabaseChangeCallbacks.filter(t=>t!==e)}}notifyChange(){this.onDatabaseChangeCallbacks.forEach(e=>{try{e()}catch(e){console.error(`Error in MasterDataManager subscriber:`,e)}})}getCharacters(){return Object.values(this.db.characters)}getCharacter(e){return this.db.characters[e]?this.db.characters[e]:Object.values(this.db.characters).find(t=>t.modelUrl===e||z(t.modelUrl)===z(e))||null}resolveCharacterModelUrl(e){if(!e)return null;let t=this.getCharacter(e);return z(t?t.modelUrl:e)}registerCharacter(e){this.db.characters[e.id]=e,this.notifyChange()}getMotions(){return Object.values(this.db.motions)}getMotion(e){return this.db.motions[e]?this.db.motions[e]:Object.values(this.db.motions).find(t=>t.file===e||z(t.file)===z(e))||null}resolveMotionUrl(e){if(!e)return null;let t=this.getMotion(e);return z(t?t.file:e)}registerMotion(e){this.db.motions[e.id]=e,this.notifyChange()}getSounds(e){let t=Object.values(this.db.sounds);return e?t.filter(t=>t.type===e):t}getSound(e){return this.db.sounds[e]?this.db.sounds[e]:Object.values(this.db.sounds).find(t=>t.file===e||z(t.file)===z(e))||null}resolveSoundUrl(e){if(!e)return null;let t=this.getSound(e);return z(t?t.file:e)}registerSound(e){this.db.sounds[e.id]=e,this.notifyChange()}getScenes(){return Object.values(this.db.scenes)}getScene(e){return this.db.scenes[e]||null}registerScene(e){this.db.scenes[e.id]=e,this.notifyChange()}exportJSON(){return JSON.stringify(this.db,null,2)}downloadJSON(e=`masters.json`){let t=this.exportJSON(),n=new Blob([t],{type:`application/json`}),r=URL.createObjectURL(n),i=document.createElement(`a`);i.href=r,i.download=e,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(r)}importJSON(e){try{let t=JSON.parse(e);return t.characters&&(this.db.characters={...this.db.characters,...t.characters}),t.motions&&(this.db.motions={...this.db.motions,...t.motions}),t.sounds&&(this.db.sounds={...this.db.sounds,...t.sounds}),t.scenes&&(this.db.scenes={...this.db.scenes,...t.scenes}),this.notifyChange(),!0}catch(e){return console.error(`Failed to import Master JSON:`,e),!1}}resetToDefault(){this.db={characters:{...X.characters},motions:{...X.motions},sounds:{...X.sounds},scenes:{...X.scenes}},this.notifyChange()}},Z={left:[-.65,0,-.45],right:[.65,0,-.45],center:[0,0,-.3]},yn={left:.22,right:-.22,center:0};function bn(e){return e===1?1:1-2**(-10*e)}function xn(e){return e<.5?4*e*e*e:1-(-2*e+2)**3/2}function Sn(e){return 1-(1-e)**3}var Cn=class{camera;controls;getAvatar;getAvatars;_isActive=!1;baseState={position:new k,target:new k,fov:30};transitionStart={position:new k,target:new k,fov:30};transitionTarget={position:new k,target:new k,fov:30};currentPose={position:new k,target:new k,fov:30};transitionDuration=.7;transitionElapsed=0;transitionEasing=`gyuin`;isTransitioning=!1;isInstantCutMode=!1;currentPreset=`hold`;currentStrength=1;sceneElapsed=0;baseFov=30;baseDistance=3;backgroundZoomScale=1;backgroundPanOffset=new C(0,0);customBackgroundZoom;customBackgroundOffset;_workingPosition=new k;_workingTarget=new k;_tempVecA=new k;_tempVecB=new k;_tempForward=new k;_tempRight=new k;_yAxis=new k(0,1,0);panoramaController;constructor(e){this.camera=e.camera,this.controls=e.controls,this.getAvatar=e.getAvatar,this.getAvatars=e.getAvatars,this.panoramaController=e.panoramaController,this.baseFov=this.camera.fov||30}get isActive(){return this._isActive}getBackgroundTransform(){return{zoomScale:this.backgroundZoomScale,panOffsetX:this.backgroundPanOffset.x,panOffsetY:this.backgroundPanOffset.y}}start(){this._isActive||(this._isActive=!0,this.baseState.position.copy(this.camera.position),this.baseState.target.copy(this.controls.target),this.baseState.fov=this.camera.fov,this.baseDistance=this.camera.position.distanceTo(this.controls.target),this.baseDistance<.5&&(this.baseDistance=3),this.currentPose.position.copy(this.camera.position),this.currentPose.target.copy(this.controls.target),this.currentPose.fov=this.camera.fov,this.controls.enabled=!1,this.panoramaController?.setCameraControlEnabled(!1))}setInstantCutMode(e){this.isInstantCutMode=e}stop(e=!1){this._isActive&&(this._isActive=!1,this.isTransitioning=!1,this.isInstantCutMode=!1,this.backgroundZoomScale=1,this.backgroundPanOffset.set(0,0),this.customBackgroundZoom=void 0,this.customBackgroundOffset=void 0,this.panoramaController?.setCameraControlEnabled(!0),this.camera.position.copy(this.baseState.position),this.controls.target.copy(this.baseState.target),this.camera.fov=this.baseState.fov,this.camera.updateProjectionMatrix(),this.camera.lookAt(this.controls.target),this.controls.enabled=!1,this.controls.update())}applyScene(e,t){this._isActive||this.start(),this.sceneElapsed=0,this.currentPreset=e.cameraPreset||`hold`,this.currentStrength=e.cameraStrength??1,this.customBackgroundZoom=e.backgroundZoom,this.customBackgroundOffset=e.backgroundOffset;let n=e.cameraTargetCharacterId||(typeof e.cameraTarget==`string`&&!(e.cameraTarget in Z)?e.cameraTarget:void 0)||e.speakerCharacterId||e.character||t,{targetPos:r,defaultCameraPos:i,defaultFov:a}=this.calculateShotFraming(e,n);this.transitionStart.position.copy(this.camera.position),this.transitionStart.target.copy(this.controls.target),this.transitionStart.fov=this.camera.fov,this.transitionTarget.position.copy(i),this.transitionTarget.target.copy(r),this.transitionTarget.fov=a;let o=this.isInstantCutMode||e.cameraTransitionEasing===`cut`||e.cameraTransitionDuration!==void 0&&e.cameraTransitionDuration<=.05;this.transitionDuration=o?.01:Math.max(.01,e.cameraTransitionDuration??.7),this.transitionEasing=o?`cut`:e.cameraTransitionEasing??`gyuin`,this.transitionElapsed=0,this.isTransitioning=!0,(this.transitionEasing===`cut`||this.transitionDuration<=.05)&&(this.currentPose.position.copy(this.transitionTarget.position),this.currentPose.target.copy(this.transitionTarget.target),this.currentPose.fov=this.transitionTarget.fov,this.isTransitioning=!1,this.applyCameraPose(this.currentPose))}calculateShotFraming(e,t){let n=new k(0,1.25,0),r=new k(0,1.25,2.5),i=this.baseFov,a=this.getAvatars?this.getAvatars():[],o=a.length>1,s=null;t&&(s=this.getAvatar(t)),!s&&o&&a.length>0?s=a[0]:s||=this.getAvatar(),s&&!s.getVisible()&&(s=null);let c=new k(0,0,0);s?.vrm?.scene&&s.vrm.scene.getWorldPosition(c);let l=e.cameraZoom||(s?`speaker`:`wide`);e.cameraZoom||(l=e.choices&&e.choices.length>0||e.speaker?.includes(`&`)||e.speaker?.includes(`＆`)?`wide`:e.cameraStartAngle===`closeUp`?`speaker_close`:e.cameraStartAngle===`farFront`?`wide`:t||!o?`speaker`:`wide`);let u=Math.max(.3,e.cameraDistance??1);if(e.cameraTarget){if(typeof e.cameraTarget==`string`&&e.cameraTarget in Z){let t=Z[e.cameraTarget];n.set(t[0],t[1]+1.25,t[2])}else if(Array.isArray(e.cameraTarget))n.set(e.cameraTarget[0],e.cameraTarget[1],e.cameraTarget[2]);else if(typeof e.cameraTarget==`string`){let t=this.getAvatar(e.cameraTarget);if(t?.vrm?.scene){let e=new k;t.vrm.scene.getWorldPosition(e),n.set(e.x,e.y+1.25,e.z)}}}else l===`wide`?n.set(0,1.15,-.3):n.set(c.x,c.y+(l===`speaker_extreme_close`?1.33:l===`speaker_close`?1.3:1.25),c.z);let d=e.cameraStartAngle||`front`,f=c.z>.3,p=!!this.panoramaController?.isActive,m=!!(e.panoramaBackgroundUrl||e.usePanoramaCamera),h=Math.abs(this.camera.position.x)<.2&&Math.abs(this.camera.position.z)<.2,g=a.length>1&&a.some(e=>e.vrm?.scene?e.vrm.scene.position.z>.3:e.initialPosition.z>.3)&&a.some(e=>e.vrm?.scene?e.vrm.scene.position.z<-.3:e.initialPosition.z<-.3);if(p||m||g||o&&h)switch(r.set(0,1.15,0),l){case`speaker_extreme_close`:i=Math.max(18,this.baseFov-10);break;case`speaker_close`:i=Math.max(22,this.baseFov-6);break;case`speaker`:i=this.baseFov;break;case`wide`:i=this.baseFov+6;break;default:i=this.baseFov;break}else{let t=f?-1:1;switch(l){case`speaker_extreme_close`:{let e=(o?.95:.85)*u;i=Math.max(20,this.baseFov-6);let a=c.x<0?.05:c.x>0?-.05:0;r.set(n.x+a,n.y+.02,n.z+e*t);break}case`speaker_close`:{let e=(o?1.45:1.35)*u;i=Math.max(22,this.baseFov-4);let a=c.x<0?.09:c.x>0?-.09:0;r.set(n.x+a,n.y+.02,n.z+e*t);break}case`speaker`:{let e=(o?1.85:1.7)*u;i=this.baseFov;let a=c.x<0?.12:c.x>0?-.12:0;r.set(n.x+a,n.y+.04,n.z+e*t);break}case`medium`:{let e=2.4*u;i=this.baseFov,r.set(n.x,n.y+.05,n.z+e*t);break}case`wide`:{let e=(o?3.6:3)*u;i=this.baseFov,r.set(0,1.18,e*t);break}case`none`:case`hold`:e.cameraPosition||r.copy(this.camera.position),e.cameraTarget||n.copy(this.controls.target),i=this.camera.fov;break}}if(d===`lowAngle`?(r.y=n.y-.45,r.z=n.z+1.2*u):d===`highAngle`?(r.y=n.y+.7,r.z=n.z+1.5*u):d===`right`?r.set(n.x+1.3*u,n.y,n.z+.4):d===`left`&&r.set(n.x-1.3*u,n.y,n.z+.4),e.cameraTarget){if(typeof e.cameraTarget==`string`&&e.cameraTarget in Z){let t=Z[e.cameraTarget];n.set(t[0],t[1]+1.25,t[2])}else if(Array.isArray(e.cameraTarget))n.set(e.cameraTarget[0],e.cameraTarget[1],e.cameraTarget[2]);else if(typeof e.cameraTarget==`string`){let t=this.getAvatar(e.cameraTarget);if(t?.vrm?.scene){let e=new k;t.vrm.scene.getWorldPosition(e),n.set(e.x,e.y+1.25,e.z)}}}return e.cameraPosition&&r.set(e.cameraPosition[0],e.cameraPosition[1],e.cameraPosition[2]),e.cameraFov&&(i=e.cameraFov),{targetPos:n,defaultCameraPos:r,defaultFov:i}}update(e){if(!this._isActive)return;if(this.sceneElapsed+=e,this.isTransitioning){this.transitionElapsed+=e;let t=Math.min(1,this.transitionElapsed/this.transitionDuration),n=t;this.transitionEasing===`gyuin`?n=bn(t):this.transitionEasing===`smooth`&&(n=xn(t)),this.currentPose.position.lerpVectors(this.transitionStart.position,this.transitionTarget.position,n);let r=new k().subVectors(this.transitionStart.target,this.transitionStart.position),i=new k().subVectors(this.transitionTarget.target,this.transitionTarget.position),a=r.length(),o=i.length();if(a>.001&&o>.001){r.normalize(),i.normalize();let e=Math.atan2(r.x,r.z),t=Math.atan2(i.x,i.z)-e;for(;t<-Math.PI;)t+=Math.PI*2;for(;t>Math.PI;)t-=Math.PI*2;let s=e+t*n,c=j.lerp(r.y,i.y,n),l=j.lerp(a,o,n),u=Math.sqrt(Math.max(0,1-c*c)),d=new k(Math.sin(s)*u,c,Math.cos(s)*u).normalize();this.currentPose.target.copy(this.currentPose.position).addScaledVector(d,l)}else this.currentPose.target.lerpVectors(this.transitionStart.target,this.transitionTarget.target,n);this.currentPose.fov=j.lerp(this.transitionStart.fov,this.transitionTarget.fov,n),t>=1&&(this.isTransitioning=!1)}let t={position:this._workingPosition.copy(this.currentPose.position),target:this._workingTarget.copy(this.currentPose.target),fov:this.currentPose.fov};if(this.currentPreset!==`hold`){let e=Sn(Math.min(1,this.sceneElapsed/4)),n=this.currentStrength;switch(this._tempForward.subVectors(t.target,t.position).normalize(),this._tempRight.crossVectors(this._tempForward,this._yAxis).normalize(),this.currentPreset){case`pushIn`:{let r=.22*n*e;t.position.addScaledVector(this._tempForward,r);break}case`pullOut`:{let r=-.25*n*e;t.position.addScaledVector(this._tempForward,r);break}case`punchIn`:{let e=bn(Math.min(1,this.sceneElapsed/.5)),r=.2*n*e;t.position.addScaledVector(this._tempForward,r);break}case`orbitLeftHalf`:{let r=-.12*n*e;t.position.sub(t.target).applyAxisAngle(this._yAxis,r).add(t.target);break}case`orbitRightHalf`:{let r=.12*n*e;t.position.sub(t.target).applyAxisAngle(this._yAxis,r).add(t.target);break}case`lowAngleUp`:{let r=.15*n*e;t.position.y+=r;break}case`spiralRise`:{let e=xn(Math.min(1,this.sceneElapsed/2)),n=1.15+.10000000000000009*e;t.target.set(.38,n,-1.15);let r=-Math.PI*2*(1-e),i=.72+.53*e,a=.82+-.1499999999999999*e;t.position.set(t.target.x+Math.sin(r)*a,i,t.target.z+Math.cos(r)*a);break}}let r=t.position.distanceTo(t.target),i=.65;r<i&&(this._tempVecA.subVectors(t.position,t.target),this._tempVecA.lengthSq()<1e-4?this._tempVecA.set(0,0,1):this._tempVecA.normalize(),t.position.copy(t.target).addScaledVector(this._tempVecA,i))}this.applyCameraPose(t);let n=t.position.distanceTo(t.target),r=this.baseDistance/Math.max(.4,n),i=this.baseFov/Math.max(15,t.fov),a=r**.45*i**.8,o=Math.max(1,Math.min(1.65,a));this.backgroundZoomScale=this.customBackgroundZoom===void 0?o:this.customBackgroundZoom;let s=new k().subVectors(this.baseState.target,this.baseState.position),c=new k().subVectors(t.target,t.position),l=Math.atan2(s.x,s.z),u=Math.atan2(c.x,c.z)-l;for(;u<-Math.PI;)u+=Math.PI*2;for(;u>Math.PI;)u-=Math.PI*2;let d=Math.asin(Math.max(-1,Math.min(1,s.y/Math.max(.001,s.length())))),f=Math.asin(Math.max(-1,Math.min(1,c.y/Math.max(.001,c.length()))))-d,p=(t.target.x-this.baseState.target.x)*.15+u*.22,m=(t.target.y-this.baseState.target.y)*.1+f*.18;this.customBackgroundOffset?.x!==void 0&&(p+=this.customBackgroundOffset.x),this.customBackgroundOffset?.y!==void 0&&(m+=this.customBackgroundOffset.y),this.backgroundPanOffset.set(p,m)}applyCameraPose(e){this.camera.position.copy(e.position),this.controls.target.copy(e.target),Math.abs(this.camera.fov-e.fov)>.01&&(this.camera.fov=e.fov,this.camera.updateProjectionMatrix()),this.camera.lookAt(this.controls.target)}},wn=class{parentContainer=null;container=null;contentEl=null;speakerEl=null;locationBadgeEl=null;nextIconEl=null;choicesContainerEl=null;fullText=``;currentSpeaker=``;currentLocation=``;currentDisplayedLength=0;typingTimer=null;typingSpeedMs=24;onNextClick;onStopClick;onAutoToggle;onTypingComplete;isVisible=!1;isChoicesVisible=!1;isAutoMode=!1;boundKeyHandler=null;countdownIntervalId=null;countdownSeconds=10;constructor(e={}){this.parentContainer=e.container??null,this.typingSpeedMs=e.typingSpeedMs??24,this.onNextClick=e.onNextClick,this.onStopClick=e.onStopClick,this.onAutoToggle=e.onAutoToggle,this.onTypingComplete=e.onTypingComplete,this.injectStyles()}getParentContainer(){return this.parentContainer??document.getElementById(`viewport-container`)??document.body}injectStyles(){if(document.getElementById(`adv-message-window-styles`))return;let e=document.createElement(`style`);e.id=`adv-message-window-styles`,e.textContent=`
      /* --- Message Window Container --- */
      .adv-message-container {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: clamp(160px, 30%, 270px);
        background: linear-gradient(to bottom, rgba(3, 7, 18, 0) 0%, rgba(3, 7, 18, 0.78) 24%, rgba(3, 7, 18, 0.96) 100%);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 36px 24px 20px;
        box-sizing: border-box;
        z-index: 50;
        pointer-events: auto;
        cursor: pointer;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }

      .adv-message-container.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* --- Top Left Location Badge --- */
      .adv-location-badge {
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 60;
        background: rgba(15, 23, 42, 0.85);
        color: #e2e8f0;
        border: 1px solid rgba(148, 163, 184, 0.3);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', serif;
        font-weight: 500;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        gap: 6px;
        opacity: 0;
        transform: translateX(-10px);
        transition: all 0.3s ease;
        pointer-events: none;
      }

      .adv-location-badge.visible {
        opacity: 1;
        transform: translateX(0);
      }

      /* --- Top Right Floating Controls --- */
      .adv-top-controls {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 60;
        display: flex;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .adv-top-controls.visible {
        opacity: 1;
      }

      .adv-auto-btn {
        background: rgba(15, 23, 42, 0.75);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-family: sans-serif;
        font-weight: 700;
        letter-spacing: 0.05em;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: all 0.25s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        user-select: none;
      }

      .adv-auto-btn:hover {
        background: rgba(30, 41, 59, 0.9);
        color: #f1f5f9;
        border-color: rgba(56, 189, 248, 0.6);
        transform: scale(1.05);
      }

      .adv-auto-btn.active {
        background: linear-gradient(135deg, rgba(2, 132, 199, 0.85) 0%, rgba(14, 165, 233, 0.95) 100%);
        color: #ffffff;
        border-color: #38bdf8;
        box-shadow: 0 0 16px rgba(56, 189, 248, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
      }

      .adv-auto-btn .adv-auto-icon {
        font-size: 10px;
        transition: transform 0.2s ease;
      }

      .adv-auto-btn.active .adv-auto-icon {
        animation: adv-auto-pulse 1.2s infinite alternate ease-in-out;
      }

      @keyframes adv-auto-pulse {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        100% {
          transform: scale(1.35);
          opacity: 1;
          text-shadow: 0 0 6px #ffffff;
        }
      }

      .adv-stop-btn {
        background: rgba(15, 23, 42, 0.75);
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-family: sans-serif;
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .adv-stop-btn:hover {
        background: rgba(239, 68, 68, 0.85);
        border-color: rgba(239, 68, 68, 1);
        transform: scale(1.05);
      }

      /* --- Message Body --- */
      .adv-message-body {
        max-width: 720px;
        width: 100%;
        color: #ccfbf1;
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', serif;
        font-size: clamp(16px, 2.2vw, 22px);
        font-weight: 500;
        line-height: 1.85;
        letter-spacing: 0.04em;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9), 0 0 20px rgba(15, 23, 42, 0.8);
        position: relative;
        padding-bottom: 8px;
      }

      .adv-speaker-name {
        color: #7dd3fc;
        font-weight: 700;
        font-size: 0.92em;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .adv-speaker-name::before {
        content: '◆';
        font-size: 0.7em;
        color: #38bdf8;
      }

      .adv-quote-mark {
        color: #93c5fd;
      }

      .adv-next-indicator {
        position: absolute;
        right: 0;
        bottom: -6px;
        display: none;
        animation: adv-bounce 1.2s infinite ease-in-out;
      }

      .adv-next-indicator.show {
        display: block;
      }

      .adv-next-indicator svg {
        width: 24px;
        height: 24px;
        fill: #38bdf8;
        filter: drop-shadow(0 2px 6px rgba(56, 189, 248, 0.6));
      }

      /* --- Persona/Anime Style Choice Dialog & Backdrop --- */
      .adv-choices-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.5);
        backdrop-filter: blur(8px);
        z-index: 70;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
        overflow: hidden;
      }

      .adv-choices-backdrop.visible {
        opacity: 1;
        pointer-events: auto;
      }

      /* Dynamic VFX Prominent Speedlines & Diagonal Action Bands */
      .adv-vfx-speedlines {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 1;
      }

      /* Solid dynamic action bands (Visible & gentle continuous floating) */
      .adv-vfx-band {
        position: absolute;
        left: -60%;
        width: 220%;
        transform: rotate(-18deg);
        pointer-events: none;
      }

      .adv-vfx-band.b1 {
        top: 14%;
        height: 42px;
        background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #1e3a8a 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 24px rgba(29, 78, 216, 0.45);
        opacity: 0.7;
        animation: vfx-light-flow-slow 7.5s linear infinite, vfx-band-sway-1 8s ease-in-out infinite alternate;
      }

      .adv-vfx-band.b2 {
        top: 60%;
        height: 30px;
        background: linear-gradient(90deg, #0369a1 0%, #0ea5e9 50%, #0369a1 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 20px rgba(2, 132, 199, 0.45);
        opacity: 0.75;
        animation: vfx-light-flow-rev 6.5s linear infinite, vfx-band-sway-2 7s ease-in-out infinite alternate;
      }

      .adv-vfx-band.b3 {
        top: 82%;
        height: 18px;
        background: linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #0284c7 100%);
        background-size: 200% 100%;
        opacity: 0.8;
        animation: vfx-light-flow-slow 6s linear infinite, vfx-band-sway-3 6s ease-in-out infinite alternate;
      }

      /* Glowing Laser Slashes (Continuous dynamic floating & light streams) */
      .adv-vfx-beam {
        position: absolute;
        left: -60%;
        width: 220%;
        transform: rotate(-18deg);
        pointer-events: none;
      }

      /* Cyan Laser Beam */
      .adv-vfx-beam.m1 {
        top: 22%;
        height: 8px;
        background: linear-gradient(90deg, #0284c7 0%, #38bdf8 25%, #ffffff 50%, #38bdf8 75%, #0284c7 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 20px #38bdf8, 0 0 36px rgba(56, 189, 248, 0.9);
        opacity: 0.9;
        animation: vfx-light-flow-fast 4.5s linear infinite, vfx-beam-sway-1 5.5s ease-in-out infinite alternate;
      }

      /* Deep Blue Laser Beam */
      .adv-vfx-beam.m2 {
        top: 46%;
        height: 9px;
        background: linear-gradient(90deg, #1e40af 0%, #3b82f6 30%, #93c5fd 50%, #3b82f6 70%, #1e40af 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 22px #38bdf8, 0 0 44px rgba(37, 99, 235, 0.95);
        opacity: 0.9;
        animation: vfx-light-flow-slow 5.5s linear infinite, vfx-beam-sway-2 6.8s ease-in-out infinite alternate;
      }

      /* Yellow Laser Beam */
      .adv-vfx-beam.m3 {
        top: 72%;
        height: 8px;
        background: linear-gradient(90deg, #ca8a04 0%, #facc15 25%, #fef08a 50%, #facc15 75%, #ca8a04 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 18px rgba(250, 204, 21, 0.95), 0 0 32px rgba(250, 204, 21, 0.6);
        opacity: 0.92;
        animation: vfx-light-flow-fast 4.8s linear infinite, vfx-beam-sway-3 5.8s ease-in-out infinite alternate;
      }

      /* Sharp Speed Cuts */
      .adv-vfx-line {
        position: absolute;
        left: -60%;
        width: 220%;
        height: 2px;
        background: #38bdf8;
        transform: rotate(-18deg);
        opacity: 0.8;
        pointer-events: none;
      }

      .adv-vfx-line.l1 {
        top: 8%;
        animation: vfx-beam-sway-1 4.2s ease-in-out infinite alternate;
      }

      .adv-vfx-line.l2 {
        top: 34%;
        height: 3px;
        animation: vfx-beam-sway-3 5s ease-in-out infinite alternate;
      }

      .adv-vfx-line.l3 {
        top: 56%;
        animation: vfx-beam-sway-2 5.5s ease-in-out infinite alternate;
      }

      .adv-vfx-line.l4 {
        top: 88%;
        height: 3px;
        animation: vfx-beam-sway-1 6.2s ease-in-out infinite alternate;
      }

      /* Streaming light across borders */
      @keyframes vfx-light-flow-fast {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      @keyframes vfx-light-flow-slow {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      @keyframes vfx-light-flow-rev {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      /* Vertical / Transverse Sway Motions (Visibly drifting without being too fast) */
      @keyframes vfx-band-sway-1 {
        0% {
          transform: rotate(-18deg) translateY(-14px);
        }
        100% {
          transform: rotate(-18deg) translateY(16px);
        }
      }

      @keyframes vfx-band-sway-2 {
        0% {
          transform: rotate(-18deg) translateY(18px);
        }
        100% {
          transform: rotate(-18deg) translateY(-16px);
        }
      }

      @keyframes vfx-band-sway-3 {
        0% {
          transform: rotate(-18deg) translateY(-12px);
        }
        100% {
          transform: rotate(-18deg) translateY(14px);
        }
      }

      @keyframes vfx-beam-sway-1 {
        0% {
          transform: rotate(-18deg) translateY(-20px);
        }
        100% {
          transform: rotate(-18deg) translateY(22px);
        }
      }

      @keyframes vfx-beam-sway-2 {
        0% {
          transform: rotate(-18deg) translateY(24px);
        }
        100% {
          transform: rotate(-18deg) translateY(-18px);
        }
      }

      @keyframes vfx-beam-sway-3 {
        0% {
          transform: rotate(-18deg) translateY(-22px);
        }
        100% {
          transform: rotate(-18deg) translateY(25px);
        }
      }

      /* Dynamic VFX Shockwave Rings */
      .adv-vfx-rings {
        position: absolute;
        left: 10%;
        bottom: 10%;
        width: 10px;
        height: 10px;
        pointer-events: none;
        z-index: 1;
      }

      .adv-vfx-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 2px solid rgba(59, 130, 246, 0.7);
        border-radius: 50%;
        opacity: 0;
      }

      .adv-vfx-ring.r1 {
        animation: vfx-ring-ripple 0.75s cubic-bezier(0.1, 0.85, 0.25, 1) 0.08s forwards;
      }

      .adv-vfx-ring.r2 {
        animation: vfx-ring-ripple 0.85s cubic-bezier(0.1, 0.85, 0.25, 1) 0.18s forwards;
      }

      .adv-vfx-ring.r3 {
        animation: vfx-ring-ripple 0.95s cubic-bezier(0.1, 0.85, 0.25, 1) 0.28s forwards;
      }

      @keyframes vfx-ring-ripple {
        0% {
          width: 20px;
          height: 20px;
          opacity: 0.95;
          border-color: rgba(96, 165, 250, 0.95);
        }
        100% {
          width: 440px;
          height: 440px;
          opacity: 0;
          border-color: rgba(37, 99, 235, 0);
        }
      }

      /* Bottom Solid Accent Bar (in front of characters) */
      .adv-vfx-bottom-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: clamp(28px, 4vh, 38px);
        background: #1d4ed8;
        border-top: 2px solid #38bdf8;
        clip-path: polygon(0 35%, 100% 0%, 100% 100%, 0% 100%);
        z-index: 10;
        box-shadow: 0 -6px 20px rgba(29, 78, 216, 0.6);
        animation: vfx-bottom-bar-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        pointer-events: none;
      }

      @keyframes vfx-bottom-bar-slide {
        0% {
          transform: translateY(100%);
          opacity: 0;
        }
        100% {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* Character Cut-Ins */
      .adv-cutin-char {
        position: absolute;
        bottom: 0;
        pointer-events: none;
        user-select: none;
        z-index: 3;
      }

      .adv-cutin-left {
        left: -1%;
        height: 85%;
        max-height: 88%;
        animation: cutin-slide-left 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .adv-cutin-right {
        right: 0%;
        height: 76%;
        max-height: 80%;
        animation: cutin-slide-right 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
      }

      .adv-char-shadow {
        position: absolute;
        inset: 0;
        z-index: 1;
        transform: translate(14px, -10px);
        filter: brightness(0) saturate(100%) invert(11%) sepia(94%) saturate(6000%) hue-rotate(230deg) brightness(85%) contrast(120%);
        opacity: 0.96;
      }

      .adv-char-shadow img,
      .adv-char-main img {
        height: 100%;
        width: auto;
        max-height: 100%;
        object-fit: contain;
        display: block;
      }

      .adv-char-main {
        position: relative;
        height: 100%;
        z-index: 2;
        filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.65));
      }

      @keyframes cutin-slide-left {
        0% {
          opacity: 0;
          transform: translate(-50px, 40px) scale(0.94);
        }
        100% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
      }

      @keyframes cutin-slide-right {
        0% {
          opacity: 0;
          transform: translate(50px, 40px) scale(0.94);
        }
        100% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
      }

      /* --- Right Side Graphic Stage & HUD (Persona / Anime Style) --- */
      .adv-right-stage {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 44%;
        pointer-events: none;
        user-select: none;
        overflow: hidden;
        z-index: 2;
      }


      /* Right Dynamic Graphic Slashes */
      .adv-right-slash {
        position: absolute;
        transform: rotate(-22deg) skewX(-10deg);
        border-radius: 4px;
        pointer-events: none;
      }

      .adv-right-slash.s1 {
        right: -20px;
        top: 36%;
        width: 320px;
        height: 14px;
        background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.35), rgba(56, 189, 248, 0.8));
        box-shadow: 0 0 16px rgba(56, 189, 248, 0.4);
        animation: slash-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both;
      }

      .adv-right-slash.s2 {
        right: -40px;
        top: 42%;
        width: 240px;
        height: 6px;
        background: #facc15;
        box-shadow: 0 0 12px rgba(250, 204, 21, 0.5);
        animation: slash-slide 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.22s both;
      }

      .adv-right-slash.s3 {
        right: -10px;
        top: 47%;
        width: 380px;
        height: 24px;
        background: rgba(15, 23, 42, 0.7);
        border-left: 4px solid #38bdf8;
        animation: slash-slide 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.14s both;
      }

      @keyframes slash-slide {
        0% {
          opacity: 0;
          transform: rotate(-22deg) skewX(-10deg) translateX(80px);
        }
        100% {
          opacity: 1;
          transform: rotate(-22deg) skewX(-10deg) translateX(0);
        }
      }


      /* --- Thinking Time Stylish Widget (Bottom Right) --- */
      .adv-thinking-widget {
        position: absolute;
        right: 4%;
        bottom: 4%;
        width: clamp(175px, 22.5vw, 235px);
        height: clamp(175px, 22.5vw, 235px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 15;
        user-select: none;
        pointer-events: none;
        animation: badge-pop-in 0.4s cubic-bezier(0.12, 1.25, 0.28, 1.15) 0.12s both;
      }

      /* Outer Rotating Tech Dash Ring */
      .adv-tt-spin-ring {
        position: absolute;
        inset: -14px;
        border-radius: 50%;
        border: 2.5px dashed rgba(56, 189, 248, 0.65);
        box-shadow: 0 0 16px rgba(56, 189, 248, 0.25);
        animation: spin-clockwise 24s linear infinite;
        pointer-events: none;
      }

      .adv-tt-spin-ring-inner {
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 1.5px solid rgba(250, 204, 21, 0.35);
        pointer-events: none;
      }

      @keyframes spin-clockwise {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* --- Countdown Badge & Digits (Big Bold with Box-Shadow, Top Right) --- */
      .adv-countdown-container {
        position: absolute;
        top: -26px;
        right: -8px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        z-index: 25;
        transform: rotate(6deg);
        pointer-events: none;
        user-select: none;
      }

      .adv-countdown-ribbon {
        background: #facc15;
        color: #0f172a;
        font-family: 'Impact', 'Arial Black', sans-serif;
        font-size: clamp(10px, 1.1vw, 12px);
        font-weight: 900;
        padding: 2px 10px;
        border: 2.5px solid #000000;
        box-shadow: 3px 3px 0px #000000;
        letter-spacing: 0.12em;
        border-radius: 3px;
        white-space: nowrap;
        margin-bottom: -5px;
        margin-right: 2px;
        position: relative;
        z-index: 2;
      }

      .adv-countdown-box {
        background: #ffffff;
        border: 4px solid #000000;
        box-shadow: 6px 6px 0px #000000;
        border-radius: 8px;
        padding: 2px 14px;
        min-width: 78px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.1s ease, border-color 0.2s ease, background 0.2s ease;
      }

      .adv-countdown-box.tick {
        animation: countdown-tick-pop 0.22s cubic-bezier(0.12, 1.25, 0.28, 1.15);
      }

      @keyframes countdown-tick-pop {
        0% {
          transform: scale(1.16);
        }
        100% {
          transform: scale(1);
        }
      }

      .adv-countdown-box.urgent {
        background: #fee2e2;
        border-color: #ef4444;
        box-shadow: 6px 6px 0px #991b1b;
      }

      .adv-countdown-box.urgent .adv-countdown-digits {
        color: #dc2626;
        text-shadow: 1px 1px 0px #000000;
      }

      .adv-countdown-digits {
        font-family: 'Impact', 'Montserrat', 'Arial Black', sans-serif;
        font-size: clamp(38px, 4.6vw, 54px);
        font-weight: 900;
        color: #0f172a;
        line-height: 1;
        letter-spacing: 0.05em;
        text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.15);
      }

      /* Main Circular Badge */
      .adv-thinking-circle-badge {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #2563eb 0%, #1d4ed8 65%, #172554 100%);
        border: 4px solid #000000;
        box-shadow: 7px 7px 0px #000000, 0 0 24px rgba(37, 99, 235, 0.5);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }

      /* Inner subtle diagonal hazard stripes */
      .adv-thinking-circle-badge::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          -45deg,
          rgba(255, 255, 255, 0.04) 0px,
          rgba(255, 255, 255, 0.04) 10px,
          transparent 10px,
          transparent 20px
        );
        pointer-events: none;
      }

      @keyframes badge-pop-in {
        0% {
          opacity: 0;
          transform: scale(0.3) rotate(12deg);
        }
        100% {
          opacity: 1;
          transform: scale(1) rotate(5deg);
        }
      }

      .adv-tt-line {
        display: flex;
        justify-content: center;
        align-items: center;
        white-space: nowrap;
        font-family: 'Impact', 'Arial Black', sans-serif;
        color: #ffffff;
        text-shadow: 2px 2px 0px #000000, 0 0 10px rgba(255, 255, 255, 0.5);
        line-height: 1.05;
        letter-spacing: 0.04em;
        position: relative;
        z-index: 2;
      }

      .adv-tt-line1 {
        font-size: clamp(26px, 3.4vw, 36px);
      }

      .adv-tt-line2 {
        font-size: clamp(32px, 4.2vw, 44px);
        font-weight: 900;
      }


      .adv-tt-char {
        display: inline-block;
        opacity: 0;
        transform: translateY(-14px) scale(1.6);
        animation: tt-char-drop 0.28s cubic-bezier(0.12, 1.25, 0.28, 1.15) forwards;
      }

      .adv-tt-space {
        display: inline-block;
        width: 0.3em;
      }

      @keyframes tt-char-drop {
        0% {
          opacity: 0;
          transform: translateY(-14px) scale(1.6) rotate(-8deg);
        }
        70% {
          opacity: 1;
          transform: translateY(2px) scale(0.92) rotate(2deg);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1) rotate(0deg);
        }
      }

      /* Dynamic Persona Typography Title (Top Center) */
      .adv-persona-title-container {
        position: absolute;
        top: 10%;
        left: 50%;
        transform: translateX(-50%) skewX(-8deg);
        z-index: 25;
        pointer-events: none;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 20px;
      }

      /* Dynamic Slash Background Accent */
      .adv-p-bg-slash {
        position: absolute;
        top: 50%;
        left: -40px;
        right: -40px;
        height: clamp(38px, 4.8vw, 56px);
        background: #0f172a;
        transform: translateY(-50%) skewX(-10deg);
        z-index: 1;
        opacity: 0;
        border-top: 3px solid #38bdf8;
        border-bottom: 3px solid #38bdf8;
        box-shadow: 0 0 24px rgba(56, 189, 248, 0.45);
        animation: persona-slash-enter 0.34s cubic-bezier(0.16, 1, 0.3, 1) 0.04s forwards;
      }

      @keyframes persona-slash-enter {
        0% {
          opacity: 0;
          transform: translateY(-50%) skewX(-10deg) scaleX(0.1);
        }
        100% {
          opacity: 0.92;
          transform: translateY(-50%) skewX(-10deg) scaleX(1);
        }
      }

      .adv-persona-text-row {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: clamp(10px, 1.8vw, 22px);
      }

      .adv-p-word {
        display: flex;
        align-items: center;
        gap: 3px;
      }

      /* Persona Letter Cutout Tile */
      .adv-p-char {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: 'Impact', 'Montserrat', 'Arial Black', sans-serif;
        font-size: clamp(28px, 3.8vw, 48px);
        font-weight: 900;
        line-height: 1;
        padding: clamp(4px, 0.6vw, 8px) clamp(8px, 1.1vw, 14px);
        background: #0f172a;
        color: #ffffff;
        border: 2.5px solid #ffffff;
        box-shadow: 4px 4px 0px #0b1d47;
        border-radius: 3px;
        opacity: 0;
        transform-origin: center center;
        animation: persona-char-slam 0.28s cubic-bezier(0.12, 1.25, 0.28, 1.15) forwards;
        animation-delay: var(--delay, 0s);
      }

      /* High-contrast tiles for Persona typography rhythm */
      .adv-p-char.accent {
        background: #ffffff;
        color: #0f172a;
        border-color: #0f172a;
        box-shadow: 4px 4px 0px #0284c7;
      }

      .adv-p-char.accent-cyan {
        background: #0284c7;
        color: #ffffff;
        border-color: #ffffff;
        box-shadow: 4px 4px 0px #0b1d47;
      }

      .adv-p-char.bang {
        background: #facc15;
        color: #0f172a;
        border-color: #0f172a;
        box-shadow: 4px 4px 0px #0b1d47;
        font-size: clamp(30px, 4.2vw, 52px);
      }

      @keyframes persona-char-slam {
        0% {
          opacity: 0;
          transform: scale(2.8) translateY(-40px) rotate(-16deg);
          filter: blur(6px);
        }
        65% {
          opacity: 1;
          transform: scale(0.92) translateY(3px) rotate(calc(var(--rot, 0deg) * -0.5));
          filter: blur(0);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0) rotate(var(--rot, 0deg));
        }
      }

      /* Choices Container */
      .adv-choices-container {
        position: absolute;
        top: 54%;
        left: 51%;
        transform: translate(-50%, -50%);
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: 20px;
        width: 52%;
        max-width: 580px;
        min-width: 350px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .adv-choices-container.visible {
        pointer-events: auto;
        opacity: 1;
      }

      /* Pop & Bold Anime Choice Card (White bg, thick outline, solid shadow) */
      .adv-choice-btn {
        position: relative;
        background: #ffffff;
        color: #0f172a;
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', sans-serif;
        font-size: clamp(15px, 1.6vw, 19px);
        font-weight: 800;
        letter-spacing: 0.02em;
        padding: 16px 24px 16px 56px;
        border: 3.5px solid #0f172a;
        border-radius: 8px;
        overflow: visible;
        box-shadow: 7px 7px 0px #0b1d47;
        cursor: pointer;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 14px;
        user-select: none;
        transform-origin: center center;
        transform: skewX(-6deg);
        opacity: 0;
        z-index: 1;
        transition: transform 0.2s cubic-bezier(0.18, 1.25, 0.32, 1.15), background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
      }

      .adv-choice-btn.slam-in {
        animation: choice-slice-in 0.36s cubic-bezier(0.12, 1.2, 0.28, 1.15) both;
      }

      @keyframes choice-slice-in {
        0% {
          opacity: 0;
          transform: translate(90px, -6px) skewX(-6deg) scaleX(1.12);
          filter: blur(8px);
        }
        65% {
          opacity: 1;
          transform: translate(-5px, 1px) skewX(-6deg) scaleX(0.98);
          filter: blur(0);
        }
        100% {
          opacity: 1;
          transform: translate(0, 0) skewX(-6deg) scaleX(1);
        }
      }

      /* Number Badge: Large, Bold, Overflowing/Popping Out of the Card (Ahead of speech tail) */
      .adv-choice-badge {
        position: absolute;
        left: -18px;
        top: -12px;
        background: #0284c7;
        color: #ffffff;
        border: 3px solid #0f172a;
        box-shadow: 3px 3px 0px #0f172a;
        font-family: 'Impact', 'Arial Black', sans-serif;
        font-size: clamp(24px, 2.5vw, 32px);
        font-weight: 900;
        padding: 3px 12px;
        border-radius: 6px;
        transform: rotate(-6deg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 0.05em;
        line-height: 1;
        flex-shrink: 0;
        z-index: 15;
        transition: transform 0.2s cubic-bezier(0.18, 1.25, 0.32, 1.15), background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
      }

      .adv-choice-text {
        position: relative;
        z-index: 5;
        flex: 1;
        line-height: 1.4;
      }

      /* Hover States: Slightly bigger, deeper shadow, pop colors */
      .adv-choice-btn:hover {
        background: #ffffff;
        border-color: #0284c7;
        color: #0284c7;
        transform: translate(-10px, -2px) skewX(-6deg) scale(1.05);
        box-shadow: 11px 11px 0px #0b1d47;
      }

      .adv-choice-btn:hover .adv-choice-badge {
        background: #facc15;
        color: #0f172a;
        border-color: #0f172a;
        transform: rotate(-2deg) scale(1.12);
        box-shadow: 4px 4px 0px #0f172a;
      }

      .adv-choice-btn:active {
        transform: translate(-6px, 1px) skewX(-6deg) scale(0.99);
        box-shadow: 5px 5px 0px #0b1d47;
      }

      /* Seamless Speech Balloon Arrow on Hover (Behind badge z-index:1, no box-shadow, matching cyan border) */
      .adv-choice-speech-tail {
        position: absolute;
        right: calc(100% - 3px);
        top: 0;
        bottom: 0;
        transform: scaleX(0);
        transform-origin: right center;
        width: clamp(40px, 5.5vw, 75px);
        pointer-events: none;
        z-index: 1;
        opacity: 0;
        overflow: visible;
        transition: transform 0.22s cubic-bezier(0.12, 1.25, 0.28, 1.15), opacity 0.18s ease;
      }

      .adv-choice-btn:hover .adv-choice-speech-tail {
        transform: scaleX(1);
        opacity: 1;
      }

      .adv-speech-tail-svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }

      @keyframes adv-bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(6px);
        }
      }

      /* --- Eyelid Closing / Opening Transition Curtains --- */
      .adv-eyelid-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 45;
        overflow: hidden;
      }

      .adv-eyelid {
        position: absolute;
        left: -8%;
        width: 116%;
        height: 56%;
        background: #000000;
        transition: transform 0.95s cubic-bezier(0.22, 1, 0.36, 1);
        box-shadow: 0 0 50px 30px rgba(0, 0, 0, 0.95);
      }

      .adv-eyelid-top {
        top: 0;
        transform: translateY(-102%);
        border-bottom-left-radius: 50% 60px;
        border-bottom-right-radius: 50% 60px;
      }

      .adv-eyelid-bottom {
        bottom: 0;
        transform: translateY(102%);
        border-top-left-radius: 50% 60px;
        border-top-right-radius: 50% 60px;
      }

      .adv-eyelid-overlay.closed .adv-eyelid-top {
        transform: translateY(0%);
      }

      .adv-eyelid-overlay.closed .adv-eyelid-bottom {
        transform: translateY(0%);
      }

      /* ================================================== */
      /* Responsive: Mobile Portrait (縦向き)               */
      /* ================================================== */
      body.is-portrait .adv-message-container,
      .is-portrait .adv-message-container {
        height: var(--adv-msg-height, 175px) !important;
        max-height: var(--adv-msg-height, 175px) !important;
        box-sizing: border-box !important;
        padding: 14px 18px 12px !important;
        bottom: 0 !important;
        transform: none !important;
        background: linear-gradient(to bottom, rgba(5, 9, 20, 0.94) 0%, rgba(3, 7, 18, 0.98) 100%) !important;
        border-top: 1px solid rgba(56, 189, 248, 0.3) !important;
        box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.75) !important;
      }

      body.is-portrait .adv-message-body,
      .is-portrait .adv-message-body {
        font-size: clamp(13px, 3.8vw, 15.5px) !important;
        line-height: 1.55 !important;
        letter-spacing: 0.02em !important;
        padding-bottom: 2px !important;
      }

      body.is-portrait .adv-speaker-name,
      .is-portrait .adv-speaker-name {
        font-size: 0.88em !important;
        margin-bottom: 3px !important;
      }

      body.is-portrait .adv-top-controls,
      .is-portrait .adv-top-controls {
        top: 12px !important;
        right: 12px !important;
        gap: 6px !important;
      }

      body.is-portrait .adv-auto-btn,
      body.is-portrait .adv-stop-btn,
      .is-portrait .adv-auto-btn,
      .is-portrait .adv-stop-btn {
        font-size: 11.5px !important;
        padding: 4px 10px !important;
      }

      body.is-portrait .adv-location-badge,
      .is-portrait .adv-location-badge {
        top: 12px !important;
        left: 12px !important;
        font-size: 11.5px !important;
        padding: 4px 10px !important;
      }

      body.is-portrait .adv-cutin-char,
      .is-portrait .adv-cutin-char {
        display: none !important;
      }

      body.is-portrait .adv-right-stage,
      .is-portrait .adv-right-stage {
        display: none !important;
      }

      body.is-portrait .adv-persona-title-container,
      .is-portrait .adv-persona-title-container {
        top: 6% !important;
        transform: translateX(-50%) scale(0.82) skewX(-8deg) !important;
        padding: 6px 12px !important;
      }

      body.is-portrait .adv-thinking-widget,
      .is-portrait .adv-thinking-widget {
        right: auto !important;
        left: 50% !important;
        bottom: 18px !important;
        transform: translateX(-50%) !important;
        width: auto !important;
        height: auto !important;
        animation: none !important;
      }

      body.is-portrait .adv-tt-spin-ring,
      body.is-portrait .adv-tt-spin-ring-inner,
      body.is-portrait .adv-thinking-circle-badge,
      .is-portrait .adv-tt-spin-ring,
      .is-portrait .adv-tt-spin-ring-inner,
      .is-portrait .adv-thinking-circle-badge {
        display: none !important;
      }

      body.is-portrait .adv-countdown-container,
      .is-portrait .adv-countdown-container {
        position: relative !important;
        top: 0 !important;
        right: 0 !important;
        transform: none !important;
        align-items: center !important;
        flex-direction: row !important;
        gap: 8px !important;
      }

      body.is-portrait .adv-countdown-ribbon,
      .is-portrait .adv-countdown-ribbon {
        margin-bottom: 0 !important;
        margin-right: 0 !important;
        font-size: 11px !important;
        padding: 3px 8px !important;
      }

      body.is-portrait .adv-countdown-box,
      .is-portrait .adv-countdown-box {
        min-width: 62px !important;
        padding: 2px 10px !important;
        box-shadow: 4px 4px 0px #000000 !important;
      }

      body.is-portrait .adv-countdown-digits,
      .is-portrait .adv-countdown-digits {
        font-size: 30px !important;
      }

      body.is-portrait .adv-choices-container,
      .is-portrait .adv-choices-container {
        top: 48% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: calc(100% - 28px) !important;
        max-width: 440px !important;
        min-width: 0 !important;
        gap: 10px !important;
        max-height: 58vh !important;
        overflow-y: auto !important;
        padding: 6px 4px !important;
        box-sizing: border-box !important;
      }

      body.is-portrait .adv-choice-btn,
      .is-portrait .adv-choice-btn {
        padding: 12px 16px 12px 46px !important;
        font-size: clamp(13px, 3.8vw, 15px) !important;
        border-width: 2.5px !important;
        box-shadow: 5px 5px 0px #0b1d47 !important;
      }

      body.is-portrait .adv-choice-badge,
      .is-portrait .adv-choice-badge {
        font-size: 20px !important;
        left: -14px !important;
        top: -10px !important;
        padding: 2px 8px !important;
        border-width: 2.5px !important;
      }

      @media (orientation: portrait) {
        .adv-message-container {
          height: var(--adv-msg-height, 175px) !important;
          max-height: var(--adv-msg-height, 175px) !important;
          box-sizing: border-box !important;
          padding: 14px 18px 12px !important;
          bottom: 0 !important;
          transform: none !important;
          background: linear-gradient(to bottom, rgba(5, 9, 20, 0.94) 0%, rgba(3, 7, 18, 0.98) 100%) !important;
          border-top: 1px solid rgba(56, 189, 248, 0.3) !important;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.75) !important;
        }

        .adv-message-body {
          font-size: clamp(13px, 3.8vw, 15.5px) !important;
          line-height: 1.55 !important;
          letter-spacing: 0.02em !important;
          padding-bottom: 2px !important;
        }

        .adv-speaker-name {
          font-size: 0.88em !important;
          margin-bottom: 3px !important;
        }

        .adv-top-controls {
          top: 12px !important;
          right: 12px !important;
          gap: 6px !important;
        }

        .adv-auto-btn,
        .adv-stop-btn {
          font-size: 11.5px !important;
          padding: 4px 10px !important;
        }

        .adv-location-badge {
          top: 12px !important;
          left: 12px !important;
          font-size: 11.5px !important;
          padding: 4px 10px !important;
        }

        /* Choices in Portrait: 左イラスト非表示、右側カウントダウンは画面下部に移動、全選択肢表示 */
        .adv-cutin-char {
          display: none !important;
        }

        .adv-right-stage {
          display: none !important;
        }

        .adv-persona-title-container {
          top: 6% !important;
          transform: translateX(-50%) scale(0.82) skewX(-8deg) !important;
          padding: 6px 12px !important;
        }

        .adv-thinking-widget {
          right: auto !important;
          left: 50% !important;
          bottom: 18px !important;
          transform: translateX(-50%) !important;
          width: auto !important;
          height: auto !important;
          animation: none !important;
        }

        .adv-tt-spin-ring,
        .adv-tt-spin-ring-inner,
        .adv-thinking-circle-badge {
          display: none !important;
        }

        .adv-countdown-container {
          position: relative !important;
          top: 0 !important;
          right: 0 !important;
          transform: none !important;
          align-items: center !important;
          flex-direction: row !important;
          gap: 8px !important;
        }

        .adv-countdown-ribbon {
          margin-bottom: 0 !important;
          margin-right: 0 !important;
          font-size: 11px !important;
          padding: 3px 8px !important;
        }

        .adv-countdown-box {
          min-width: 62px !important;
          padding: 2px 10px !important;
          box-shadow: 4px 4px 0px #000000 !important;
        }

        .adv-countdown-digits {
          font-size: 30px !important;
        }

        .adv-choices-container {
          top: 48% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: calc(100% - 28px) !important;
          max-width: 440px !important;
          min-width: 0 !important;
          gap: 10px !important;
          max-height: 58vh !important;
          overflow-y: auto !important;
          padding: 6px 4px !important;
          box-sizing: border-box !important;
        }

        .adv-choice-btn {
          padding: 12px 16px 12px 46px !important;
          font-size: clamp(13px, 3.8vw, 15px) !important;
          border-width: 2.5px !important;
          box-shadow: 5px 5px 0px #0b1d47 !important;
        }

        .adv-choice-badge {
          font-size: 20px !important;
          left: -14px !important;
          top: -10px !important;
          padding: 2px 8px !important;
          border-width: 2.5px !important;
        }
      }

      /* ================================================== */
      /* Responsive: Mobile Landscape (横向き)             */
      /* ================================================== */
      body.is-landscape-mobile .adv-message-container,
      .is-landscape-mobile .adv-message-container {
        display: none !important;
      }

      body.is-landscape-mobile .adv-top-controls,
      .is-landscape-mobile .adv-top-controls {
        top: 10px !important;
        right: 10px !important;
        gap: 6px !important;
      }

      body.is-landscape-mobile .adv-auto-btn,
      body.is-landscape-mobile .adv-stop-btn,
      .is-landscape-mobile .adv-auto-btn,
      .is-landscape-mobile .adv-stop-btn {
        font-size: 11px !important;
        padding: 4px 8px !important;
      }

      body.is-landscape-mobile .adv-location-badge,
      .is-landscape-mobile .adv-location-badge {
        top: 10px !important;
        left: 10px !important;
        font-size: 11px !important;
        padding: 4px 8px !important;
      }

      body.is-landscape-mobile .adv-cutin-char,
      .is-landscape-mobile .adv-cutin-char {
        display: none !important;
      }

      body.is-landscape-mobile .adv-right-stage,
      .is-landscape-mobile .adv-right-stage {
        display: none !important;
      }

      body.is-landscape-mobile .adv-persona-title-container,
      .is-landscape-mobile .adv-persona-title-container {
        top: 3% !important;
        transform: translateX(-50%) scale(0.68) skewX(-8deg) !important;
        padding: 4px 10px !important;
      }

      body.is-landscape-mobile .adv-thinking-widget,
      .is-landscape-mobile .adv-thinking-widget {
        right: 12px !important;
        bottom: 10px !important;
        transform: scale(0.6) !important;
        transform-origin: bottom right !important;
      }

      body.is-landscape-mobile .adv-choices-container,
      .is-landscape-mobile .adv-choices-container {
        top: 52% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: min(560px, 88%) !important;
        max-width: 560px !important;
        min-width: 0 !important;
        gap: 7px !important;
        max-height: 84vh !important;
        overflow-y: auto !important;
        padding: 4px 6px !important;
        box-sizing: border-box !important;
      }

      body.is-landscape-mobile .adv-choice-btn,
      .is-landscape-mobile .adv-choice-btn {
        padding: 8px 14px 8px 40px !important;
        font-size: 13px !important;
        border-width: 2.5px !important;
        box-shadow: 4px 4px 0px #0b1d47 !important;
      }

      body.is-landscape-mobile .adv-choice-badge,
      .is-landscape-mobile .adv-choice-badge {
        font-size: 17px !important;
        left: -12px !important;
        top: -8px !important;
        padding: 1px 7px !important;
        border-width: 2px !important;
      }

      @media (orientation: landscape) and (max-height: 520px) {
        /* 横向きスマホではメッセージウィンドウを非表示 */
        .adv-message-container {
          display: none !important;
        }

        .adv-top-controls {
          top: 10px !important;
          right: 10px !important;
          gap: 6px !important;
        }

        .adv-auto-btn,
        .adv-stop-btn {
          font-size: 11px !important;
          padding: 4px 8px !important;
        }

        .adv-location-badge {
          top: 10px !important;
          left: 10px !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
        }

        /* Choices in Landscape: 全選択肢をコンパクトに収める */
        .adv-cutin-char {
          display: none !important;
        }

        .adv-right-stage {
          display: none !important;
        }

        .adv-persona-title-container {
          top: 3% !important;
          transform: translateX(-50%) scale(0.68) skewX(-8deg) !important;
          padding: 4px 10px !important;
        }

        .adv-thinking-widget {
          right: 12px !important;
          bottom: 10px !important;
          transform: scale(0.6) !important;
          transform-origin: bottom right !important;
        }

        .adv-choices-container {
          top: 52% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: min(560px, 88%) !important;
          max-width: 560px !important;
          min-width: 0 !important;
          gap: 7px !important;
          max-height: 84vh !important;
          overflow-y: auto !important;
          padding: 4px 6px !important;
          box-sizing: border-box !important;
        }

        .adv-choice-btn {
          padding: 8px 14px 8px 40px !important;
          font-size: 13px !important;
          border-width: 2.5px !important;
          box-shadow: 4px 4px 0px #0b1d47 !important;
        }

        .adv-choice-badge {
          font-size: 17px !important;
          left: -12px !important;
          top: -8px !important;
          padding: 1px 7px !important;
          border-width: 2px !important;
        }
      }
    `,document.head.appendChild(e)}isForcedHidden=!1;setForcedHidden(e){this.isForcedHidden=e,e?(this.hide(),this.container&&(this.container.classList.remove(`visible`),this.container.style.display=`none`)):this.container&&(this.container.style.display=``)}show(){this.isForcedHidden||this.isVisible||(this.createDOM(),this.isVisible=!0,this.boundKeyHandler=e=>{e.key===`Escape`?this.onStopClick?.():(e.key===`a`||e.key===`A`)&&(this.isChoicesVisible||this.toggleAutoMode())},window.addEventListener(`keydown`,this.boundKeyHandler),requestAnimationFrame(()=>{this.container&&this.container.classList.add(`visible`);let e=document.getElementById(`adv-top-controls`);e&&e.classList.add(`visible`),this.locationBadgeEl&&this.currentLocation&&this.locationBadgeEl.classList.add(`visible`)}))}hide(){if(!this.isVisible)return;this.isVisible=!1,this.stopTyping(),this.hideChoices(),this.boundKeyHandler&&=(window.removeEventListener(`keydown`,this.boundKeyHandler),null);let e=document.getElementById(`adv-top-controls`);e&&e.classList.remove(`visible`),this.locationBadgeEl&&this.locationBadgeEl.classList.remove(`visible`),this.resetEyelids(),this.container&&(this.container.classList.remove(`visible`),setTimeout(()=>{!this.isVisible&&this.container&&(this.container.remove(),this.container=null,this.contentEl=null,this.speakerEl=null,this.locationBadgeEl?.remove(),this.locationBadgeEl=null,this.nextIconEl=null,this.choicesContainerEl?.remove(),this.choicesContainerEl=null,document.getElementById(`adv-choices-backdrop`)?.remove(),this.eyelidOverlayEl?.remove(),this.eyelidOverlayEl=null,e?.remove())},400))}eyelidOverlayEl=null;createEyelidOverlay(){if(this.eyelidOverlayEl)return;let e=this.getParentContainer(),t=document.createElement(`div`);t.className=`adv-eyelid-overlay`,t.innerHTML=`
      <div class="adv-eyelid adv-eyelid-top"></div>
      <div class="adv-eyelid adv-eyelid-bottom"></div>
    `,e.appendChild(t),this.eyelidOverlayEl=t}setEyelidClosed(e){this.createEyelidOverlay(),e?this.eyelidOverlayEl?.classList.add(`closed`):this.eyelidOverlayEl?.classList.remove(`closed`)}resetEyelids(){this.eyelidOverlayEl&&this.eyelidOverlayEl.classList.remove(`closed`)}setLocation(e){this.currentLocation=e,this.locationBadgeEl&&(this.locationBadgeEl.innerHTML=`📍 ${this.escapeHTML(e)}`,e?this.locationBadgeEl.classList.add(`visible`):this.locationBadgeEl.classList.remove(`visible`))}setText(e,t=``){this.isForcedHidden||this.show(),this.hideChoices(),this.stopTyping(),this.fullText=e,this.currentSpeaker=t,this.currentDisplayedLength=0,this.nextIconEl&&this.nextIconEl.classList.remove(`show`),this.typeNextChar()}isShowingChoices(){return this.isChoicesVisible}buildAnimatedLetters(e,t,n=.032){return e.split(``).map((e,r)=>e===` `?`<span class="adv-tt-space">&nbsp;</span>`:`<span class="adv-tt-char" style="animation-delay: ${(t+r*n).toFixed(3)}s">${e}</span>`).join(``)}getSpeechTailSVG(e,t){let n=30;return n=t===1?30:e===0?56:e===1?16:-14,`
      <div class="adv-choice-speech-tail">
        <svg class="adv-speech-tail-svg" viewBox="0 0 150 60" preserveAspectRatio="none">
          <!-- Seamless Speech Balloon Arrow Polygon Fill (White matching button) -->
          <polygon points="150,16 150,44 0,${n}" fill="#ffffff" />
          <!-- Speech Balloon Arrow Outline with cyan border matching button hover -->
          <path d="M 150,16 L 0,${n} L 150,44" fill="none" stroke="#0284c7" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </div>
    `}buildPersonaChoiceTitle(){let e=[{letters:[{ch:`M`,cls:`accent`,rot:-6},{ch:`a`,cls:``,rot:3},{ch:`k`,cls:``,rot:-4},{ch:`e`,cls:``,rot:2}]},{letters:[{ch:`Y`,cls:`accent-cyan`,rot:4},{ch:`o`,cls:``,rot:-3},{ch:`u`,cls:``,rot:5},{ch:`r`,cls:``,rot:-2}]},{letters:[{ch:`C`,cls:`accent`,rot:-5},{ch:`h`,cls:``,rot:3},{ch:`o`,cls:``,rot:-3},{ch:`i`,cls:``,rot:4},{ch:`c`,cls:``,rot:-4},{ch:`e`,cls:``,rot:3},{ch:`!`,cls:`bang`,rot:-6},{ch:`!`,cls:`bang`,rot:6}]}],t=.08;return`
      <div class="adv-persona-title-container">
        <div class="adv-p-bg-slash"></div>
        <div class="adv-persona-text-row">
          ${e.map(e=>`<div class="adv-p-word">${e.letters.map(e=>{let n=t.toFixed(3);return t+=.038,`<span class="adv-p-char${e.cls?` ${e.cls}`:``}" style="--delay: ${n}s; --rot: ${e.rot}deg;">${e.ch}</span>`}).join(``)}</div>`).join(``)}
        </div>
      </div>
    `}playSE(e,t=.5){try{let n=new Audio(z(e));n.volume=t,n.play().catch(()=>{})}catch{}}showChoices(e,t){this.isChoicesVisible=!0,this.nextIconEl&&this.nextIconEl.classList.remove(`show`),this.playSE(`/se/items_shown.mp3`,.6);let n=document.getElementById(`adv-choices-backdrop`);if(!n){let e=this.getParentContainer();n=document.createElement(`div`),n.id=`adv-choices-backdrop`,n.className=`adv-choices-backdrop`,e.appendChild(n)}n.innerHTML=`
      <div class="adv-vfx-speedlines">
        <div class="adv-vfx-band b1"></div>
        <div class="adv-vfx-band b2"></div>
        <div class="adv-vfx-band b3"></div>
        <div class="adv-vfx-beam m1"></div>
        <div class="adv-vfx-beam m2"></div>
        <div class="adv-vfx-beam m3"></div>
        <div class="adv-vfx-line l1"></div>
        <div class="adv-vfx-line l2"></div>
        <div class="adv-vfx-line l3"></div>
        <div class="adv-vfx-line l4"></div>
      </div>
      <div class="adv-vfx-rings">
        <div class="adv-vfx-ring r1"></div>
        <div class="adv-vfx-ring r2"></div>
        <div class="adv-vfx-ring r3"></div>
      </div>

      <!-- Persona Dynamic Cutout Typography Title -->
      ${this.buildPersonaChoiceTitle()}

      <!-- Left Character: Hero with dark blue silhouette shadow -->
      <div class="adv-cutin-char adv-cutin-left">
        <div class="adv-char-shadow">
          <img src="${z(`/img/hero.avif`)}" alt="" />
        </div>
        <div class="adv-char-main">
          <img src="${z(`/img/hero.avif`)}" alt="Hero" />
        </div>
      </div>

      <!-- Right Side Graphic Stage (Stylish Persona / Anime composition) -->
      <div class="adv-right-stage">
        <div class="adv-right-slash s1"></div>
        <div class="adv-right-slash s2"></div>
        <div class="adv-right-slash s3"></div>
      </div>



      <!-- Thinking Time Stylish Widget (Bottom Right) -->
      <div class="adv-thinking-widget">
        <!-- Outer Rotating Tech Dash Ring -->
        <div class="adv-tt-spin-ring"></div>
        <div class="adv-tt-spin-ring-inner"></div>

        <!-- Big Bold Countdown Unit with Box-Shadow & Adjusted Ribbon Position -->
        <div class="adv-countdown-container">
          <div class="adv-countdown-ribbon">COUNTDOWN</div>
          <div class="adv-countdown-box">
            <span class="adv-countdown-digits" id="adv-countdown-digits">10</span>
          </div>
        </div>

        <!-- Main Circular Badge -->
        <div class="adv-thinking-circle-badge">
          <div class="adv-tt-line adv-tt-line1">${this.buildAnimatedLetters(`Thinking`,.1,.026)}</div>
          <div class="adv-tt-line adv-tt-line2">${this.buildAnimatedLetters(`Time`,.32,.035)}</div>
        </div>
      </div>

      <!-- Front Bottom Accent Bar (in front of characters) -->
      <div class="adv-vfx-bottom-bar"></div>
    `;let r=document.createElement(`div`);r.className=`adv-choices-container`,n.appendChild(r),this.choicesContainerEl=r,e.forEach((n,i)=>{let a=document.createElement(`button`);a.className=`adv-choice-btn slam-in`,a.style.animationDelay=`${(.26+i*.09).toFixed(2)}s`,a.innerHTML=`
        ${this.getSpeechTailSVG(i,e.length)}
        <span class="adv-choice-badge">0${i+1}</span>
        <span class="adv-choice-text">${this.escapeHTML(n.text)}</span>
      `,a.addEventListener(`mouseenter`,()=>{this.playSE(`/se/items_hover.mp3`,.45)}),a.addEventListener(`click`,e=>{e.stopPropagation(),this.clearCountdownTimer(),this.playSE(`/se/items_chose.mp3`,.65),this.hideChoices(),t(n)}),r.appendChild(a)}),this.clearCountdownTimer(),this.countdownSeconds=10,this.startCountdownTimer(e,t),requestAnimationFrame(()=>{n?.classList.add(`visible`),r.classList.add(`visible`)})}hideChoices(){this.clearCountdownTimer(),this.isChoicesVisible=!1;let e=document.getElementById(`adv-choices-backdrop`);e&&e.classList.remove(`visible`),this.choicesContainerEl&&this.choicesContainerEl.classList.remove(`visible`),setTimeout(()=>{!this.isChoicesVisible&&e&&(e.innerHTML=``,this.choicesContainerEl=null)},300)}clearCountdownTimer(){this.countdownIntervalId!==null&&(window.clearInterval(this.countdownIntervalId),this.countdownIntervalId=null)}startCountdownTimer(e,t){this.updateCountdownDisplay(),this.countdownIntervalId=window.setInterval(()=>{if(!this.isChoicesVisible){this.clearCountdownTimer();return}if(this.countdownSeconds--,this.updateCountdownDisplay(),this.countdownSeconds<=0&&(this.clearCountdownTimer(),this.isChoicesVisible&&e.length>0)){let n=e[0];this.playSE(`/se/items_chose.mp3`,.65),this.hideChoices(),t(n)}},1e3)}updateCountdownDisplay(){let e=document.getElementById(`adv-countdown-digits`);if(!e)return;e.textContent=String(Math.max(0,this.countdownSeconds)).padStart(2,`0`);let t=e.parentElement;t&&(this.countdownSeconds<=3?t.classList.add(`urgent`):t.classList.remove(`urgent`),t.classList.remove(`tick`),t.offsetWidth,t.classList.add(`tick`))}typeNextChar(){this.currentDisplayedLength<this.fullText.length?(this.currentDisplayedLength++,this.renderContent(this.fullText.slice(0,this.currentDisplayedLength)),this.typingTimer=window.setTimeout(()=>{this.typeNextChar()},this.typingSpeedMs)):(this.renderContent(this.fullText),this.nextIconEl&&!this.isChoicesVisible&&this.nextIconEl.classList.add(`show`),this.onTypingComplete?.())}renderContent(e){if(!this.contentEl)return;this.speakerEl&&(this.currentSpeaker?(this.speakerEl.innerHTML=`<span class="adv-speaker-name">${this.escapeHTML(this.currentSpeaker)}</span>`,this.speakerEl.style.display=`block`):(this.speakerEl.innerHTML=``,this.speakerEl.style.display=`none`));let t=e.split(`
`).map(e=>this.escapeHTML(e).replace(/「/g,`<span class="adv-quote-mark">「</span>`).replace(/」/g,`<span class="adv-quote-mark">」</span>`)).join(`<br>`);this.contentEl.innerHTML=`<div>${t}</div>`}stopTyping(){this.typingTimer!==null&&(clearTimeout(this.typingTimer),this.typingTimer=null)}createDOM(){if(this.container)return;let e=this.getParentContainer(),t=document.createElement(`div`);t.className=`adv-location-badge`,this.currentLocation&&(t.innerHTML=`📍 ${this.escapeHTML(this.currentLocation)}`),e.appendChild(t),this.locationBadgeEl=t;let n=document.createElement(`div`);n.className=`adv-message-container`;let r=document.createElement(`div`);r.className=`adv-message-body`;let i=document.createElement(`div`);r.appendChild(i),this.speakerEl=i;let a=document.createElement(`div`);r.appendChild(a),this.contentEl=a;let o=document.createElement(`div`);o.className=`adv-next-indicator`,o.innerHTML=`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
        <path d="M480-83 240-323l56-56 184 183 184-183 56 56L480-83Zm0-238L240-561l56-56 184 183 184-183 56 56-240 240Zm0-238L240-799l56-56 184 183 184-183 56 56-240 240Z"/>
      </svg>
    `,r.appendChild(o),this.nextIconEl=o,n.appendChild(r),n.addEventListener(`click`,e=>{e.stopPropagation(),!this.isChoicesVisible&&(this.currentDisplayedLength<this.fullText.length?(this.stopTyping(),this.currentDisplayedLength=this.fullText.length,this.renderContent(this.fullText),this.nextIconEl&&this.nextIconEl.classList.add(`show`),this.onTypingComplete?.()):this.onNextClick?.())}),e.appendChild(n),this.container=n;let s=document.createElement(`div`);s.id=`adv-top-controls`,s.className=`adv-top-controls`,s.innerHTML=`
      <button class="adv-auto-btn" id="adv-auto-btn" title="${U().scenario.autoMode} (A)">
        <span class="adv-auto-icon">▶</span> ${U().scenario.autoMode}
      </button>
      <button class="adv-stop-btn" title="${U().scenario.endScenario} (ESC)">
        <span>⏹</span> ${U().scenario.endScenario}
      </button>
    `;let c=s.querySelector(`#adv-auto-btn`);c&&(c.classList.toggle(`active`,this.isAutoMode),c.addEventListener(`click`,e=>{e.stopPropagation(),this.toggleAutoMode()})),s.querySelector(`.adv-stop-btn`)?.addEventListener(`click`,e=>{e.stopPropagation(),this.onStopClick?.()}),e.appendChild(s),this.createChoicesDOM()}setAutoMode(e){this.isAutoMode=e;let t=document.getElementById(`adv-auto-btn`);t&&t.classList.toggle(`active`,e)}toggleAutoMode(){let e=!this.isAutoMode;return this.setAutoMode(e),this.onAutoToggle?.(e),e}createChoicesDOM(){if(document.getElementById(`adv-choices-backdrop`))return;let e=this.getParentContainer(),t=document.createElement(`div`);t.id=`adv-choices-backdrop`,t.className=`adv-choices-backdrop`,e.appendChild(t)}escapeHTML(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`)}dispose(){this.hide()}},Tn=class{canvas=null;ctx=null;isVisible=!1;config;animationFrameId=null;lastUpdateTimestamp=0;container;constructor(e=document.body,t){this.container=e,this.config={centerX:t?.centerX??.5,centerY:t?.centerY??.45,lineCount:t?.lineCount??75,innerRadiusRatio:t?.innerRadiusRatio??.22,lineColor:t?.lineColor??`rgba(15, 23, 42, 0.88)`,updateIntervalMs:t?.updateIntervalMs??45}}initCanvas(){this.canvas||(this.canvas=document.createElement(`canvas`),this.canvas.className=`focus-lines-overlay`,this.canvas.style.position=`fixed`,this.canvas.style.inset=`0`,this.canvas.style.width=`100vw`,this.canvas.style.height=`100vh`,this.canvas.style.pointerEvents=`none`,this.canvas.style.zIndex=`45`,this.canvas.style.opacity=`0`,this.canvas.style.transition=`opacity 0.15s ease-out`,this.ctx=this.canvas.getContext(`2d`),this.container.appendChild(this.canvas),this.resize(),window.addEventListener(`resize`,this.handleResize))}handleResize=()=>{this.isVisible&&this.resize()};resize(){if(!this.canvas)return;let e=Math.min(window.devicePixelRatio||1,2),t=window.innerWidth,n=window.innerHeight;this.canvas.width=Math.floor(t*e),this.canvas.height=Math.floor(n*e)}show(e){e&&(this.config={...this.config,...e}),this.initCanvas(),!(!this.canvas||!this.ctx)&&(this.resize(),this.isVisible=!0,this.canvas.style.opacity=`1`,this.lastUpdateTimestamp=0,this.animationFrameId||this.loop(performance.now()))}hide(){this.isVisible&&(this.isVisible=!1,this.canvas&&(this.canvas.style.opacity=`0`,setTimeout(()=>{!this.isVisible&&this.ctx&&this.canvas&&this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height)},150)),this.animationFrameId&&=(cancelAnimationFrame(this.animationFrameId),null))}loop=e=>{this.isVisible&&(e-this.lastUpdateTimestamp>=this.config.updateIntervalMs&&(this.renderLines(),this.lastUpdateTimestamp=e),this.animationFrameId=requestAnimationFrame(this.loop))};renderLines(){if(!this.canvas||!this.ctx)return;let e=this.ctx,t=this.canvas.width,n=this.canvas.height;e.clearRect(0,0,t,n);let r=t*this.config.centerX,i=n*this.config.centerY,a=Math.sqrt(t*t+n*n)*.75,o=Math.min(t,n)*this.config.innerRadiusRatio,s=this.config.lineCount,c=Math.PI*2/s;e.fillStyle=this.config.lineColor;for(let t=0;t<s;t++){if(Math.random()<.12)continue;let n=t*c+(Math.random()-.5)*c*.6,s=c*(.35+Math.random()*.75),l=o*(.75+Math.random()*.55),u=n-s*.5,d=n+s*.5,f=r+Math.cos(u)*a,p=i+Math.sin(u)*a,m=r+Math.cos(d)*a,h=i+Math.sin(d)*a,g=r+Math.cos(n)*l,_=i+Math.sin(n)*l;e.beginPath(),e.moveTo(f,p),e.lineTo(m,h),e.lineTo(g,_),e.closePath(),e.fill()}}dispose(){this.hide(),window.removeEventListener(`resize`,this.handleResize),this.canvas&&this.canvas.parentNode&&this.canvas.parentNode.removeChild(this.canvas),this.canvas=null,this.ctx=null}},En=class{containerEl=null;redCutInEl=null;greenCutInEl=null;timeoutId=null;constructor(){this.initDOM()}initDOM(){let e=document.getElementById(`shaft-cutin-overlay`);e||(e=document.createElement(`div`),e.id=`shaft-cutin-overlay`,e.style.position=`absolute`,e.style.inset=`0`,e.style.pointerEvents=`none`,e.style.userSelect=`none`,e.style.zIndex=`50`,e.style.display=`none`,e.style.overflow=`hidden`,(document.getElementById(`viewport-container`)||document.body).appendChild(e)),this.containerEl=e;let t=document.createElement(`div`);t.className=`shaft-cutin-red`,t.style.position=`absolute`,t.style.inset=`0`,t.style.display=`none`,t.style.flexDirection=`column`,t.style.justifyContent=`space-between`,t.style.backgroundColor=`transparent`,t.innerHTML=`
      <div style="height: 14%; width: 100%; background: #000000;"></div>
      <div style="flex: 1; width: 100%; background: #dc2626; display: flex; align-items: center; justify-content: center; padding: 2rem 4rem; box-sizing: border-box;">
        <div style="max-width: 900px; color: #ffffff; font-family: 'Shippori Mincho', 'Yu Mincho', serif; text-align: left;">
          <div style="font-size: clamp(1.4rem, 3.0vw, 2.2rem); font-weight: 800; letter-spacing: 0.18em; line-height: 1.5; margin-bottom: 0.8rem;">
            何ダカ面倒ナ話ガ始マッタ。
          </div>
          <div style="font-size: clamp(0.95rem, 1.8vw, 1.35rem); font-weight: 600; letter-spacing: 0.12em; line-height: 1.8; opacity: 0.95;">
            居ルカドウカモ分カラナイ存在ガ重力ニ縛ラレタ存在デアルカドウカヲ議論スル事ニドレホドノ意味ガアルノカ分カラナイガ、此処ハ話ヲ進メルシカナイダロウ。
          </div>
        </div>
      </div>
      <div style="height: 14%; width: 100%; background: #000000;"></div>
    `,e.appendChild(t),this.redCutInEl=t;let n=document.createElement(`div`);n.className=`shaft-cutin-green`,n.style.position=`absolute`,n.style.inset=`0`,n.style.display=`none`,n.style.flexDirection=`column`,n.style.justifyContent=`space-between`,n.style.backgroundColor=`transparent`,n.innerHTML=`
      <div style="height: 15%; width: 100%; background: #ffffff;"></div>
      <div style="flex: 1; width: 100%; background: #15803d; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">
        <div style="color: #ffffff; font-family: 'Shippori Mincho', 'Yu Mincho', serif; font-weight: 800; font-size: clamp(3.5rem, 9vw, 6.5rem); letter-spacing: 0.2em; text-indent: 0.2em; line-height: 1;">
          閉
        </div>
        <div style="color: #ffffff; font-family: 'Montserrat', sans-serif; font-weight: 500; font-size: clamp(0.85rem, 1.8vw, 1.25rem); letter-spacing: 0.4em; text-indent: 0.4em; margin-top: 0.8rem; text-transform: lowercase; opacity: 0.9;">
          close
        </div>
      </div>
      <div style="height: 15%; width: 100%; background: #ffffff;"></div>
    `,e.appendChild(n),this.greenCutInEl=n}show(e,t,n){this.hide(),this.containerEl&&(this.containerEl.style.display=`block`,e===`red_trouble`&&this.redCutInEl?this.redCutInEl.style.display=`flex`:e===`green_closed`&&this.greenCutInEl&&(this.greenCutInEl.style.display=`flex`),t&&t>0&&(this.timeoutId=window.setTimeout(()=>{this.hide(),n&&n()},t*1e3)))}hide(){this.timeoutId!==null&&(clearTimeout(this.timeoutId),this.timeoutId=null),this.containerEl&&(this.containerEl.style.display=`none`),this.redCutInEl&&(this.redCutInEl.style.display=`none`),this.greenCutInEl&&(this.greenCutInEl.style.display=`none`)}dispose(){this.hide(),this.containerEl&&this.containerEl.parentNode&&this.containerEl.parentNode.removeChild(this.containerEl)}},Dn=class{overlayEl=null;container;constructor(e){this.container=e,this.injectStyles(),this.ensureElement()}getParentContainer(){return this.container??document.getElementById(`viewport-container`)??document.body}injectStyles(){if(document.getElementById(`blackout-overlay-styles`))return;let e=document.createElement(`style`);e.id=`blackout-overlay-styles`,e.textContent=`
      .scenario-blackout-overlay {
        position: absolute;
        inset: 0;
        background-color: #000000;
        z-index: 70;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .scenario-blackout-overlay.active {
        opacity: 1;
        pointer-events: auto;
      }
    `,document.head.appendChild(e)}ensureElement(){if(!this.overlayEl){let e=this.getParentContainer();if(!e)return document.createElement(`div`);let t=document.createElement(`div`);t.className=`scenario-blackout-overlay`,e.appendChild(t),this.overlayEl=t}return this.overlayEl}async fadeOut(e=320){let t=this.ensureElement();t.style.transitionDuration=`${e}ms`,t.classList.add(`active`),await new Promise(t=>setTimeout(t,e))}async fadeIn(e=320){let t=this.ensureElement();t.style.transitionDuration=`${e}ms`,t.classList.remove(`active`),await new Promise(t=>setTimeout(t,e))}async fadeTransition(e,t=300,n=80,r=320){await this.fadeOut(t);try{await e()}catch(e){console.error(`[BlackoutOverlay] Error during transition action:`,e)}n>0&&await new Promise(e=>setTimeout(e,n)),await this.fadeIn(r)}reset(){this.overlayEl&&(this.overlayEl.classList.remove(`active`),this.overlayEl.style.transitionDuration=`0ms`)}dispose(){this.overlayEl&&=(this.overlayEl.remove(),null)}},On=class{getAvatar;getAvatars;getAudioLipSync;masterManager;onPlayStateChange;onSceneChange;onFinished;onSwitchAvatar;onSetupScenarioCharacters;onRestoreAvatar;onSwitchScenePreset;onApplyCamera;onApplySceneCamera;onApplyFisheye;onUpdateScrollingBackground;onUpdateDreamBackground;onSwitchBackground;onSwitchPanoramaBackground;messageWindow;currentPackage=null;chapterIndex=0;sceneIndex=0;flags=new Set;isPlayingState=!1;activeMoveTransitions=new Map;bgmAudio=null;seAudio=null;autoNextTimer=null;pendingChoiceTimer=null;pendingEffectTextTimers=[];pendingMotionTimers=[];currentBackgroundUrl=null;boundVoiceEndHandler=null;isAutoMode=!1;focusLinesOverlay=new Tn;blackoutOverlay=new Dn;shaftCutInOverlay=new En;onSwitchShaftMode;onSwitchShaftSpaceStage;onUpdateCrowd;onSwitchStage;lastLocation=void 0;isSceneTransitioning=!1;sceneElapsedTime=0;pendingAvatarTransitions=new Map;pendingSceneTransitions=null;constructor(e){this.getAvatar=e.getAvatar,this.getAvatars=e.getAvatars,this.getAudioLipSync=e.getAudioLipSync,this.masterManager=e.masterManager??new vn,this.onPlayStateChange=e.onPlayStateChange,this.onSceneChange=e.onSceneChange,this.onFinished=e.onFinished,this.onSwitchAvatar=e.onSwitchAvatar,this.onSetupScenarioCharacters=e.onSetupScenarioCharacters,this.onRestoreAvatar=e.onRestoreAvatar,this.onSwitchScenePreset=e.onSwitchScenePreset,this.onApplyCamera=e.onApplyCamera,this.onApplySceneCamera=e.onApplySceneCamera,this.onApplyFisheye=e.onApplyFisheye,this.onUpdateScrollingBackground=e.onUpdateScrollingBackground,this.onUpdateDreamBackground=e.onUpdateDreamBackground,this.onSwitchBackground=e.onSwitchBackground,this.onSwitchPanoramaBackground=e.onSwitchPanoramaBackground,this.onSwitchShaftMode=e.onSwitchShaftMode,this.onSwitchShaftSpaceStage=e.onSwitchShaftSpaceStage,this.onUpdateCrowd=e.onUpdateCrowd,this.onSwitchStage=e.onSwitchStage,this.messageWindow=new wn({typingSpeedMs:22,onNextClick:()=>{this.handleUserNext()},onStopClick:()=>{this.stop()},onAutoToggle:e=>{this.setAutoMode(e)},onTypingComplete:()=>{this.handleTypingComplete()}}),window.addEventListener(`keydown`,e=>{this.isPlayingState&&(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||(e.code===`Space`||e.code===`Enter`)&&(e.preventDefault(),this.handleUserNext()))}),window.addEventListener(`click`,e=>{if(!this.isPlayingState)return;let t=e.target;t?.closest(`#unified-panel`)||t?.closest(`.scenario-controls`)||t?.closest(`button`)||this.handleUserNext()})}get autoMode(){return this.isAutoMode}setAutoMode(e){if(this.isAutoMode=e,this.messageWindow.setAutoMode(e),!this.isPlayingState)return;let t=this.currentScene;if(t)if(e){let e=t.voice||t.voiceUrl,n=this.getAudioLipSync();if(!(e&&n.isPlaying))if(t.choices&&t.choices.length>0)this.messageWindow.isShowingChoices()||this.showChoicesWithAttention(t.choices,e=>{this.selectChoice(e)});else{this.clearAutoNextTimer();let e=t.autoNextSec??.8;this.autoNextTimer=window.setTimeout(()=>{this.next()},e*1e3)}}else t.autoNextSec||this.clearAutoNextTimer()}toggleAutoMode(){let e=!this.isAutoMode;return this.setAutoMode(e),e}get isPlaying(){return this.isPlayingState}getCurrentPackage(){return this.currentPackage}get currentScene(){if(!this.currentPackage)return null;let e=this.currentPackage.chapters[this.chapterIndex];return e?e.scenes[this.sceneIndex]??null:null}getState(){return{chapterIndex:this.chapterIndex,sceneIndex:this.sceneIndex,flags:new Set(this.flags),isPlaying:this.isPlayingState,isTyping:!1,isWaitingChoice:(this.currentScene?.choices?.length??0)>0}}async play(e){this.isPlayingState&&this.stop(),this.currentPackage=e,this.chapterIndex=0,this.sceneIndex=0,this.flags.clear(),this.isPlayingState=!0,this.currentBackgroundUrl=null,this.lastLocation=void 0,this.isSceneTransitioning=!1,this.blackoutOverlay.reset(),(this.getAvatars?this.getAvatars():[this.getAvatar()].filter(Boolean)).forEach(e=>{e.setTearsEnabled(!1),e.resetFaceTexture(),e.clearEffectText()}),this.onPlayStateChange?.(!0);try{await this.onSwitchStage?.(e.stage)}catch(e){console.error(`Failed to switch scenario stage:`,e)}if(e.characters&&e.characters.length>0&&this.onSetupScenarioCharacters)try{await this.onSetupScenarioCharacters(e.characters)}catch(e){console.error(`Failed to setup scenario characters:`,e)}let t=this.masterManager.resolveSoundUrl(e.bgm||e.bgmUrl),n=this.masterManager.resolveSoundUrl(e.se||e.seUrl);this.startBgm(t||void 0,e.bgmVolume,e.bgmLoop??!0),this.startSe(n||void 0,e.seVolume),this.messageWindow.setAutoMode(this.isAutoMode),e.hideMessageWindow?this.messageWindow.setForcedHidden(!0):(this.messageWindow.setForcedHidden(!1),this.messageWindow.show()),this.executeCurrentScene()}stop(){this.isPlayingState&&(this.isPlayingState=!1,this.lastLocation=void 0,this.isSceneTransitioning=!1,this.blackoutOverlay.reset(),this.clearAutoNextTimer(),this.clearPendingChoiceTimer(),this.clearPendingEffectTextTimers(),this.clearPendingMotionTimers(),this.focusLinesOverlay.hide(),this.shaftCutInOverlay.hide(),this.activeMoveTransitions.clear(),this.pendingAvatarTransitions.clear(),this.pendingSceneTransitions=null,this.sceneElapsedTime=0,this.stopAudioAndVoice(),this.stopBgm(),this.stopSe(),this.onUpdateCrowd?.(!1),(this.getAvatars?this.getAvatars():[this.getAvatar()].filter(Boolean)).forEach(e=>{e.resetFaceTexture(),e.setFaceOverlay(`blush`,!1),e.setFaceOverlay(`anger`,!1),e.setFaceOverlay(`sweat`,!1),e.clearEffectText(),e.setTearsEnabled(!1),e.setMotionBlurEnabled(!1),e.setMotionSpeed(1),e.setYandereMode(!1),e.setShafudo(!1),e.setSeated(!1),e.setVisible(!0)}),this.onApplyFisheye?.(!1),this.onSwitchShaftMode?.(!1),this.onSwitchShaftSpaceStage?.(!1),this.messageWindow.setForcedHidden(!1),this.messageWindow.hide(),this.currentBackgroundUrl=null,this.onUpdateScrollingBackground?.(void 0),this.onUpdateDreamBackground?.(void 0),this.onSwitchPanoramaBackground?.(null),this.onPlayStateChange?.(!1),this.onFinished?.(),this.onRestoreAvatar&&this.onRestoreAvatar().catch(e=>{console.error(`Failed to restore avatar after scenario:`,e)}))}handleUserNext(){if(!this.isPlayingState||this.isSceneTransitioning)return;let e=this.currentScene;if(e){if(e.choices&&e.choices.length>0){if(!this.messageWindow.isShowingChoices()){let t=this.pendingChoiceTimer!==null;this.showChoicesWithAttention(e.choices,e=>{this.selectChoice(e)},t)}return}this.next()}}next(){if(!this.isPlayingState||!this.currentPackage||this.isSceneTransitioning)return;this.clearAutoNextTimer();let e=this.currentPackage.chapters[this.chapterIndex];if(!e){this.stop();return}let t=e.scenes[this.sceneIndex];if(t?.isEnding||t?.goto===`__end__`||t?.goto===`end`){this.stop();return}if(t?.goto){this.jumpToTarget(t.goto);return}let n=this.sceneIndex+1;for(;n<e.scenes.length;){let t=e.scenes[n];if(this.evaluateConditions(t.conditions)){this.sceneIndex=n,this.executeCurrentScene();return}n++}let r=this.chapterIndex+1;for(;r<this.currentPackage.chapters.length;){let e=this.currentPackage.chapters[r];if(this.evaluateConditions(e.conditions)){this.chapterIndex=r,this.sceneIndex=0,this.executeCurrentScene();return}r++}this.stop()}selectChoice(e){if(this.isPlayingState){if(this.clearPendingChoiceTimer(),e.flag&&this.flags.add(e.flag),e.effectText){let t=this.getAvatar();t&&t.showEffectText({stylePreset:e.effectText,text:``})}e.goto?this.jumpToTarget(e.goto):this.next()}}jumpToTarget(e){if(!this.currentPackage)return;let t=this.currentPackage.chapters[this.chapterIndex];if(t){let n=t.scenes.findIndex(t=>t.id===e);if(n!==-1){this.sceneIndex=n,this.executeCurrentScene();return}}for(let t=0;t<this.currentPackage.chapters.length;t++){let n=this.currentPackage.chapters[t];if(n.id===e){this.chapterIndex=t,this.sceneIndex=0,this.executeCurrentScene();return}let r=n.scenes.findIndex(t=>t.id===e);if(r!==-1){this.chapterIndex=t,this.sceneIndex=r,this.executeCurrentScene();return}}this.next()}evaluateConditions(e){return!e||e.length===0?!0:e.every(e=>this.flags.has(e))}applyAvatarAction(e,t,n){let{motion:r,expression:i,expressionWeight:a,faceTexture:o,effectText:s,position:c,rotationY:l,lookAtCamera:u,headLookAtCamera:d,eyeLookAtCamera:f,eyeWander:p,eyeOffset:m,headOffset:h}=t,g=!!(this.currentPackage?.characters&&this.currentPackage.characters.length>1),_=u!==void 0||d!==void 0||f!==void 0||t.lookAtTarget!==void 0;if(!g||_){let t=f===void 0?u===void 0?!0:u:f;e.setEyeLookAt({mode:t?`camera`:`forward`,offset:m?{x:m[0],y:m[1]}:{x:0,y:0},wander:typeof p==`boolean`?p:typeof p==`number`?p>0:!1,wanderIntensity:typeof p==`number`?p:1}),e.setLookAtCamera(t);let n=d===void 0?!1:d;e.setHeadLookAtCamera(n,{offset:h?{x:h[0],y:h[1]}:{x:0,y:0}})}if(t.visible!==void 0&&e.setVisible(t.visible),c!==void 0)if(typeof c==`string`&&c in Z){let[t,n,r]=Z[c];e.setPosition(t,n,r),l===void 0&&c in yn&&e.setRotationY(yn[c])}else Array.isArray(c)&&e.setPosition(c[0],c[1],c[2]);if(l!==void 0&&e.setRotationY(l),(t.daylight!==void 0||t.renderOrder!==void 0)&&e.setDaylightAndRenderOrder(t.daylight,t.renderOrder),t.moveTo){let n=new k;e.vrm?.scene?e.vrm.scene.getWorldPosition(n):n.copy(e.initialPosition);let r=e.vrm?.scene?e.vrm.scene.rotation.y:e.initialRotationY;this.activeMoveTransitions.set(e,{startPos:n,targetPos:new k(...t.moveTo.target),startRotY:r,targetRotY:t.moveTo.rotationY,duration:Math.max(.01,t.moveTo.duration),elapsed:0})}let v=t.motionSpeed??this.currentScene?.motionSpeed??1;if(r){let n=this.masterManager.resolveMotionUrl(r)||z(r),i=n.toLowerCase(),a=t.motionLoop===void 0?i.includes(`idle`)||i.includes(`walking`)||i.includes(`jogging`)||i.includes(`standing pose`)||i.includes(`chin_rest`)||i.includes(`sitting`)||i.includes(`sit`):t.motionLoop;if(e.playAnimation(n,a,.5,z(`/animations/Idle.fbx`),v),!t.transitions?.length&&t.motionDuration!==void 0&&t.motionDuration>0){let n=window.setTimeout(()=>{if(!this.isPlayingState)return;let n=t.nextMotion||z(`/animations/Standing Idle.fbx`),r=this.masterManager.resolveMotionUrl(n)||z(n);e.playAnimation(r,!0,.5,void 0,1)},t.motionDuration*1e3);this.pendingMotionTimers.push(n)}}else (t.motionSpeed!==void 0||this.currentScene?.motionSpeed!==void 0)&&e.setMotionSpeed(v);if(i&&e.setExpression(i,a??1),o?o.toLowerCase().includes(`blush`)?(e.resetFaceTexture(),e.setBlushMode(!0,{faceTexture:o})):(e.setBlushMode(!1),e.setFaceTexture(o)):(e.resetFaceTexture(),e.isBlushMode()&&e.setBlushMode(!1)),e.clearEffectText(),s){let t=window.setTimeout(()=>{this.isPlayingState&&(typeof s==`string`?e.showEffectText({stylePreset:s}):e.showEffectText({stylePreset:s.preset,text:s.text,duration:s.duration}))},900);this.pendingEffectTextTimers.push(t)}if(t.tears!==void 0&&(t.tearConfig&&e.setTearConfig(t.tearConfig),e.setTearsEnabled(t.tears)),t.sweat!==void 0)if(t.sweat===!1)e.setSweatEnabled(!1);else{let n=typeof t.sweat==`string`?t.sweat:`fly4`;e.showSweat({mode:n,duration:4})}if(t.fastMotion!==void 0&&e.fastMotionEffect?.updateConfig({enabled:t.fastMotion}),t.faceOverlays!==void 0)for(let n of[`blush`,`anger`,`sweat`]){let r=!!t.faceOverlays[n];e.setFaceOverlay(n,r)}if(t.motionBlur!==void 0&&e.setMotionBlurEnabled(t.motionBlur),t.yandere!==void 0)if(t.yandere===!1)e.setYandereMode(!1);else{let n=typeof t.yandere==`object`?t.yandere:void 0;e.setYandereMode(!0,n)}if(t.shafudo!==void 0&&e.setShafudo(t.shafudo),t.seated!==void 0&&e.setSeated(t.seated),t.transitions&&t.transitions.length>0){let r=[...t.transitions].sort((e,t)=>e.at-t.at);this.pendingAvatarTransitions.set(e,{charId:n||``,transitions:r,nextIndex:0})}}clearPendingChoiceTimer(){this.pendingChoiceTimer!==null&&(window.clearTimeout(this.pendingChoiceTimer),this.pendingChoiceTimer=null)}showChoicesWithAttention(e,t,n=!1){this.clearPendingChoiceTimer(),this.applyWaitingPlayerAttention();let r=this.currentScene,i=n?0:r?.choiceDelaySec===void 0?1:r.choiceDelaySec;if(i<=0){this.messageWindow.showChoices(e,t);return}this.pendingChoiceTimer=window.setTimeout(()=>{this.pendingChoiceTimer=null,this.isPlayingState&&this.currentScene===r&&this.messageWindow.showChoices(e,t)},i*1e3)}applyConversationAttention(e){if(!(this.currentPackage?.characters&&this.currentPackage.characters.length>1))return;let t=this.currentPackage.characters.map(e=>e.id),n=e.speakerCharacterId||e.character||e.avatar?.character,r=!!(e.speaker?.includes(`&`)||e.speaker?.includes(`＆`))||!n&&t.length>1,i=!!(e.choices&&e.choices.length>0),a=e.dialogueTarget||`player`;for(let o of t){let s=this.getAvatar(o);if(!s)continue;let c=e.avatars?.[o];if(c?.lookAtTarget){this.applyCustomLookAtTarget(s,o,c.lookAtTarget,c);continue}if(c?.lookAtCamera!==void 0&&c.headLookAtCamera!==void 0)continue;let l=n===o,u=c?.shallowHeadAngle??!0,d=c?.headMaxYaw,f=c?.headWeight,p=typeof c?.eyeWander==`boolean`?c.eyeWander:typeof c?.eyeWander==`number`?c.eyeWander>0:!1,m=typeof c?.eyeWander==`number`?c.eyeWander:1;if(i||r)s.setConversationLookAt({target:`camera`,shallowAngle:u,maxYaw:d,weight:f,wander:p,wanderIntensity:m});else if(l)if(a===`player`)s.setConversationLookAt({target:`camera`,shallowAngle:u,maxYaw:d,weight:f,wander:p,wanderIntensity:m});else{let e=a===`partner`?t.find(e=>e!==o):a,n=e?this.getAvatar(e):null;n?s.setConversationLookAt({target:()=>n.getHeadWorldPosition(),shallowAngle:u,maxYaw:d,weight:f,wander:p,wanderIntensity:m}):s.setConversationLookAt({target:`camera`,shallowAngle:u,maxYaw:d,weight:f,wander:p,wanderIntensity:m})}else{let e=n?this.getAvatar(n):null;e?s.setConversationLookAt({target:()=>e.getHeadWorldPosition(),shallowAngle:u,maxYaw:d,weight:f,wander:p,wanderIntensity:m}):s.setConversationLookAt({target:`camera`,shallowAngle:u,maxYaw:d,weight:f,wander:p,wanderIntensity:m})}}}applyWaitingPlayerAttention(){if(this.currentPackage?.characters&&this.currentPackage.characters.length>1)for(let e of this.currentPackage.characters){let t=this.getAvatar(e.id);t&&t.setConversationLookAt({target:`camera`,shallowAngle:!0})}}applyCustomLookAtTarget(e,t,n,r){let i=r?.shallowHeadAngle??!0,a=r?.headMaxYaw,o=r?.headWeight,s=typeof r?.eyeWander==`boolean`?r.eyeWander:!1,c=typeof r?.eyeWander==`number`?r.eyeWander:1;if(n===`player`||n===`camera`)e.setConversationLookAt({target:`camera`,shallowAngle:i,maxYaw:a,weight:o,wander:s,wanderIntensity:c});else if(n===`forward`)e.setConversationLookAt({target:`forward`});else if(n===`partner`){let n=(this.currentPackage?.characters?.map(e=>e.id)??[]).find(e=>e!==t),r=n?this.getAvatar(n):null;r&&e.setConversationLookAt({target:()=>r.getHeadWorldPosition(),shallowAngle:i,maxYaw:a,weight:o,wander:s,wanderIntensity:c})}else if(n===`speaker`){let t=this.currentScene?.speakerCharacterId,n=t?this.getAvatar(t):null;n&&n!==e&&e.setConversationLookAt({target:()=>n.getHeadWorldPosition(),shallowAngle:i,maxYaw:a,weight:o,wander:s,wanderIntensity:c})}else{let t=this.getAvatar(n);t&&e.setConversationLookAt({target:()=>t.getHeadWorldPosition(),shallowAngle:i,maxYaw:a,weight:o,wander:s,wanderIntensity:c})}}async executeCurrentScene(){let e=this.currentScene;if(!e){this.stop();return}this.clearAutoNextTimer(),this.clearPendingChoiceTimer(),this.clearPendingEffectTextTimers(),this.clearPendingMotionTimers(),this.pendingAvatarTransitions.clear(),this.pendingSceneTransitions=null,this.sceneElapsedTime=0,this.stopVoice();let t=e.screenTransition!==`none`&&!this.currentPackage?.hideMessageWindow&&this.lastLocation!==void 0&&e.location!==void 0&&e.location!==this.lastLocation,n=e.screenTransition===`fade_black`;t||n?(this.isSceneTransitioning=!0,this.messageWindow.hide(),await this.blackoutOverlay.fadeTransition(async()=>{this.applySceneVisuals(e)},300,100,320),this.isSceneTransitioning=!1,this.lastLocation=e.location,this.applySceneAudioAndDialogue(e)):(this.lastLocation=e.location,this.applySceneVisuals(e),this.applySceneAudioAndDialogue(e))}applySceneVisuals(e){let t=!!(this.currentPackage?.characters&&this.currentPackage.characters.length>0),n=e.character||e.avatar?.character;if(!t&&n&&this.onSwitchAvatar){let e=this.masterManager.resolveCharacterModelUrl(n);e&&this.onSwitchAvatar(e).catch(e=>{console.error(`Failed to switch avatar during scenario:`,e)})}e.scenePreset&&this.onSwitchScenePreset&&(this.onSwitchScenePreset(e.scenePreset),this.currentBackgroundUrl&&!e.background&&!e.panoramaBackgroundUrl&&this.onSwitchBackground&&this.onSwitchBackground(this.currentBackgroundUrl));let r=e.panoramaBackgroundUrl||this.currentPackage?.panoramaBackgroundUrl;r?(this.currentBackgroundUrl=null,this.onSwitchPanoramaBackground?.(r)):e.background&&this.onSwitchBackground&&(this.currentBackgroundUrl=e.background,this.onSwitchPanoramaBackground?.(null),this.onSwitchBackground(e.background)),this.onUpdateScrollingBackground?.(e.scrollingBackground);let i=e.dreamBackground===void 0?e.cameraPreset===`spiralRise`?`heart`:void 0:e.dreamBackground;if(this.onUpdateDreamBackground?.(i,e),e.focusLines){let t=typeof e.focusLines==`object`?e.focusLines:void 0;this.focusLinesOverlay.show(t)}else this.focusLinesOverlay.hide();this.onUpdateCrowd?.(e.crowd);let a=this.getAvatars?this.getAvatars():[this.getAvatar()].filter(Boolean);for(let t of a)t.setMotionBlurEnabled(!!e.motionBlur);if(e.fisheye!==void 0&&this.onApplyFisheye?.(e.fisheye),e.yandere!==void 0){let t=this.getAvatar(e.speakerCharacterId);if(t)if(e.yandere===!1)t.setYandereMode(!1);else{let n=typeof e.yandere==`object`?e.yandere:void 0;t.setYandereMode(!0,n)}}if(e.shaftCutIn&&e.shaftCutIn!==`none`?this.shaftCutInOverlay.show(e.shaftCutIn,e.shaftCutInDuration):this.shaftCutInOverlay.hide(),e.shaftMode!==void 0){this.onSwitchShaftMode?.(e.shaftMode);let t=this.getAvatars?this.getAvatars():[this.getAvatar()].filter(Boolean);for(let n of t)n.setMotionFrozen(e.shaftMode),n.setLipSyncEnabled(!e.shaftMode)}if(e.shaftSpaceStage===void 0?e.shaftMode===!1&&this.onSwitchShaftSpaceStage?.(!1):this.onSwitchShaftSpaceStage?.(e.shaftSpaceStage),e.shafudo!==void 0){let t=this.getAvatar(e.speakerCharacterId);t&&t.setShafudo(e.shafudo)}if(e.avatars)for(let[t,n]of Object.entries(e.avatars)){let e=this.getAvatar(t);e&&this.applyAvatarAction(e,n,t)}else if(e.avatar){let t=e.avatar.character||e.character||e.speakerCharacterId,n=this.getAvatar(t);n&&this.applyAvatarAction(n,e.avatar,t)}e.transitions&&e.transitions.length>0&&(this.pendingSceneTransitions={transitions:[...e.transitions].sort((e,t)=>e.at-t.at),nextIndex:0}),this.applyConversationAttention(e),this.onApplySceneCamera?this.onApplySceneCamera(e):this.onApplyCamera&&(e.cameraStartAngle||e.cameraPreset)&&this.onApplyCamera(e.cameraStartAngle,e.cameraPreset,e.cameraStrength??1),e.screenTransition===`eyelid_close`?this.messageWindow.setEyelidClosed(!0):this.messageWindow.setEyelidClosed(!1)}applySceneAudioAndDialogue(e){let t=e.seUrl||(e.scrollingBackground?.enabled?`/se/walking.mp3`:void 0);if(t)e.seLoop===!1?this.playOneShotSe(t,e.seVolume??.8):this.startSe(t,e.seVolume??.65,!0);else if(this.currentPackage?.se||this.currentPackage?.seUrl){let e=this.currentPackage.se||this.currentPackage.seUrl;this.startSe(e,this.currentPackage.seVolume??.2,!0)}else this.stopSe();let n=e.voice||e.voiceUrl;if(n){let t=this.getAudioLipSync(),r=this.masterManager.resolveSoundUrl(n)||z(n);t.loadAudioUrl(r,e.text,e.voicePan??0),t.play().catch(()=>{}),this.boundVoiceEndHandler&&t.audioElement.removeEventListener(`ended`,this.boundVoiceEndHandler),this.boundVoiceEndHandler=()=>{this.handleVoiceEnded()},t.audioElement.addEventListener(`ended`,this.boundVoiceEndHandler,{once:!0})}if(e.location&&this.messageWindow.setLocation(e.location),this.messageWindow.setText(e.text,e.speaker??``),this.currentPackage?.hideMessageWindow&&this.messageWindow.hide(),this.messageWindow.hideChoices(),e.choices&&e.choices.length>0)this.showChoicesWithAttention(e.choices,e=>{this.selectChoice(e)});else if(!n&&(this.isAutoMode||e.autoNextSec!==void 0||this.currentPackage?.hideMessageWindow)){let t=e.autoNextSec??3;this.clearAutoNextTimer(),this.autoNextTimer=window.setTimeout(()=>{this.next()},t*1e3)}this.onSceneChange?.(e,this.getState())}handleVoiceEnded(){if(!this.isPlayingState)return;let e=this.currentScene;if(e){if(e.choices&&e.choices.length>0){this.messageWindow.isShowingChoices()||this.showChoicesWithAttention(e.choices,e=>{this.selectChoice(e)},!0);return}if(this.isAutoMode||e.autoNextSec!==void 0||this.currentPackage?.hideMessageWindow){let t=e.autoNextSec??.6;this.clearAutoNextTimer(),this.autoNextTimer=window.setTimeout(()=>{this.next()},t*1e3)}}}handleTypingComplete(){if(!this.isPlayingState)return;let e=this.currentScene;if(e&&!(e.voice||e.voiceUrl)&&(this.isAutoMode||e.autoNextSec)){let t=Math.max(2,Math.min(6,1.2+e.text.length*.055)),n=e.autoNextSec??t;this.clearAutoNextTimer(),this.autoNextTimer=window.setTimeout(()=>{e.choices&&e.choices.length>0?this.messageWindow.isShowingChoices()||this.showChoicesWithAttention(e.choices,e=>{this.selectChoice(e)}):this.next()},n*1e3)}}startBgm(e,t=.4,n=!0){if(e)try{this.bgmAudio?this.bgmAudio.src=z(e):this.bgmAudio=new Audio(z(e)),this.bgmAudio.loop=n,this.bgmAudio.volume=t,this.bgmAudio.play().catch(()=>{})}catch{}}stopBgm(){this.bgmAudio&&(this.bgmAudio.pause(),this.bgmAudio.currentTime=0)}playOneShotSe(e,t=.8){try{let n=z(e),r=new Audio(n);r.volume=Math.max(0,Math.min(1,t)),r.play().catch(()=>{})}catch{}}currentSeUrl=null;startSe(e,t=.2,n=!0){if(!e)return;let r=z(e);try{this.seAudio?(this.seAudio.loop=n,this.seAudio.volume=t,(this.currentSeUrl!==r||this.seAudio.paused)&&(this.seAudio.src=r,this.currentSeUrl=r,this.seAudio.play().catch(()=>{}))):(this.seAudio=new Audio(r),this.seAudio.loop=n,this.seAudio.volume=t,this.currentSeUrl=r,this.seAudio.play().catch(()=>{}))}catch{}}stopSe(){this.seAudio&&(this.seAudio.pause(),this.seAudio.currentTime=0,this.currentSeUrl=null)}stopVoice(){let e=this.getAudioLipSync();this.boundVoiceEndHandler&&=(e.audioElement.removeEventListener(`ended`,this.boundVoiceEndHandler),null),e.stop()}stopAudioAndVoice(){this.stopVoice()}clearAutoNextTimer(){this.autoNextTimer!==null&&(clearTimeout(this.autoNextTimer),this.autoNextTimer=null)}clearPendingEffectTextTimers(){for(let e of this.pendingEffectTextTimers)clearTimeout(e);this.pendingEffectTextTimers=[]}clearPendingMotionTimers(){for(let e of this.pendingMotionTimers)clearTimeout(e);this.pendingMotionTimers=[]}update(e){if(this.isPlayingState){for(let[t,n]of this.activeMoveTransitions.entries()){n.elapsed+=e;let r=Math.min(1,n.elapsed/n.duration),i=j.lerp(n.startPos.x,n.targetPos.x,r),a=j.lerp(n.startPos.y,n.targetPos.y,r),o=j.lerp(n.startPos.z,n.targetPos.z,r);if(t.setPosition(i,a,o),n.targetRotY!==void 0){let e=n.targetRotY-n.startRotY;for(;e<-Math.PI;)e+=Math.PI*2;for(;e>Math.PI;)e-=Math.PI*2;t.setRotationY(n.startRotY+e*r)}r>=1&&this.activeMoveTransitions.delete(t)}if(this.pendingAvatarTransitions.size>0||this.pendingSceneTransitions!==null){let t=this.getSceneCurrentTime(e);for(let[e,n]of this.pendingAvatarTransitions){for(;n.nextIndex<n.transitions.length;){let r=n.transitions[n.nextIndex];if(t<r.at)break;this.applyAvatarTransition(e,r,n.charId),n.nextIndex++}n.nextIndex>=n.transitions.length&&this.pendingAvatarTransitions.delete(e)}if(this.pendingSceneTransitions){let e=this.pendingSceneTransitions;for(;e.nextIndex<e.transitions.length;){let n=e.transitions[e.nextIndex];if(t<n.at)break;this.applySceneTransition(n),e.nextIndex++}e.nextIndex>=e.transitions.length&&(this.pendingSceneTransitions=null)}}else this.sceneElapsedTime+=e}}getSceneCurrentTime(e){let t=this.getAudioLipSync();return t.isPlaying&&t.audioElement.currentTime>0?(this.sceneElapsedTime=t.audioElement.currentTime,t.audioElement.currentTime):(this.sceneElapsedTime+=e,this.sceneElapsedTime)}applyAvatarTransition(e,t,n){if(t.expression!==void 0&&e.setExpression(t.expression,t.expressionWeight??1),t.motion){let n=this.masterManager.resolveMotionUrl(t.motion)||z(t.motion),r=n.toLowerCase(),i=t.motionLoop??(r.includes(`idle`)||r.includes(`walking`)||r.includes(`sitting`)||r.includes(`sit`));e.playAnimation(n,i,.5,void 0,t.motionSpeed??1)}if(t.lookAtTarget!==void 0)this.applyCustomLookAtTarget(e,n,t.lookAtTarget,{eyeWander:t.eyeWander,eyeOffset:t.eyeOffset,headOffset:t.headOffset});else if(t.lookAtCamera!==void 0||t.headLookAtCamera!==void 0||t.eyeLookAtCamera!==void 0){let n=t.eyeLookAtCamera??t.lookAtCamera??!0;e.setEyeLookAt({mode:n?`camera`:`forward`,offset:t.eyeOffset?{x:t.eyeOffset[0],y:t.eyeOffset[1]}:{x:0,y:0},wander:typeof t.eyeWander==`boolean`?t.eyeWander:typeof t.eyeWander==`number`?t.eyeWander>0:!1,wanderIntensity:typeof t.eyeWander==`number`?t.eyeWander:1}),e.setLookAtCamera(n);let r=t.headLookAtCamera??!1;e.setHeadLookAtCamera(r,{offset:t.headOffset?{x:t.headOffset[0],y:t.headOffset[1]}:{x:0,y:0}})}else t.eyeWander!==void 0&&e.setEyeLookAt({mode:`camera`,wander:typeof t.eyeWander==`boolean`?t.eyeWander:t.eyeWander>0,wanderIntensity:typeof t.eyeWander==`number`?t.eyeWander:1});if(t.faceTexture!==void 0&&(t.faceTexture.toLowerCase().includes(`blush`)?(e.resetFaceTexture(),e.setBlushMode(!0,{faceTexture:t.faceTexture})):t.faceTexture===``?(e.resetFaceTexture(),e.isBlushMode()&&e.setBlushMode(!1)):(e.setBlushMode(!1),e.setFaceTexture(t.faceTexture))),t.tears!==void 0&&e.setTearsEnabled(t.tears),t.sweat!==void 0)if(t.sweat===!1)e.setSweatEnabled(!1);else{let n=typeof t.sweat==`string`?t.sweat:`fly4`;e.showSweat({mode:n,duration:4})}t.effectText!==void 0&&(e.clearEffectText(),typeof t.effectText==`string`?e.showEffectText({stylePreset:t.effectText}):e.showEffectText({stylePreset:t.effectText.preset,text:t.effectText.text,duration:t.effectText.duration})),t.visible!==void 0&&e.setVisible(t.visible)}applySceneTransition(e){let t=this.currentScene;if(t){if(e.cameraZoom||e.cameraDistance!==void 0||e.cameraTarget){let n={...t,cameraZoom:e.cameraZoom??t.cameraZoom,cameraDistance:e.cameraDistance??t.cameraDistance,cameraTarget:e.cameraTarget??t.cameraTarget,cameraTransitionDuration:e.cameraTransitionDuration??.7,cameraTransitionEasing:e.cameraTransitionEasing??`smooth`};this.onApplySceneCamera?.(n)}if(e.background&&(this.currentBackgroundUrl=e.background,this.onSwitchBackground?.(e.background)),e.focusLines!==void 0)if(e.focusLines){let t=typeof e.focusLines==`object`?e.focusLines:void 0;this.focusLinesOverlay.show(t)}else this.focusLinesOverlay.hide()}}dispose(){this.stop(),this.clearPendingChoiceTimer(),this.focusLinesOverlay.dispose(),this.messageWindow.dispose()}},kn=[{text:`君とはよく会うな。もしかして私のストーカーなのか？`,displayText:`「君とはよく会うな。もしかして私のストーカーなのか？」`,durationSec:5.92,voiceUrl:`/voices/scenario_01.wav`,motionUrl:`/animations/Dismissing Gesture.fbx`,expression:`neutral`,pauseAfterSec:.3,cameraZoom:`speaker`,cameraPreset:`pushIn`,cameraStrength:.8},{text:`ふふっ、冗談だ`,displayText:`「ふふっ、冗談だ」`,durationSec:2.44,voiceUrl:`/voices/scenario_02.wav`,motionUrl:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:1,pauseAfterSec:.3,cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,cameraPreset:`punchIn`,cameraStrength:1},{text:`それで、君はここで何をしてるのかな？`,displayText:`「それで、君はここで何をしてるのかな？」`,durationSec:4.04,voiceUrl:`/voices/scenario_03.wav`,motionUrl:`/animations/Acknowledging.fbx`,expression:`neutral`,expressionWeight:1,pauseAfterSec:.8,cameraZoom:`medium`,cameraPreset:`orbitLeftHalf`,cameraStrength:.6}],An=[{text:`We run into each other quite often. Are you perhaps stalking me?`,displayText:`"We run into each other quite often. Are you perhaps stalking me?"`,durationSec:5.92,voiceUrl:`/voices/scenario_01.wav`,motionUrl:`/animations/Dismissing Gesture.fbx`,expression:`neutral`,pauseAfterSec:.3,cameraZoom:`speaker`,cameraPreset:`pushIn`,cameraStrength:.8},{text:`Hehe, just kidding.`,displayText:`"Hehe, just kidding."`,durationSec:2.44,voiceUrl:`/voices/scenario_02.wav`,motionUrl:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:1,pauseAfterSec:.3,cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,cameraPreset:`punchIn`,cameraStrength:1},{text:`So, what are you doing here anyway?`,displayText:`"So, what are you doing here anyway?"`,durationSec:4.04,voiceUrl:`/voices/scenario_03.wav`,motionUrl:`/animations/Acknowledging.fbx`,expression:`neutral`,expressionWeight:1,pauseAfterSec:.8,cameraZoom:`medium`,cameraPreset:`orbitLeftHalf`,cameraStrength:.6}];function jn(e=H()){return e===`en`?An:kn}var Mn=class{getAvatar;getAudioLipSync;onStepChange;onPlayStateChange;onFinished;onApplyStepCamera;bgmUrl;bgmVolume;seUrl;seVolume;bgmAudio=null;seAudio=null;messageWindow;_isPlaying=!1;currentStepIndex=0;steps=[];timeoutId=null;boundAudioEndedHandler=null;constructor(e){this.getAvatar=e.getAvatar,this.getAudioLipSync=e.getAudioLipSync,this.onStepChange=e.onStepChange,this.onPlayStateChange=e.onPlayStateChange,this.onFinished=e.onFinished,this.onApplyStepCamera=e.onApplyStepCamera,this.bgmUrl=e.bgmUrl??`/bgm/bgm.mp3`,this.bgmVolume=e.bgmVolume??.4,this.seUrl=e.seUrl??`/se/large_brown_cicada.mp3`,this.seVolume=e.seVolume??.2,this.messageWindow=new wn({typingSpeedMs:35,onStopClick:()=>{this.stop()},onNextClick:()=>{}})}get isPlaying(){return this._isPlaying}get currentStep(){return this.currentStepIndex}play(e){this._isPlaying&&this.stop(),this.steps=e&&e.length>0?e:jn(),this._isPlaying=!0,this.currentStepIndex=0,this.onPlayStateChange?.(!0),this.startBgm(),this.startSe(),this.messageWindow.show(),this.executeStep(0)}stop(){if(!this._isPlaying)return;this._isPlaying=!1,this.clearPendingTimeout();let e=this.getAudioLipSync();this.boundAudioEndedHandler&&=(e.audioElement.removeEventListener(`ended`,this.boundAudioEndedHandler),null),e.stop(),this.stopBgm(),this.stopSe(),this.messageWindow.hide();let t=this.getAvatar();t&&(t.setExpression(`neutral`,1),t.playAnimation(z(`/animations/Idle.fbx`),!0)),this.onPlayStateChange?.(!1)}startBgm(){this.bgmAudio||(this.bgmAudio=new Audio,this.bgmAudio.loop=!0),this.bgmAudio.src=z(this.bgmUrl),this.bgmAudio.volume=Math.max(0,Math.min(1,this.bgmVolume)),this.bgmAudio.currentTime=0,this.bgmAudio.play().catch(e=>console.warn(`BGM play failed:`,e))}stopBgm(){this.bgmAudio&&(this.bgmAudio.pause(),this.bgmAudio.currentTime=0)}startSe(){this.seAudio||(this.seAudio=new Audio,this.seAudio.loop=!0),this.seAudio.src=z(this.seUrl),this.seAudio.volume=Math.max(0,Math.min(1,this.seVolume)),this.seAudio.currentTime=0,this.seAudio.play().catch(e=>console.warn(`SE play failed:`,e))}stopSe(){this.seAudio&&(this.seAudio.pause(),this.seAudio.currentTime=0)}clearPendingTimeout(){this.timeoutId!==null&&(window.clearTimeout(this.timeoutId),this.timeoutId=null)}executeStep(e){if(!this._isPlaying)return;if(e>=this.steps.length){this.timeoutId=window.setTimeout(()=>{this._isPlaying&&(this.stop(),this.onFinished?.())},1500);return}this.currentStepIndex=e;let t=this.steps[e];this.onStepChange?.(e,t);let n=this.getAvatar(),r=this.getAudioLipSync();if(this.onApplyStepCamera?.(t),n&&t.expression&&n.setExpression(t.expression,t.expressionWeight??1),n&&t.motionUrl){let e=z(t.motionUrl),r=e.includes(`Idle`)||e.includes(`Walking`)||e.includes(`Jogging`)||e.includes(`Pose`);n.playAnimation(e,r)}let i=t.displayText||`「${t.text}」`;this.messageWindow.setText(i);let a=z(t.voiceUrl);r.loadAudioUrl(a,t.text),this.boundAudioEndedHandler&&=(r.audioElement.removeEventListener(`ended`,this.boundAudioEndedHandler),null),this.boundAudioEndedHandler=()=>{if(!this._isPlaying)return;this.boundAudioEndedHandler&&=(r.audioElement.removeEventListener(`ended`,this.boundAudioEndedHandler),null);let n=t.pauseAfterSec??.3;this.timeoutId=window.setTimeout(()=>{this._isPlaying&&this.executeStep(e+1)},Math.max(10,n*1e3))},r.audioElement.addEventListener(`ended`,this.boundAudioEndedHandler,{once:!0}),r.play()}dispose(){this.stop(),this.messageWindow.dispose()}},Q={uniforms:{tDiffuse:{value:null},uBlurAmount:{value:0},uOpacity:{value:1},uTint:{value:new O(1,1,1)},uZoomScale:{value:1},uPanOffset:{value:new C(0,0)},uFeatherWidth:{value:.2}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float uBlurAmount;
    uniform float uOpacity;
    uniform vec3 uTint;
    uniform float uZoomScale;
    uniform vec2 uPanOffset;
    uniform float uFeatherWidth;
    varying vec2 vUv;

    // High frequency pseudo-random hash for frosted glass micro-facet roughness
    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      // Horizontal edge feather alpha gradient
      float edgeAlpha = 1.0;
      if (uFeatherWidth > 0.001) {
        float leftEdge = smoothstep(0.0, uFeatherWidth, vUv.x);
        float rightEdge = smoothstep(1.0, 1.0 - uFeatherWidth, vUv.x);
        edgeAlpha = leftEdge * rightEdge;
      }

      // Dynamic camera parallax & zoom transform
      vec2 baseUv = (vUv - 0.5) / max(1.0, uZoomScale) + 0.5 - uPanOffset;

      if (uBlurAmount <= 0.002) {
        vec4 col = texture2D(tDiffuse, baseUv);
        gl_FragColor = vec4(col.rgb * uTint, col.a * uOpacity * edgeAlpha);
        return;
      }

      // Frosted Glass Effect (Texture UV coherent noise to avoid pixel shimmer)
      float noise = (hash21(baseUv * 600.0) - 0.5) * 2.0;
      float baseRadius = uBlurAmount * 0.012;

      vec4 sum = vec4(0.0);
      float totalWeight = 0.0;

      // 16 sampling points
      vec2 taps[16];
      taps[0]  = vec2( 0.0,      0.0);
      taps[1]  = vec2( 0.28,     0.15);
      taps[2]  = vec2(-0.25,     0.32);
      taps[3]  = vec2( 0.35,    -0.28);
      taps[4]  = vec2(-0.38,    -0.18);
      taps[5]  = vec2( 0.58,     0.42);
      taps[6]  = vec2(-0.62,     0.38);
      taps[7]  = vec2( 0.45,    -0.58);
      taps[8]  = vec2(-0.52,    -0.55);
      taps[9]  = vec2( 0.82,     0.12);
      taps[10] = vec2(-0.85,    -0.10);
      taps[11] = vec2( 0.12,     0.85);
      taps[12] = vec2(-0.15,    -0.88);
      taps[13] = vec2( 0.75,    -0.65);
      taps[14] = vec2(-0.72,     0.68);
      taps[15] = vec2( 0.95,     0.75);

      for (int i = 0; i < 16; i++) {
        vec2 jitterOffset = vec2(noise * 0.0018 * uBlurAmount);
        vec2 sampleUv = baseUv + taps[i] * baseRadius + jitterOffset;
        float w = 1.0 - length(taps[i]) * 0.45;
        sum += texture2D(tDiffuse, sampleUv) * w;
        totalWeight += w;
      }

      vec4 frostedColor = sum / totalWeight;
      vec3 milkyWhite = vec3(0.96, 0.98, 1.0);
      vec3 finalRgb = mix(frostedColor.rgb, milkyWhite, 0.09 * uBlurAmount);
      finalRgb += (noise * 0.014 * uBlurAmount);

      gl_FragColor = vec4(finalRgb * uTint, frostedColor.a * uOpacity * edgeAlpha);
    }
  `},Nn=class{scene;camera;rootGroup;planeMeshes;materials;geometry;textureLoader=new ae;currentTexture=null;currentTextureUrl=``;_isVisible=!1;_isSliding=!1;speed=.65;direction=`left`;targetBlur=0;currentBlur=0;featherWidth=.2;planeDistance=4.5;slideOffset=0;planeWidth=12;planeHeight=6.75;constructor(e){this.scene=e.scene,this.camera=e.camera,this.rootGroup=new S,this.rootGroup.name=`ScrollingBackgroundGroup`,this.rootGroup.visible=!1,this.rootGroup.renderOrder=-5,this.geometry=new P(1,1),this.materials=[new I({uniforms:w.clone(Q.uniforms),vertexShader:Q.vertexShader,fragmentShader:Q.fragmentShader,depthWrite:!1,depthTest:!0,transparent:!0,side:2}),new I({uniforms:w.clone(Q.uniforms),vertexShader:Q.vertexShader,fragmentShader:Q.fragmentShader,depthWrite:!1,depthTest:!0,transparent:!0,side:2}),new I({uniforms:w.clone(Q.uniforms),vertexShader:Q.vertexShader,fragmentShader:Q.fragmentShader,depthWrite:!1,depthTest:!0,transparent:!0,side:2})],this.planeMeshes=this.materials.map((e,t)=>{let n=new L(this.geometry,e);return n.renderOrder=-5+t,this.rootGroup.add(n),n}),this.scene.add(this.rootGroup)}get isVisible(){return this._isVisible}get isSliding(){return this._isSliding}show(e){let t=e?.textureUrl||`/textures/town_far.avif`;this.speed=e?.speed??this.speed,this.direction=e?.direction??this.direction,this.targetBlur=Math.max(0,Math.min(1,e?.blur??0)),e?.featherWidth===void 0?this.setFeatherWidth(this.featherWidth):this.setFeatherWidth(e.featherWidth),e?.instantBlur&&(this.currentBlur=this.targetBlur,this.applyBlurToMaterials(this.currentBlur)),this._isSliding=e?.speed===void 0?!0:e.speed>0,this._isVisible=!0,this.rootGroup.visible=!0,this.loadTexture(t),this.updatePlanesTransform(0)}hide(){this._isVisible=!1,this._isSliding=!1,this.rootGroup.visible=!1,this.slideOffset=0}setSliding(e){this._isSliding=e}setSpeed(e){this.speed=e,e<=0&&(this._isSliding=!1)}setBlur(e,t=!1){this.targetBlur=Math.max(0,Math.min(1,e)),t&&(this.currentBlur=this.targetBlur,this.applyBlurToMaterials(this.currentBlur))}setFeatherWidth(e){this.featherWidth=Math.max(0,Math.min(.49,e));for(let e of this.materials)e.uniforms.uFeatherWidth.value=this.featherWidth}loadTexture(e){let t=z(e);this.currentTextureUrl===t&&this.currentTexture||(this.currentTextureUrl=t,this.textureLoader.load(t,e=>{e.colorSpace=E,e.wrapS=ue,e.wrapT=ue,this.currentTexture=e;for(let t of this.materials)t.uniforms.tDiffuse.value=e,t.needsUpdate=!0},void 0,e=>{console.error(`Failed to load scrolling background texture:`,e)}))}applyBlurToMaterials(e){for(let t of this.materials)t.uniforms.uBlurAmount.value=e}update(e,t){if(!this._isVisible)return;let n=t?Math.max(1,t.zoomScale):1,r=t?t.panOffsetX:0,i=t?t.panOffsetY:0;for(let e of this.materials)e.uniforms.uZoomScale.value=n,e.uniforms.uPanOffset.value.set(r,i);if(Math.abs(this.currentBlur-this.targetBlur)>.001){let t=e*3.5;this.currentBlur<this.targetBlur?this.currentBlur=Math.min(this.targetBlur,this.currentBlur+t):this.currentBlur=Math.max(this.targetBlur,this.currentBlur-t),this.applyBlurToMaterials(this.currentBlur)}if(this._isSliding&&this.speed>0){let t=this.direction===`left`?-1:1;this.slideOffset+=t*this.speed*e}this.updatePlanesTransform(e)}updatePlanesTransform(e){let t=new k;this.camera.getWorldDirection(t);let n=this.camera.position.clone().addScaledVector(t,this.planeDistance);this.rootGroup.position.copy(n),this.rootGroup.quaternion.copy(this.camera.quaternion);let r=j.degToRad(this.camera.fov),i=2*this.planeDistance*Math.tan(r/2),a=i*this.camera.aspect;this.planeHeight=i*1.6,this.planeWidth=a*1.8;let o=Math.max(0,Math.min(.49,this.featherWidth)),s=this.planeWidth*(1-o),c=s,l=this.slideOffset%c;l>0&&(l-=c);let u=[l-s,l,l+s];for(let e=0;e<3;e++){let t=this.planeMeshes[e];t&&(t.position.set(u[e],0,-.004*e),t.scale.set(this.planeWidth,this.planeHeight,1))}}dispose(){this.hide(),this.geometry.dispose();for(let e of this.materials)e.dispose();this.currentTexture&&this.currentTexture.dispose(),this.scene.remove(this.rootGroup)}},Pn=class{container=null;slice1=null;slice2=null;slice3=null;slice4=null;titleEl=null;subtitleEl=null;isRunning=!1;constructor(){this.injectStyles(),this.createElements()}getParentContainer(){return document.getElementById(`viewport-container`)??document.body}injectStyles(){if(document.getElementById(`interlude-overlay-styles`))return;let e=document.createElement(`style`);e.id=`interlude-overlay-styles`,e.textContent=`
      .interlude-overlay-container {
        position: absolute;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        overflow: hidden;
        display: none;
      }

      .interlude-overlay-container.visible {
        display: block;
        pointer-events: auto;
      }

      .interlude-slice {
        position: absolute;
        left: 0;
        right: 0;
        height: 25%;
        transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }

      /* Alternating horizontal slices with anime sky/blue palette */
      .interlude-slice-1 {
        top: 0;
        background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
        transform: translateX(101%);
      }

      .interlude-slice-2 {
        top: 25%;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        transform: translateX(-101%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 20px;
        box-sizing: border-box;
      }

      .interlude-slice-3 {
        top: 50%;
        background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
        transform: translateX(101%);
      }

      .interlude-slice-4 {
        top: 75%;
        background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
        transform: translateX(-101%);
      }

      /* Active State: All slices slide in to cover screen */
      .interlude-overlay-container.covered .interlude-slice-1,
      .interlude-overlay-container.covered .interlude-slice-2,
      .interlude-overlay-container.covered .interlude-slice-3,
      .interlude-overlay-container.covered .interlude-slice-4 {
        transform: translateX(0);
      }

      /* Exit State: Slices exit to opposite sides for dynamic theatrical wipe */
      .interlude-overlay-container.exiting .interlude-slice-1 {
        transform: translateX(-101%);
      }
      .interlude-overlay-container.exiting .interlude-slice-2 {
        transform: translateX(101%);
      }
      .interlude-overlay-container.exiting .interlude-slice-3 {
        transform: translateX(-101%);
      }
      .interlude-overlay-container.exiting .interlude-slice-4 {
        transform: translateX(101%);
      }

      /* Center Title / Typography */
      .interlude-content {
        text-align: center;
        user-select: none;
      }

      .interlude-subtitle {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: #0284c7;
        margin-bottom: 4px;
      }

      .interlude-title {
        margin: 0;
        font-size: clamp(18px, 3.2vw, 28px);
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
        font-weight: 700;
        color: #0c4a6e;
        letter-spacing: 0.1em;
        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.85);
      }

      .interlude-deco-bar {
        width: 48px;
        height: 2px;
        background: linear-gradient(90deg, #0284c7 0%, #38bdf8 100%);
        margin: 6px auto 0;
        border-radius: 2px;
      }
    `,document.head.appendChild(e)}createElements(){let e=this.getParentContainer(),t=document.getElementById(`interlude-overlay-container`);t&&t.remove();let n=document.createElement(`div`);n.id=`interlude-overlay-container`,n.className=`interlude-overlay-container`,n.innerHTML=`
      <div class="interlude-slice interlude-slice-1"></div>
      <div class="interlude-slice interlude-slice-2">
        <div class="interlude-content">
          <span class="interlude-subtitle">SCENE TRANSITION</span>
          <h2 class="interlude-title">街の散歩道</h2>
          <div class="interlude-deco-bar"></div>
        </div>
      </div>
      <div class="interlude-slice interlude-slice-3"></div>
      <div class="interlude-slice interlude-slice-4"></div>
    `,e.appendChild(n),this.container=n,this.slice1=n.querySelector(`.interlude-slice-1`),this.slice2=n.querySelector(`.interlude-slice-2`),this.slice3=n.querySelector(`.interlude-slice-3`),this.slice4=n.querySelector(`.interlude-slice-4`),this.titleEl=n.querySelector(`.interlude-title`),this.subtitleEl=n.querySelector(`.interlude-subtitle`)}async playTransition(e={}){if(this.isRunning)return;this.isRunning=!0,(!this.container||!document.contains(this.container))&&this.createElements(),this.titleEl&&(this.titleEl.textContent=e.title??`街の散歩道`),this.subtitleEl&&(this.subtitleEl.textContent=e.subtitle??`SCENE TRANSITION`);let t=e.holdDurationMs??320,n=this.container;if(n.classList.remove(`exiting`,`covered`),n.classList.add(`visible`),n.offsetHeight,n.classList.add(`covered`),await new Promise(e=>setTimeout(e,430)),e.onCovered)try{await e.onCovered()}catch(e){console.error(`Error during interlude onCovered:`,e)}await new Promise(e=>setTimeout(e,t)),n.classList.remove(`covered`),n.classList.add(`exiting`),await new Promise(e=>setTimeout(e,430)),n.classList.remove(`visible`,`exiting`),this.isRunning=!1}},Fn=class{scene;camera;canvas;ctx;texture;material;mesh;_isActive=!1;elapsed=0;currentOpacity=0;config;hearts=[];bokehOrbs=[];sparkles=[];totalTime=0;canvasWidth=1024;canvasHeight=1024;planeDistance=5;constructor(e,t){this.scene=e,this.camera=t,this.config={duration:2.4,fadeInDuration:.18,fadeOutStart:1.7,fadeOutDuration:.7,theme:`heart`},this.canvas=document.createElement(`canvas`),this.canvas.width=this.canvasWidth,this.canvas.height=this.canvasHeight,this.ctx=this.canvas.getContext(`2d`,{alpha:!1}),this.texture=new R(this.canvas),this.texture.generateMipmaps=!1,this.texture.minFilter=te,this.texture.magFilter=te,this.material=new F({map:this.texture,transparent:!0,opacity:0,depthTest:!0,depthWrite:!1,side:2}),this.mesh=new L(new P(1,1),this.material),this.mesh.name=`AnimeDreamBackgroundMesh`,this.mesh.renderOrder=-5,this.mesh.visible=!1,this.scene.add(this.mesh),this.initParticles()}get isActive(){return this._isActive}get opacity(){return this.currentOpacity}initParticles(){this.hearts=[],this.bokehOrbs=[],this.sparkles=[];let e=[`#ff5f9e`,`#ff7da7`,`#ffa3c4`,`#ff6b8b`,`#ffffff`,`#ff8bb0`];for(let t=0;t<28;t++){let t=Math.random()*this.canvasWidth,n=Math.random(),r=n<.55?`filled`:n<.82?`outline`:`inner`;this.hearts.push({x:t,y:Math.random()*this.canvasHeight,baseX:t,size:22+Math.random()*48,speedY:45+Math.random()*65,wobbleSpeed:1.4+Math.random()*1.8,wobbleAmp:18+Math.random()*32,rotSpeed:.8+Math.random()*1.5,pulseSpeed:2.2+Math.random()*2.5,color:e[Math.floor(Math.random()*e.length)],style:r,alpha:.65+Math.random()*.32,phase:Math.random()*Math.PI*2})}let t=[{r:255,g:215,b:230},{r:255,g:242,b:210},{r:255,g:228,b:242},{r:255,g:200,b:220}];for(let e=0;e<22;e++){let e=Math.random()*this.canvasWidth,n=t[Math.floor(Math.random()*t.length)];this.bokehOrbs.push({x:e,y:Math.random()*this.canvasHeight,baseX:e,radius:35+Math.random()*65,speedY:20+Math.random()*38,wobbleSpeed:.8+Math.random()*1.2,wobbleAmp:12+Math.random()*20,r:n.r,g:n.g,b:n.b,alpha:.22+Math.random()*.24,pulseSpeed:1.5+Math.random()*2,phase:Math.random()*Math.PI*2})}for(let e=0;e<18;e++)this.sparkles.push({x:Math.random()*this.canvasWidth,y:Math.random()*this.canvasHeight,size:16+Math.random()*28,speedY:18+Math.random()*32,rotSpeed:.5+Math.random()*1.2,twinkleSpeed:2.8+Math.random()*3.5,color:Math.random()<.65?`#ffffff`:`#fff9d6`,phase:Math.random()*Math.PI*2})}play(e){e&&(this.config={duration:e.duration??2.4,fadeInDuration:e.fadeInDuration??.18,fadeOutStart:e.fadeOutStart??1.7,fadeOutDuration:e.fadeOutDuration??.7,theme:e.theme??`heart`}),this._isActive=!0,this.elapsed=0,this.currentOpacity=0,this.material.opacity=0,this.mesh.visible=!0,this.initParticles(),this.renderFrame(0),this.texture.needsUpdate=!0}stop(e=!1){!this._isActive&&this.currentOpacity<=0||(e||this.currentOpacity<=.02?(this._isActive=!1,this.currentOpacity=0,this.material.opacity=0,this.mesh.visible=!1):(this._isActive=!1,this.config.fadeOutStart=this.elapsed,this.config.fadeOutDuration=.35))}update(e){if(!this._isActive&&this.currentOpacity<=0){this.mesh.visible&&(this.mesh.visible=!1);return}if(this.elapsed+=e,this.totalTime+=e,this.elapsed<this.config.fadeInDuration){let e=this.elapsed/Math.max(.01,this.config.fadeInDuration);this.currentOpacity=Math.min(1,e*(2-e))}else if(this.elapsed<this.config.fadeOutStart)this.currentOpacity=1;else if(this.elapsed<this.config.fadeOutStart+this.config.fadeOutDuration){let e=(this.elapsed-this.config.fadeOutStart)/Math.max(.01,this.config.fadeOutDuration),t=e*e*(3-2*e);this.currentOpacity=Math.max(0,1-t)}else this.currentOpacity=0,this._isActive=!1,this.mesh.visible=!1;if(this.material.opacity=this.currentOpacity,this.currentOpacity<=0){this.mesh.visible=!1;return}this.mesh.visible=!0,this.updateMeshFrustum(),this.updateParticles(e),this.renderFrame(e),this.texture.needsUpdate=!0}updateMeshFrustum(){let e=new k;this.camera.getWorldDirection(e);let t=this.camera.position.clone().addScaledVector(e,this.planeDistance);this.mesh.position.copy(t),this.mesh.quaternion.copy(this.camera.quaternion);let n=j.degToRad(this.camera.fov),r=2*this.planeDistance*Math.tan(n/2),i=r*this.camera.aspect;this.mesh.scale.set(i*1.35,r*1.35,1)}updateParticles(e){let t=this.canvasHeight,n=this.totalTime;for(let r of this.hearts)r.y-=r.speedY*e,r.x=r.baseX+Math.sin(n*r.wobbleSpeed+r.phase)*r.wobbleAmp,r.y<-r.size*2&&(r.y=t+r.size*2,r.baseX=Math.random()*this.canvasWidth,r.x=r.baseX);for(let r of this.bokehOrbs)r.y-=r.speedY*e,r.x=r.baseX+Math.sin(n*r.wobbleSpeed+r.phase)*r.wobbleAmp,r.y<-r.radius*2&&(r.y=t+r.radius*2,r.baseX=Math.random()*this.canvasWidth,r.x=r.baseX);for(let n of this.sparkles)n.y-=n.speedY*e,n.y<-n.size*2&&(n.y=t+n.size*2,n.x=Math.random()*this.canvasWidth)}renderFrame(e){let t=this.ctx,n=this.canvasWidth,r=this.canvasHeight,i=this.totalTime,a=t.createLinearGradient(0,0,0,r);a.addColorStop(0,`#fff5f8`),a.addColorStop(.35,`#ffebf3`),a.addColorStop(.7,`#ffd6e7`),a.addColorStop(1,`#fce4f4`),t.fillStyle=a,t.fillRect(0,0,n,r),t.save(),t.translate(n*.5,r*.48),t.rotate(i*.09);let o=Math.PI*2/14;t.fillStyle=`rgba(255, 255, 255, 0.16)`;for(let e=0;e<14;e+=2)t.beginPath(),t.moveTo(0,0),t.arc(0,0,n*.85,e*o,(e+1)*o),t.closePath(),t.fill();t.restore();let s=.55+.05*Math.sin(i*2.2),c=t.createRadialGradient(n*.5,r*.48,0,n*.5,r*.48,n*s);c.addColorStop(0,`rgba(255, 255, 255, 0.72)`),c.addColorStop(.4,`rgba(255, 240, 246, 0.45)`),c.addColorStop(.85,`rgba(255, 222, 238, 0.15)`),c.addColorStop(1,`rgba(255, 210, 230, 0.0)`),t.fillStyle=c,t.fillRect(0,0,n,r);for(let e of this.bokehOrbs){let n=1+.15*Math.sin(i*e.pulseSpeed+e.phase),r=e.radius*n,a=t.createRadialGradient(e.x,e.y,0,e.x,e.y,r);a.addColorStop(0,`rgba(255, 255, 255, ${e.alpha*1.3})`),a.addColorStop(.35,`rgba(${e.r}, ${e.g}, ${e.b}, ${e.alpha*.8})`),a.addColorStop(.75,`rgba(${e.r}, ${e.g}, ${e.b}, ${e.alpha*.2})`),a.addColorStop(1,`rgba(${e.r}, ${e.g}, ${e.b}, 0.0)`),t.fillStyle=a,t.beginPath(),t.arc(e.x,e.y,r,0,Math.PI*2),t.fill()}for(let e of this.hearts){let n=1+.12*Math.sin(i*e.pulseSpeed+e.phase),r=e.size*n,a=Math.sin(i*e.rotSpeed+e.phase)*.28;this.drawHeart(t,e.x,e.y,r,a,e.style,e.color,e.alpha)}for(let e of this.sparkles){let n=Math.sin(i*e.twinkleSpeed+e.phase)**2,r=e.size*(.6+.5*n),a=.35+.65*n,o=i*e.rotSpeed+e.phase;this.drawSparkle(t,e.x,e.y,r,o,a,e.color)}}drawHeart(e,t,n,r,i,a,o,s){e.save(),e.translate(t,n),e.rotate(i),e.globalAlpha=s;let c=r;e.beginPath(),e.moveTo(0,-.25*c),e.bezierCurveTo(-.55*c,-.85*c,-1*c,-.2*c,-.6*c,.4*c),e.bezierCurveTo(-.35*c,.7*c,0,.9*c,0,1.05*c),e.bezierCurveTo(0,.9*c,.35*c,.7*c,.6*c,.4*c),e.bezierCurveTo(1*c,-.2*c,.55*c,-.85*c,0,-.25*c),e.closePath(),a===`filled`?(e.fillStyle=o,e.fill(),e.beginPath(),e.ellipse(-.32*c,-.42*c,.16*c,.08*c,-Math.PI/4,0,Math.PI*2),e.fillStyle=`rgba(255, 255, 255, 0.85)`,e.fill()):a===`outline`?(e.strokeStyle=o,e.lineWidth=Math.max(3.5,r*.12),e.lineCap=`round`,e.lineJoin=`round`,e.stroke(),e.fillStyle=`rgba(255, 255, 255, 0.25)`,e.fill()):a===`inner`&&(e.fillStyle=o,e.fill(),e.save(),e.scale(.48,.48),e.beginPath(),e.moveTo(0,-.25*c),e.bezierCurveTo(-.55*c,-.85*c,-1*c,-.2*c,-.6*c,.4*c),e.bezierCurveTo(-.35*c,.7*c,0,.9*c,0,1.05*c),e.bezierCurveTo(0,.9*c,.35*c,.7*c,.6*c,.4*c),e.bezierCurveTo(1*c,-.2*c,.55*c,-.85*c,0,-.25*c),e.closePath(),e.fillStyle=`rgba(255, 255, 255, 0.9)`,e.fill(),e.restore()),e.restore()}drawSparkle(e,t,n,r,i,a,o){e.save(),e.translate(t,n),e.rotate(i),e.globalAlpha=a,e.fillStyle=o,e.beginPath();let s=r*.5,c=r*.08;e.moveTo(0,-s),e.quadraticCurveTo(0,0,-s,0),e.quadraticCurveTo(0,0,0,s),e.quadraticCurveTo(0,0,s,0),e.quadraticCurveTo(0,0,0,-s),e.closePath(),e.fill(),e.beginPath(),e.arc(0,0,Math.max(1.5,c*1.5),0,Math.PI*2),e.fillStyle=`#ffffff`,e.fill(),e.restore()}dispose(){this.stop(!0),this.mesh.parent&&this.mesh.parent.remove(this.mesh),this.mesh.geometry.dispose(),this.material.dispose(),this.texture.dispose(),this.canvas.width=1,this.canvas.height=1}},In=class{container;typoWrapper;titleLogoWrapper;isVisible=!1;constructor(){this.container=document.createElement(`div`),this.container.id=`pv-overlay-root`,this.container.style.cssText=`
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 999;
      display: none;
      overflow: hidden;
    `,this.typoWrapper=document.createElement(`div`),this.typoWrapper.className=`pv-dynamic-typo-container`,this.typoWrapper.style.cssText=`
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      display: flex;
      transition: opacity 0.5s ease;
      opacity: 0;
    `,this.container.appendChild(this.typoWrapper),this.titleLogoWrapper=document.createElement(`div`),this.titleLogoWrapper.className=`pv-title-logo-wrapper`,this.titleLogoWrapper.style.cssText=`
      position: absolute;
      top: 38%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.65);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: all 0.75s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `,this.titleLogoWrapper.innerHTML=`
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Montserrat:wght@300;400;600;800;900&family=Shippori+Mincho:wght@500;600;700;800&display=swap');

        /* --- 共通フォント --- */
        .pv-font-mincho {
          font-family: 'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif;
        }
        .pv-font-cinzel {
          font-family: 'Cinzel', 'Times New Roman', serif;
        }
        .pv-font-sans-proportional {
          font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* --- 自己完結型レイアウトスタイル --- */
        .pv-l-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 20px;
          pointer-events: none;
        }
        .pv-l-vert-right {
          position: absolute;
          right: 24px;
          top: 15%;
          bottom: 24%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .pv-l-vert-left {
          position: absolute;
          left: 24px;
          top: 15%;
          bottom: 24%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        /* --- シネマティック文字縁取り ＆ 輪郭強化 --- */
        .pv-main-catchphrase {
          -webkit-text-stroke: 1.5px rgba(0, 0, 0, 0.9);
          paint-order: stroke fill;
        }
        .pv-sub-catchphrase {
          -webkit-text-stroke: 0.6px rgba(0, 0, 0, 0.85);
          paint-order: stroke fill;
        }

        .pv-l-horiz-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          padding: 10px 48px 12px 24px;
          background: radial-gradient(ellipse closest-side at 80% 50%, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.22) 65%, transparent 100%);
          backdrop-filter: blur(2.5px);
          -webkit-backdrop-filter: blur(2.5px);
          border-radius: 20px;
        }
        .pv-l-horiz-left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: 10px 24px 12px 48px;
          background: radial-gradient(ellipse closest-side at 20% 50%, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.22) 65%, transparent 100%);
          backdrop-filter: blur(2.5px);
          -webkit-backdrop-filter: blur(2.5px);
          border-radius: 20px;
        }
        .pv-smash-container {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          pointer-events: none;
        }
        .pv-ghost-text {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }
        .pv-step-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-left: 70px;
          padding-right: 70px;
          pointer-events: none;
        }
        .pv-cinema-push-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          pointer-events: none;
          background: radial-gradient(ellipse 75% 55% at 50% 50%, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.25) 65%, transparent 100%);
          backdrop-filter: blur(2.5px);
          -webkit-backdrop-filter: blur(2.5px);
        }
        .pv-bottom-glow-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 48px;
          text-align: center;
          pointer-events: none;
        }

        /* --- アニメーション定義 --- */
        @keyframes pvVertLineEnter {
          0% { opacity: 0; transform: translateY(-16px); letter-spacing: 0.25em; }
          100% { opacity: 0.9; transform: translateY(0); letter-spacing: 0.45em; }
        }
        @keyframes pvHorizTextEnter {
          0% { opacity: 0; transform: translateX(16px); filter: blur(8px); letter-spacing: 0.08em; }
          100% { opacity: 1; transform: translateX(0); filter: blur(0px); letter-spacing: 0.18em; }
        }
        @keyframes pvTextFloatDrift {
          0%, 100% { transform: scale(1.0); }
          50% { transform: scale(1.025) translate(-2px, -2px); }
        }
        @keyframes pvSmashImpact {
          0% { opacity: 0; transform: scale(2.0) rotate(-4deg); filter: blur(14px); }
          25% { opacity: 1; transform: scale(0.97) rotate(-4deg); filter: blur(0px); }
          40% { transform: scale(1.02) rotate(-4deg); }
          100% { transform: scale(1.0) rotate(-4deg); }
        }
        @keyframes pvGhostSlide {
          0% { transform: translateX(6%); opacity: 0; }
          20% { opacity: 0.14; }
          100% { transform: translateX(-6%); opacity: 0.18; }
        }
        @keyframes pvStepLine {
          0% { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0px); }
        }
        @keyframes pvCinematicPushIn {
          0% { opacity: 0; transform: scale(0.75); letter-spacing: 0.08em; filter: blur(12px); }
          20% { opacity: 1; filter: blur(0px); }
          100% { opacity: 1; transform: scale(1.08); letter-spacing: 0.20em; filter: blur(0px); }
        }
        @keyframes pvBottomGlowEnter {
          0% { opacity: 0; transform: translateY(12px); filter: blur(8px); letter-spacing: 0.12em; }
          100% { opacity: 1; transform: translateY(0); filter: blur(0px); letter-spacing: 0.22em; }
        }

        /* --- Kawaii ロゴアニメーション --- */
        @keyframes kawaiiFloat {
          0%, 100% { transform: translateY(0px) rotate(-1.5deg); }
          50% { transform: translateY(-10px) rotate(1.5deg); }
        }
        @keyframes kawaiiHeartSparkle {
          0% { transform: scale(0.8) translateY(0); opacity: 0; }
          50% { transform: scale(1.2) translateY(-15px); opacity: 1; }
          100% { transform: scale(0.9) translateY(-30px); opacity: 0; }
        }
        @keyframes logoShine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .kawaii-logo-main {
          display: flex;
          align-items: center;
          gap: 6px;
          animation: kawaiiFloat 3s ease-in-out infinite;
          filter: drop-shadow(0 14px 30px rgba(255, 64, 129, 0.5));
        }
        .kawaii-num {
          font-size: clamp(70px, 12vw, 110px);
          font-weight: 900;
          color: #ff3377;
          background: linear-gradient(135deg, #ff1493 0%, #ff69b4 50%, #ff85a2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          -webkit-text-stroke: 5px #ffffff;
          filter: drop-shadow(0 4px 0 #ff007f);
          transform: rotate(-6deg);
          display: inline-block;
        }
        .kawaii-text {
          font-size: clamp(54px, 9vw, 84px);
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #ff2d87;
          background: linear-gradient(135deg, #ff007f 0%, #ff69b4 40%, #ffb6c1 80%, #ffffff 100%);
          background-size: 200% 200%;
          animation: logoShine 4s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          -webkit-text-stroke: 4.5px #ffffff;
          filter: drop-shadow(0 4px 0 #e60067);
          text-shadow: 0 4px 20px rgba(255, 105, 180, 0.6);
        }
        .kawaii-heart-icon {
          font-size: clamp(34px, 5vw, 50px);
          display: inline-block;
          animation: kawaiiFloat 2s ease-in-out infinite;
          filter: drop-shadow(0 4px 8px rgba(255, 20, 147, 0.5));
        }
        .kawaii-subtitle-badge {
          margin-top: 14px;
          padding: 8px 30px;
          background: linear-gradient(90deg, #ff1493, #a855f7, #38bdf8);
          border: 2px solid #ffffff;
          border-radius: 999px;
          color: #ffffff;
          font-size: clamp(14px, 2vw, 19px);
          font-weight: 800;
          letter-spacing: 0.22em;
          box-shadow: 0 8px 24px rgba(255, 20, 147, 0.45);
          text-transform: uppercase;
        }
        .sparkle-particle {
          position: absolute;
          pointer-events: none;
          animation: kawaiiHeartSparkle 2s ease-out infinite;
        }
      </style>

      <div class="kawaii-logo-main">
        <span class="kawaii-heart-icon">💖</span>
        <span class="kawaii-num">5</span>
        <span class="kawaii-text">秒の告白</span>
        <span class="kawaii-heart-icon">✨</span>
      </div>
      <div class="kawaii-subtitle-badge">
        5 SECONDS CONFESSION 〜恋する奇跡の瞬間〜
      </div>

      <!-- キラキラ・ハート装飾 -->
      <div class="sparkle-particle" style="top: -20px; left: 10%; font-size: 32px; animation-delay: 0.2s;">✨</div>
      <div class="sparkle-particle" style="top: -30px; right: 15%; font-size: 36px; animation-delay: 0.7s;">💕</div>
      <div class="sparkle-particle" style="bottom: -15px; left: 20%; font-size: 28px; animation-delay: 1.1s;">🌸</div>
      <div class="sparkle-particle" style="bottom: -20px; right: 25%; font-size: 30px; animation-delay: 1.5s;">🌟</div>
    `,this.container.appendChild(this.titleLogoWrapper);let e=document.getElementById(`app`);e&&e.parentNode?e.parentNode.insertBefore(this.container,e.nextSibling):document.body.appendChild(this.container)}show(){this.container.style.display=`block`,this.isVisible=!0}hide(){this.container.style.display=`none`,this.typoWrapper.style.opacity=`0`,this.typoWrapper.innerHTML=``,this.titleLogoWrapper.style.opacity=`0`,this.titleLogoWrapper.style.transform=`translate(-50%, -50%) scale(0.65)`,this.isVisible=!1}updateSubtitle(e){this.isVisible||this.show();let t=e.theme||`day`,n=this.getThemeStyles(t),r=e.layout||`bottom-glow`,i=``;if(r===`l-shape`){let t=e.side!==`left`,r=t?`pv-l-horiz-right`:`pv-l-horiz-left`;i=`
        <div class="pv-l-container" style="animation: pvTextFloatDrift 6s ease-in-out infinite;">
          <!-- 縦のプロポーショナル英字 ＆ ヘアライン -->
          <div class="${t?`pv-l-vert-right`:`pv-l-vert-left`}">
            <div style="width: 1px; flex: 1; background: linear-gradient(to bottom, transparent, ${n.lineColor}, transparent);"></div>
            <div class="pv-font-sans-proportional" style="
              writing-mode: vertical-rl;
              font-size: clamp(10px, 1.2vw, 13px);
              font-weight: 700;
              letter-spacing: 0.45em;
              text-transform: uppercase;
              color: ${n.enColor};
              animation: pvVertLineEnter 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            ">
              ${e.verticalEn||`5 SECONDS CONFESSION`}
            </div>
          </div>

          <!-- 底辺の日本語主文（横書きで「、」「っ」が完全に自然） -->
          <div class="${r}">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(19px, 2.7vw, 36px);
              font-weight: 700;
              color: ${n.mainText};
              white-space: nowrap;
              filter: ${n.textShadow};
              animation: pvHorizTextEnter 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            ">
              ${e.titleText||``}
            </div>
            ${e.subText?`
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 8px;
                font-size: clamp(11px, 1.3vw, 15px);
                font-weight: 600;
                letter-spacing: 0.35em;
                text-transform: uppercase;
                color: ${n.enColor};
                animation: pvHorizTextEnter 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
              ">
                ${e.subText}
              </div>
            `:``}
          </div>
        </div>
      `}else i=r===`ghost-smash`?`
        <div class="pv-smash-container">
          <!-- 背景の巨大ゴースト英字（プロポーショナル・幾何学サンセリフ） -->
          <div class="pv-ghost-text" style="animation: pvGhostSlide 9s linear infinite;">
            <span class="pv-font-sans-proportional" style="
              font-size: clamp(70px, 14vw, 150px);
              font-weight: 900;
              color: #ffffff;
              letter-spacing: 0.25em;
              white-space: nowrap;
              opacity: 0.15;
            ">
              ${e.ghostText||`FALL IN LOVE`}
            </span>
          </div>

          <!-- 手前に叩きつけられる斜めコピー -->
          <div style="
            position: relative;
            z-index: 10;
            text-align: center;
            animation: pvSmashImpact 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          ">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(34px, 5.8vw, 76px);
              font-weight: 800;
              color: ${n.mainText};
              white-space: nowrap;
              filter: ${n.textShadow};
            ">
              ${e.titleText||``}
            </div>
            ${e.subText?`
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 12px;
                font-size: clamp(14px, 1.8vw, 22px);
                font-weight: 700;
                letter-spacing: 0.38em;
                text-transform: uppercase;
                color: ${n.enColor};
              ">
                ${e.subText}
              </div>
            `:``}
          </div>
        </div>
      `:r===`step-cascade`?`
        <div class="pv-step-container" style="animation: pvTextFloatDrift 6s ease-in-out infinite;">
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${(e.lines||[{text:`もしも、`,en:`IF EVER`},{text:`世界が今日`,en:`THE WORLD ENDS`},{text:`終わるなら。`,en:`RIGHT TODAY`}]).map((e,t)=>`
              <div class="pv-font-mincho" style="
                font-size: clamp(20px, 3.0vw, 36px);
                font-weight: 700;
                color: ${n.mainText};
                padding-left: ${t*48}px;
                display: flex;
                align-items: center;
                gap: 14px;
                filter: ${n.textShadow};
                animation: pvStepLine 1s cubic-bezier(0.16, 1, 0.3, 1) ${t*.28}s forwards;
                opacity: 0;
              ">
                <span class="pv-main-catchphrase">${e.text}</span>
                ${e.en?`
                  <span class="pv-font-cinzel" style="
                    font-size: clamp(10px, 1.1vw, 13px);
                    font-weight: 700;
                    letter-spacing: 0.28em;
                    color: ${n.enColor};
                    text-transform: uppercase;
                  ">${e.en}</span>
                `:``}
              </div>
            `).join(``)}
          </div>
        </div>
      `:r===`cinema-push`?`
        <div class="pv-cinema-push-container">
          <div style="animation: pvCinematicPushIn 4.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(24px, 3.8vw, 48px);
              font-weight: 700;
              color: ${n.mainText};
              white-space: nowrap;
              filter: ${n.textShadow};
            ">
              ${e.titleText||``}
            </div>
            ${e.subText?`
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 14px;
                font-size: clamp(11px, 1.3vw, 15px);
                font-weight: 700;
                letter-spacing: 0.45em;
                text-transform: uppercase;
                color: ${n.enColor};
              ">
                ${e.subText}
              </div>
            `:``}
          </div>
        </div>
      `:`
        <div class="pv-bottom-glow-container" style="animation: pvTextFloatDrift 6s ease-in-out infinite;">
          <div style="text-align: center; animation: pvBottomGlowEnter 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(24px, 3.6vw, 46px);
              font-weight: 700;
              color: ${n.mainText};
              white-space: nowrap;
              filter: ${n.textShadow};
            ">
              ${e.titleText||``}
            </div>
            ${e.subText?`
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 10px;
                font-size: clamp(11px, 1.3vw, 15px);
                font-weight: 600;
                letter-spacing: 0.38em;
                text-transform: uppercase;
                color: ${n.enColor};
              ">
                ${e.subText}
              </div>
            `:``}
          </div>
        </div>
      `;this.typoWrapper.innerHTML=i,this.typoWrapper.style.opacity=`1`}getThemeStyles(e){switch(e){case`sunset`:return{mainText:`#fffbeb`,textShadow:`0 0 4px #000000, 0 0 10px #000000, 0 2px 14px rgba(0,0,0,0.95), 0 0 30px rgba(245,158,11,0.5)`,accentColor:`#f43f5e`,enColor:`#fef3c7`,lineColor:`rgba(245, 158, 11, 0.8)`};case`night`:return{mainText:`#ffffff`,textShadow:`0 0 4px #000000, 0 0 10px #000000, 0 2px 14px rgba(0,0,0,0.98), 0 0 24px rgba(168,85,247,0.65)`,accentColor:`#e11d48`,enColor:`#f3e8ff`,lineColor:`rgba(168, 85, 247, 0.8)`};default:return{mainText:`#ffffff`,textShadow:`0 0 4px #000000, 0 0 10px #000000, 0 2px 12px rgba(0,0,0,0.95), 0 0 25px rgba(56,189,248,0.45)`,accentColor:`#38bdf8`,enColor:`#e0f2fe`,lineColor:`rgba(56, 189, 248, 0.8)`}}}showKawaiiTitleLogo(){this.isVisible||this.show(),this.typoWrapper.style.opacity=`0`,this.titleLogoWrapper.style.display=`flex`,this.titleLogoWrapper.style.opacity=`1`,requestAnimationFrame(()=>{this.titleLogoWrapper.style.transform=`translate(-50%, -50%) scale(1.05)`,setTimeout(()=>{this.titleLogoWrapper.style.transform=`translate(-50%, -50%) scale(1.0)`},350)})}hideKawaiiTitleLogo(){this.titleLogoWrapper.style.opacity=`0`,this.titleLogoWrapper.style.transform=`translate(-50%, -50%) scale(0.65)`}dispose(){this.container.remove()}},Ln=[{id:`mob_classroom_boy_talking`,modelUrl:z(`/models/mob/boy.vrm`),motionUrl:z(`/animations/mob_chat_gesture.fbx`),position:[-1.5,0,-3.05],rotationY:2.07,scale:.98,animTimeOffset:.2},{id:`mob_classroom_girl_listening`,modelUrl:z(`/models/mob/girl.vrm`),motionUrl:z(`/animations/mob_listen_nod.fbx`),position:[-.95,0,-3.35],rotationY:-1.07,scale:.95,animTimeOffset:1.1},{id:`mob_classroom_girl_laughing`,modelUrl:z(`/models/mob/girl2.vrm`),motionUrl:z(`/animations/ardy_laugh.fbx`),position:[-2.15,0,-3.45],rotationY:1.1,scale:.94,animTimeOffset:.7},{id:`mob_classroom_girl2_talking`,modelUrl:z(`/models/mob/girl2.vrm`),motionUrl:z(`/animations/mob_chat_gesture.fbx`),position:[1,0,-3.15],rotationY:1.2,scale:.95,animTimeOffset:1.8},{id:`mob_classroom_boy2_listening`,modelUrl:z(`/models/mob/boy.vrm`),motionUrl:z(`/animations/mob_listen_nod.fbx`),position:[1.65,0,-2.95],rotationY:-1.9,scale:1,animTimeOffset:.5},{id:`mob_classroom_girl_board`,modelUrl:z(`/models/mob/girl.vrm`),motionUrl:z(`/animations/Standing Idle.fbx`),position:[-1.9,0,-4.55],rotationY:Math.PI,scale:.93,animTimeOffset:2.3}],Rn=[{id:`mob_pc_boy_talking`,modelUrl:z(`/models/mob/boy.vrm`),motionUrl:z(`/animations/mob_chat_gesture.fbx`),position:[3.27,0,-3.7],rotationY:2.7,scale:.98,animTimeOffset:.3},{id:`mob_pc_girl_listening`,modelUrl:z(`/models/mob/girl.vrm`),motionUrl:z(`/animations/mob_listen_nod.fbx`),position:[3.27,0,-4.6],rotationY:-.3,scale:.95,animTimeOffset:1.2},{id:`mob_pc_girl2_center`,modelUrl:z(`/models/mob/girl2.vrm`),motionUrl:z(`/animations/Standing Idle.fbx`),position:[.08,0,-5.4],rotationY:.4,scale:.95,animTimeOffset:2.1},{id:`mob_pc_boy2_laughing`,modelUrl:z(`/models/mob/boy.vrm`),motionUrl:z(`/animations/ardy_laugh.fbx`),position:[-.6,0,-7.4],rotationY:.5,scale:.98,animTimeOffset:.8},{id:`mob_pc_girl_window`,modelUrl:z(`/models/mob/girl.vrm`),motionUrl:z(`/animations/mob_listen_nod.fbx`),position:[-3.27,0,-4],rotationY:.9,scale:.94,animTimeOffset:1.5}],zn=[{id:`mob_street_girl_walk_r`,modelUrl:z(`/models/mob/girl.vrm`),motionUrl:z(`/animations/Walking.fbx`),position:[-3.2,0,-2.8],rotationY:Math.PI*.5,scale:.95,animTimeOffset:.2,daylight:.6,renderOrder:-2,movement:{endPosition:[3.2,0,-2.8],speed:.65,loop:!0}},{id:`mob_street_boy_walk_l`,modelUrl:z(`/models/mob/boy.vrm`),motionUrl:z(`/animations/Walking.fbx`),position:[3.2,0,-3.1],rotationY:-Math.PI*.5,scale:.98,animTimeOffset:1.4,daylight:.6,renderOrder:-2,movement:{endPosition:[-3.2,0,-3.1],speed:.7,loop:!0}},{id:`mob_street_girl2_walk_r`,modelUrl:z(`/models/mob/girl2.vrm`),motionUrl:z(`/animations/Walking.fbx`),position:[-1.8,0,-3.5],rotationY:Math.PI*.5,scale:.9,animTimeOffset:.8,daylight:.6,renderOrder:-2,movement:{endPosition:[3.2,0,-3.5],speed:.55,loop:!0}}],Bn=class{room=null;generation=0;saved=null;constructor(e,t={load:Ie,dispose:Le}){this.options=e,this.set=t}async enter(){if(this.room)return;let e=++this.generation,t=await this.set.load();if(e!==this.generation){this.set.dispose(t);return}let n=this.options.getConfig();this.saved=structuredClone({environment:n.environment}),this.room=t,this.options.scene.add(t),this.hideFlatBackground()}hideFlatBackground(){if(!this.room)return;let e=this.options.getConfig();Object.assign(e.environment,{showBackgroundImage:!0,backgroundImageUrl:z(Re),showMidground:!1,showNearground:!1,showFloor:!1}),this.options.onApplyConfig(e)}exit(){if(this.generation++,this.room&&this.set.dispose(this.room),this.room=null,!this.saved)return;let e=this.options.getConfig(),t=(e,n)=>{for(let[r,i]of Object.entries(n))i&&typeof i==`object`&&!Array.isArray(i)&&e[r]?t(e[r],i):e[r]=i};t(e.environment,this.saved.environment),this.saved=null,this.options.onApplyConfig(e)}},Vn=class{dialogueCameraController;scrollingBackgroundManager;dreamBackground;crowdController;interludeOverlay;pvTitleOverlay;scenarioPlayer;scenarioEngine;masterManager;audioLipSync;currentCrowdPreset=null;scene;camera;controls;avatarManager;sharedEffectTextManager;windController;getConfig;onApplyConfig;onSwitchScenePreset;panoramaController;shaftModeController;classroomStage;paintedClassroomStage;paintedLibraryStage;isScenarioStageActive=!1;savedCameraPosBeforeMultiAvatar=null;savedCameraTargetBeforeMultiAvatar=null;constructor(e){this.panoramaController=e.panoramaController,this.shaftModeController=e.shaftModeController,this.classroomStage=e.classroomStage;let t=e.panoramaController;this.scene=e.scene,this.camera=e.camera,this.controls=e.controls,this.avatarManager=e.avatarManager,this.sharedEffectTextManager=e.sharedEffectTextManager,this.windController=e.windController,this.getConfig=e.getConfig,this.onApplyConfig=e.onApplyConfig,this.paintedClassroomStage=new Bn(e),this.paintedLibraryStage=new Bn(e,{load:Be,dispose:ze}),this.onSwitchScenePreset=e.onSwitchScenePreset,this.audioLipSync=e.audioLipSync,this.masterManager=new vn,this.scrollingBackgroundManager=new Nn({scene:this.scene,camera:this.camera}),this.dreamBackground=new Fn(this.scene,this.camera),this.crowdController=new Ne(this.scene),this.interludeOverlay=new Pn,this.pvTitleOverlay=new In,this.dialogueCameraController=new Cn({camera:this.camera,controls:this.controls,panoramaController:e.panoramaController,getAvatar:e=>this.avatarManager.isMultiAvatarScenarioActive?e&&this.avatarManager.scenarioAvatars.has(e)?this.avatarManager.scenarioAvatars.get(e):this.avatarManager.scenarioAvatars.values().next().value??null:this.avatarManager.avatarInstance,getAvatars:()=>this.avatarManager.isMultiAvatarScenarioActive?Array.from(this.avatarManager.scenarioAvatars.values()):this.avatarManager.avatarInstance?[this.avatarManager.avatarInstance]:[]}),this.scenarioPlayer=new Mn({getAvatar:()=>this.avatarManager.isMultiAvatarScenarioActive?this.avatarManager.scenarioAvatars.values().next().value??null:this.avatarManager.avatarInstance,getAudioLipSync:()=>e.audioLipSync,onStepChange:(e,t)=>{rn(e,t)},onApplyStepCamera:e=>{this.dialogueCameraController.applyScene({id:`step_${e.displayText||e.text}`,text:e.text,cameraZoom:e.cameraZoom,cameraDistance:e.cameraDistance,cameraPreset:e.cameraPreset,cameraStrength:e.cameraStrength,cameraStartAngle:e.cameraStartAngle,cameraTransitionDuration:e.cameraTransitionDuration,cameraTransitionEasing:e.cameraTransitionEasing})},onPlayStateChange:()=>{this.scenarioPlayer.isPlaying||(this.dialogueCameraController.stop(),this.scrollingBackgroundManager.hide(),this.dreamBackground.stop(!0)),this.syncPlayStateUI()},onFinished:()=>{this.dialogueCameraController.stop(),this.scrollingBackgroundManager.hide(),this.dreamBackground.stop(!0)}}),this.scenarioEngine=new On({getAvatar:e=>this.avatarManager.isMultiAvatarScenarioActive?e&&this.avatarManager.scenarioAvatars.has(e)?this.avatarManager.scenarioAvatars.get(e):this.avatarManager.scenarioAvatars.values().next().value??null:this.avatarManager.avatarInstance,getAvatars:()=>this.avatarManager.isMultiAvatarScenarioActive?Array.from(this.avatarManager.scenarioAvatars.values()):this.avatarManager.avatarInstance?[this.avatarManager.avatarInstance]:[],getAudioLipSync:()=>e.audioLipSync,masterManager:this.masterManager,onPlayStateChange:()=>{this.scenarioEngine.isPlaying||(this.paintedClassroomStage.exit(),this.paintedLibraryStage.exit(),this.crowdController.setVisible(!1),this.dialogueCameraController.stop(),this.scrollingBackgroundManager.hide(),this.pvTitleOverlay.hide(),this.shaftModeController?.setShaftMode(!1),this.shaftModeController?.setSpaceStage(!1)),this.syncPlayStateUI()},onSceneChange:(e,t)=>{if(an(e,t),e.id.startsWith(`pv_cut`))if(e.id===`pv_cut9_climax`)this.pvTitleOverlay.showKawaiiTitleLogo();else{this.pvTitleOverlay.hideKawaiiTitleLogo();let t={pv_cut1:{layout:`step-cascade`,theme:`day`,lines:[{text:`もしも、`,en:`IF EVER`},{text:`世界が今日`,en:`THE WORLD ENDS`},{text:`終わるなら。`,en:`RIGHT TODAY`}]},pv_cut2:{layout:`l-shape`,side:`right`,theme:`day`,titleText:`名前を呼ぶことも、できなかった。`,verticalEn:`AFTERNOON CLASSROOM`,subText:`SCENE 02 ／ FIVE SECONDS CONFESSION`},pv_cut3:{layout:`l-shape`,side:`left`,theme:`day`,titleText:`「友達」のままじゃ、終われない。`,verticalEn:`TEASING HEART`,subText:`WE CANNOT JUST STAY FRIENDS`},pv_cut4:{layout:`l-shape`,side:`left`,theme:`day`,titleText:`素直になれない、距離がもどかしい。`,verticalEn:`SILENT DISTANCE`,subText:`THIS DISTANCE HURTS`},pv_cut5:{layout:`l-shape`,side:`right`,theme:`sunset`,titleText:`残された時間は、あと少し――`,verticalEn:`SUMMER BREEZE`,subText:`OUR TIME IS RUNNING OUT`},pv_cut6:{layout:`ghost-smash`,theme:`day`,ghostText:`FALL IN LOVE`,titleText:`この夏、君に<span style="color:#f43f5e; -webkit-text-stroke: 1.5px #ffffff;">恋</span>をした。`,subText:`✦ THIS SUMMER, I FELL IN LOVE WITH YOU ✦`},pv_cut7:{layout:`l-shape`,side:`left`,theme:`sunset`,titleText:`夕暮れが、本音を暴いていく。`,verticalEn:`CRIMSON TWILIGHT`,subText:`TWILIGHT REVEALS TRUE FEELINGS`},pv_cut8:{layout:`bottom-glow`,theme:`night`,titleText:`伝えたい想いは、ひとつだけ。`,subText:`ONLY ONE FEELING TO CONFESS`},pv_cut9_intro:{layout:`cinema-push`,theme:`sunset`,titleText:`たった<span style="color:#f43f5e; -webkit-text-stroke: 1.5px #ffffff; font-weight: 900;">５秒</span>の勇気で、世界は変わる。`,subText:`✦ A FIVE-SECOND MIRACLE ✦`}}[e.id];t&&this.pvTitleOverlay.updateSubtitle(t)}else this.pvTitleOverlay.hide()},onApplySceneCamera:e=>{this.scenarioEngine.getCurrentPackage()?.instantCameraCut&&this.dialogueCameraController.setInstantCutMode(!0),this.dialogueCameraController.applyScene(e)},onUpdateScrollingBackground:e=>{if(e&&e.enabled){let t=e.textureUrl||`/textures/town_far.avif`;this.scrollingBackgroundManager.show({textureUrl:t,speed:e.speed,blur:e.blur,direction:e.direction,instantBlur:e.instantBlur,featherWidth:e.featherWidth});let n=this.getConfig();n.environment.showMidground=!1,n.environment.midgroundImageUrl=void 0,n.environment.showBackgroundImage=!1,this.onApplyConfig(n)}else this.scrollingBackgroundManager.hide()},onSwitchBackground:e=>{let t=this.getConfig();t.environment.showBackgroundImage=!0,t.environment.backgroundImageUrl=z(e),t.environment.showMidground=!1,t.environment.midgroundImageUrl=void 0,t.environment.showNearground=!1,t.environment.neargroundImageUrl=void 0,this.onApplyConfig(t)},onSwitchPanoramaBackground:e=>{if(e&&t){let n=this.getConfig();n.environment.showMidground=!1,n.environment.midgroundImageUrl=void 0,n.environment.showFloor=!1,t.load({imageUrl:z(e),initialYaw:0,initialPitch:0,initialFov:n.camera.fov||30})}else if(t&&t.isActive){t.deactivate();let e=this.getConfig();this.onApplyConfig(e)}},onSwitchAvatar:async e=>{this.avatarManager.currentModelUrl===e&&this.avatarManager.avatarInstance||this.avatarManager.loadAvatarModel(e)},onSetupScenarioCharacters:async e=>{await this.setupScenarioCharacters(e)},onRestoreAvatar:async()=>{await this.restoreSingleAvatar()},onSwitchScenePreset:e=>{this.onSwitchScenePreset(e),this.paintedClassroomStage.hideFlatBackground(),this.paintedLibraryStage.hideFlatBackground()},onApplyFisheye:e=>{let t=this.getConfig();t.postProcessing.cinematic&&(typeof e==`boolean`?t.postProcessing.cinematic.fisheye?t.postProcessing.cinematic.fisheye.enabled=e:t.postProcessing.cinematic.fisheye={enabled:e,strength:.8,zoom:1,circular:!0}:e?t.postProcessing.cinematic.fisheye={enabled:e.enabled??!0,strength:e.strength??.8,zoom:e.zoom??1,circular:e.circular??!0}:t.postProcessing.cinematic.fisheye&&(t.postProcessing.cinematic.fisheye.enabled=!1),this.onApplyConfig(t))},onUpdateDreamBackground:e=>{if(e){let t=typeof e==`object`?e:void 0;this.dreamBackground.play(t)}else this.dreamBackground.stop()},onSwitchShaftMode:e=>{this.shaftModeController?.setShaftMode(e)},onSwitchShaftSpaceStage:e=>{this.shaftModeController?.setSpaceStage(e)},onSwitchStage:async e=>{if(this.paintedClassroomStage.exit(),this.paintedLibraryStage.exit(),e===`painted-library`){this.isScenarioStageActive&&this.classroomStage?.exit(),this.isScenarioStageActive=!1,await this.paintedLibraryStage.enter();return}if(e===`painted-classroom`){this.isScenarioStageActive&&this.classroomStage?.exit(),this.isScenarioStageActive=!1,await this.paintedClassroomStage.enter();return}if(e===`classroom`){if(!this.classroomStage){console.warn(`[ScenarioController] No classroom stage is available in this viewer.`);return}await this.classroomStage.enter(),this.isScenarioStageActive=!0}else this.isScenarioStageActive&&=(this.classroomStage?.exit(),!1)},onUpdateCrowd:async e=>{if(!e){this.crowdController.setVisible(!1);return}let t=typeof e==`object`;if(!(t?e.enabled??!0:e)){this.crowdController.setVisible(!1);return}let n=t?e.preset??`corridor`:`corridor`,r=t?e.opacity??.6:.6;if(this.crowdController.setOpacity(r),this.currentCrowdPreset!==n){this.currentCrowdPreset=n,this.crowdController.clear();let e=n===`school_gate`?Fe:n===`painted-classroom`?Rn:n===`classroom`?Ln:n===`cafe_street`?zn:Pe;for(let t of e)await this.crowdController.addMember(t)}this.crowdController.setVisible(!0)},onFinished:()=>{this.dialogueCameraController.stop(),this.scrollingBackgroundManager.hide(),this.dreamBackground.stop(!0),this.crowdController.setVisible(!1),this.pvTitleOverlay.hide(),this.shaftModeController?.setShaftMode(!1),this.shaftModeController?.setSpaceStage(!1);let t=this.getConfig();t.postProcessing.cinematic?.fisheye&&(t.postProcessing.cinematic.fisheye.enabled=!1,this.onApplyConfig(t)),J(`✨ シナリオが終了しました`),e.onFinished?.()}})}async playWithInterlude(e,t){this.scenarioEngine.isPlaying&&this.scenarioEngine.stop(),this.scenarioPlayer.isPlaying&&this.scenarioPlayer.stop(),this.dreamBackground.stop(!0);let n=t?.title??e.title,r=t?.subtitle??`SCENE TRANSITION`;await this.interludeOverlay.playTransition({title:n,subtitle:r,holdDurationMs:t?.holdDurationMs??320,onCovered:async()=>{await this.scenarioEngine.play(e)}})}update(e){this.scenarioEngine.isPlaying&&this.scenarioEngine.update(e);let t=this.dialogueCameraController?.isActive?this.dialogueCameraController.getBackgroundTransform():null;this.scrollingBackgroundManager?.isVisible&&this.scrollingBackgroundManager.update(e,t),this.dreamBackground&&this.dreamBackground.update(e),this.crowdController.update(e),this.isScenarioStageActive&&this.classroomStage?.update()}syncPlayStateUI(){nn(this.scenarioPlayer.isPlaying,this.scenarioEngine.isPlaying,this.avatarManager.isMultiAvatarScenarioActive)}async setupScenarioCharacters(e){this.avatarManager.avatarInstance&&(this.avatarManager.avatarInstance.dispose(),this.avatarManager.avatarInstance=null),this.avatarManager.scenarioAvatars.forEach(e=>e.dispose()),this.avatarManager.scenarioAvatars.clear(),this.windController.resetModel(),this.avatarManager.isMultiAvatarScenarioActive=!0,this.savedCameraPosBeforeMultiAvatar||(this.savedCameraPosBeforeMultiAvatar=this.camera.position.clone(),this.savedCameraTargetBeforeMultiAvatar=this.controls.target.clone());let t=e.some(e=>Array.isArray(e.position)?e.position[2]>.3:!1)&&e.some(e=>Array.isArray(e.position)?e.position[2]<-.3:!1);this.panoramaController?.isActive||t?(this.camera.position.set(0,1.15,0),this.controls.target.set(0,1.25,-1),this.controls.update()):e.length>1&&(this.camera.position.set(0,1.15,3.45),this.controls.target.set(0,.95,0),this.controls.update());let n=this.getConfig(),r=e.map(e=>new Promise((t,r)=>{let i=this.masterManager.resolveCharacterModelUrl(e.character)||z(e.character),a=0,o=0,s=0,c=e.rotationY??0;if(typeof e.position==`string`&&e.position in Z){let t=Z[e.position];a=t[0],o=t[1],s=t[2],e.rotationY===void 0&&e.position in yn&&(c=yn[e.position])}else Array.isArray(e.position)&&(a=e.position[0],o=e.position[1],s=e.position[2]);new Ae(this.scene,this.camera,{modelUrl:i,defaultAnimationUrl:z(`/animations/Idle.fbx`),position:[a,o,s],rotationY:c,config:n,autoBlink:!0,lookAtCamera:!1,enableBreathing:!0,effectTextManager:this.sharedEffectTextManager,renderer:this.avatarManager.renderer??void 0,hairShadow:this.avatarManager.hairShadow,daylight:e.daylight,renderOrder:e.renderOrder,onLoaded:n=>{e.fastMotion!==void 0&&n.fastMotionEffect?.updateConfig({enabled:e.fastMotion}),this.avatarManager.scenarioAvatars.set(e.id,n),t()},onError:t=>{console.error(`Failed to load scenario character ${e.id}:`,t),r(t)}})}));await Promise.all(r),this.onApplyConfig(n)}async restoreSingleAvatar(){this.avatarManager.isMultiAvatarScenarioActive&&(this.avatarManager.scenarioAvatars.forEach(e=>e.dispose()),this.avatarManager.scenarioAvatars.clear(),this.avatarManager.isMultiAvatarScenarioActive=!1,this.savedCameraPosBeforeMultiAvatar&&this.savedCameraTargetBeforeMultiAvatar&&(this.camera.position.copy(this.savedCameraPosBeforeMultiAvatar),this.controls.target.copy(this.savedCameraTargetBeforeMultiAvatar),this.controls.update(),this.savedCameraPosBeforeMultiAvatar=null,this.savedCameraTargetBeforeMultiAvatar=null),this.avatarManager.loadAvatarModel(this.avatarManager.currentModelUrl))}},Hn=-4.48,Un=[3.321,1.107,-1.107,-3.321],Wn=2.09,Gn=[[.91,1.82],[1.87,2.79]],Kn=2.873,qn=1.92,$={z:-5.195,y:1.7425,width:4.466,height:1.3855},Jn={bloom:{enabled:!0,strength:.18,radius:.8,threshold:.82},diffusion:{enabled:!0,strength:.22,radius:3}},Yn=new O(`#f7e6d2`),Xn={hairRingTint:`#ffe3c6`,ambient:{color:`#a3a6d6`,intensity:1},directional:{color:`#ffdcb2`,intensity:3.2,posX:-10,posY:5.4,posZ:2.6}},Zn=class{scene;dirLight;getConfig;onApplyConfig;loader=new ye;environment=null;loading=null;savedEnvironmentConfig=null;savedLighting=null;savedPostProcessing=null;savedShadowCamera=null;gradientMap;clock=new Ce;timeUniform={value:0};constructor(e){this.scene=e.scene,this.dirLight=e.dirLight,this.getConfig=e.getConfig,this.onApplyConfig=e.onApplyConfig;let t=[96,100,110,150,212,244,255,255];this.gradientMap=new g(new Uint8Array(t.flatMap(e=>[e,e,e,255])),t.length,1,re),this.gradientMap.magFilter=te,this.gradientMap.minFilter=te,this.gradientMap.generateMipmaps=!1,this.gradientMap.needsUpdate=!0}get isActive(){return this.savedLighting!==null}preload(){return this.environment?Promise.resolve(this.environment):(this.loading??=this.build().then(e=>(this.environment=e,this.loading=null,e),e=>{throw this.loading=null,e}),this.loading)}async enter(){let e=await this.preload();if(this.isActive)return;this.savedEnvironmentConfig={...this.getConfig().environment},this.savedLighting=structuredClone(this.getConfig().lighting),this.savedPostProcessing=structuredClone(this.getConfig().postProcessing);let t=this.dirLight.shadow,n=t.camera;this.savedShadowCamera={left:n.left,right:n.right,top:n.top,bottom:n.bottom,near:n.near,far:n.far,mapSize:t.mapSize.clone(),bias:t.bias,normalBias:t.normalBias,radius:t.radius,intensity:t.intensity},Object.assign(n,{left:-8,right:8,top:8,bottom:-8,near:.1,far:26}),n.updateProjectionMatrix(),t.mapSize.set(2048,2048),t.bias=-15e-5,t.normalBias=.015,t.radius=3,t.intensity=.7;let r=this.getConfig();r.environment.showBackgroundImage=!1,r.environment.showMidground=!1,r.environment.showNearground=!1,r.environment.showFloor=!1,r.environment.backgroundColor=`#f3dcc0`,r.lighting.castShadows=!0,r.lighting.hairRingTint=Xn.hairRingTint,Object.assign(r.lighting.ambient,Xn.ambient),Object.assign(r.lighting.directional,Xn.directional),r.lighting.sunShafts.enabled=!1,r.lighting.lensFlare.enabled=!1,Object.assign(r.postProcessing.bloom,Jn.bloom),Object.assign(r.postProcessing.cinematic.diffusion,Jn.diffusion),this.onApplyConfig(r),this.scene.add(e)}update(){this.isActive&&(this.timeUniform.value=this.clock.getElapsedTime())}exit(){if(this.environment){this.scene.remove(this.environment);let e=new Set,t=new Set,n=new Set;this.environment.traverse(r=>{r instanceof L&&(t.add(r.geometry),(Array.isArray(r.material)?r.material:[r.material]).forEach(t=>{n.add(t),Object.values(t).forEach(t=>{t instanceof x&&t!==this.gradientMap&&e.add(t)})}))}),t.forEach(e=>e.dispose()),n.forEach(e=>e.dispose()),e.forEach(e=>e.dispose()),this.environment=null}if(this.isActive){if(this.savedEnvironmentConfig&&=(Object.assign(this.getConfig().environment,this.savedEnvironmentConfig),null),this.savedLighting&&=($n(this.getConfig().lighting,this.savedLighting),null),this.savedPostProcessing&&=($n(this.getConfig().postProcessing,this.savedPostProcessing),null),this.savedShadowCamera){let e=this.dirLight.shadow,t=e.camera,n=this.savedShadowCamera;Object.assign(t,{left:n.left,right:n.right,top:n.top,bottom:n.bottom,near:n.near,far:n.far}),t.updateProjectionMatrix(),e.mapSize.copy(n.mapSize),e.bias=n.bias,e.normalBias=n.normalBias,e.radius=n.radius,e.intensity=n.intensity,this.savedShadowCamera=null}this.onApplyConfig(this.getConfig())}}async build(){let e=(await this.loader.loadAsync(z(`/models/school-environments/school-classroom-3d.glb`))).scene;return e.name=`School classroom | 3D stage`,e.traverse(e=>{if(!(e instanceof L))return;let t=Array.isArray(e.material)?e.material:[e.material];e.castShadow=t.some(e=>this.shouldCastShadow(e.name)),e.receiveShadow=t.some(e=>!e.transparent&&!e.name.includes(`daylight glass`));let n=e=>{let t=e.name.includes(`varnished desk top`)?this.deskTopMaterial(e):e.name.includes(`sheer linen curtain`)?this.curtainMaterial(e):e.name.includes(`daylight glass`)?this.glassMaterial(e):this.toonMaterial(e);return e.dispose(),t};e.material=Array.isArray(e.material)?e.material.map(n):n(e.material),t.some(e=>e.name.includes(`sheer linen curtain`))&&(e.renderOrder=1)}),e.add(this.createCourtyardBackdrop()),e.add(this.createChalkWriting()),e.add(this.createSunBeams()),e.add(this.createDustMotes()),e}toonMaterial(e){let t=e,n=new fe({name:`${e.name||`Classroom material`} | toon`,color:t.color?.clone()??new O(16777215),map:t.map??null,alphaMap:t.alphaMap??null,transparent:e.transparent,opacity:e.opacity,side:e.side,depthWrite:e.depthWrite,alphaTest:e.alphaTest,gradientMap:this.gradientMap});return n.toneMapped=!0,n.onBeforeCompile=e=>{e.uniforms.uHazeColor={value:Yn},e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vClassroomWorldPosition;`).replace(`#include <worldpos_vertex>`,`#include <worldpos_vertex>
vClassroomWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
varying vec3 vClassroomWorldPosition;
uniform vec3 uHazeColor;`).replace(`#include <map_fragment>`,`#include <map_fragment>
             float paintedVariation = sin(vClassroomWorldPosition.x * 2.1 + sin(vClassroomWorldPosition.z * 1.7))
               * sin(vClassroomWorldPosition.y * 2.8 + vClassroomWorldPosition.x * 0.9);
             diffuseColor.rgb *= 1.0 + paintedVariation * 0.035;`).replace(`#include <lights_fragment_end>`,`#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= 0.68;`).replace(`#include <fog_fragment>`,`#include <fog_fragment>
             // Sunlit air: surfaces soften and pale toward the light's color with distance,
             // so furniture reads as painted background rather than crisp props.
             float hazeDistance = length(vClassroomWorldPosition - cameraPosition);
             float haze = 0.05 + 0.16 * smoothstep(1.5, 11.0, hazeDistance);
             float luma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
             gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(luma), 0.06);
             gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, haze);`)},n.customProgramCacheKey=()=>`classroom-lit-toon-v5`,n.needsUpdate=!0,n}deskTopMaterial(e){let t=e,n=this.toonMaterial(e),r=j.clamp(t.roughness,.1,.9),i=n.onBeforeCompile,a=de.lights_toon_pars_fragment.replace(`reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );`,`reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
       vec3 deskHalfVector = normalize( directLight.direction + geometryViewDir );
       float deskGloss = pow( max( dot( geometryNormal, deskHalfVector ), 0.0 ), ${(4+(1-r)*8).toFixed(2)} );
       float deskHighlight = smoothstep( 0.035, 0.13, deskGloss );
       reflectedLight.directDiffuse += directLight.color * vec3(0.30, 0.19, 0.10) * deskHighlight * ${(.75-r*.38).toFixed(2)};`);return n.name=`${e.name} | toon varnish`,n.onBeforeCompile=(e,t)=>{i(e,t),e.fragmentShader=e.fragmentShader.replace(`#include <lights_toon_pars_fragment>`,a)},n.customProgramCacheKey=()=>`classroom-desk-toon-varnish-v1-${r}`,n}curtainMaterial(e){let t=new F({name:`${e.name} | backlit sheer`,color:`#f7e8d2`,transparent:!0,opacity:.5,side:2,depthWrite:!1,forceSinglePass:!0});return t.onBeforeCompile=e=>{e.uniforms.uTime=this.timeUniform,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uTime;
varying float vFold;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
           vFold = abs(normal.z);
           // Hanging from the rail: the hem moves most, and gusts roll along the window bank.
           float hang = clamp((${Kn.toFixed(3)} - transformed.y) / ${qn.toFixed(2)}, 0.0, 1.0);
           float gust = 0.55 + 0.45 * sin(uTime * 0.7 + transformed.z * 0.35);
           transformed.x += hang * hang * gust * (0.11 + 0.05 * sin(uTime * 1.9 + transformed.z * 4.0 + transformed.y * 2.0));
           transformed.z += hang * 0.035 * sin(uTime * 1.3 + transformed.z * 2.5);`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
varying float vFold;`).replace(`#include <color_fragment>`,`#include <color_fragment>
           diffuseColor.rgb *= 1.0 - vFold * 0.28;
           diffuseColor.a = min(1.0, diffuseColor.a + vFold * 0.35);`)},t.customProgramCacheKey=()=>`classroom-sheer-curtain-v1`,t}glassMaterial(e){return new F({name:`${e.name} | clear`,color:`#fff4e4`,transparent:!0,opacity:.08,depthWrite:!1,side:2})}createCourtyardBackdrop(){let e=new ae().load(z(`/textures/school-courtyard-far.avif`));e.colorSpace=E,e.anisotropy=8;let t=new F({map:e,fog:!1});t.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,`#include <map_fragment>
         diffuseColor.rgb = mix(diffuseColor.rgb * vec3(1.06, 0.96, 0.84), vec3(1.0, 0.9, 0.77), 0.24);`)},t.customProgramCacheKey=()=>`classroom-courtyard-backdrop-v1`;let n=new L(new P(36,20.15),t);return n.name=`Courtyard painted backdrop`,n.position.set(-17,-1.6,0),n.rotation.y=Math.PI/2,n}createChalkWriting(){let e=document.createElement(`canvas`);e.width=2048,e.height=Math.round(2048*$.height/$.width);let t=e.getContext(`2d`),n=Qn(24),r=e=>`${e}px "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic", sans-serif`;t.filter=`blur(18px)`;for(let r=0;r<18;r+=1)t.fillStyle=`rgba(232, 240, 236, ${.012+n()*.014})`,t.beginPath(),t.ellipse(300+n()*1300,80+n()*(e.height-160),180+n()*320,22+n()*30,(n()-.5)*.12,0,Math.PI*2),t.fill();t.filter=`none`;let i=(e,i,a,o,s=`#f3f5ee`)=>{t.font=r(o),t.fillStyle=s;for(let r=0;r<3;r+=1)t.globalAlpha=.34,t.fillText(e,i+(n()-.5)*2.2,a+(n()-.5)*2.2);t.globalAlpha=1},a=(e,t,n,r)=>{[...e].forEach((e,a)=>i(e,t,n+a*r*1.08,r))};t.textBaseline=`top`,i(`現代文`,96,70,74),t.fillStyle=`rgba(243, 245, 238, 0.55)`,t.fillRect(96,158,250,5),i(`「羅生門」  芥川龍之介`,110,200,56),i(`①  下人の心の動きを追う`,130,300,48),i(`②  老婆の言葉と行動`,130,380,48),i(`p.128〜135`,130,470,44,`#f6e39a`),a(`9月24日`,1935,60,60),a(`日直`,1840,60,54),a(`アオイ`,1840,200,50),a(`エミリ`,1760,200,50),t.globalCompositeOperation=`destination-out`;for(let r=0;r<9e3;r+=1)t.fillStyle=`rgba(0, 0, 0, ${.25+n()*.5})`,t.fillRect(n()*e.width,n()*e.height,1.5,1.5);t.globalCompositeOperation=`source-over`;let o=new R(e);o.colorSpace=E,o.anisotropy=8;let s=this.toonMaterial(new xe({name:`Chalk writing`,map:o,transparent:!0,depthWrite:!1})),c=new L(new P($.width,$.height),s);return c.name=`Blackboard chalk writing`,c.position.set(0,$.y,$.z),c.receiveShadow=!0,c}sunTravelDirection(){let{posX:e,posY:t,posZ:n}=Xn.directional;return new k(-e,-t,-n).normalize()}createSunBeams(){let e=this.sunTravelDirection(),t=[],n=[],r=[],i=t=>t.clone().addScaledVector(e,t.y/-e.y);for(let e of Un)for(let[a,o]of Gn){let s=Wn/2-.05,c=[new k(Hn,a,e-s),new k(Hn,a,e+s),new k(Hn,o,e+s),new k(Hn,o,e-s)],l=t.length/3;for(let e of c)t.push(e.x,e.y,e.z),n.push(0);for(let e of c){let r=i(e);t.push(r.x,r.y,r.z),n.push(1)}for(let e=0;e<4;e+=1){let t=l+e,n=l+(e+1)%4;r.push(t,n,n+4,t,n+4,t+4)}}let a=new A;a.setAttribute(`position`,new ne(t,3)),a.setAttribute(`along`,new ne(n,1)),a.setIndex(r);let o=new L(a,new I({name:`Classroom sun beams`,uniforms:{uTime:this.timeUniform,uColor:{value:new O(`#ffd9a8`)},uStrength:{value:.085}},vertexShader:`
        attribute float along;
        varying float vAlong;
        varying vec3 vWorld;
        void main() {
          vAlong = along;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,fragmentShader:`
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;
        varying float vAlong;
        varying vec3 vWorld;
        void main() {
          // Interpolation can nudge vAlong past 1; pow() of a negative base is NaN, which bloom would spread.
          float fade = pow(max(1.0 - vAlong, 0.0), 1.4) * smoothstep(0.0, 0.06, vAlong);
          float streak = 0.72 + 0.28 * sin(vWorld.z * 6.0 + vWorld.y * 2.5 + uTime * 0.35);
          gl_FragColor = vec4(uColor * uStrength * fade * streak, 1.0);
          #include <colorspace_fragment>
        }`,transparent:!0,depthWrite:!1,blending:2,side:2}));return o.name=`Classroom sun beams`,o.renderOrder=2,o.frustumCulled=!1,o}createDustMotes(){let e=this.sunTravelDirection(),t=Qn(7),n=new Float32Array(660),r=new Float32Array(220);for(let i=0;i<220;i+=1){let a=Un[Math.floor(t()*Un.length)],o=new k(Hn,.95+t()*1.8,a+(t()-.5)*Wn),s=o.addScaledVector(e,t()*.75*o.y/-e.y);n.set([s.x,s.y,s.z],i*3),r[i]=t()*100}let i=new P(1,1),a=new f;a.index=i.index,a.setAttribute(`position`,i.getAttribute(`position`)),a.setAttribute(`uv`,i.getAttribute(`uv`)),a.setAttribute(`center`,new we(n,3)),a.setAttribute(`seed`,new we(r,1)),a.instanceCount=220;let o=new L(a,new I({name:`Classroom dust motes`,uniforms:{uTime:this.timeUniform},vertexShader:`
        uniform float uTime;
        attribute vec3 center;
        attribute float seed;
        varying vec2 vUv;
        varying float vTwinkle;
        void main() {
          vec3 p = center;
          p.x += sin(uTime * 0.13 + seed) * 0.18;
          p.y += sin(uTime * 0.09 + seed * 1.7) * 0.22;
          p.z += cos(uTime * 0.11 + seed * 0.6) * 0.18;
          vUv = uv;
          // Stays positive: additive blending would turn a negative value into a dark speck.
          vTwinkle = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * 1.6 + seed * 3.1));
          vec4 view = modelViewMatrix * vec4(p, 1.0);
          view.xy += position.xy * 0.022;
          gl_Position = projectionMatrix * view;
        }`,fragmentShader:`
        varying vec2 vUv;
        varying float vTwinkle;
        void main() {
          float glow = 1.0 - smoothstep(0.0, 0.5, length(vUv - 0.5));
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * glow * vTwinkle * 0.55, 1.0);
          #include <colorspace_fragment>
        }`,transparent:!0,depthWrite:!1,blending:2}));return o.name=`Classroom dust motes`,o.frustumCulled=!1,o.renderOrder=3,o}shouldCastShadow(e){let t=e.toLowerCase();return[`varnished desk top`,`sunlit honey wood`,`warm walnut edge`,`silver painted steel`,`dark seat support`,`beech cabinet`,`textbook`,`plant`,`leaf green`,`unwritten paper`,`warm cream plaster`,`porcelain wainscot`,`silver window trim`].some(e=>t.includes(e))}};function Qn(e){let t=e>>>0;return()=>(t=t*1664525+1013904223>>>0,t/4294967296)}function $n(e,t){for(let n of Object.keys(t)){let r=t[n];r&&typeof r==`object`&&e[n]&&typeof e[n]==`object`?$n(e[n],r):e[n]=r}}var er=[`aa`,`ih`,`ou`,`ee`,`oh`],tr=(e,t=0)=>Number.isFinite(e)?Math.max(0,Math.min(1,e)):t,nr=class{mix=[1,0,0,0,0];target=[1,0,0,0,0];open=0;targetOpen=0;silence=1;blush=0;targetBlush=0;setVisemes(e={},t){let n=er.map(t=>tr(e[t]??0)),r=n.reduce((e,t)=>e+t,0);this.targetOpen=tr(t??Math.min(1,r)),r>0&&(this.target=n.map(e=>e/r)),this.targetOpen>0&&(this.silence=0)}setPhoneme(e,t=1){let n=er.includes(e);this.setVisemes(n?{[e]:1}:{},n?t:0)}setBlush(e){this.targetBlush=tr(e)}stopSpeaking(){this.targetOpen=0,this.silence=1}update(e){let t=Number.isFinite(e)?Math.max(0,Math.min(.1,e)):0;this.targetOpen===0&&(this.silence+=t);let n=this.targetOpen===0&&this.silence<.1?this.open:this.targetOpen,r=1-Math.exp(-t/.065);return this.mix=this.mix.map((e,t)=>e+(this.target[t]-e)*r),this.open+=(n-this.open)*(1-Math.exp(-t/(n>this.open?.045:.11))),this.blush+=(this.targetBlush-this.blush)*(1-Math.exp(-t/.24)),this.state}get state(){let e=Math.min(1,(1-Math.max(...this.mix))*2),t=this.open*(1-.5*e),n=t<=.5?2*t:2*(1-t),r=Math.max(0,2*t-1),i={};return er.forEach((e,t)=>{i[`mouth_${e}_half`]=n*this.mix[t],i[`mouth_${e}`]=r*this.mix[t]}),{weights:i,rest:Math.max(0,1-2*t),openness:t,inputOpenness:this.open,blush:this.blush}}};function rr(e){let t=tr(e);return{open:Math.max(0,1-2*t),half:1-Math.abs(2*t-1),closed:Math.max(0,2*t-1)}}var ir=class{canvas;gl=null;container;config;isReady=!1;isVisible=!1;program=null;uniforms={};vertexBuffer=null;vertexCount=0;manifest=null;expressionManifest=null;layers=[];halfEye=null;openEye=null;mouthAtlas=null;expressions=new nr;clock=0;forcedBlinkTime=-10;spring={l:{x:0,v:0},r:{x:0,v:0},ribbon:{x:0,v:0}};constructor(e){this.container=e.container??document.getElementById(`viewport-container`)??document.body,this.config=e.config,this.canvas=document.createElement(`canvas`),this.canvas.id=`live2d-canvas`,this.canvas.style.position=`absolute`,this.canvas.style.inset=`0`,this.canvas.style.width=`100%`,this.canvas.style.height=`100%`,this.canvas.style.objectFit=`contain`,this.canvas.style.objectPosition=`center bottom`,this.canvas.style.pointerEvents=`none`,this.canvas.style.zIndex=`15`,this.canvas.style.display=`none`,this.container.appendChild(this.canvas)}async init(){let e=this.canvas.getContext(`webgl`,{alpha:!0,antialias:!1,premultipliedAlpha:!0,preserveDrawingBuffer:!1});if(!e){console.warn(`[Live2DOverlay] WebGL is not available for Live2DOverlay`);return}this.gl=e;let t=this.config.basePath.endsWith(`/`)?this.config.basePath:`${this.config.basePath}/`,n=z(this.config.manifestUrl||`${t}manifest.json`),r=z(this.config.expressionManifestUrl||`${t}expressions/manifest.json`);try{let[e,i]=await Promise.all([fetch(n).then(e=>e.json()),fetch(r).then(e=>e.json())]);this.manifest=e,this.expressionManifest=i,this.canvas.width=e.width,this.canvas.height=e.height,this.initShaders(e.width,e.height),this.initGeometry(e.width,e.height);let a=e=>this.loadTexture(z(e.startsWith(`/`)?e:`${t}${e}`));this.layers=await Promise.all(e.layers.map(async e=>({...e,texture:await a(e.file)})));let o=i.entries.find(e=>e.name===`eye_half`);o&&(this.halfEye={...o,texture:await a(o.file)});let s=i.entries.find(e=>e.name===`eye_open`);s&&(this.openEye={...s,texture:await a(s.file)}),this.mouthAtlas={...i.mouthRegion,texture:await a(`expressions/mouth-atlas.png`)},this.isReady=!0}catch(e){console.error(`[Live2DOverlay] Failed to load Live2D assets:`,e)}}initShaders(e,t){let n=this.gl,r=`
      attribute vec2 p;
      uniform float angle, breathing, hairL, hairR, ribbon;
      uniform vec4 crop;
      uniform vec2 characterTransform;
      varying vec2 uv;
      varying vec2 sourcePoint;

      float bell(vec2 p, vec2 c, vec2 s) {
        vec2 q = (p - c) / s;
        return exp(-dot(q, q) * 2.0);
      }

      void main() {
        vec2 q = p;
        float hw = 1.0 - smoothstep(600.0, 1050.0, p.y);
        vec2 pivot = vec2(725.0, 516.0);
        vec2 d = p - pivot;
        float a = angle * hw;
        q = pivot + mat2(cos(a), sin(a), -sin(a), cos(a)) * d;
        q.y -= breathing * 3.0 * (1.0 - smoothstep(620.0, 1190.0, p.y));
        q.x += hairL * bell(p, vec2(335.0, 545.0), vec2(100.0, 140.0));
        q.x += hairR * bell(p, vec2(827.0, 452.0), vec2(52.0, 115.0));
        q.x += ribbon * bell(p, vec2(570.0, 930.0), vec2(53.0, 125.0));
        uv = (p - crop.xy) / crop.zw;
        sourcePoint = p;
        float scale = characterTransform.x;
        float offY = characterTransform.y;
        gl_Position = vec4(
          (q.x / ${e}.0 * 2.0 - 1.0) * scale * 0.95,
          (1.0 - q.y / ${t}.0 * 2.0) * scale + offY,
          0,
          1
        );
      }
    `,i=(e,t)=>{let r=n.createShader(e);if(n.shaderSource(r,t),n.compileShader(r),!n.getShaderParameter(r,n.COMPILE_STATUS))throw Error(n.getShaderInfoLog(r)||`Shader compilation failed`);return r},a=n.createProgram();if(n.attachShader(a,i(n.VERTEX_SHADER,r)),n.attachShader(a,i(n.FRAGMENT_SHADER,`
      precision highp float;
      uniform sampler2D tex;
      uniform float opacity, iris, blush, wet, mouthMode, eyeStage, eyeClosure;
      uniform float mouthWeights[10];
      uniform vec2 gaze;
      uniform vec4 crop;
      varying vec2 uv;
      varying vec2 sourcePoint;

      float spot(vec2 center, vec2 size) {
        vec2 d = (sourcePoint - center) / size;
        return exp(-dot(d, d) * 2.0);
      }

      void main() {
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
        vec4 c = texture2D(tex, uv);

        if (eyeStage >= 0.0) {
          vec2 center = sourcePoint.x < 560.0 ? vec2(464.0, 443.0) : vec2(665.0, 379.0);
          float localY = sourcePoint.y - center.y + (sourcePoint.x - center.x) * 0.30;
          float targetLid = mix(-19.0, 8.0, eyeClosure);
          float sourceLid = mix(-19.0, 8.0, eyeStage);
          float mappedY = localY < targetLid
            ? mix(-45.0, sourceLid, clamp((localY + 45.0) / (targetLid + 45.0), 0.0, 1.0))
            : mix(sourceLid, 28.0, clamp((localY - targetLid) / (28.0 - targetLid), 0.0, 1.0));
          if (localY <= -45.0 || localY >= 28.0 || abs(eyeClosure - eyeStage) < 0.00001) mappedY = localY;
          float eyeInfluence = 1.0 - smoothstep(39.0, 54.0, abs(sourcePoint.x - center.x));
          vec2 coord = uv + vec2(0.0, (mappedY - localY) * eyeInfluence / crop.w);
          float pupil = spot(center, vec2(24.0, 23.0));
          coord -= gaze / crop.zw * pupil * (1.0 - eyeClosure);
          vec4 sampleEye = texture2D(tex, coord);
          if (sampleEye.a > 0.1) c.rgb = sampleEye.rgb * c.a / sampleEye.a;
        }

        if (mouthMode > 0.5) {
          c = vec4(0.0);
          for (int i = 0; i < 10; i++) {
            float f = float(i);
            vec2 tile = vec2(mod(f, 5.0), floor(f / 5.0));
            c += texture2D(tex, (tile + uv) / vec2(5.0, 2.0)) * mouthWeights[i];
          }
        }

        if (iris > 0.5) {
          vec4 shifted = texture2D(tex, uv - gaze / crop.zw);
          c.rgb = mix(vec3(0.96, 0.94, 0.95) * c.a, shifted.rgb * c.a / max(shifted.a, 0.001), min(1.0, shifted.a / max(c.a, 0.001)));
        }

        float cheeks = spot(vec2(473.0, 493.0), vec2(55.0, 29.0)) + spot(vec2(690.0, 439.0), vec2(38.0, 26.0));
        c.rgb = mix(c.rgb, vec3(0.97, 0.40, 0.49) * c.a, min(0.30, cheeks * blush * 0.30));

        float highlights = spot(vec2(476.0, 430.0) + gaze, vec2(5.0, 6.0)) + spot(vec2(666.0, 367.0) + gaze, vec2(5.0, 6.0));
        float rim = spot(vec2(478.0, 458.0) + gaze, vec2(14.0, 3.0)) + spot(vec2(665.0, 397.0) + gaze, vec2(13.0, 3.0));
        float purple = smoothstep(0.025, 0.10, (c.b - c.g) / max(c.a, 0.001));
        c.rgb = mix(c.rgb, vec3(1.0, 0.95, 1.0) * c.a, min(0.65, wet * (highlights * 0.65 + rim * 0.32) * purple));

        gl_FragColor = vec4(c.rgb * opacity, c.a * opacity);
      }
    `)),n.linkProgram(a),!n.getProgramParameter(a,n.LINK_STATUS))throw Error(n.getProgramInfoLog(a)||`Program link failed`);this.program=a,n.useProgram(a);for(let e of[`angle`,`breathing`,`hairL`,`hairR`,`ribbon`,`crop`,`gaze`,`iris`,`opacity`,`blush`,`wet`,`mouthMode`,`mouthWeights`,`eyeStage`,`eyeClosure`,`characterTransform`])this.uniforms[e]=n.getUniformLocation(a,e===`mouthWeights`?`mouthWeights[0]`:e)}initGeometry(e,t){let n=this.gl,r=[];for(let n=0;n<80;n++)for(let i=0;i<60;i++){let a=i*e/60,o=(i+1)*e/60,s=n*t/80,c=(n+1)*t/80;r.push(a,s,o,s,a,c,a,c,o,s,o,c)}this.vertexCount=r.length/2;let i=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,i),n.bufferData(n.ARRAY_BUFFER,new Float32Array(r),n.STATIC_DRAW);let a=n.getAttribLocation(this.program,`p`);n.enableVertexAttribArray(a),n.vertexAttribPointer(a,2,n.FLOAT,!1,0,0),this.vertexBuffer=i}async loadTexture(e){let t=this.gl,n=new Image;n.crossOrigin=`anonymous`,n.src=e,await n.decode();let r=t.createTexture();return t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,n),r}setVisible(e){this.isVisible=e,this.canvas.style.display=e?`block`:`none`}stepSpring(e,t,n){return e.v+=(t-e.x)*18*n,e.v*=Math.exp(-6*n),e.x+=e.v*n,e.x}blinkAt(e){let t=(e%4.9-3.5)/.24;return t>=0&&t<=1?Math.sin(t*Math.PI)**1.1:0}render(e=1/60){if(!this.isReady||!this.isVisible||!this.gl||!this.manifest)return;this.clock+=e;let t=this.clock,n=this.gl,r=this.manifest.width,i=this.manifest.height,a=this.expressions.update(e),o=.8*Math.PI/180*Math.sin(t*.49),s=Math.sin(t*1.35),c=Math.max(this.blinkAt(t),t-this.forcedBlinkTime>=0&&t-this.forcedBlinkTime<.45?Math.sin((t-this.forcedBlinkTime)/.45*Math.PI):0),l=this.stepSpring(this.spring.l,Math.sin(t*1.4)*1.25,e),u=this.stepSpring(this.spring.r,Math.sin(t*1.23+1)*.8,e),d=this.stepSpring(this.spring.ribbon,Math.sin(t*1.1)*.7,e),f=Math.sin(t*.7)*.7,p=Math.sin(t*.43)*.35,m=rr(c),h=a.blush;n.useProgram(this.program),n.uniform1f(this.uniforms.angle,o),n.uniform1f(this.uniforms.breathing,s),n.uniform1f(this.uniforms.hairL,l),n.uniform1f(this.uniforms.hairR,u),n.uniform1f(this.uniforms.ribbon,d),n.uniform2f(this.uniforms.gaze,f,p),n.uniform2f(this.uniforms.characterTransform,this.config.characterScale??1.04,this.config.characterOffsetY??-.09),n.viewport(0,0,r,i),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.enable(n.BLEND),n.blendFuncSeparate(n.ONE,n.ONE,n.ONE,n.ONE);let g=[...this.layers];this.halfEye&&g.push(this.halfEye),this.openEye&&g.push(this.openEye),n.uniform1f(this.uniforms.mouthMode,0);for(let e of g){if([`underpaint`,`eyewhite`,`irides`,`eyelash`].includes(e.name))continue;let t=1;e.name===`eye_close`?t=m.closed:e.name===`eye_half`?t=m.half:e.name===`eye_open`&&(t=m.open),n.uniform1f(this.uniforms.eyeStage,e.name===`eye_open`?0:e.name===`eye_half`?.5:e.name===`eye_close`?1:-1),n.uniform1f(this.uniforms.eyeClosure,c),n.uniform1f(this.uniforms.blush,e.name===`face`?h:0),n.uniform1f(this.uniforms.wet,[`irides`,`eye_half`,`eye_open`].includes(e.name)?h:0),n.uniform1f(this.uniforms.opacity,t),n.uniform1f(this.uniforms.iris,e.name===`irides`?1:0),n.uniform4f(this.uniforms.crop,e.x,e.y,e.width,e.height),n.bindTexture(n.TEXTURE_2D,e.texture??null),n.drawArrays(n.TRIANGLES,0,this.vertexCount)}if(this.mouthAtlas?.texture){n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA),n.uniform1f(this.uniforms.mouthMode,1),n.uniform1f(this.uniforms.eyeStage,-1),n.uniform1f(this.uniforms.opacity,1),n.uniform1f(this.uniforms.iris,0),n.uniform1f(this.uniforms.blush,0),n.uniform1f(this.uniforms.wet,0);let e=a.weights,t=[...er.map(t=>e[`mouth_${t}`]??0),...er.map(t=>e[`mouth_${t}_half`]??0)];n.uniform1fv(this.uniforms.mouthWeights,new Float32Array(t)),n.uniform4f(this.uniforms.crop,this.mouthAtlas.x,this.mouthAtlas.y,this.mouthAtlas.width,this.mouthAtlas.height),n.bindTexture(n.TEXTURE_2D,this.mouthAtlas.texture),n.drawArrays(n.TRIANGLES,0,this.vertexCount)}}dispose(){this.canvas&&this.canvas.parentElement&&this.canvas.remove(),this.gl=null}},ar=class{avatarManager;viewerCore;audioLipSync;blackoutOverlay;live2dOverlay;config;currentMode=`vrm`;appCanvas;modeListeners=[];sceneOverrideEnabled=null;_targetPos=new k;_camPos=new k;constructor(e){this.avatarManager=e.avatarManager,this.viewerCore=e.viewerCore,this.audioLipSync=e.audioLipSync,this.config={...qe,...e.config??{}},this.appCanvas=this.viewerCore.canvas,this.blackoutOverlay=new Dn,this.live2dOverlay=new ir({config:this.config}),this.live2dOverlay.init()}setSceneOverride(e){this.sceneOverrideEnabled=e}get mode(){return this.currentMode}onModeChange(e){return this.modeListeners.push(e),()=>{this.modeListeners=this.modeListeners.filter(t=>t!==e)}}notifyModeChange(){for(let e of this.modeListeners)try{e(this.currentMode)}catch(e){console.error(`Error in Live2D mode listener:`,e)}}async toggle(){this.currentMode===`transitioning_to_live2d`||this.currentMode===`transitioning_to_vrm`||(this.currentMode===`live2d`?await this.transitionToVRM():await this.transitionToLive2D())}isTargetModel(){let e=this.avatarManager.currentModelUrl.toLowerCase();return this.config.targetModelSubstrings.some(t=>e.includes(t.toLowerCase()))}update(e){if(this.currentMode===`live2d`||this.live2dOverlay.isVisible){if(this.audioLipSync){let e=this.audioLipSync.currentPhoneme,t=this.audioLipSync.currentRms;this.audioLipSync.isPlaying&&e&&e!==`nn`?this.live2dOverlay.expressions.setPhoneme(e,Math.min(1,.5+t*6)):!this.audioLipSync.isPlaying&&this.live2dOverlay.expressions.open>0&&this.live2dOverlay.expressions.stopSpeaking()}this.avatarManager.avatarInstance?.isBlushMode()?this.live2dOverlay.expressions.setBlush(.85):this.live2dOverlay.expressions.blush>0&&this.live2dOverlay.expressions.setBlush(0),this.live2dOverlay.render(e)}if(!(!this.config.enabled||!this.live2dOverlay.isReady)&&!(this.currentMode===`transitioning_to_live2d`||this.currentMode===`transitioning_to_vrm`)){if(this.sceneOverrideEnabled===!1){this.currentMode===`live2d`&&this.transitionToVRM();return}if(this.sceneOverrideEnabled===!0){this.currentMode===`vrm`&&this.transitionToLive2D();return}if(!this.isTargetModel()){this.currentMode===`live2d`&&this.transitionToVRM();return}if(this.config.proximityTriggerEnabled){let e=this.calculateDistance();if(e<0)return;this.currentMode===`vrm`&&e<=this.config.triggerDistance?this.transitionToLive2D():this.currentMode===`live2d`&&e>=this.config.restoreDistance&&this.transitionToVRM()}}}calculateDistance(){let e=this.avatarManager.avatarInstance;if(!e?.vrm?.scene)return-1;let t=e.vrm.humanoid?.getNormalizedBoneNode(`upperChest`)||e.vrm.humanoid?.getNormalizedBoneNode(`chest`)||e.vrm.humanoid?.getNormalizedBoneNode(`head`);return t?t.getWorldPosition(this._targetPos):(e.vrm.scene.getWorldPosition(this._targetPos),this._targetPos.y+=1.25),this._camPos.copy(this.viewerCore.camera.position),this._camPos.distanceTo(this._targetPos)}async transitionToLive2D(){if(this.currentMode!==`vrm`)return;this.currentMode=`transitioning_to_live2d`,this.notifyModeChange();let e=this.config.fadeOutDurationMs??160,t=this.config.holdDurationMs??50,n=this.config.fadeInDurationMs??180;await this.blackoutOverlay.fadeTransition(()=>{let e=this.avatarManager.avatarInstance;e&&(e.setVisible(!1),e.isBlushMode()&&this.live2dOverlay.expressions.setBlush(.85));let t=this.config.backgroundZoomScale??1.22;this.appCanvas.style.transition=`filter 0.25s ease, transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)`,this.appCanvas.style.filter=`blur(${this.config.blurAmount}px) brightness(0.95)`,this.appCanvas.style.transform=`scale(${t})`,this.live2dOverlay.setVisible(!0)},e,t,n),this.currentMode=`live2d`,this.notifyModeChange()}async transitionToVRM(){if(this.currentMode!==`live2d`)return;this.currentMode=`transitioning_to_vrm`,this.notifyModeChange();let e=this.config.fadeOutDurationMs??160,t=this.config.holdDurationMs??50,n=this.config.fadeInDurationMs??180;await this.blackoutOverlay.fadeTransition(()=>{this.live2dOverlay.setVisible(!1),this.appCanvas.style.filter=``,this.appCanvas.style.transform=``;let e=this.avatarManager.avatarInstance;e&&e.setVisible(!0)},e,t,n),this.currentMode=`vrm`,this.notifyModeChange()}dispose(){this.live2dOverlay.dispose(),this.blackoutOverlay.dispose(),this.appCanvas.style.filter=``,this.appCanvas.style.transform=``}},or=class{avatarManager;viewerCore;getConfig;isActive=!1;stageGroup=null;overlayEl=null;labelElements=new Map;originalSunShafts=null;originalLensFlare=null;currentSpaceStage=!1;spaceGroup=null;sunMesh=null;earthGroup=null;earthMesh=null;moonMesh=null;aoiGhostMesh=null;orbitAngle=0;aoiGhostPos=new k;texturesToDispose=[];constructor(e){this.avatarManager=e.avatarManager,this.viewerCore=e.viewerCore,this.getConfig=e.getConfig,this.initOverlay(),this.initStage(),this.initSpaceStage()}initOverlay(){let e=document.getElementById(`shaft-typography-overlay`);e||(e=document.createElement(`div`),e.id=`shaft-typography-overlay`,e.style.position=`absolute`,e.style.top=`0`,e.style.left=`0`,e.style.width=`100%`,e.style.height=`100%`,e.style.pointerEvents=`none`,e.style.userSelect=`none`,e.style.overflow=`hidden`,e.style.zIndex=`30`,e.style.display=`none`,(document.getElementById(`viewport-container`)||document.body).appendChild(e)),this.overlayEl=e}createOrGetLabelElement(e,t){let n=this.labelElements.get(e);return n||(n=document.createElement(`div`),n.className=`shaft-vertical-text shaft-text-${e}`,n.style.position=`absolute`,n.style.writingMode=`vertical-rl`,n.style.textOrientation=`upright`,n.style.whiteSpace=`nowrap`,n.style.lineHeight=`1.1`,n.style.fontFamily=`"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif`,n.style.fontWeight=`800`,n.style.fontSize=`clamp(1.6rem, 3.4vw, 2.5rem)`,n.style.color=`#ffffff`,n.style.letterSpacing=`0.22em`,n.style.textShadow=`0 0 8px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.9)`,n.style.transform=`translate(-50%, -50%) scale(1)`,n.style.transition=`transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)`,n.style.display=`inline-block`,this.overlayEl?.appendChild(n),this.labelElements.set(e,n)),n.textContent=t,n}initStage(){let e=new S;e.name=`ShaftAbstractStage`,e.visible=!1;let t=(e,t,n,r=110)=>{let i=document.createElement(`canvas`);i.width=512,i.height=512;let a=i.getContext(`2d`);a.fillStyle=t,a.fillRect(0,0,512,512),a.fillStyle=n,a.font=`bold ${r}px "Shippori Mincho", "Yu Mincho", serif`,a.textAlign=`center`,a.textBaseline=`middle`,a.fillText(e,256,256);let o=new R(i);return o.colorSpace=E,this.texturesToDispose.push(o),o},n=new N(14,.2,14),r=t(`床`,`#e4e4e7`,`#a1a1aa`,95);r.wrapS=v,r.wrapT=v,r.repeat.set(4,4);let i=new L(n,new F({map:r,toneMapped:!1}));i.position.set(0,-.1,0),e.add(i);let a=new L(new N(4,1.9,.05),new F({map:t(`黒板`,`#3f3f46`,`#ffffff`,130),toneMapped:!1}));a.position.set(0,1.6,-2.6),e.add(a);let o=new N(.85,.04,.55),s=new F({map:t(`机`,`#52525b`,`#ffffff`,110),toneMapped:!1}),c=new F({color:4144966,toneMapped:!1}),l=new N(.04,.7,.04),u=[[-.38,-.23],[.38,-.23],[-.38,.23],[.38,.23]],d=(e,t)=>{let n=new S;n.position.set(e,0,t);let r=new L(o,s);r.position.set(0,.72,0),n.add(r);for(let[e,t]of u){let r=new L(l,c);r.position.set(e,.35,t),n.add(r)}return n},f=new N(.42,.03,.42),p=new F({map:t(`椅子`,`#52525b`,`#ffffff`,95),toneMapped:!1}),m=new N(.42,.24,.03),h=new F({color:4144966,toneMapped:!1}),g=new N(.03,.42,.03),_=new N(.03,.36,.03),y=[[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]],b=(e,t)=>{let n=new S;n.position.set(e,0,t);let r=new L(f,p);r.position.set(0,.42,0),n.add(r);let i=new L(m,p);i.position.set(0,.75,.18),n.add(i);for(let[e,t]of y){let r=new L(g,h);r.position.set(e,.21,t),n.add(r)}let a=new L(_,h);a.position.set(-.18,.58,.18);let o=new L(_,h);return o.position.set(.18,.58,.18),n.add(a,o),n};e.add(d(.85,.2)),e.add(b(.85,.75)),e.add(d(-.85,.2)),e.add(b(-.85,.75)),this.viewerCore.scene.add(e),this.stageGroup=e}initSpaceStage(){let e=new S;e.name=`ShaftSpaceStage`,e.visible=!1;let t=(e,t,n,r,i=512,a)=>{let o=document.createElement(`canvas`);o.width=i,o.height=i;let s=o.getContext(`2d`),c=i/2,l=i*.44;s.strokeStyle=r,s.lineWidth=i*.02,s.beginPath(),s.arc(c,c,l+i*.03,0,Math.PI*2),s.stroke(),s.fillStyle=t,s.beginPath(),s.arc(c,c,l,0,Math.PI*2),s.fill(),s.strokeStyle=`#ffffff`,s.lineWidth=i*.015,s.beginPath(),s.arc(c,c,l*.92,0,Math.PI*2),s.stroke(),s.fillStyle=n,s.font=`bold ${Math.round(i*.32)}px "Shippori Mincho", "Yu Mincho", serif`,s.textAlign=`center`,s.textBaseline=`middle`,s.fillText(e,c,a?c-i*.05:c),a&&(s.fillStyle=`#ffffff`,s.font=`600 ${Math.round(i*.08)}px "Montserrat", sans-serif`,s.letterSpacing=`3px`,s.fillText(a,c,c+i*.22));let u=new R(o);return u.colorSpace=E,this.texturesToDispose.push(u),u},n=new F({map:t(`太陽`,`#dc2626`,`#ffffff`,`#fca5a5`,512,`SUN`),transparent:!0,toneMapped:!1,depthWrite:!1});this.sunMesh=new L(new P(1.35,1.35),n),this.sunMesh.position.set(0,.4,0),e.add(this.sunMesh);let r=new L(new _(.72,.73,64),new F({color:16281969,side:2,toneMapped:!1}));r.position.set(0,.4,-.01),e.add(r);let i=[];for(let e=0;e<=128;e++){let t=e/128*Math.PI*2;i.push(new k(Math.cos(t)*2.35,.4,Math.sin(t)*1.75))}let a=new b(new A().setFromPoints(i),new se({color:16777215,dashSize:.14,gapSize:.08}));a.computeLineDistances(),e.add(a),this.earthGroup=new S;let o=new F({map:t(`地球`,`#2563eb`,`#ffffff`,`#93c5fd`,512,`EARTH`),transparent:!0,toneMapped:!1,depthWrite:!1});this.earthMesh=new L(new P(.68,.68),o),this.earthGroup.add(this.earthMesh);let s=new F({map:t(`月`,`#eab308`,`#000000`,`#fef08a`,256),transparent:!0,toneMapped:!1,depthWrite:!1});this.moonMesh=new L(new P(.3,.3),s),this.moonMesh.position.set(.52,0,0),this.earthGroup.add(this.moonMesh),e.add(this.earthGroup);let c=document.createElement(`canvas`);c.width=384,c.height=768;let l=c.getContext(`2d`);l.font=`bold 155px "Shippori Mincho", "Yu Mincho", serif`,l.textAlign=`center`,l.textBaseline=`middle`;let u=[`ア`,`オ`,`イ`];l.shadowColor=`rgba(0, 0, 0, 0.95)`,l.shadowBlur=18,l.lineWidth=20,l.strokeStyle=`#000000`,u.forEach((e,t)=>{let n=180+t*175;l.strokeText(e,192,n)}),l.shadowBlur=0,l.lineWidth=14,l.strokeStyle=`#ffffff`,u.forEach((e,t)=>{let n=180+t*175;l.strokeText(e,192,n)}),l.fillStyle=`#f59e0b`,u.forEach((e,t)=>{let n=180+t*175;l.fillText(e,192,n)}),l.font=`800 38px "Montserrat", sans-serif`,l.strokeStyle=`#000000`,l.lineWidth=8,l.strokeText(`AOI`,192,700),l.fillStyle=`#ffffff`,l.fillText(`AOI`,192,700);let d=new R(c);d.colorSpace=E,this.texturesToDispose.push(d);let f=new F({map:d,transparent:!0,toneMapped:!1,depthWrite:!1,side:2});this.aoiGhostMesh=new L(new P(.65,1.3),f),this.aoiGhostMesh.name=`ShaftAoiGhostMesh`,this.aoiGhostMesh.visible=!1,e.add(this.aoiGhostMesh);for(let[t,n,r]of[[-3.2,2,-1],[3,1.8,-1.2],[-2.5,-.6,.8],[2.8,-.4,1.2],[-1.2,2.5,-2],[1.5,2.6,-1.8],[-3.5,.5,.2],[3.4,.8,-.3],[-.8,-.8,1.5],[.9,-.9,1.6]]){let i=document.createElement(`canvas`);i.width=64,i.height=64;let a=i.getContext(`2d`);a.strokeStyle=`rgba(255, 255, 255, 0.7)`,a.lineWidth=4,a.beginPath(),a.moveTo(32,10),a.lineTo(32,54),a.moveTo(10,32),a.lineTo(54,32),a.stroke();let o=new R(i);this.texturesToDispose.push(o);let s=new F({map:o,transparent:!0,toneMapped:!1,depthWrite:!1}),c=new L(new P(.25,.25),s);c.position.set(t,n,r),e.add(c)}this.viewerCore.scene.add(e),this.spaceGroup=e}setSpaceStage(e){let t=e||!1;if(this.currentSpaceStage!==t){if(this.currentSpaceStage=t,t){this.spaceGroup&&(this.spaceGroup.visible=!0),this.stageGroup&&(this.stageGroup.visible=!1),this.overlayEl&&(this.overlayEl.style.display=`none`),this.viewerCore.scene.background=new O(0),this.viewerCore.renderer.setClearColor(0,1);let e=document.getElementById(`viewport-container`);e&&(e.style.backgroundColor=`#000000`),t===`ghost_left_behind`?this.aoiGhostMesh&&(this.aoiGhostMesh.visible=!0,this.aoiGhostPos.set(1.4,.7,.6),this.aoiGhostMesh.position.copy(this.aoiGhostPos),this.orbitAngle=1.1):this.aoiGhostMesh&&(this.aoiGhostMesh.visible=!1)}else if(this.spaceGroup&&(this.spaceGroup.visible=!1),this.aoiGhostMesh&&(this.aoiGhostMesh.visible=!1),this.isActive){this.stageGroup&&(this.stageGroup.visible=!0),this.viewerCore.scene.background=new O(16777215),this.viewerCore.renderer.setClearColor(16777215,1);let e=document.getElementById(`viewport-container`);e&&(e.style.backgroundColor=`#ffffff`),this.overlayEl&&(this.overlayEl.style.display=`block`)}}}getCharacterInfoForAvatar(e){let t=(e||``).toLowerCase();return t.includes(`aoi`)||t.includes(`girl_01`)?{name:`アオイ`,color:`#f59e0b`}:t.includes(`emili`)||t.includes(`girl_02`)?{name:`エミリ`,color:`#dc2626`}:t.includes(`shion`)||t.includes(`girl_03`)?{name:`シオン`,color:`#2563eb`}:{name:`アバター`,color:`#e11d48`}}getCharacterInfo(){return this.getCharacterInfoForAvatar(this.avatarManager.currentModelUrl)}setShaftMode(e){if(this.isActive===e)return;this.isActive=e;let t=this.getCharacterInfo();if(e){this.avatarManager.setSolidColorMode(!0,t.color),this.viewerCore.scene.background=new O(16777215),this.viewerCore.renderer.setClearColor(16777215,1);let e=document.getElementById(`viewport-container`);e&&(e.style.backgroundColor=`#ffffff`),this.viewerCore.skyBackground.mesh.visible=!1,this.viewerCore.midgroundMesh.visible=!1,this.viewerCore.neargroundMesh.visible=!1,this.viewerCore.sunEffect.sunGroup.visible=!1,this.viewerCore.sunEffect.flareGroup.visible=!1,this.viewerCore.godRaysPass.enabled=!1;let n=this.getConfig();if(n.lighting.sunShafts&&(this.originalSunShafts=n.lighting.sunShafts.enabled,n.lighting.sunShafts.enabled=!1),n.lighting.lensFlare&&(this.originalLensFlare=n.lighting.lensFlare.enabled,n.lighting.lensFlare.enabled=!1),this.stageGroup&&(this.stageGroup.visible=!0),this.overlayEl)if(this.overlayEl.style.display=`block`,this.avatarManager.isMultiAvatarScenarioActive&&this.avatarManager.scenarioAvatars.size>0)for(let[e]of this.avatarManager.scenarioAvatars.entries()){let t=this.getCharacterInfoForAvatar(e),n=this.createOrGetLabelElement(e,t.name);n.style.display=`inline-block`,n.style.transform=`translate(-50%, -50%) scale(1.2)`,requestAnimationFrame(()=>{n.style.transform=`translate(-50%, -50%) scale(1)`})}else{let e=this.createOrGetLabelElement(`single`,t.name);e.style.display=`inline-block`,e.style.transform=`translate(-50%, -50%) scale(1.2)`,requestAnimationFrame(()=>{e.style.transform=`translate(-50%, -50%) scale(1)`})}}else{this.avatarManager.setSolidColorMode(!1),this.stageGroup&&(this.stageGroup.visible=!1),this.setSpaceStage(!1);let e=this.getConfig();this.originalSunShafts!==null&&e.lighting.sunShafts&&(e.lighting.sunShafts.enabled=this.originalSunShafts,this.originalSunShafts=null),this.originalLensFlare!==null&&e.lighting.lensFlare&&(e.lighting.lensFlare.enabled=this.originalLensFlare,this.originalLensFlare=null),this.viewerCore.updateBackgroundDisplay(e),this.viewerCore.updateMidgroundDisplay(e),this.viewerCore.updateNeargroundDisplay(e),this.viewerCore.sunEffect.sunGroup.visible=(e.lighting.sunShafts?.enabled||e.lighting.lensFlare?.enabled)??!1,this.viewerCore.sunEffect.flareGroup.visible=e.lighting.lensFlare?.enabled??!1,this.overlayEl&&(this.overlayEl.style.display=`none`);for(let e of this.labelElements.values())e.style.display=`none`}}getIsActive(){return this.isActive}refreshCurrentAvatar(){if(!this.isActive)return;let e=this.getCharacterInfo();if(this.avatarManager.setSolidColorMode(!0,e.color),this.avatarManager.isMultiAvatarScenarioActive&&this.avatarManager.scenarioAvatars.size>0)for(let[e]of this.avatarManager.scenarioAvatars.entries()){let t=this.getCharacterInfoForAvatar(e);this.createOrGetLabelElement(e,t.name)}else this.createOrGetLabelElement(`single`,e.name);this.viewerCore.scene.background=new O(16777215),this.viewerCore.renderer.setClearColor(16777215,1);let t=document.getElementById(`viewport-container`);t&&(t.style.backgroundColor=`#ffffff`),this.viewerCore.skyBackground.mesh.visible=!1,this.viewerCore.midgroundMesh.visible=!1,this.viewerCore.neargroundMesh.visible=!1,this.viewerCore.sunEffect.sunGroup.visible=!1,this.viewerCore.sunEffect.flareGroup.visible=!1,this.viewerCore.godRaysPass.enabled=!1,this.stageGroup&&(this.stageGroup.visible=!0)}update(){if(!this.isActive)return;if(this.currentSpaceStage&&this.spaceGroup?.visible){if((this.viewerCore.scene.background===null||!this.viewerCore.scene.background.isColor||this.viewerCore.scene.background.getHex()!==0)&&(this.viewerCore.scene.background=new O(0)),this.orbitAngle+=.045,this.earthGroup){let e=Math.cos(this.orbitAngle)*2.35,t=Math.sin(this.orbitAngle)*1.75;if(this.earthGroup.position.set(e,.4,t),this.moonMesh){let e=this.orbitAngle*4;this.moonMesh.position.set(Math.cos(e)*.55,Math.sin(e)*.25,Math.sin(e)*.35)}}let e=this.viewerCore.camera;if(this.sunMesh&&this.sunMesh.quaternion.copy(e.quaternion),this.earthMesh&&this.earthMesh.quaternion.copy(e.quaternion),this.moonMesh&&this.moonMesh.quaternion.copy(e.quaternion),this.currentSpaceStage===`ghost_left_behind`&&this.aoiGhostMesh?.visible){this.aoiGhostMesh.quaternion.copy(e.quaternion);let t=Math.sin(Date.now()*.003)*.04;this.aoiGhostMesh.position.y=this.aoiGhostPos.y+t}return}if(!this.overlayEl)return;this.viewerCore.skyBackground.mesh.visible&&(this.viewerCore.skyBackground.mesh.visible=!1),(this.viewerCore.scene.background===null||!this.viewerCore.scene.background.isColor)&&(this.viewerCore.scene.background=new O(16777215));let e=this.viewerCore.camera;if(this.avatarManager.isMultiAvatarScenarioActive&&this.avatarManager.scenarioAvatars.size>0)for(let[t,n]of this.avatarManager.scenarioAvatars.entries()){let r=this.getCharacterInfoForAvatar(t),i=this.createOrGetLabelElement(t,r.name);if(!n?.vrm||!n.getVisible()||!n.vrm.scene.visible){i.style.display=`none`;continue}let a=n.vrm.humanoid?.getNormalizedBoneNode(`head`)||n.vrm.humanoid?.getNormalizedBoneNode(`neck`),o=new k;a?(a.getWorldPosition(o),o.y-=.1):(n.vrm.scene.getWorldPosition(o),o.y+=1.25);let s=o.clone().project(e),c=(s.x*.5+.5)*100,l=(-s.y*.5+.5)*100;s.z>1||s.x<-1.05||s.x>1.05?i.style.display=`none`:(i.style.display=`inline-block`,i.style.left=`${c.toFixed(1)}%`,i.style.top=`${l.toFixed(1)}%`)}else{let e=this.avatarManager.avatarInstance,t=this.getCharacterInfo(),n=this.createOrGetLabelElement(`single`,t.name);if(!e?.vrm||!e.getVisible()||!e.vrm.scene.visible){n.style.display=`none`;return}let r=e.vrm.humanoid?.getNormalizedBoneNode(`head`)||e.vrm.humanoid?.getNormalizedBoneNode(`neck`),i=new k;r?(r.getWorldPosition(i),i.y-=.1):(e.vrm.scene.getWorldPosition(i),i.y+=1.25);let a=this.viewerCore.camera,o=i.clone().project(a),s=(o.x*.5+.5)*100,c=(-o.y*.5+.5)*100;o.z>1||o.x<-1.05||o.x>1.05?n.style.display=`none`:(n.style.display=`inline-block`,n.style.left=`${s.toFixed(1)}%`,n.style.top=`${c.toFixed(1)}%`)}}dispose(){this.isActive&&this.setShaftMode(!1),this.setSpaceStage(!1),this.overlayEl&&this.overlayEl.parentNode&&this.overlayEl.parentNode.removeChild(this.overlayEl),this.labelElements.clear(),this.stageGroup&&this.viewerCore.scene.remove(this.stageGroup),this.spaceGroup&&this.viewerCore.scene.remove(this.spaceGroup),this.texturesToDispose.forEach(e=>e.dispose()),this.texturesToDispose=[]}},sr={id:`park_confession`,title:`夕暮れの公園と放課後の期待`,bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.35,seUrl:`/se/large_brown_cicada.mp3`,seVolume:.15,chapters:[{id:`main`,title:`放課後の呼び出し`,scenes:[{id:`intro_1`,speaker:`女の子`,location:`夕暮れの公園`,scenePreset:`evening_park`,text:`「あ、来てくれたんだ……！ 急にこんな公園に呼び出したりして、ごめんね」`,voiceUrl:`/voices/confess_intro_1.wav`,avatar:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.8,effectText:`doki`},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`pushIn`,cameraStrength:.6},{id:`intro_2`,speaker:`女の子`,location:`夕暮れの公園・ベンチ前`,text:`「あのね……ずっと前から、あなたに伝えたいことがあって……」`,voiceUrl:`/voices/confess_intro_2.wav`,avatar:{motion:`/animations/ardy_confess_hesitant.fbx`,expression:`neutral`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:`doki`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`orbitLeftHalf`,cameraStrength:.5},{id:`intro_3`,speaker:`女の子`,location:`夕暮れの公園・ベンチ前`,text:`「私のこと……どう思ってる……？」`,voiceUrl:`/voices/confess_intro_3.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`neutral`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:`doki`},cameraZoom:`medium`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`hold`,choices:[{text:`「俺もずっと好きだった！付き合ってください！」`,flag:`confess_love`,goto:`route_love_1`,effectText:`yatta`},{text:`「先週貸した500円、返してほしいんだけど」`,flag:`ask_money`,goto:`route_money_1`,effectText:`gaan`},{text:`（何も言わずにじっと見つめる）`,flag:`silent_stare`,goto:`route_silent_1`,effectText:`shiin`}]},{id:`route_love_1`,speaker:`女の子`,location:`夕暮れの公園`,text:`「やったーっ！ え……！？ ほんとに……！？ 夢じゃないよね……！？」`,voiceUrl:`/voices/confess_love_1.wav`,avatar:{motion:`/animations/ardy_confess_joy.fbx`,expression:`happy`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:`yatta`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.45,cameraPreset:`punchIn`,cameraStrength:1.2},{id:`route_love_2`,speaker:`女の子`,location:`夕暮れの公園`,text:`「すっごく嬉しい……！ 私、ずっとあなたのことばかり考えてたの……っ！」`,voiceUrl:`/voices/confess_love_2.wav`,avatar:{motion:`/animations/ardy_confess_heart.fbx`,expression:`relaxed`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:{preset:`doki`,text:`ドキドキ♡`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`orbitRightHalf`,cameraStrength:.6},{id:`route_love_3`,speaker:`女の子`,location:`夕暮れの公園`,text:`「ねぇ...これって夢じゃないよね？ぎゅ〜ってしてくれる？」`,voiceUrl:`/voices/confess_love_hug.wav`,avatar:{motion:`/animations/ardy_confess_hug.fbx`,expression:`relaxed`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:{preset:`doki`,text:`ドキドキ…♡`}},cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pushIn`,cameraStrength:.5},{id:`route_love_4`,speaker:`女の子`,location:`夕暮れの公園`,text:`「ずっと...そばにいてね...」`,voiceUrl:`/voices/asmr_tuned2.wav`,voicePan:1,screenTransition:`eyelid_close`,avatar:{motion:`/animations/Idle.fbx`,expression:`relaxed`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:{preset:`doki`,text:`ドキドキ…♡`}},cameraZoom:`speaker_extreme_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.9,cameraPreset:`pushIn`,cameraStrength:.4,goto:`ending_common`},{id:`route_money_1`,speaker:`女の子`,location:`夕暮れの公園`,text:`「え……？ ご、500えん……？」`,voiceUrl:`/voices/confess_money_1.wav`,avatar:{motion:`/animations/Dismissing Gesture.fbx`,expression:`surprised`,expressionWeight:1,effectText:`gaan`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.4,cameraPreset:`punchIn`,cameraStrength:1},{id:`route_money_2`,speaker:`女の子`,location:`夕暮れの公園`,text:`「そ、そんな理由でこんな呼び出しに応じたの……！？ 私の心の準備とドキドキを返してよー！！」`,voiceUrl:`/voices/confess_money_2.wav`,avatar:{motion:`/animations/Angry.fbx`,expression:`angry`,expressionWeight:1,effectText:`iraira`},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`orbitLeftHalf`,cameraStrength:.8},{id:`route_money_3`,speaker:`女の子`,location:`夕暮れの公園`,text:`「ほら！ 500円！ これで文句ないでしょ！ もうっ、鈍感バカーッ！」`,voiceUrl:`/voices/confess_money_3.wav`,avatar:{motion:`/animations/Angry.fbx`,expression:`angry`,expressionWeight:.8,effectText:`wanawana`},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`panRight`,cameraStrength:.7,goto:`ending_common`},{id:`route_silent_1`,speaker:``,location:`夕暮れの公園`,text:`（…………静寂が流れる…………）`,avatar:{motion:`/animations/Idle.fbx`,expression:`neutral`,expressionWeight:.5,effectText:`shiin`},cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`pushIn`,cameraStrength:.4},{id:`route_silent_2`,speaker:`女の子`,location:`夕暮れの公園`,text:`「ちょ、ちょっと……なんで何も言わないの……！？ 気まずいから何か言ってよ〜っ！」`,voiceUrl:`/voices/confess_silent_2.wav`,avatar:{motion:`/animations/Acknowledging.fbx`,expression:`surprised`,expressionWeight:.9,effectText:`biku`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.45,cameraPreset:`punchIn`,cameraStrength:1.1},{id:`route_silent_3`,speaker:`女の子`,location:`夕暮れの公園`,text:`「うぅ……からかわないでよね……。もう一回、ちゃんと最初からやり直してあげるからね！」`,voiceUrl:`/voices/confess_silent_3.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.7,effectText:`doki`},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pullOut`,cameraStrength:.7,goto:`ending_common`},{id:`ending_common`,speaker:``,location:`夕暮れの公園`,text:`―― 夕暮れの公園での出来事は、こうして幕を閉じた。 【シナリオ終了】`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.5},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`orbitRightHalf`,cameraStrength:.4}]}]},cr={id:`park_confession`,title:`Twilight Park & After-School Anticipation`,bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.35,seUrl:`/se/large_brown_cicada.mp3`,seVolume:.15,chapters:[{id:`main`,title:`After-School Summons`,scenes:[{id:`intro_1`,speaker:`Girl`,location:`Twilight Park`,scenePreset:`evening_park`,text:`"Ah, you came...! Sorry for calling you out to this park so suddenly."`,voiceUrl:`/voices/confess_intro_1.wav`,avatar:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.8,effectText:`doki`},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`pushIn`,cameraStrength:.6},{id:`intro_2`,speaker:`Girl`,location:`Twilight Park - Near Bench`,text:`"Um, you know... there's something I've been meaning to tell you for a long time..."`,voiceUrl:`/voices/confess_intro_2.wav`,avatar:{motion:`/animations/ardy_confess_hesitant.fbx`,expression:`neutral`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:`doki`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`orbitLeftHalf`,cameraStrength:.5},{id:`intro_3`,speaker:`Girl`,location:`Twilight Park - Near Bench`,text:`"How... how do you feel about me...?"`,voiceUrl:`/voices/confess_intro_3.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`neutral`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:`doki`},cameraZoom:`medium`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`hold`,choices:[{text:`"I've always loved you too! Please go out with me!"`,flag:`confess_love`,goto:`route_love_1`,effectText:`yatta`},{text:`"Can I have back the 500 yen I lent you last week?"`,flag:`ask_money`,goto:`route_money_1`,effectText:`gaan`},{text:`(Stare at her silently without saying a word)`,flag:`silent_stare`,goto:`route_silent_1`,effectText:`shiin`}]},{id:`route_love_1`,speaker:`Girl`,location:`Twilight Park`,text:`"Yay!! Wait... really!? You mean it!? This isn't a dream, right...!?"`,voiceUrl:`/voices/confess_love_1.wav`,avatar:{motion:`/animations/ardy_confess_joy.fbx`,expression:`happy`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:`yatta`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.45,cameraPreset:`punchIn`,cameraStrength:1.2},{id:`route_love_2`,speaker:`Girl`,location:`Twilight Park`,text:`"I'm so happy...! I've been thinking about you non-stop all this time...!"`,voiceUrl:`/voices/confess_love_2.wav`,avatar:{motion:`/animations/ardy_confess_heart.fbx`,expression:`relaxed`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:{preset:`doki`,text:`Heart Thump♡`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`orbitRightHalf`,cameraStrength:.6},{id:`route_love_3`,speaker:`Girl`,location:`Twilight Park`,text:`"Hey... this isn't a dream, right? Will you give me a hug...?"`,voiceUrl:`/voices/confess_love_hug.wav`,avatar:{motion:`/animations/ardy_confess_hug.fbx`,expression:`relaxed`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:{preset:`doki`,text:`Heart Thump…♡`}},cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pushIn`,cameraStrength:.5},{id:`route_love_4`,speaker:`Girl`,location:`Twilight Park`,text:`"Stay... by my side forever..."`,voiceUrl:`/voices/asmr_tuned2.wav`,voicePan:1,screenTransition:`eyelid_close`,avatar:{motion:`/animations/Idle.fbx`,expression:`relaxed`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,effectText:{preset:`doki`,text:`Heart Thump…♡`}},cameraZoom:`speaker_extreme_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.9,cameraPreset:`pushIn`,cameraStrength:.4,goto:`ending_common`},{id:`route_money_1`,speaker:`Girl`,location:`Twilight Park`,text:`"Huh...? F-Five hundred yen...?"`,voiceUrl:`/voices/confess_money_1.wav`,avatar:{motion:`/animations/Dismissing Gesture.fbx`,expression:`surprised`,expressionWeight:1,effectText:`gaan`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.4,cameraPreset:`punchIn`,cameraStrength:1},{id:`route_money_2`,speaker:`Girl`,location:`Twilight Park`,text:`"Is that why you showed up today...!? Give me back my heartfelt anticipation and racing heart!!"`,voiceUrl:`/voices/confess_money_2.wav`,avatar:{motion:`/animations/Angry.fbx`,expression:`angry`,expressionWeight:1,effectText:`iraira`},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`orbitLeftHalf`,cameraStrength:.8},{id:`route_money_3`,speaker:`Girl`,location:`Twilight Park`,text:`"Here! Take your 500 yen! Happy now?! Geez, you dense idiot!"`,voiceUrl:`/voices/confess_money_3.wav`,avatar:{motion:`/animations/Angry.fbx`,expression:`angry`,expressionWeight:.8,effectText:`wanawana`},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`panRight`,cameraStrength:.7,goto:`ending_common`},{id:`route_silent_1`,speaker:``,location:`Twilight Park`,text:`(...... An awkward silence settles in ......)`,avatar:{motion:`/animations/Idle.fbx`,expression:`neutral`,expressionWeight:.5,effectText:`shiin`},cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`pushIn`,cameraStrength:.4},{id:`route_silent_2`,speaker:`Girl`,location:`Twilight Park`,text:`"W-Wait... why aren't you saying anything...!? This is so awkward, say something already~!"`,voiceUrl:`/voices/confess_silent_2.wav`,avatar:{motion:`/animations/Acknowledging.fbx`,expression:`surprised`,expressionWeight:.9,effectText:`biku`},cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.45,cameraPreset:`punchIn`,cameraStrength:1.1},{id:`route_silent_3`,speaker:`Girl`,location:`Twilight Park`,text:`"Ugh... don't tease me like that... Fine, I'll let you start over properly from the beginning!"`,voiceUrl:`/voices/confess_silent_3.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.7,effectText:`doki`},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pullOut`,cameraStrength:.7,goto:`ending_common`},{id:`ending_common`,speaker:``,location:`Twilight Park`,text:`— And so, the after-school moment in the twilight park drew to a close. [Scenario End]`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.5},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`orbitRightHalf`,cameraStrength:.4}]}]};function lr(e=H()){return e===`en`?cr:sr}var ur={id:`two_girls_chat`,title:`放課後の寄り道〜アオイとエミリ〜`,characters:[{id:`girl_01`,character:`/models/aoi/aoi-school.vrm`,position:`left`},{id:`girl_02`,character:`/models/emili/emili.vrm`,position:`right`}],bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.3,chapters:[{id:`main`,title:`放課後の約束`,scenes:[{id:`chat_intro_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`放課後の教室`,scenePreset:`morning_school`,text:`「エミリちゃん！ 今日の放課後、もし予定なかったら一緒にどこか寄っていかない？」`,voiceUrl:`/voices/chat_intro_1.wav`,avatars:{girl_01:{motion:`/animations/Dismissing Gesture.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`doki`},girl_02:{motion:`/animations/Female Standing Pose.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`pushIn`,cameraStrength:.6},{id:`chat_intro_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`放課後の教室`,text:`「あ、アオイ！ ちょうど声かけようと思ってたの！ 駅前に新しくできたカフェ、行ってみない？」`,voiceUrl:`/voices/chat_intro_2.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Excited.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`kirakira`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`orbitRightHalf`,cameraStrength:.5},{id:`chat_choice`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`放課後の教室`,text:`「どこに行こうか？ 一緒に決めよっ！」`,avatars:{girl_01:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Female Standing Pose.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`hold`,choices:[{text:`🍰 新作スイーツがあるカフェに行こう！`,flag:`choice_cafe`,goto:`route_cafe_1`,effectText:`yatta`},{text:`📚 明日の小テストに向けて図書館で勉強しよう！`,flag:`choice_study`,goto:`route_study_1`,effectText:`gaan`},{text:`🍃 夕暮れの公園でゆっくりおしゃべりしよう`,flag:`choice_park`,goto:`route_park_1`,effectText:`doki`}]},{id:`route_cafe_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`駅前カフェ通り`,text:`「やったぁ！ 期間限定の特製ストロベリーパフェがあるんだって！ 楽しみ〜！」`,voiceUrl:`/voices/chat_cafe_1.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Excited.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`yatta`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pushIn`,cameraStrength:.4},{id:`route_cafe_2`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`駅前カフェ通り`,text:`「ふふっ、エミリちゃん本当にスイーツ大好きだよね。私も写真いっぱい撮っちゃお♪」`,voiceUrl:`/voices/chat_cafe_2.wav`,avatars:{girl_01:{motion:`/animations/Quick Formal Bow.fbx`,expression:`happy`,expressionWeight:.6,effectText:`kirakira`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`orbitLeftHalf`,cameraStrength:.6,goto:`ending_chat`},{id:`route_study_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`学校の図書室`,text:`「えぇ〜っ！？ 放課後なのに勉強〜！？ アオイ、真面目すぎるよ〜っ！」`,voiceUrl:`/voices/chat_study_1.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Angry.fbx`,expression:`surprised`,expressionWeight:.8,effectText:`gaan`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`hold`,cameraStrength:.5},{id:`route_study_2`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`学校の図書室`,text:`「大丈夫、1時間だけ集中して終わったら美味しいジュースおごってあげるから！」`,voiceUrl:`/voices/chat_study_2.wav`,avatars:{girl_01:{motion:`/animations/Acknowledging.fbx`,expression:`relaxed`,expressionWeight:.7,effectText:`doki`},girl_02:{motion:`/animations/Dismissing Gesture.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pushIn`,cameraStrength:.6,goto:`ending_chat`},{id:`route_park_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`夕暮れの公園`,scenePreset:`evening_park`,text:`「夕方の風が気持ちいいね。たまにはこうやってのんびり歩くのもいいかも」`,voiceUrl:`/voices/chat_park_1.wav`,avatars:{girl_01:{motion:`/animations/Female Standing Pose.fbx`,expression:`relaxed`,expressionWeight:.7,effectText:`kirakira`},girl_02:{motion:`/animations/Walking.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`panRight`,cameraStrength:.6},{id:`route_park_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`夕暮れの公園`,text:`「うん！ 綺麗な夕焼けだね。アオイとおしゃべりしながら歩くの大好き♪」`,voiceUrl:`/voices/chat_park_2.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Quick Formal Bow.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`doki`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`orbitLeftHalf`,cameraStrength:.5,goto:`ending_chat`},{id:`ending_chat`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`帰り道`,text:`「「それじゃあ、行こっか！」」 ―― 2人の楽しい放課後が始まった。【シナリオ終了】`,avatars:{girl_01:{motion:`/animations/Standing Greeting.fbx`,expression:`happy`,expressionWeight:.7,effectText:`kirakira`},girl_02:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`yatta`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`pullOut`,cameraStrength:.8}]}]},dr={id:`two_girls_chat`,title:`After-School Hangout ~Aoi & Emiri~`,characters:[{id:`girl_01`,character:`/models/aoi/aoi-school.vrm`,position:`left`},{id:`girl_02`,character:`/models/emili/emili.vrm`,position:`right`}],bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.3,chapters:[{id:`main`,title:`After-School Promise`,scenes:[{id:`chat_intro_1`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`Classroom after school`,scenePreset:`morning_school`,text:`"Emiri! If you have no plans after school, want to hang out somewhere together?"`,voiceUrl:`/voices/chat_intro_1.wav`,avatars:{girl_01:{motion:`/animations/Dismissing Gesture.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`doki`},girl_02:{motion:`/animations/Female Standing Pose.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`pushIn`,cameraStrength:.6},{id:`chat_intro_2`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`Classroom after school`,text:`"Ah, Aoi! I was just about to ask you! Want to check out the new cafe in front of the station?"`,voiceUrl:`/voices/chat_intro_2.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Excited.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`kirakira`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`orbitRightHalf`,cameraStrength:.5},{id:`chat_choice`,speaker:`Aoi & Emiri`,dialogueTarget:`player`,location:`Classroom after school`,text:`"Where should we go? Let's decide together!"`,avatars:{girl_01:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Female Standing Pose.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`hold`,choices:[{text:`🍰 Let's go to the cafe for seasonal sweets!`,flag:`choice_cafe`,goto:`route_cafe_1`,effectText:`yatta`},{text:`📚 Let's study at the library for tomorrow's quiz!`,flag:`choice_study`,goto:`route_study_1`,effectText:`gaan`},{text:`🍃 Let's take a relaxing walk in the twilight park`,flag:`choice_park`,goto:`route_park_1`,effectText:`doki`}]},{id:`route_cafe_1`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`Cafe Street`,text:`"Yay! I heard they have a limited strawberry parfait! Can't wait~!"`,voiceUrl:`/voices/chat_cafe_1.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Excited.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`yatta`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pushIn`,cameraStrength:.4},{id:`route_cafe_2`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`Cafe Street`,text:`"Hehe, Emiri really loves sweets. I'm definitely taking lots of photos♪"`,voiceUrl:`/voices/chat_cafe_2.wav`,avatars:{girl_01:{motion:`/animations/Quick Formal Bow.fbx`,expression:`happy`,expressionWeight:.6,effectText:`kirakira`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`orbitLeftHalf`,cameraStrength:.6,goto:`ending_chat`},{id:`route_study_1`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`School Library`,text:`"Whaaat!? Studying after school!? Aoi, you're way too serious~!"`,voiceUrl:`/voices/chat_study_1.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Angry.fbx`,expression:`surprised`,expressionWeight:.8,effectText:`gaan`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`hold`,cameraStrength:.5},{id:`route_study_2`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`School Library`,text:`"It's okay, just 1 hour of focus and I'll buy you a delicious drink afterwards!"`,voiceUrl:`/voices/chat_study_2.wav`,avatars:{girl_01:{motion:`/animations/Acknowledging.fbx`,expression:`relaxed`,expressionWeight:.7,effectText:`doki`},girl_02:{motion:`/animations/Dismissing Gesture.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pushIn`,cameraStrength:.6,goto:`ending_chat`},{id:`route_park_1`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`Twilight Park`,scenePreset:`evening_park`,text:`"The evening breeze feels so nice. It's great to just take a relaxing walk like this once in a while."`,voiceUrl:`/voices/chat_park_1.wav`,avatars:{girl_01:{motion:`/animations/Female Standing Pose.fbx`,expression:`relaxed`,expressionWeight:.7,effectText:`kirakira`},girl_02:{motion:`/animations/Walking.fbx`,expression:`neutral`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`panRight`,cameraStrength:.6},{id:`route_park_2`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`Twilight Park`,text:`"Yeah! The sunset is so pretty. I love chatting with you while we walk, Aoi♪"`,voiceUrl:`/voices/chat_park_2.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Quick Formal Bow.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`doki`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`orbitLeftHalf`,cameraStrength:.5,goto:`ending_chat`},{id:`ending_chat`,speaker:`Aoi & Emiri`,dialogueTarget:`player`,location:`Way home`,text:`"\\"Well then, let's go!\\"" — And so began their delightful after-school time. [Scenario End]`,avatars:{girl_01:{motion:`/animations/Standing Greeting.fbx`,expression:`happy`,expressionWeight:.7,effectText:`kirakira`},girl_02:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.6,effectText:`yatta`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`pullOut`,cameraStrength:.8}]}]};function fr(e=H()){return e===`en`?dr:ur}var pr={id:`trio_chat`,title:`放課後トライアングル〜アオイとエミリとあなた〜`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:[-.38,-.1,-1.15],rotationY:.22},{id:`girl_02`,character:z(`/models/emili/emili.vrm`),position:[.38,-.1,-1.15],rotationY:-.22}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.25,chapters:[{id:`main`,title:`放課後の作戦会議`,scenes:[{id:`trio_intro_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`教室`,scenePreset:`day_school`,background:z(`/textures/school-corridor-far.avif`),voiceUrl:z(`/voices/trio_intro_1.wav`),text:`「ねえ……ちょっといいかな？ 放課後、急に引き留めちゃってごめんね」`,cameraPosition:[-.12,1.3,-.15],cameraTarget:[-.38,1.25,-1.35],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`trio_intro_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`教室`,voiceUrl:z(`/voices/trio_intro_2.wav`),text:`「あーっ！ アオイずるい！ 私を置いて2人だけで内緒話しようとしてたでしょ〜！」`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.45,cameraPreset:`hold`,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.7},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`}}},{id:`trio_intro_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`教室`,voiceUrl:z(`/voices/trio_intro_3.wav`),text:`「ち、違うよエミリ！ 内緒話なんかじゃないってば。今度の週末、3人でどこか出かけないかって相談しようと思って……」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`surprised`,expressionWeight:.9,effectText:`asease`,sweat:`fly4`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`trio_intro_4`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/trio_intro_4.wav`),text:`「えっ、3人でお出かけ！？ やったぁ！ ……ねえねえ、あなたはどう？ 私たち2人と一緒に行くの、嫌じゃない？」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`}}},{id:`trio_choice`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/trio_choice.wav`),text:`「どこに行きたい？ 3人で一緒に決めよっ！」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.7,cameraPreset:`hold`,choiceDelaySec:1,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:1,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8,headWeight:.9},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:1,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8,headWeight:.9}},choices:[{text:`🍰 おしゃれなカフェで新作スイーツ巡り！`,flag:`choice_cafe`,goto:`route_cafe_1`,effectText:`yatta`},{text:`🌊 海が見える公園でのんびりピクニック！`,flag:`choice_picnic`,goto:`route_picnic_1`,effectText:`kirakira`},{text:`✨ 2人と一緒なら、どこへ行っても楽しいよ！`,flag:`choice_anywhere`,goto:`route_anywhere_1`,effectText:`doki`}]},{id:`route_cafe_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/trio_cafe_1.wav`),text:`「わぁっ、大賛成！ 駅前にできたカフェ、季節限定のいちごタルトがすっごく美味しいんだって！」`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraPreset:`spiralRise`,cameraStrength:1,cameraTransitionEasing:`cut`,cameraTransitionDuration:0,dreamBackground:`heart`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`}}},{id:`route_cafe_2`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_cafe_2.wav`),text:`「もう、エミリはいつも甘いものばかり……でも、私もあそこの紅茶気になってたんだよね」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.9},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_cafe_3`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_cafe_3.wav`),text:`「えへへ、じゃあ決まりね！ アオイにも半分分けてあげるから！」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`trio_ending`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1}}},{id:`route_picnic_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_picnic_1.wav`),text:`「海辺の公園……！ すごく素敵。潮風を浴びながらおしゃべりするの、楽しみだな」`,cameraPosition:[-.12,1.2,-.15],cameraTarget:[-.38,1.25,-1.35],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`relaxed`,expressionWeight:1,effectText:`kirakira`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_picnic_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_picnic_2.wav`),text:`「いいねいいね！ 私、お弁当にサンドイッチ作って持っていっちゃおうかな〜！」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`}}},{id:`route_picnic_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_picnic_3.wav`),text:`「ふふっ、エミリのサンドイッチ、味見ならいつでも手伝うよ？ 一緒に作ろうか」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`trio_ending`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:1},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_anywhere_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_anywhere_1.wav`),text:`「そんな風に言ってもらえるなんて……ふふっ、ありがとう。私もあなたと一緒ならどこでも嬉しいな」`,cameraPosition:[-.12,1.2,-.15],cameraTarget:[-.38,1.25,-1.35],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:1,effectText:`doki`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_anywhere_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_anywhere_2.wav`),text:`「きゃーっ！ さらっとそういうこと言っちゃうんだから〜！ アオイ、顔真っ赤になってるよ！」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`doki`}}},{id:`route_anywhere_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_anywhere_3.wav`),text:`「も、もうっ、からかわないでよエミリ！ ……でも、本当に嬉しいな」`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`trio_ending`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.9},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`trio_ending`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_ending.wav`),text:`「「それじゃあ今週末、楽しみにしてるね！ 約束だよ！」」 ―― 3人の特別な放課後会議が幕を閉じた。【シナリオ終了】`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.7,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8}}}]}]},mr={id:`trio_chat`,title:`After-School Triangle: Aoi, Emiri, and You`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:[-.38,0,-1.35],rotationY:.22},{id:`girl_02`,character:z(`/models/emili/emili.vrm`),position:[.38,0,-1.35],rotationY:-.22}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.25,chapters:[{id:`main`,title:`After-School Strategy Meeting`,scenes:[{id:`trio_intro_1`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`Classroom`,scenePreset:`day_school`,background:z(`/textures/school-corridor-far.avif`),voiceUrl:z(`/voices/trio_intro_1.wav`),text:`"Hey... do you have a moment? Sorry to keep you suddenly after school."`,cameraPosition:[-.12,1.2,-.15],cameraTarget:[-.38,1.25,-1.35],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`trio_intro_2`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`Classroom`,voiceUrl:z(`/voices/trio_intro_2.wav`),text:`"Aah! Not fair, Aoi! Were you trying to have a secret talk alone without me~?"`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.45,cameraPreset:`hold`,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.7},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`}}},{id:`trio_intro_3`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`Classroom`,voiceUrl:z(`/voices/trio_intro_3.wav`),text:`"N-No, Emiri! It's not a secret at all. I was just hoping to ask if the three of us could hang out together this weekend..."`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`surprised`,expressionWeight:.9,effectText:`asease`,sweat:`fly4`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`trio_intro_4`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`Classroom`,voiceUrl:z(`/voices/trio_intro_4.wav`),text:`"Wait, the three of us together!? Yay! ...Hey, what do you think? You wouldn't mind joining us two, right?"`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`}}},{id:`trio_choice`,speaker:`Aoi & Emiri`,dialogueTarget:`player`,location:`Classroom`,voiceUrl:z(`/voices/trio_choice.wav`),text:`"Where should we go? Let's choose together!"`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.7,cameraPreset:`hold`,choiceDelaySec:1,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:1,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8,headWeight:.9},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:1,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8,headWeight:.9}},choices:[{text:`🍰 Let's explore sweet treats at a lovely cafe!`,flag:`choice_cafe`,goto:`route_cafe_1`,effectText:`yatta`},{text:`🌊 A relaxing picnic at the seaside park!`,flag:`choice_picnic`,goto:`route_picnic_1`,effectText:`kirakira`},{text:`✨ Anywhere is wonderful as long as I'm with you two!`,flag:`choice_anywhere`,goto:`route_anywhere_1`,effectText:`doki`}]},{id:`route_cafe_1`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`Classroom`,voiceUrl:z(`/voices/trio_cafe_1.wav`),text:`"Awesome! The new cafe by the station has incredible seasonal strawberry tarts!"`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraPreset:`spiralRise`,cameraStrength:1,cameraTransitionEasing:`cut`,cameraTransitionDuration:0,dreamBackground:`heart`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`}}},{id:`route_cafe_2`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_cafe_2.wav`),text:`"Oh Emiri, you always go for sweets... But actually, I was curious about their tea selection too."`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.9},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_cafe_3`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_cafe_3.wav`),text:`"Hehe, then it's settled! I'll share a slice with you, Aoi!"`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`trio_ending`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1}}},{id:`route_picnic_1`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_picnic_1.wav`),text:`"The seaside park...! That sounds so nice. Enjoying the breeze and talking sounds lovely."`,cameraPosition:[-.12,1.2,-.15],cameraTarget:[-.38,1.25,-1.35],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`relaxed`,expressionWeight:1,effectText:`kirakira`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_picnic_2`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_picnic_2.wav`),text:`"Great idea! Maybe I'll pack some homemade sandwiches for all of us~!"`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`}}},{id:`route_picnic_3`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_picnic_3.wav`),text:`"Hehe, I'll happily help you taste-test beforehand! Shall we make them together?"`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`trio_ending`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:1},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_anywhere_1`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_anywhere_1.wav`),text:`"To hear you say that... hehe, thank you. Anywhere with you makes me so happy too."`,cameraPosition:[-.12,1.2,-.15],cameraTarget:[-.38,1.25,-1.35],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:1,effectText:`doki`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`route_anywhere_2`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_anywhere_2.wav`),text:`"Kyaa~! You say that with such a straight face! Look, Aoi's face is totally red!"`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`doki`}}},{id:`route_anywhere_3`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`Classroom at Twilight`,voiceUrl:z(`/voices/trio_anywhere_3.wav`),text:`"S-Stop teasing, Emiri! ...Though, I'm honestly really glad."`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`trio_ending`,avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.9},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8}}},{id:`trio_ending`,speaker:`Emiri`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`放課後の教室`,voiceUrl:z(`/voices/trio_ending.wav`),text:`"「それじゃあ今週末、楽しみにしてるね！ 約束だよ！」" ―― 3人の特別な放課後会議が幕を閉じた。【シナリオ終了】`,cameraPosition:[0,1.1,.45],cameraTarget:[0,1.15,-1.35],cameraZoom:`wide`,cameraTransitionDuration:.7,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,lookAtTarget:`player`,shallowHeadAngle:!1,headMaxYaw:.8}}}]}]};function hr(e=H()){return e===`ja`?pr:mr}var gr={id:`harem_choice`,title:`放課後大波乱!? 一体誰が本命なのよ〜！`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:`left`},{id:`girl_04`,character:z(`/models/shion/shion-school.vrm`),position:`center`},{id:`girl_02`,character:z(`/models/emili/emili.vrm`),position:`right`}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.25,chapters:[{id:`main`,title:`本命決着裁判`,scenes:[{id:`harem_intro_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`教室`,scenePreset:`day_school`,background:z(`/textures/school-corridor-far.avif`),voiceUrl:z(`/voices/harem_intro_1.wav`),text:`「ねえ……今日こそ、ちゃんとハッキリさせてほしいの。」`,cameraPosition:[-.4,1.35,.65],cameraTarget:[-.65,1.35,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.7,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_01`}}},{id:`harem_intro_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_intro_2.wav`),text:`「そうよ！ 誰にでも思わせぶりな態度取って……一体誰が本命なのよ〜！」`,cameraPosition:[.4,1.3,.65],cameraTarget:[.65,1.3,-.45],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.45,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.6,lookAtTarget:`girl_02`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.9,lookAtTarget:`girl_02`},girl_02:{motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`,lookAtTarget:`player`}}},{id:`harem_intro_3`,speaker:`シオン`,speakerCharacterId:`girl_04`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_intro_3.wav`),text:`「……はぁ。めんどくさ。私まで巻き込まないでほしいんだけど。……で？ 誰なわけ？」`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_04`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_04`}}},{id:`harem_intro_4`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_intro_4.wav`),text:`「私達3人の中で、あなたの本当の気持ち……教えて？」`,cameraPosition:[0,1.2,1.85],cameraTarget:[0,1.2,-.4],cameraZoom:`wide`,cameraTransitionDuration:.6,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.9,effectText:`doki`,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.7,lookAtTarget:`player`}}},{id:`harem_choice`,speaker:`3人`,dialogueTarget:`player`,location:`教室`,text:`（3人からの視線が突き刺さる……！ 一体誰を選ぶ！？）`,cameraPosition:[0,1.2,1.95],cameraTarget:[0,1.2,-.4],cameraZoom:`wide`,cameraTransitionDuration:.7,cameraPreset:`hold`,choiceDelaySec:.8,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.8,lookAtTarget:`player`,shallowHeadAngle:!1,headWeight:.9},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.9,lookAtTarget:`player`,shallowHeadAngle:!1,headWeight:.9},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:.9,lookAtTarget:`player`,shallowHeadAngle:!1,headWeight:.9}},choices:[{text:`💙 アオイが本命だよ！`,flag:`choice_aoi`,goto:`route_aoi_1`,effectText:`doki`},{text:`💛 エミリが本命だよ！`,flag:`choice_emily`,goto:`route_emily_1`,effectText:`yatta`},{text:`🖤 シオンが本命だよ！`,flag:`choice_shion`,goto:`route_shion_1`,effectText:`kirakira`},{text:`💥 3人とも大好きだーっ！！（選べない）`,flag:`choice_all`,goto:`route_all_1`,effectText:`iraira`}]},{id:`route_aoi_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_aoi_1.wav`),text:`「えっ……！？ ほ、本当に私……！？ 夢じゃないよね……っ！？」`,cameraPosition:[-.4,1.35,.65],cameraTarget:[-.65,1.35,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_01:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`doki`,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,lookAtTarget:`girl_01`}}},{id:`route_aoi_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_aoi_2.wav`),text:`「ちょっとー！ なんでアオイなのよー！ 私のほうが絶対カワイイのにー！」`,cameraPosition:[.4,1.3,.65],cameraTarget:[.65,1.3,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.9,lookAtTarget:`girl_02`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_02`},girl_02:{motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`,lookAtTarget:`player`}}},{id:`route_aoi_3`,speaker:`シオン`,speakerCharacterId:`girl_04`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_aoi_3.wav`),text:`「ふぁ……。あっそ。お熱いことで。じゃ、決まったなら私帰って寝るね。」`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,goto:`harem_ending`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.8,lookAtTarget:`girl_04`},girl_04:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:.8,lookAtTarget:`girl_04`}}},{id:`route_emily_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_emily_1.wav`),text:`「やったーっ！ やっぱり私が一番でしょ♪ 見たかアオイ〜！」`,cameraPosition:[.4,1.3,.65],cameraTarget:[.65,1.3,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,lookAtTarget:`girl_02`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_02`},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`,lookAtTarget:`player`}}},{id:`route_emily_2`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_emily_2.wav`),text:`「うそ……っ！ 私じゃなかったの……！？ もう、バカバカ、知らないっ！」`,cameraPosition:[-.4,1.35,.65],cameraTarget:[-.65,1.35,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.9,lookAtTarget:`girl_01`}}},{id:`route_emily_3`,speaker:`シオン`,speakerCharacterId:`girl_04`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_emily_3.wav`),text:`「……はいはい。お似合いなんじゃない？ 騒がしいカップルの誕生だね。」`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,goto:`harem_ending`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:.8,lookAtTarget:`girl_04`},girl_04:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_02`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.9,lookAtTarget:`girl_04`}}},{id:`route_shion_1`,speaker:`シオン`,speakerCharacterId:`girl_04`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_shion_1.wav`),text:`「……は？ ……え、な、何言ってんの……？ 私なんか選んで……後悔しても知らないから……っ。」`,cameraPosition:[0,1.25,.7],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,lookAtTarget:`girl_04`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`surprised`,expressionWeight:.9,effectText:`doki`,lookAtTarget:`player`,faceTexture:`/textures/girl_face_blush.png`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,lookAtTarget:`girl_04`}}},{id:`route_shion_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`教室`,voiceUrl:z(`/voices/harem_shion_2.wav`),text:`「ええええーっ！？ まさかのシオン！？ なんでよーっ！？」`,cameraPosition:[.4,1.3,.65],cameraTarget:[.65,1.3,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.9,lookAtTarget:`girl_02`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.9,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`,lookAtTarget:`girl_04`}}},{id:`route_shion_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`教室`,voiceUrl:z(`/voices/harem_shion_3.wav`),text:`「し、シオンだったの……？ でも……シオン、すっごく顔真っ赤だよ……？」`,cameraPosition:[-.4,1.35,.65],cameraTarget:[-.65,1.35,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,goto:`harem_ending`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.8,effectText:`doki`,lookAtTarget:`girl_04`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`surprised`,expressionWeight:.9,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.9,lookAtTarget:`girl_04`}}},{id:`route_all_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_all_1.wav`),text:`「はあぁぁ！？ 一番言っちゃいけない最低なセリフ出たー！！」`,cameraPosition:[.4,1.3,.65],cameraTarget:[.65,1.3,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.45,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:1,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`angry`,expressionWeight:.8,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`,lookAtTarget:`player`}}},{id:`route_all_2`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_all_2.wav`),text:`「サイテー……。本当に反省してよね！ もうみんなで絶交だから！」`,cameraPosition:[-.4,1.35,.65],cameraTarget:[-.65,1.35,-.45],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,focusLines:!0,avatars:{girl_01:{motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`angry`,expressionWeight:.9,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:1,lookAtTarget:`player`}}},{id:`route_all_3`,speaker:`シオン`,speakerCharacterId:`girl_04`,dialogueTarget:`player`,location:`教室`,voiceUrl:z(`/voices/harem_all_3.wav`),text:`「……救いようがないね。エナドリ奢ってもらっても……許さないから。」`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,goto:`harem_ending`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:.9,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:.9,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:.9,lookAtTarget:`player`}}},{id:`harem_ending`,speaker:`ナレーション`,dialogueTarget:`player`,location:`教室`,text:`こうして、放課後のドタバタ本命裁判は幕を閉じた……（？） あなたと3人の騒がしい青春はまだまだ続きそうだ。`,cameraPosition:[0,1.2,1.95],cameraTarget:[0,1.2,-.4],cameraZoom:`wide`,cameraTransitionDuration:.8,cameraPreset:`hold`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`player`},girl_04:{motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`player`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`player`}}}]}]};function _r(e=H()){return gr}var vr={id:`town_walk`,title:`放課後の並木道 〜君と歩く帰り道〜`,bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.18,chapters:[{id:`main`,title:`街の散歩道`,scenes:[{id:`walk_1`,speaker:`アオイ`,location:`放課後の並木道`,text:`「放課後、こうして一緒に並んで歩いて帰るの……なんだか久しぶりだね！」`,voiceUrl:`/voices/town_walk_1.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`relax`,expressionWeight:.85,position:[.12,0,-.4],rotationY:-.22,headOffset:[0,-.12]},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`},{id:`walk_2`,speaker:`アオイ`,location:`放課後の並木道`,text:`「この並木道、街並みも綺麗だし、風がふわっと抜けてすごく気持ちいいな〜」`,voiceUrl:`/voices/town_walk_2.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:.9,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!1,headLookAtCamera:!1,headOffset:[0,-.12]},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`},{id:`walk_3`,speaker:`アオイ`,location:`放課後の並木道`,text:`「ねえ、聞いてる？ ……ふふっ、私の横顔ばっかり見て、どうしたの？」`,voiceUrl:`/voices/town_walk_3.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`relax`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,position:[.12,0,-.4],rotationY:-.25,lookAtCamera:!0,headOffset:[0,-.12]},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,choices:[{text:`「アオイが楽しそうだったから、つい見とれてた」`,flag:`admire_her`,goto:`walk_route_admire`,effectText:`doki`},{text:`「この先に新しくできたお店の話を思い出してさ」`,flag:`talk_shop`,goto:`walk_route_shop`,effectText:`kirakira`}]},{id:`walk_route_admire`,speaker:`アオイ`,location:`放課後の並木道`,text:`「も、もう〜！ 急にそういうこと言うんだから……ちょっと照れるじゃん」`,voiceUrl:`/voices/town_walk_admire.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,position:[.12,0,-.4],rotationY:-.22,effectText:`doki`,lookAtCamera:!0,headLookAtCamera:!0,headOffset:[0,-.12]},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,goto:`walk_transition_stop`},{id:`walk_route_shop`,speaker:`アオイ`,location:`放課後の並木道`,text:`「あ、知ってた！？ 私もちょうどその話しようと思ってたんだよね！」`,voiceUrl:`/voices/town_walk_shop.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:.95,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!0,headLookAtCamera:!0,headOffset:[0,-.12],eyeWander:!1},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,goto:`walk_transition_stop`},{id:`walk_transition_stop`,speaker:`アオイ`,location:`街の広場・カフェ前`,text:`「あっ、見て見て！ ほら、あそこの看板……ちょっと止まって！」`,voiceUrl:`/voices/town_walk_stop.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Standing Greeting.fbx`,expression:`relaxed`,expressionWeight:.85,position:[0,0,0],rotationY:0},cameraZoom:`medium`,cameraStartAngle:`front`,cameraDistance:1.25,cameraPreset:`pullOut`,cameraStrength:.6,cameraTransitionDuration:.9,cameraTransitionEasing:`smooth`},{id:`stop_talk_1`,speaker:`アオイ`,location:`街の広場・カフェ前`,text:`「ここだよ！ ねこちゃんの看板のカフェ！ ここのアップルパイ、すっごく評判なんだって〜」`,voiceUrl:`/voices/town_walk_cafe_1.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Excited.fbx`,expression:`relaxed`,expressionWeight:.9,position:[0,0,0],rotationY:0,effectText:`kirakira`},cameraZoom:`medium`,cameraStartAngle:`front`,cameraDistance:1.2,cameraPreset:`orbitLeftHalf`,cameraStrength:.35},{id:`stop_talk_2`,speaker:`アオイ`,location:`街の広場・カフェ前`,text:`「もし急ぎの用事がないなら……ちょっと寄っていかない？ 一緒に食べよ！」`,voiceUrl:`/voices/town_walk_cafe_2.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Acknowledging.fbx`,expression:`relaxed`,expressionWeight:.9,position:[0,0,0],rotationY:0},cameraZoom:`speaker`,cameraStartAngle:`front`,cameraDistance:1.15,cameraPreset:`pushIn`,cameraStrength:.4,choices:[{text:`「いいね、行こう！ 今日は俺がごちそうするよ」`,flag:`choice_treat`,goto:`stop_route_treat`,effectText:`yatta`},{text:`「もちろん！ アオイのおごりなら喜んで！」`,flag:`choice_ask`,goto:`stop_route_ask`,effectText:`doki`}]},{id:`stop_route_treat`,speaker:`アオイ`,location:`街の広場・カフェ前`,text:`「わぁ、本当！？ やったぁ〜！ ありがとう、優しい〜！ じゃあ一番大きいやつ頼んじゃお♪ 行こ！」`,voiceUrl:`/voices/town_walk_treat.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Excited.fbx`,expression:`happy`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,position:[0,0,0],rotationY:0,effectText:`yatta`},cameraZoom:`speaker`,cameraStartAngle:`front`,cameraDistance:1.1,cameraPreset:`punchIn`,cameraStrength:.6,goto:`ending_walk`},{id:`stop_route_ask`,speaker:`アオイ`,location:`街の広場・カフェ前`,conditions:[`choice_ask`],text:`「えーっ！？ なんで私が奢る前提なの〜！？ ……まぁ、半分こならいいけどねっ♪ 行こ！」`,voiceUrl:`/voices/town_walk_ask.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Dismissing Gesture.fbx`,expression:`relaxed`,expressionWeight:.9,position:[0,0,0],rotationY:0,effectText:`doki`},cameraZoom:`speaker`,cameraStartAngle:`front`,cameraDistance:1.1,cameraPreset:`pushIn`,cameraStrength:.5,goto:`ending_walk`},{id:`ending_walk`,speaker:``,location:`街の広場・カフェ前`,text:`―― 爽やかな風が吹き抜ける放課後の並木道。二人は並んでカフェの扉を開けた。 【シナリオ終了】`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Standing Idle.fbx`,expression:`relaxed`,expressionWeight:.8,position:[0,0,0],rotationY:0},cameraZoom:`wide`,cameraStartAngle:`front`,cameraDistance:1.35,cameraPreset:`pullOut`,cameraStrength:.5,cameraTransitionDuration:1,cameraTransitionEasing:`smooth`}]}]},yr={id:`town_walk`,title:`Walking with Aoi on the Avenue`,bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.18,chapters:[{id:`main`,title:`Avenue Walk`,scenes:[{id:`walk_1`,speaker:`Aoi`,location:`Tree-lined Avenue`,text:`"Walking home together side by side like this... it has been quite a while, hasn't it?"`,voiceUrl:`/voices/town_walk_1.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:.85,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!0,headLookAtCamera:!0,headOffset:[0,-.12]},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`},{id:`walk_2`,speaker:`Aoi`,location:`Tree-lined Avenue`,text:`"This avenue has such lovely town scenery, and the gentle breeze feels so refreshing!"`,voiceUrl:`/voices/town_walk_2.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:.9,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!1,headLookAtCamera:!1,headOffset:[0,-.12]},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`},{id:`walk_3`,speaker:`Aoi`,location:`Tree-lined Avenue`,text:`"Hey, are you listening? ...Hehe, why are you staring at my face like that?"`,voiceUrl:`/voices/town_walk_3.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:1,position:[.12,0,-.4],rotationY:-.25,effectText:`doki`,lookAtCamera:!0,headLookAtCamera:!0,headOffset:[0,-.12],eyeWander:!0},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,choices:[{text:`"You looked so cheerful, I couldn't help but admire you."`,flag:`admire_her`,goto:`walk_route_admire`,effectText:`doki`},{text:`"I just remembered that a new cafe opened up ahead."`,flag:`talk_shop`,goto:`walk_route_shop`,effectText:`kirakira`}]},{id:`walk_route_admire`,speaker:`Aoi`,location:`Tree-lined Avenue`,text:`"Come on! Saying something like that out of nowhere... you're making me blush!"`,voiceUrl:`/voices/town_walk_admire.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!0,headLookAtCamera:!0,headOffset:[0,-.12],eyeWander:!0},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,goto:`walk_transition_stop`},{id:`walk_route_shop`,speaker:`Aoi`,location:`Tree-lined Avenue`,text:`"Oh, you knew about it too?! I was just about to bring that up!"`,voiceUrl:`/voices/town_walk_shop.wav`,avatar:{motion:`/animations/Walking.fbx`,expression:`happy`,expressionWeight:.95,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!0,headLookAtCamera:!0,headOffset:[0,-.12],eyeWander:!1},scrollingBackground:{enabled:!0,textureUrl:`/textures/town_far.avif`,speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,goto:`walk_transition_stop`},{id:`walk_transition_stop`,speaker:`Aoi`,location:`Town Square - Before Cafe`,text:`"Look, look! Over there, that cute cat signboard... wait, let's stop here!"`,voiceUrl:`/voices/town_walk_stop.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Standing Greeting.fbx`,expression:`relaxed`,expressionWeight:.85,position:[0,0,0],rotationY:0},cameraZoom:`medium`,cameraStartAngle:`front`,cameraDistance:1.25,cameraPreset:`pullOut`,cameraStrength:.6,cameraTransitionDuration:.9,cameraTransitionEasing:`smooth`},{id:`stop_talk_1`,speaker:`Aoi`,location:`Town Square - Before Cafe`,text:`"Right here! The cafe with the cat signboard! Their apple pie is supposedly super delicious!"`,voiceUrl:`/voices/town_walk_cafe_1.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Excited.fbx`,expression:`relaxed`,expressionWeight:.9,position:[0,0,0],rotationY:0,effectText:`kirakira`},cameraZoom:`medium`,cameraStartAngle:`front`,cameraDistance:1.2,cameraPreset:`orbitLeftHalf`,cameraStrength:.35},{id:`stop_talk_2`,speaker:`Aoi`,location:`Town Square - Before Cafe`,text:`"If you're not in a hurry... want to drop by? Let's eat together!"`,voiceUrl:`/voices/town_walk_cafe_2.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Acknowledging.fbx`,expression:`relaxed`,expressionWeight:.9,position:[0,0,0],rotationY:0},cameraZoom:`speaker`,cameraStartAngle:`front`,cameraDistance:1.15,cameraPreset:`pushIn`,cameraStrength:.4,choices:[{text:`"Sounds great, let's go! My treat today."`,flag:`choice_treat`,goto:`stop_route_treat`,effectText:`yatta`},{text:`"Sure! As long as you're paying, Aoi!"`,flag:`choice_ask`,goto:`stop_route_ask`,effectText:`doki`}]},{id:`stop_route_treat`,speaker:`Aoi`,location:`Town Square - Before Cafe`,text:`"Really?! Yay! Thank you, you're so sweet! I'm ordering the biggest slice! Let's go!"`,voiceUrl:`/voices/town_walk_treat.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Excited.fbx`,expression:`happy`,expressionWeight:1,faceTexture:`/textures/girl_face_blush.png`,position:[0,0,0],rotationY:0,effectText:`yatta`},cameraZoom:`speaker`,cameraStartAngle:`front`,cameraDistance:1.1,cameraPreset:`punchIn`,cameraStrength:.6,goto:`ending_walk`},{id:`stop_route_ask`,speaker:`Aoi`,location:`Town Square - Before Cafe`,conditions:[`choice_ask`],text:`"What?! Why are you assuming I'm treating?! ...Well, I guess going half-and-half is fine! Let's go!"`,voiceUrl:`/voices/town_walk_ask.wav`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Dismissing Gesture.fbx`,expression:`relaxed`,expressionWeight:.9,position:[0,0,0],rotationY:0,effectText:`doki`},cameraZoom:`speaker`,cameraStartAngle:`front`,cameraDistance:1.1,cameraPreset:`pushIn`,cameraStrength:.5,goto:`ending_walk`},{id:`ending_walk`,speaker:``,location:`Town Square - Before Cafe`,text:`--- Under the gentle breeze of the after-school avenue, the two opened the cafe door side by side. [Scenario End]`,background:`/textures/town_far.avif`,avatar:{motion:`/animations/Standing Idle.fbx`,expression:`relaxed`,expressionWeight:.8,position:[0,0,0],rotationY:0},cameraZoom:`wide`,cameraStartAngle:`front`,cameraDistance:1.35,cameraPreset:`pullOut`,cameraStrength:.5,cameraTransitionDuration:1,cameraTransitionEasing:`smooth`}]}]};function br(e=H()){return e===`en`?yr:vr}var xr={id:`behind_you_emily`,title:`噂話は背後にご注意〜教室の秘密〜`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:[0,0,-1.3],rotationY:0},{id:`girl_02`,character:z(`/models/emili/emili.vrm`),position:[0,0,1.3],rotationY:Math.PI}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.25,panoramaBackgroundUrl:z(`/textures/class_room_3d.avif`),chapters:[{id:`main`,title:`背後のエミリ`,scenes:[{id:`scene_0_prologue`,speaker:`あなた`,location:`放課後の教室`,scenePreset:`morning_school`,panoramaBackgroundUrl:z(`/textures/class_room_3d.avif`),text:`（放課後、誰もいない教室でぼーっと窓の外を眺めていると……）`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`normal`,expressionWeight:1},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:.5}},cameraTarget:[1.8,1.15,0],cameraTransitionEasing:`cut`,cameraPreset:`hold`,autoNextSec:2.5},{id:`scene_1_intro`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,scenePreset:`morning_school`,panoramaBackgroundUrl:z(`/textures/class_room_3d.avif`),text:`「ねえねえ、ちょっとここだけの内緒話なんだけど……聞いてくれる？」`,voiceUrl:z(`/voices/behind_intro_1.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`normal`,expressionWeight:1},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:.5}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1.2,cameraPreset:`hold`},{id:`scene_2_gossip`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,text:`「実はね、エミリちゃん……普段はあんなにツンツンしてるのに、家ではめちゃくちゃ可愛いピンクのぬいぐるみに囲まれて寝てるらしいの！」`,voiceUrl:z(`/voices/behind_gossip_2.wav`),avatars:{girl_01:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`},{id:`scene_3_deep_secret`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,text:`「しかも毎日『くまちゃん、今日も大好きだよ〜♡』ってぎゅーって抱きしめてるんだって！ ふふっ、エミリちゃんがここにいなくて本当に良かった〜！」`,voiceUrl:z(`/voices/behind_secret_3.wav`),avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`happy`,expressionWeight:1},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`},{id:`scene_4_behind_voice`,speaker:`？？？ (背後から)`,speakerCharacterId:`girl_02`,cameraTargetCharacterId:`girl_01`,location:`放課後の教室`,text:`「……へぇ？ 私のくまちゃんの話、随分と盛り上がってるみたいじゃない……？」`,voiceUrl:z(`/voices/behind_emily_4.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,effectText:{preset:`biku`,text:`ビクッ！！！`,duration:2.5}},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`,expressionWeight:.9,effectText:`iraira`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,cameraPreset:`hold`},{id:`scene_5_aoi_panic`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,text:`「ひ、ひぃぃぃっ！？ う、後ろ……！ あなたの真後ろにエミリちゃんが立ってる……！！」`,voiceUrl:z(`/voices/behind_panic_5.wav`),avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`sad`,expressionWeight:1,effectText:{preset:`gaan`,text:`ガーン！`,duration:3}},girl_02:{motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:1}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,cameraPreset:`hold`},{id:`scene_6_turn_around`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`放課後の教室`,text:`「私のいない場所で、一体何を話してたのかなぁ……？ じっくり聞かせてもらおうじゃない」`,voiceUrl:z(`/voices/behind_turn_6.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`sad`,expressionWeight:.8},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`,expressionWeight:.9,effectText:{preset:`iraira`,text:`じとーーーーー (怒)`,duration:3.5}}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1.4,cameraPreset:`hold`},{id:`scene_7_choice`,speaker:`あなた (選択肢)`,speakerCharacterId:`girl_02`,cameraZoom:`speaker`,location:`放課後の教室`,text:`（どうやってこのピンチを切り抜けよう……！？）`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`sad`},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`}},choices:[{text:`✨「エミリの可愛さを熱弁してたんだよ！」`,goto:`route_praise`,effectText:`kirakira`},{text:`👉「アオイが全部言いました！！」`,goto:`route_blame`,effectText:`wanawana`},{text:`🙇「ひぃっ！ ごめんなさい！！」`,goto:`route_apology`,effectText:`doki`}]},{id:`route_praise`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`放課後の教室`,text:`「な、なによそれ……！ か、可愛いだなんて、そんなこと言って誤魔化そうとしても無駄なんだからねっ///」`,voiceUrl:z(`/voices/behind_praise.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.7},girl_02:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:.9,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`doki`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`route_praise_2`},{id:`route_praise_2`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,text:`「ふふっ、エミリちゃん顔真っ赤だよ〜！ すっごく可愛い〜♪」`,voiceUrl:z(`/voices/behind_praise_2.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:.6,faceTexture:z(`/textures/girl_face_blush.png`)}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`,goto:`scene_ending`},{id:`route_blame`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,text:`「えええっ！？ ちょっと、自分だけ助かろうとするなんてひどいよ〜〜！！」`,voiceUrl:z(`/voices/behind_blame_1.wav`),avatars:{girl_01:{motion:z(`/animations/Angry.fbx`),expression:`sad`,expressionWeight:1,effectText:`wanawana`},girl_02:{motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:.8}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`,goto:`route_blame_2`},{id:`route_blame_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`放課後の教室`,text:`「ふふっ、醜い責任の擦り付け合いね……！ 二人まとめてお仕置き決定♪」`,voiceUrl:z(`/voices/behind_blame_2.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`sad`},girl_02:{motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`hold`,goto:`scene_ending`},{id:`route_apology`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`放課後の教室`,text:`「……まったく。素直に謝ったから今回は許してあげる。でも次くまちゃんの話をしたら、本当に怒るからね！」`,voiceUrl:z(`/voices/behind_apology.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.6},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`neutral`,expressionWeight:.7,effectText:`shiin`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`hold`,goto:`route_apology_2`},{id:`route_apology_2`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,text:`「ふぅ〜〜よかったぁ……！ 許してもらえて命拾いしたね！」`,voiceUrl:z(`/voices/behind_apology_2.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.8,effectText:`doki`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`,goto:`scene_ending`},{id:`scene_ending`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`放課後の教室`,text:`「さ、放課後なんだから三人で駅前カフェ行くわよ！ 二人とも、私の奢りなんだから感謝しなさいよね！」`,voiceUrl:z(`/voices/behind_ending.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`hold`,goto:`scene_ending_aoi`},{id:`scene_ending_aoi`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`放課後の教室`,text:`「ふふっ、エミリちゃん本当にスイーツ大好きだよね。写真いっぱい撮っちゃお♪ カフェ行こ行こー！」`,voiceUrl:z(`/voices/behind_ending_aoi.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:.9}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`}]}]},Sr={id:`behind_you_emily`,title:`Watch Your Back: Secrets in the Classroom`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:[0,0,-1],rotationY:0},{id:`girl_02`,character:z(`/models/emili/emili.vrm`),position:[0,0,1],rotationY:Math.PI}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.25,panoramaBackgroundUrl:z(`/textures/class_room_3d.avif`),chapters:[{id:`main`,title:`Emily Behind You`,scenes:[{id:`scene_0_prologue`,speaker:`You`,location:`Classroom After School`,scenePreset:`morning_school`,panoramaBackgroundUrl:z(`/textures/class_room_3d.avif`),text:`(After school, gazing blankly out the classroom window...)`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.7},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:.5}},cameraTarget:[1.8,1.15,0],cameraTransitionEasing:`cut`,cameraPreset:`hold`,autoNextSec:2.5},{id:`scene_1_intro`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,scenePreset:`morning_school`,panoramaBackgroundUrl:z(`/textures/class_room_3d.avif`),text:`"Hey, can you keep a secret just between us...?"`,voiceUrl:z(`/voices/behind_intro_1.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.7,effectText:`doki`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:.5}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1.2,cameraPreset:`hold`},{id:`scene_2_gossip`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,text:`"The truth is, even though Emily is always acting so tsundere... she sleeps surrounded by cute pink plushies at home!"`,voiceUrl:z(`/voices/behind_gossip_2.wav`),avatars:{girl_01:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:.8,effectText:`kirakira`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`},{id:`scene_3_deep_secret`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,text:`"And she literally hugs her teddy bear saying 'I love you so much today too, Teddy♡' every day! Ahaha, I'm so glad Emily isn't here right now~!"`,voiceUrl:z(`/voices/behind_secret_3.wav`),avatars:{girl_01:{motion:z(`/animations/Acknowledging.fbx`),expression:`happy`,expressionWeight:.9,effectText:`wanawana`},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`,expressionWeight:.6}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`},{id:`scene_4_behind_voice`,speaker:`??? (From Behind)`,speakerCharacterId:`girl_02`,cameraTargetCharacterId:`girl_01`,location:`Classroom After School`,text:`"...Oh really? Sounds like you two are having quite a thrilling conversation about my teddy bear...?"`,voiceUrl:z(`/voices/behind_emily_4.wav`),avatars:{girl_01:{motion:z(`/animations/Angry.fbx`),expression:`surprised`,expressionWeight:1,effectText:{preset:`biku`,text:`Eeeek!`,duration:2.5}},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`,expressionWeight:.9,effectText:`iraira`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,cameraPreset:`hold`},{id:`scene_5_aoi_panic`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,text:`"E-Eeeek!? B-Behind you...! Emily is standing right behind you...!!" `,voiceUrl:z(`/voices/behind_panic_5.wav`),avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`sad`,expressionWeight:1,effectText:{preset:`gaan`,text:`OMG!`,duration:3}},girl_02:{motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:1}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5},{id:`scene_6_turn_around`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Classroom After School`,text:`"What were you two gossiping about behind my back, huh? Why don't you tell me all the details?"`,voiceUrl:z(`/voices/behind_turn_6.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`sad`,expressionWeight:.8},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`,expressionWeight:.9,effectText:{preset:`iraira`,text:`Glare...`,duration:3.5}}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1.4,cameraPreset:`hold`},{id:`scene_7_choice`,speaker:`You (Choice)`,speakerCharacterId:`girl_02`,cameraZoom:`speaker`,location:`Classroom After School`,text:`(How do I get out of this alive...!?)`,avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`sad`},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`angry`}},choices:[{text:`✨ "I was just praising how adorable you are!"`,goto:`route_praise`,effectText:`kirakira`},{text:`👉 "Aoi said everything, not me!!"`,goto:`route_blame`,effectText:`wanawana`},{text:`🙇 "Eeeep! I'm so sorry!!" `,goto:`route_apology`,effectText:`doki`}]},{id:`route_praise`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Classroom After School`,text:`"W-What are you saying...?! C-Calling me cute won't save you, okay...?!///"`,voiceUrl:z(`/voices/behind_praise.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.7},girl_02:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:.9,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`doki`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`hold`,goto:`route_praise_2`},{id:`route_praise_2`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,text:`"Hehe, Emily's face is completely red! She's so adorable~♪"`,voiceUrl:z(`/voices/behind_praise_2.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:.6,faceTexture:z(`/textures/girl_face_blush.png`)}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`,goto:`scene_ending`},{id:`route_blame`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,text:`"Whaaat?! How could you betray me just to save yourself?!"`,voiceUrl:z(`/voices/behind_blame_1.wav`),avatars:{girl_01:{motion:z(`/animations/Angry.fbx`),expression:`sad`,expressionWeight:1,effectText:`wanawana`},girl_02:{motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:.8}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`,goto:`route_blame_2`},{id:`route_blame_2`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Classroom After School`,text:`"Hehe, throwing each other under the bus, are we? You're both getting punished together♪"`,voiceUrl:z(`/voices/behind_blame_2.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`sad`},girl_02:{motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:1,effectText:`iraira`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`hold`,goto:`scene_ending`},{id:`route_apology`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Classroom After School`,text:`"...Good grief. Since you apologized honestly, I'll let you off this once. But mention my teddy bear again and you'll regret it!"`,voiceUrl:z(`/voices/behind_apology.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.6},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`neutral`,expressionWeight:.7,effectText:`shiin`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`hold`,goto:`route_apology_2`},{id:`route_apology_2`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,text:`"Phew~~ What a relief...! We barely survived that one!"`,voiceUrl:z(`/voices/behind_apology_2.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.8,effectText:`doki`},girl_02:{motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`,goto:`scene_ending`},{id:`scene_ending`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Classroom After School`,text:`"Alright, school's over so the three of us are heading to the station cafe! And of course, it's on you two♪"`,voiceUrl:z(`/voices/behind_ending.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`hold`,goto:`scene_ending_aoi`},{id:`scene_ending_aoi`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Classroom After School`,text:`"Yay! Going to the cafe together with Emily! Let's go, let's go~♪"`,voiceUrl:z(`/voices/behind_ending_aoi.wav`),avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`},girl_02:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:.9}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`}]}]};function Cr(e=H()){return e===`ja`?xr:Sr}var wr={id:`nisa_all_country`,title:`夕暮れの校門とオルカンの憂鬱`,bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.35,seUrl:`/se/large_brown_cicada.mp3`,seVolume:.15,chapters:[{id:`main`,title:`放課後の投資相談`,scenes:[{id:`intro_1`,speaker:`葵`,location:`放課後・夕暮れの校門`,scenePreset:`evening_school`,text:`「あ、来てくれたんだ……！ 放課後に校門の前で待っててなんて言って、急にごめんね。」`,voiceUrl:`/voices/nisa_01.wav`,avatar:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.8},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`pushIn`,cameraStrength:.4},{id:`intro_2`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「あのね……ずっと一人で悩んでて、誰にも言えなかったんだけど……あなたにだけは、正直に相談したくて……。」`,voiceUrl:`/voices/nisa_02.wav`,avatar:{expression:`sorrow`,expressionWeight:.7,effectText:`doki`},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`hold`},{id:`intro_3`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「私ね……今年から新NISA、始めたんだ……。」`,voiceUrl:`/voices/nisa_03.wav`,avatar:{motion:`/animations/Acknowledging.fbx`,expression:`happy`,expressionWeight:.9,effectText:`doki`},cameraZoom:`speaker`,cameraPreset:`hold`},{id:`intro_4`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「ネットのみんなはさ、『思考停止でオルカン一本買っとけば20年後には勝てる』って言うでしょ……？」`,voiceUrl:`/voices/nisa_04.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`angry`,expressionWeight:.8},cameraZoom:`speaker`,cameraPreset:`hold`},{id:`intro_5`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「でも……もしこれから世界的な大恐慌が来たらどうするの……っ！？ 人口動態とか地政学リスクとか……本当に全世界株式一本で大丈夫なの……っ！？」`,voiceUrl:`/voices/nisa_05.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`sorrow`,expressionWeight:1,tears:!0,tearConfig:{side:`both`,speed:.45,glowIntensity:2,trailLength:1,loop:!1}},cameraZoom:`speaker`,cameraPreset:`pushIn`,cameraStrength:.5,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6},{id:`intro_6`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「私……毎月の積立日になるたびに胃が痛くて……っ。ねえ、私どうしたらいいと思う……？」`,voiceUrl:`/voices/nisa_06.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`sorrow`,expressionWeight:.9,tears:!0},cameraZoom:`speaker`,cameraPreset:`hold`,choices:[{text:`「世界の成長を信じて気絶ホールド一択だよ」`,flag:`choice_hold`,goto:`route_hold_1`,effectText:`kirakira`},{text:`「不安なら少し現金比率を高めようか」`,flag:`choice_cash`,goto:`route_cash_1`,effectText:`doki`},{text:`「全財産をレバナスにぶち込めば悩みも消えるよ」`,flag:`choice_reva`,goto:`route_reva_1`,effectText:`biku`}]},{id:`route_hold_1`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「気絶ホールド……！ そっか、アプリを消して20年間寝てればいいんだね……！ なんだか少し心が軽くなったかも……ありがとう……！」`,voiceUrl:`/voices/nisa_hold_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.85,tears:!0,effectText:`yatta`},cameraZoom:`speaker`,cameraPreset:`hold`,goto:`epilogue_1`},{id:`route_cash_1`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「現金比率……！ そうだよね、無リスク資産でリスク許容度を整えるのが基本だった……！ 冷静になれたよ、ありがとう……！」`,voiceUrl:`/voices/nisa_cash_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.8,tears:!0,effectText:`kirakira`},cameraZoom:`speaker`,cameraPreset:`hold`,goto:`epilogue_1`},{id:`route_reva_1`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「えっ、全財産レバナス……！？ それ、不安どころか破滅に向かってない……！？ もう、バカぁ……っ！」`,voiceUrl:`/voices/nisa_reva_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`angry`,expressionWeight:.85,tears:!0,effectText:`iraira`},cameraZoom:`speaker`,cameraPreset:`hold`,goto:`epilogue_1`},{id:`epilogue_1`,speaker:`葵`,location:`放課後・夕暮れの校門`,text:`「ふふっ、あなたに相談してよかった。……じゃあ、一緒にアイスでも食べて帰ろ？ 私のNISA口座から出すわけにはいかないから、割り勘ね！」`,voiceUrl:`/voices/nisa_epilogue_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:1,tears:!0,effectText:`kirakira`},cameraZoom:`speaker`,cameraPreset:`hold`}]}]},Tr={id:`nisa_all_country`,title:`Sunset at School Gate: The All-Country ETF Anxiety`,bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.35,seUrl:`/se/large_brown_cicada.mp3`,seVolume:.15,chapters:[{id:`main`,title:`Afterschool Investment Consultation`,scenes:[{id:`intro_1`,speaker:`Aoi`,location:`School Gate at Sunset`,scenePreset:`evening_school`,text:`"Ah, you came...! Sorry for asking you out to the school gate after class out of nowhere."`,voiceUrl:`/voices/nisa_01.wav`,avatar:{motion:`/animations/Standing Greeting.fbx`,expression:`neutral`,expressionWeight:.8},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8,cameraPreset:`pushIn`,cameraStrength:.4},{id:`intro_2`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"The truth is... I've been agonizing over this alone, but you're the only one I can truly confide in..."`,voiceUrl:`/voices/nisa_02.wav`,avatar:{motion:`/animations/Female Standing Pose.fbx`,expression:`sorrow`,expressionWeight:.7,effectText:`doki`},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6,cameraPreset:`hold`},{id:`intro_3`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"I... I opened a new NISA account and started investing this year..."`,voiceUrl:`/voices/nisa_03.wav`,avatar:{motion:`/animations/Acknowledging.fbx`,expression:`neutral`,expressionWeight:.9,effectText:`wanawana`},cameraZoom:`speaker`,cameraPreset:`hold`},{id:`intro_4`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"Everyone online says, 'Just buy All-Country index and sleep for 20 years and you win', right...?"`,voiceUrl:`/voices/nisa_04.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`neutral`,expressionWeight:.8},cameraZoom:`speaker`,cameraPreset:`hold`},{id:`intro_5`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"But... what if the whole world economy enters a Great Depression...?! What about demographics and geopolitical risks... Is All-Country really foolproof...?!`,voiceUrl:`/voices/nisa_05.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`sorrow`,expressionWeight:1,tears:!0,tearConfig:{side:`both`,speed:.45,glowIntensity:2,trailLength:1,loop:!1},effectText:`gaan`},cameraZoom:`speaker`,cameraPreset:`pushIn`,cameraStrength:.5,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6},{id:`intro_6`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"My stomach hurts every month when auto-invest triggers...! What do you think I should do...?"`,voiceUrl:`/voices/nisa_06.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`sorrow`,expressionWeight:.9,tears:!0},cameraZoom:`speaker`,cameraPreset:`hold`,choices:[{text:`"Trust global growth and knock yourself out holding."`,flag:`choice_hold`,goto:`route_hold_1`,effectText:`kirakira`},{text:`"If you're worried, just raise your cash ratio."`,flag:`choice_cash`,goto:`route_cash_1`,effectText:`doki`},{text:`"Dump all your life savings into Leveraged NASDAQ."`,flag:`choice_reva`,goto:`route_reva_1`,effectText:`biku`}]},{id:`route_hold_1`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"Knock myself out holding...! You're right, just delete the app and hibernate for 20 years...! I feel so much lighter... Thank you...!"`,voiceUrl:`/voices/nisa_hold_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.85,tears:!0,effectText:`yatta`},cameraZoom:`speaker`,cameraPreset:`hold`,goto:`epilogue_1`},{id:`route_cash_1`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"Cash ratio...! That's true, keeping risk-free assets to balance risk tolerance is the golden rule...! I feel calm now, thank you...!"`,voiceUrl:`/voices/nisa_cash_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:.8,tears:!0,effectText:`kirakira`},cameraZoom:`speaker`,cameraPreset:`hold`,goto:`epilogue_1`},{id:`route_reva_1`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"Wait, 100% Leveraged NASDAQ...?! That's not solving anxiety, that's a speedrun to financial ruin...! Dummy...!"`,voiceUrl:`/voices/nisa_reva_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`angry`,expressionWeight:.85,tears:!0,effectText:`iraira`},cameraZoom:`speaker`,cameraPreset:`hold`,goto:`epilogue_1`},{id:`epilogue_1`,speaker:`Aoi`,location:`School Gate at Sunset`,text:`"Hehe, I'm so glad I talked to you. Let's get some ice cream on the way home! We're splitting the bill though, can't touch my NISA funds!"`,voiceUrl:`/voices/nisa_epilogue_01.wav`,avatar:{motion:`/animations/Idle.fbx`,expression:`happy`,expressionWeight:1,tears:!0,effectText:`kirakira`},cameraZoom:`speaker`,cameraPreset:`hold`}]}]};function Er(e=H()){return e===`en`?Tr:wr}var Dr={id:`fast_motion_action`,title:`疾風怒濤！高速アクション特訓`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:`left`},{id:`girl_02`,character:z(`/models/emili/emili.vrm`),position:`right`}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.28,chapters:[{id:`main`,title:`アニメ作画風モーションエフェクト検証`,scenes:[{id:`motion_intro`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`放課後の校門前`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_01_aoi.wav`),text:`「エミリちゃん！アニメの格闘シーンみたいに、腕を高速で動かしたときのスピード線や残像エフェクトを試してみようよ！」`,avatars:{girl_01:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`happy`,expressionWeight:.8},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`neutral`,expressionWeight:.5}},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.9},{id:`motion_waving`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`放課後の校門前`,scenePreset:`day_school`,motionBlur:!0,voiceUrl:z(`/voices/fastmotion_02_aoi.wav`),text:`「まずは高速手振り！ブンブン振ると、手首や肘の軌道に沿ってスピード線と残像がシュババッと走るよ！」`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),motionSpeed:2,expression:`happy`,expressionWeight:1,effectText:`kirakira`},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.6}},cameraZoom:`medium`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.7},{id:`motion_emily_ready`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`放課後の校門前`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_03_emily.wav`),text:`「ふふっ、甘いわねアオイ。スピード線の本気を見たいなら、私の鋭いストレートパンチを見てなさい！」`,avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`neutral`,expressionWeight:.5},girl_02:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.8}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8},{id:`motion_emily_punch`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`camera`,location:`放課後の校門前`,scenePreset:`day_school`,motionBlur:!0,voiceUrl:z(`/voices/fastmotion_04_emily.wav`),text:`「せいっ！やあっ！――腕の軌跡に沿うスピード線、背後に残る残像、そして逆方向に伸びるぼかしアウトライン！」`,avatars:{girl_01:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`surprised`,expressionWeight:1,effectText:`biku`},girl_02:{motion:z(`/animations/Punching.fbx`),motionSpeed:1.4,expression:`angry`,expressionWeight:.8}},cameraZoom:`medium`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6},{id:`motion_praise`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`放課後の校門前`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_05_aoi.wav`),text:`「すごーい！全身のモーションブラーじゃなくて、動いた腕の周辺だけにピタッと追従して超カッコいい作画になってる！」`,avatars:{girl_01:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`},girl_02:{motion:z(`/animations/Salute.fbx`),expression:`happy`,expressionWeight:.7}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1},{id:`motion_outro`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`camera`,location:`放課後の校門前`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_06_emily.wav`),text:`「腕も脚も、一定以上の速度で振り抜いた瞬間だけ自動発生するわ。これぞアニメ作画の真骨頂ね！」`,avatars:{girl_01:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`happy`,expressionWeight:.9},girl_02:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.8}},cameraZoom:`medium`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8}]}]},Or={id:`fast_motion_action`,title:`Fast Action Motion Effects Showcase`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:`left`},{id:`girl_02`,character:z(`/models/emili/emili.vrm`),position:`right`}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.28,chapters:[{id:`main`,title:`Anime Fast Motion Effects Test`,scenes:[{id:`motion_intro`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`School Gate after School`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_01_aoi.wav`),text:`"Emily! Let's test out anime-style speed lines and afterimage effects when moving arms at high speed!"`,avatars:{girl_01:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`happy`,expressionWeight:.8},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`neutral`,expressionWeight:.5}},cameraZoom:`speaker`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.9},{id:`motion_waving`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`School Gate after School`,scenePreset:`day_school`,motionBlur:!0,voiceUrl:z(`/voices/fastmotion_02_aoi.wav`),text:`"First, rapid hand waving! Speed lines and afterimages instantly emerge along the wrist trajectory!"`,avatars:{girl_01:{motion:z(`/animations/Standing Greeting.fbx`),motionSpeed:2,expression:`happy`,expressionWeight:1,effectText:`kirakira`},girl_02:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.6}},cameraZoom:`medium`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.7},{id:`motion_emily_ready`,speaker:`Emily`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`School Gate after School`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_03_emily.wav`),text:`"Hehe, not bad Aoi! But if you want to see true action velocity, watch my rapid punches!"`,avatars:{girl_01:{motion:z(`/animations/Dismissing Gesture.fbx`),expression:`neutral`,expressionWeight:.5},girl_02:{motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.8}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8},{id:`motion_emily_punch`,speaker:`Emily`,speakerCharacterId:`girl_02`,dialogueTarget:`camera`,location:`School Gate after School`,scenePreset:`day_school`,motionBlur:!0,voiceUrl:z(`/voices/fastmotion_04_emily.wav`),text:`"Take that! Sharp tapered speed lines, ghost afterimages behind the arm, and directional trailing blur outline!"`,avatars:{girl_01:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`surprised`,expressionWeight:1,effectText:`biku`},girl_02:{motion:z(`/animations/Punching.fbx`),motionSpeed:1.4,expression:`angry`,expressionWeight:.8}},cameraZoom:`medium`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.6},{id:`motion_praise`,speaker:`Aoi`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`School Gate after School`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_05_aoi.wav`),text:`"Incredible! Instead of whole-screen blur, it perfectly pinpoints the moving arms and looks like hand-drawn anime sakuga!"`,avatars:{girl_01:{motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`},girl_02:{motion:z(`/animations/Salute.fbx`),expression:`happy`,expressionWeight:.7}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1},{id:`motion_outro`,speaker:`Emily`,speakerCharacterId:`girl_02`,dialogueTarget:`camera`,location:`School Gate after School`,scenePreset:`day_school`,voiceUrl:z(`/voices/fastmotion_06_emily.wav`),text:`"Both arms and legs trigger dynamically whenever swinging past threshold speeds. Anime motion at its finest!"`,avatars:{girl_01:{motion:z(`/animations/Female Standing Pose.fbx`),expression:`happy`,expressionWeight:.9},girl_02:{motion:z(`/animations/Acknowledging.fbx`),expression:`relaxed`,expressionWeight:.8}},cameraZoom:`medium`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8}]}]};function kr(e){return(e??H())===`en`?Or:Dr}var Ar={id:`door_peep_yandere`,title:`🚪 覗き穴の訪問者〜深夜のヤンデレ〜`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:[0,-100,0],rotationY:0}],bgmUrl:z(`/bgm/Waiting_Beneath_the_Boards.mp3`),bgmVolume:.2,chapters:[{id:`main`,title:`ドアスコープの向こう側`,scenes:[{id:`scene_0_midnight`,speaker:`あなた`,location:`自室 (深夜2:00)`,scenePreset:`dark_indoor`,background:z(`/textures/myroom_far.avif`),cameraZoom:`wide`,cameraPosition:[0,1.25,2.8],cameraTarget:[0,1.25,0],text:`深夜2時。部屋の明かりを落とし、ベッドに入ろうとしていたその時だった。`,fisheye:!1,avatars:{girl_01:{visible:!1,position:[0,0,0]}},autoNextSec:3.5},{id:`scene_1_chime`,speaker:`あなた`,location:`自室 (深夜2:00)`,scenePreset:`dark_indoor`,background:z(`/textures/myroom_far.avif`),cameraZoom:`wide`,cameraPosition:[0,1.25,2.8],cameraTarget:[0,1.25,0],seUrl:z(`/se/door_chime.mp3`),seVolume:.85,seLoop:!1,text:`（ピンポーン……ピンポーン……）
不意に、静まり返った部屋にインターホンの呼び鈴が響き渡った。
こんな真夜中に、一体誰だ……？`,fisheye:!1,avatars:{girl_01:{visible:!1,position:[0,0,0]}},autoNextSec:4},{id:`scene_2_approach_door`,speaker:`あなた`,location:`玄関前`,scenePreset:`dark_indoor`,background:z(`/textures/myroom_far.avif`),cameraZoom:`wide`,cameraPosition:[0,1.25,2.8],cameraTarget:[0,1.25,0],text:`足音を忍ばせて玄関へと向かう。モニター画面のボタンを押すが、真っ暗で何も映らない。
……仕方なく、ドアの丸い覗き穴（ドアスコープ）にそっと目を当てた。`,fisheye:!1,avatars:{girl_01:{visible:!1,position:[0,0,0]}}},{id:`scene_3_peep_start`,speaker:`あなた`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,background:z(`/textures/apartment_door_far.avif`),seUrl:z(`/se/piano_note.mp3`),seVolume:.85,seLoop:!1,text:`丸く歪んだ魚眼レンズの向こう側……外廊下の薄暗い照明の下に、制服姿の彼女がうつむいて立ち尽くしている。`,fisheye:{enabled:!0,strength:.75,zoom:.95,circular:!0},cameraTarget:[0,1.3,0],cameraDistance:1,avatars:{girl_01:{visible:!0,position:[0,0,-1.6],motion:z(`/animations/Standing Idle.fbx`),expression:`sad`,headOffset:[0,-.25],lookAtCamera:!1,headLookAtCamera:!1}}},{id:`scene_4_head_up`,speaker:`あなた`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,text:`不意に、彼女がギチ……ギチ……と首を傾げながら、ゆっくりと顔を上げた。`,fisheye:{enabled:!0,strength:.85,zoom:.95,circular:!0},avatars:{girl_01:{position:[0,0,-1.6],motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.16},lookAtCamera:!0,headLookAtCamera:!0}}},{id:`scene_5_eye_contact`,speaker:`あなた`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,text:`ヒッ……！？
まるでこちらが覗いていることが分かっているかのように、光の消えた真っ黒な瞳が正確にレンズを射抜いてくる。`,fisheye:{enabled:!0,strength:.9,zoom:.95,circular:!0},avatars:{girl_01:{position:[0,0,-1.6],expression:`neutral`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.2},lookAtCamera:!0}}},{id:`scene_6_voice_whisper`,speaker:`少女`,speakerCharacterId:`girl_01`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_whisper.wav`),text:`「……ねえ。中にいるんでしょ……？ 息の音、ちゃんと聞こえてるよ……？」`,fisheye:{enabled:!0,strength:.95,zoom:.95,circular:!0},avatars:{girl_01:{position:[0,0,-1.6],expression:`happy`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.22},lookAtCamera:!0}}},{id:`scene_7_step_closer`,speaker:`少女`,speakerCharacterId:`girl_01`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_closer.wav`),text:`「メッセージ……なんで既読スルーするの？ 電話も拒否したよね……？ だからね、直接会いに来ちゃった♡」`,fisheye:{enabled:!0,strength:1.05,zoom:1,circular:!0},avatars:{girl_01:{motion:z(`/animations/Walking.fbx`),motionDuration:1,nextMotion:z(`/animations/Standing Idle.fbx`),moveTo:{target:[0,0,-.65],duration:1},expression:`happy`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.18},lookAtCamera:!0}}},{id:`scene_8_panic_face`,speaker:`少女`,speakerCharacterId:`girl_01`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_scream.wav`),seUrl:z(`/se/door_knock.mp3`),seVolume:.9,seLoop:!1,text:`「ねえ、開けてよ……！ 開けて開けて開けて開けて開けて開けて開けてッ！！」`,fisheye:{enabled:!0,strength:1.25,zoom:1,circular:!0},cameraTarget:[0,1.3,0],cameraDistance:.55,avatars:{girl_01:{position:[0,0,-.28],motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.25},lookAtCamera:!0,effectText:`wanawana`}}},{id:`scene_9_choice`,speaker:`あなた`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,seUrl:z(`/se/door_knock.mp3`),seVolume:.75,seLoop:!1,text:`ガラス越しに鼻先が触れるほどの距離で、彼女がドアをガンガンと叩きながら狂ったように叫んでいる……！ どうする……！？`,fisheye:{enabled:!0,strength:1.25,zoom:1,circular:!0},avatars:{girl_01:{position:[0,0,-.28],expression:`angry`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.25},lookAtCamera:!0}},choices:[{text:`🔑 ドアの鍵を開ける`,goto:`scene_open_door`,effectText:`doki`},{text:`🤫 息を殺して居留守を決め込む`,goto:`scene_stay_silent`,effectText:`biku`}]},{id:`scene_open_door`,speaker:`少女`,speakerCharacterId:`girl_01`,location:`玄関口`,scenePreset:`dark_indoor`,background:z(`/textures/apartment_door_far.avif`),voiceUrl:z(`/voices/doorpeep_opendoor.wav`),text:`ガチャリ……と鍵を開けると、ドアが勢いよく開け放たれた。
「……ふふっ、やっと開けてくれた♡ もう絶対に離さないから……ずーっと、一生一緒だよ？」`,fisheye:!1,cameraZoom:`speaker_close`,avatars:{girl_01:{position:[0,0,-.7],motion:z(`/animations/Excited.fbx`),expression:`happy`,yandere:{hideHighlights:!0,tiltHead:!0,tiltAngle:-.15},lookAtCamera:!0,effectText:`kirakira`}}},{id:`scene_stay_silent`,speaker:`少女`,speakerCharacterId:`girl_01`,location:`ドアスコープ越し (アパート前)`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_silent.wav`),seUrl:z(`/se/door_rattle.mp3`),seVolume:.95,seLoop:!1,text:`ガチャガチャガチャガチャッ！！ ドアノブが狂乱の勢いで激しく回される！
「嘘つき……そこに立ってるの、見えてるんだからね……絶対に逃がさないんだからッ……！！」`,fisheye:{enabled:!0,strength:1.35,zoom:1,circular:!0},avatars:{girl_01:{position:[0,0,-.26],expression:`angry`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.28},lookAtCamera:!0,effectText:`wanawana`}}}]}]},jr={id:`door_peep_yandere`,title:`🚪 The Peep-hole Visitor: Midnight Yandere`,characters:[{id:`girl_01`,character:z(`/models/aoi/aoi-school.vrm`),position:[0,-100,0],rotationY:0}],bgmUrl:z(`/bgm/Waiting_Beneath_the_Boards.mp3`),bgmVolume:.2,chapters:[{id:`main`,title:`Through the Peep-hole`,scenes:[{id:`scene_0_midnight`,speaker:`You`,location:`My Room (2:00 AM)`,scenePreset:`dark_indoor`,background:z(`/textures/myroom_far.avif`),cameraZoom:`wide`,cameraPosition:[0,1.25,2.8],cameraTarget:[0,1.25,0],text:`2:00 AM. Just as I turned off the lights in my room and was about to climb into bed...`,fisheye:!1,avatars:{girl_01:{visible:!1,position:[0,0,0]}},autoNextSec:3.5},{id:`scene_1_chime`,speaker:`You`,location:`My Room (2:00 AM)`,scenePreset:`dark_indoor`,background:z(`/textures/myroom_far.avif`),cameraZoom:`wide`,cameraPosition:[0,1.25,2.8],cameraTarget:[0,1.25,0],seUrl:z(`/se/door_chime.mp3`),seVolume:.85,seLoop:!1,text:`(Ding-dong... Ding-dong...)
Suddenly, the doorbell chimed through the dead silence of the apartment.
Who on earth could it be at this ungodly hour...?`,fisheye:!1,avatars:{girl_01:{visible:!1,position:[0,0,0]}},autoNextSec:4},{id:`scene_2_approach_door`,speaker:`You`,location:`Front Door`,scenePreset:`dark_indoor`,background:z(`/textures/myroom_far.avif`),cameraZoom:`wide`,cameraPosition:[0,1.25,2.8],cameraTarget:[0,1.25,0],text:`Stealthily, I made my way to the entrance. I pressed the intercom screen button, but the display remained completely pitch black.
...With no other choice, I carefully pressed my eye against the peephole.`,fisheye:!1,avatars:{girl_01:{visible:!1,position:[0,0,0]}}},{id:`scene_3_peep_start`,speaker:`You`,location:`Through the Peephole`,scenePreset:`dark_indoor`,background:z(`/textures/apartment_door_far.avif`),seUrl:z(`/se/piano_note.mp3`),seVolume:.85,seLoop:!1,text:`Beyond the curved, distorted circle of the fisheye lens... Under the dim corridor lighting, a girl in school uniform stood motionless, looking down.`,fisheye:{enabled:!0,strength:.75,zoom:.95,circular:!0},cameraTarget:[0,1.3,0],cameraDistance:1,avatars:{girl_01:{visible:!0,position:[0,0,-1.6],motion:z(`/animations/Standing Idle.fbx`),expression:`sad`,headOffset:[0,-.25],lookAtCamera:!1,headLookAtCamera:!1}}},{id:`scene_4_head_up`,speaker:`You`,location:`Through the Peephole`,scenePreset:`dark_indoor`,text:`Slowly, stiffly tilting her neck with an eerie stillness, she raised her head.`,fisheye:{enabled:!0,strength:.85,zoom:.95,circular:!0},avatars:{girl_01:{position:[0,0,-1.6],motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.16},lookAtCamera:!0,headLookAtCamera:!0}}},{id:`scene_5_eye_contact`,speaker:`You`,location:`Through the Peephole`,scenePreset:`dark_indoor`,text:`Gasp...!?
As if she knew with certainty that I was peering out, her lifeless, pitch-black eyes locked right onto the glass lens.`,fisheye:{enabled:!0,strength:.9,zoom:.95,circular:!0},avatars:{girl_01:{position:[0,0,-1.6],expression:`neutral`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.2},lookAtCamera:!0}}},{id:`scene_6_voice_whisper`,speaker:`Girl`,speakerCharacterId:`girl_01`,location:`Through the Peephole`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_whisper.wav`),text:`"...Hey. You're in there, aren't you...? I can hear the sound of your breath, you know...?"`,fisheye:{enabled:!0,strength:.95,zoom:.95,circular:!0},avatars:{girl_01:{position:[0,0,-1.6],expression:`happy`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.22},lookAtCamera:!0}}},{id:`scene_7_step_closer`,speaker:`Girl`,speakerCharacterId:`girl_01`,location:`Through the Peephole`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_closer.wav`),text:`"Why did you leave my messages on read? You declined my calls too, didn't you...? So I came all the way to see you in person♡"`,fisheye:{enabled:!0,strength:1.05,zoom:1,circular:!0},avatars:{girl_01:{motion:z(`/animations/Walking.fbx`),motionDuration:1,nextMotion:z(`/animations/Standing Idle.fbx`),moveTo:{target:[0,0,-.65],duration:1},expression:`happy`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.18},lookAtCamera:!0}}},{id:`scene_8_panic_face`,speaker:`Girl`,speakerCharacterId:`girl_01`,location:`Through the Peephole`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_scream.wav`),seUrl:z(`/se/door_knock.mp3`),seVolume:.9,seLoop:!1,text:`"Hey, open up...! OPEN IT OPEN IT OPEN IT OPEN IT OPEN UP NOW!!"`,fisheye:{enabled:!0,strength:1.25,zoom:1,circular:!0},cameraTarget:[0,1.3,0],cameraDistance:.55,avatars:{girl_01:{position:[0,0,-.28],motion:z(`/animations/Standing Idle.fbx`),expression:`angry`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.25},lookAtCamera:!0,effectText:`wanawana`}}},{id:`scene_9_choice`,speaker:`You`,location:`Through the Peephole`,scenePreset:`dark_indoor`,seUrl:z(`/se/door_knock.mp3`),seVolume:.75,seLoop:!1,text:`Her face is pressed right against the glass as she violently pounds on the metal door, screaming with insane fury...! What should I do...?!`,fisheye:{enabled:!0,strength:1.25,zoom:1,circular:!0},avatars:{girl_01:{position:[0,0,-.28],expression:`angry`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.25},lookAtCamera:!0}},choices:[{text:`🔑 Unlock and open the door`,goto:`scene_open_door`,effectText:`doki`},{text:`🤫 Hold your breath and stay silent`,goto:`scene_stay_silent`,effectText:`biku`}]},{id:`scene_open_door`,speaker:`Girl`,speakerCharacterId:`girl_01`,location:`Entrance Doorway`,scenePreset:`dark_indoor`,background:z(`/textures/apartment_door_far.avif`),voiceUrl:z(`/voices/doorpeep_opendoor.wav`),text:`Click... With a heavy turn of the lock, the door was thrown wide open.
"...Fufu, you finally opened it for me♡ I'll never let you go now... Together forever and ever, okay?"`,fisheye:!1,cameraZoom:`speaker_close`,avatars:{girl_01:{position:[0,0,-.7],motion:z(`/animations/Excited.fbx`),expression:`happy`,yandere:{hideHighlights:!0,tiltHead:!0,tiltAngle:-.15},lookAtCamera:!0,effectText:`kirakira`}}},{id:`scene_stay_silent`,speaker:`Girl`,speakerCharacterId:`girl_01`,location:`Through the Peephole`,scenePreset:`dark_indoor`,voiceUrl:z(`/voices/doorpeep_silent.wav`),seUrl:z(`/se/door_rattle.mp3`),seVolume:.95,seLoop:!1,text:`Rattle-rattle-rattle-CLANK!! The doorknob was rattled with insane violence!
"Liar... I can see you standing right there... You're never getting away from me... NEVER!!" `,fisheye:{enabled:!0,strength:1.35,zoom:1,circular:!0},avatars:{girl_01:{position:[0,0,-.26],expression:`angry`,yandere:{hideHighlights:!0,dimEyeWhite:!0,tiltHead:!0,tiltAngle:-.28},lookAtCamera:!0,effectText:`wanawana`}}}]}]};function Mr(e){return e===`ja`?Ar:jr}var Nr={id:`private_date`,title:`休日デート〜私服のエミリと街歩き〜`,characters:[{id:`girl_02`,character:z(`/models/emili/emili-private.vrm`),position:`center`,rotationY:0},{id:`girl_04`,character:z(`/models/shion/shion-private.vrm`),position:`right`,rotationY:-.22},{id:`girl_01`,character:z(`/models/aoi/aoi-private.vrm`),position:`right`,rotationY:-.22}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.22,chapters:[{id:`main`,title:`休日デートの1日`,scenes:[{id:`prep_1`,speaker:`あなた`,location:`自分の部屋`,scenePreset:`bright_indoor`,background:z(`/textures/myroom_far.avif`),text:`（よし、準備完了！ エミリとの初めての休日デート……なんだかソワソワするな。）`,cameraPosition:[0,1.25,1.1],cameraTarget:[0,1.2,0],cameraZoom:`none`,cameraTransitionDuration:0,avatars:{girl_02:{visible:!1},girl_04:{visible:!1},girl_01:{visible:!1}}},{id:`prep_2`,speaker:`あなた`,location:`自分の部屋`,scenePreset:`bright_indoor`,background:z(`/textures/myroom_far.avif`),seUrl:z(`/se/door_chime.mp3`),seLoop:!1,text:`（ピンポーン♪ ……あっ、呼び鈴だ！ エミリが玄関まで迎えに来てくれたみたいだ！）`,cameraPosition:[0,1.25,1.1],cameraTarget:[0,1.2,0],cameraZoom:`none`,avatars:{girl_02:{visible:!1},girl_04:{visible:!1},girl_01:{visible:!1}},screenTransition:`interlude`},{id:`door_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`玄関前`,scenePreset:`day_outdoor`,background:z(`/textures/apartment_door_far.avif`),voiceUrl:z(`/voices/date_emili_01.wav`),text:`「おはよー！ 待たせちゃった？ 今日の私服……どうかな、似合ってる？」`,cameraPosition:[0,1.25,.72],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`,lookAtTarget:`player`},girl_04:{visible:!1},girl_01:{visible:!1}}},{id:`door_choice`,speaker:``,text:``,location:`玄関前`,scenePreset:`day_outdoor`,cameraPosition:[0,1.25,.72],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,choiceDelaySec:0,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.85,lookAtTarget:`player`}},choices:[{text:`すっごく似合ってるよ、可愛い！`,goto:`door_choice_1`,effectText:`doki`},{text:`いつもと違って大人っぽいね`,goto:`door_choice_2`,effectText:`kirakira`}]},{id:`door_choice_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`玄関前`,voiceUrl:z(`/voices/date_emili_02a.wav`),text:`「ほんと！？ えへへ……嬉しいな！ 実は今日のために色々悩んで選んだんだ♪」`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`doki`,lookAtTarget:`player`}},goto:`door_depart`},{id:`door_choice_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`玄関前`,voiceUrl:z(`/voices/date_emili_02b.wav`),text:`「大人っぽい！？ ……そ、そうかな？ えへへ、ちょっと照れちゃうけど嬉しい♪」`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.95,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`}},goto:`door_depart`},{id:`door_depart`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`玄関前`,voiceUrl:z(`/voices/date_emili_03.wav`),text:`「それじゃ、今日のデート……しゅっぱーつ！」`,cameraPosition:[0,1.25,.85],cameraTarget:[0,1.25,-.3],cameraZoom:`medium`,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Dismissing Gesture.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`,lookAtTarget:`player`}},screenTransition:`fade_black`},{id:`walk_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`休日の並木道`,text:`「こうして並んで歩くの、なんだかドキドキしちゃうね……！ お天気も最高だし♪」`,voiceUrl:z(`/voices/date_emili_04.wav`),seUrl:z(`/se/walking.mp3`),seLoop:!0,scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`relax`,expressionWeight:.85,position:[.12,0,-.4],rotationY:-.22,headOffset:[0,-.12]},girl_04:{visible:!1},girl_01:{visible:!1}}},{id:`walk_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`休日の並木道`,text:`「ねえねえ、まずはどこから行く？ 行きたいお店、いっぱいチェックしてきたんだ〜！」`,voiceUrl:z(`/voices/date_emili_05.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`happy`,expressionWeight:.95,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!1,headLookAtCamera:!1,headOffset:[0,-.12]}}},{id:`walk_3`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`休日の並木道`,text:`「……ふふっ、私の横顔ばっかり見てどうしたの？ 照れちゃうじゃん！」`,voiceUrl:z(`/voices/date_emili_06.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`relax`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),position:[.12,0,-.4],rotationY:-.25,lookAtCamera:!0,headOffset:[0,-.12],effectText:`doki`}},screenTransition:`interlude`},{id:`shion_1`,speaker:`シオン`,speakerCharacterId:`girl_04`,location:`街角の広場`,scenePreset:`day_outdoor`,background:z(`/textures/town_far.avif`),voiceUrl:z(`/voices/date_shion_01.wav`),text:`「……ん？ あんた達、こんなところで何してんの。……あー、デート？ ふーん。」`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,scrollingBackground:{enabled:!1},avatars:{girl_02:{visible:!0,position:[-.38,-.1,-1.15],rotationY:.22,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.8,faceTexture:void 0,lookAtTarget:`girl_04`},girl_04:{visible:!0,position:[.38,-.1,-1.15],rotationY:-.22,motion:z(`/animations/Idle.fbx`),expression:`neutral`,expressionWeight:.8,lookAtTarget:`girl_02`},girl_01:{visible:!1}}},{id:`shion_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`街角の広場`,voiceUrl:z(`/voices/date_emili_07.wav`),text:`「シ、シオン！？ なんでこんなところに……！ べ、別にデートじゃないし……あ、いやデートだけど！」`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.4,focusLines:!0,avatars:{girl_02:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`angry`,expressionWeight:1,effectText:`wanawana`,lookAtTarget:`girl_04`},girl_04:{visible:!0,motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_02`}}},{id:`shion_3`,speaker:`シオン`,speakerCharacterId:`girl_04`,location:`街角の広場`,voiceUrl:z(`/voices/date_shion_02.wav`),text:`「別に邪魔する気はないよ。私、そこの本屋行くだけだし。私服……ふたりとも気合い入ってんね。じゃ、お邪魔虫は退散しまーす。」`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.7,lookAtTarget:`girl_04`},girl_04:{visible:!0,motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:.9,lookAtTarget:`girl_02`}}},{id:`shion_4`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`街角の広場`,voiceUrl:z(`/voices/date_emili_08.wav`),text:`「もーっ！ シオンったら急に現れてからかうんだから！ ……ふぅ、びっくりした。気を取り直して行こっ！」`,cameraPosition:[0,1.25,.7],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.85,lookAtTarget:`player`},girl_04:{visible:!1}},screenTransition:`interlude`},{id:`cafe_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`テラスカフェ`,scenePreset:`day_outdoor`,background:z(`/textures/cafe_far.avif`),voiceUrl:z(`/voices/date_aoi_01.wav`),text:`「あ……！ ふたりとも、こんにちは！ こんな素敵なカフェで会うなんて、すごい偶然だね！」`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,position:[-.38,-.1,-1.15],rotationY:.22,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_01:{visible:!0,position:[.38,-.1,-1.15],rotationY:-.22,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,lookAtTarget:`girl_02`},girl_04:{visible:!1}}},{id:`cafe_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`テラスカフェ`,voiceUrl:z(`/voices/date_emili_09.wav`),text:`「アオイ！ アオイも私服でお買い物？ すっごく似合ってて可愛い〜！」`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`,lookAtTarget:`girl_01`},girl_01:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_02`}}},{id:`cafe_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`テラスカフェ`,voiceUrl:z(`/voices/date_aoi_02.wav`),text:`「ありがとうエミリ！ エミリのワンピースもすごくお洒落だよ。……ふたりで、お出かけ中だったんだ？」`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_01:{visible:!0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.9,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`girl_02`}}},{id:`cafe_4`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`テラスカフェ`,voiceUrl:z(`/voices/date_emili_10.wav`),text:`「うん！ ちょっと休憩にお茶しよって話してて。アオイも一緒にどう？」`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,lookAtTarget:`girl_01`},girl_01:{visible:!0,faceTexture:void 0,lookAtTarget:`girl_02`}}},{id:`cafe_5`,speaker:`アオイ`,speakerCharacterId:`girl_01`,location:`テラスカフェ`,voiceUrl:z(`/voices/date_aoi_03.wav`),text:`「ふふ、誘ってくれてありがとう。でも私はこれから約束があるから……ふたりでゆっくり楽しんできてね？」`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_01:{visible:!0,motion:z(`/animations/Dismissing Gesture.fbx`),expression:`happy`,expressionWeight:.95,lookAtTarget:`girl_02`}}},{id:`cafe_6`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`テラスカフェ`,voiceUrl:z(`/voices/date_emili_11.wav`),text:`「そっか、残念！ また学校でゆっくりお話しよ！」`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,lookAtTarget:`girl_01`},girl_01:{visible:!1}},screenTransition:`fade_black`},{id:`park_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`夕暮れの公園`,scenePreset:`evening_park`,background:z(`/textures/modern-park-far.avif`),voiceUrl:z(`/voices/date_emili_12.wav`),text:`「ふぅ……！ 今日一日、すっごく楽しかったな。あっという間に夕方になっちゃったね。」`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.9,faceTexture:void 0,lookAtTarget:`player`},girl_01:{visible:!1},girl_04:{visible:!1}}},{id:`park_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`夕暮れの公園`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_13.wav`),text:`「街でシオンにからかわれたり、カフェでアオイに会ったり……賑やかだったけど……」`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.85,lookAtTarget:`player`}}},{id:`park_3`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`夕暮れの公園`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_14.wav`),text:`「でもね……あなたと過ごした今日の時間、私にとってすごく特別だったよ。」`,cameraPosition:[0,1.28,.62],cameraTarget:[0,1.28,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`doki`,lookAtTarget:`player`}}},{id:`park_choice`,speaker:``,text:``,location:`夕暮れの公園`,scenePreset:`evening_park`,cameraPosition:[0,1.28,.62],cameraTarget:[0,1.28,-.3],cameraZoom:`speaker_close`,choiceDelaySec:0,avatars:{girl_02:{visible:!0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.95,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`}},choices:[{text:`俺もすごく楽しかった、ありがとう`,goto:`park_choice_1`,effectText:`kirakira`},{text:`また二人でデートしようね`,goto:`park_choice_2`,effectText:`doki`}]},{id:`park_choice_1`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`夕暮れの公園`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_15a.wav`),text:`「えへへ、そう言ってもらえて幸せだな……♪」`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`,lookAtTarget:`player`}},goto:`park_ending`},{id:`park_choice_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`夕暮れの公園`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_15b.wav`),text:`「うんっ……！ 絶対、またデートしてね。約束だよ♪」`,cameraZoom:`speaker_close`,dreamBackground:`heart`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`,lookAtTarget:`player`}},goto:`park_ending`},{id:`park_ending`,speaker:`エミリ`,speakerCharacterId:`girl_02`,location:`夕暮れの公園`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_16.wav`),text:`「今日は本当にありがとう！ 来週も……楽しみにしてるね！」`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,dreamBackground:`heart`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,lookAtTarget:`player`}}}]}]},Pr={id:`private_date`,title:`Holiday Date: A Walk in Town with Casual Emily`,characters:[{id:`girl_02`,character:z(`/models/emili/emili-private.vrm`),position:`center`,rotationY:0},{id:`girl_04`,character:z(`/models/shion/shion-private.vrm`),position:`right`,rotationY:-.22},{id:`girl_01`,character:z(`/models/aoi/aoi-private.vrm`),position:`right`,rotationY:-.22}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.22,chapters:[{id:`main`,title:`A Day on a Holiday Date`,scenes:[{id:`prep_1`,speaker:`You`,location:`My Room`,scenePreset:`bright_indoor`,background:z(`/textures/myroom_far.avif`),text:`(All right, all set! My first casual holiday date with Emily... I can't help feeling nervous.)`,cameraPosition:[0,1.25,1.1],cameraTarget:[0,1.2,0],cameraZoom:`none`,cameraTransitionDuration:0,avatars:{girl_02:{visible:!1},girl_04:{visible:!1},girl_01:{visible:!1}}},{id:`prep_2`,speaker:`You`,location:`My Room`,scenePreset:`bright_indoor`,background:z(`/textures/myroom_far.avif`),seUrl:z(`/se/door_chime.mp3`),seLoop:!1,text:`(Ding-dong♪ ...Ah, the doorbell! Looks like Emily came to pick me up at my front door!)`,cameraPosition:[0,1.25,1.1],cameraTarget:[0,1.2,0],cameraZoom:`none`,avatars:{girl_02:{visible:!1},girl_04:{visible:!1},girl_01:{visible:!1}},screenTransition:`interlude`},{id:`door_1`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Front Door`,scenePreset:`day_outdoor`,background:z(`/textures/apartment_door_far.avif`),voiceUrl:z(`/voices/date_emili_01.wav`),text:`"Good morning! Did I keep you waiting? What do you think of my casual outfit today... does it look good on me?"`,cameraPosition:[0,1.25,.72],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,effectText:`kirakira`,lookAtTarget:`player`},girl_04:{visible:!1},girl_01:{visible:!1}}},{id:`door_choice`,speaker:``,text:``,location:`Front Door`,scenePreset:`day_outdoor`,cameraPosition:[0,1.25,.72],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,choiceDelaySec:0,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.85,lookAtTarget:`player`}},choices:[{text:`It looks amazing on you, so cute!`,goto:`door_choice_1`,effectText:`doki`},{text:`It's different from usual, looks very mature.`,goto:`door_choice_2`,effectText:`kirakira`}]},{id:`door_choice_1`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Front Door`,voiceUrl:z(`/voices/date_emili_02a.wav`),text:`"Really!? Hehe... I'm so glad! I actually spent a lot of time trying to pick the right outfit for today♪"`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`doki`,lookAtTarget:`player`}},goto:`door_depart`},{id:`door_choice_2`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Front Door`,voiceUrl:z(`/voices/date_emili_02b.wav`),text:`"Mature!? ...R-Really? Hehe, that makes me a little shy, but I'm really happy♪"`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.95,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`}},goto:`door_depart`},{id:`door_depart`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Front Door`,voiceUrl:z(`/voices/date_emili_03.wav`),text:`"Well then, off we go on our date today!"`,cameraPosition:[0,1.25,.85],cameraTarget:[0,1.25,-.3],cameraZoom:`medium`,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Dismissing Gesture.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`,lookAtTarget:`player`}},screenTransition:`fade_black`},{id:`walk_1`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Tree-lined Avenue`,text:`"Walking side by side like this makes my heart race a little...! And the weather is just wonderful, too♪"`,voiceUrl:z(`/voices/date_emili_04.wav`),seUrl:z(`/se/walking.mp3`),seLoop:!0,scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`relax`,expressionWeight:.85,position:[.12,0,-.4],rotationY:-.22,headOffset:[0,-.12]},girl_04:{visible:!1},girl_01:{visible:!1}}},{id:`walk_2`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Tree-lined Avenue`,text:`"Hey hey, where should we head first? I checked out so many cute shops I wanted to visit~!"`,voiceUrl:z(`/voices/date_emili_05.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`happy`,expressionWeight:.95,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!1,headLookAtCamera:!1,headOffset:[0,-.12]}}},{id:`walk_3`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Tree-lined Avenue`,text:`"...Hehe, why do you keep staring at my face? You're going to make me blush!"`,voiceUrl:z(`/voices/date_emili_06.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`relax`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),position:[.12,0,-.4],rotationY:-.25,lookAtCamera:!0,headOffset:[0,-.12],effectText:`doki`}},screenTransition:`interlude`},{id:`shion_1`,speaker:`Shion`,speakerCharacterId:`girl_04`,location:`Town Square`,scenePreset:`day_outdoor`,background:z(`/textures/town_far.avif`),voiceUrl:z(`/voices/date_shion_01.wav`),text:`"...Hm? What are you two doing around here? ...Ah, a date? Hmph."`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,scrollingBackground:{enabled:!1},avatars:{girl_02:{visible:!0,position:[-.38,-.1,-1.15],rotationY:.22,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.8,faceTexture:void 0,lookAtTarget:`girl_04`},girl_04:{visible:!0,position:[.38,-.1,-1.15],rotationY:-.22,motion:z(`/animations/Idle.fbx`),expression:`neutral`,expressionWeight:.8,lookAtTarget:`girl_02`},girl_01:{visible:!1}}},{id:`shion_2`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Town Square`,voiceUrl:z(`/voices/date_emili_07.wav`),text:`"Sh-Shion!? What are you doing here...?! I-It's not like it's a date or anything... wait, no, it IS a date, but!"`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.4,focusLines:!0,avatars:{girl_02:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`angry`,expressionWeight:1,effectText:`wanawana`,lookAtTarget:`girl_04`},girl_04:{visible:!0,motion:z(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_02`}}},{id:`shion_3`,speaker:`Shion`,speakerCharacterId:`girl_04`,location:`Town Square`,voiceUrl:z(`/voices/date_shion_02.wav`),text:`"I don't plan to get in your way. I'm just heading to the bookstore over there. Casual clothes... looks like you both went all out. Well, the third wheel will take her leave~"`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.7,lookAtTarget:`girl_04`},girl_04:{visible:!0,motion:z(`/animations/Dismissing Gesture.fbx`),expression:`relaxed`,expressionWeight:.9,lookAtTarget:`girl_02`}}},{id:`shion_4`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Town Square`,voiceUrl:z(`/voices/date_emili_08.wav`),text:`"Geez! Shion just popping in out of nowhere to tease us! ...Whew, that took me by surprise. Let's shake it off and keep going!"`,cameraPosition:[0,1.25,.7],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.85,lookAtTarget:`player`},girl_04:{visible:!1}},screenTransition:`interlude`},{id:`cafe_1`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Terrace Cafe`,scenePreset:`day_outdoor`,background:z(`/textures/cafe_far.avif`),voiceUrl:z(`/voices/date_aoi_01.wav`),text:`"Ah...! Hello, both of you! What a coincidence bumping into you at such a lovely cafe!"`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,position:[-.38,-.1,-1.15],rotationY:.22,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_01:{visible:!0,position:[.38,-.1,-1.15],rotationY:-.22,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,lookAtTarget:`girl_02`},girl_04:{visible:!1}}},{id:`cafe_2`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Terrace Cafe`,voiceUrl:z(`/voices/date_emili_09.wav`),text:`"Aoi! Are you out shopping in casual clothes too? That outfit suits you so well, it's adorable~!"`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`,lookAtTarget:`girl_01`},girl_01:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_02`}}},{id:`cafe_3`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Terrace Cafe`,voiceUrl:z(`/voices/date_aoi_02.wav`),text:`"Thank you, Emily! Your dress is super stylish, too. ...Were the two of you spending the day out together?"`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_01:{visible:!0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.9,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`girl_02`}}},{id:`cafe_4`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Terrace Cafe`,voiceUrl:z(`/voices/date_emili_10.wav`),text:`"Yeah! We were just talking about having some tea to take a break. Would you like to join us, Aoi?"`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.9,lookAtTarget:`girl_01`},girl_01:{visible:!0,faceTexture:void 0,lookAtTarget:`girl_02`}}},{id:`cafe_5`,speaker:`Aoi`,speakerCharacterId:`girl_01`,location:`Terrace Cafe`,voiceUrl:z(`/voices/date_aoi_03.wav`),text:`"Hehe, thanks for inviting me. But I have plans with someone soon... so you two go ahead and enjoy your time together, okay?"`,cameraPosition:[.38,1.25,-.48],cameraTarget:[.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:.8,lookAtTarget:`girl_01`},girl_01:{visible:!0,motion:z(`/animations/Dismissing Gesture.fbx`),expression:`happy`,expressionWeight:.95,lookAtTarget:`girl_02`}}},{id:`cafe_6`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Terrace Cafe`,voiceUrl:z(`/voices/date_emili_11.wav`),text:`"Aww, too bad! Let's chat all about it at school next week, then!"`,cameraPosition:[-.38,1.25,-.48],cameraTarget:[-.38,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,lookAtTarget:`girl_01`},girl_01:{visible:!1}},screenTransition:`fade_black`},{id:`park_1`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Park at Sunset`,scenePreset:`evening_park`,background:z(`/textures/modern-park-far.avif`),voiceUrl:z(`/voices/date_emili_12.wav`),text:`"Phew...! Today was so much fun. The evening crept up on us before I even noticed."`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.6,avatars:{girl_02:{visible:!0,position:`center`,rotationY:0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.9,faceTexture:void 0,lookAtTarget:`player`},girl_01:{visible:!1},girl_04:{visible:!1}}},{id:`park_2`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Park at Sunset`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_13.wav`),text:`"Being teased by Shion in town, bumping into Aoi at the cafe... it was quite an eventful day, but..."`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:.85,lookAtTarget:`player`}}},{id:`park_3`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Park at Sunset`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_14.wav`),text:`"You know... every single moment I spent with you today was truly special to me."`,cameraPosition:[0,1.28,.62],cameraTarget:[0,1.28,-.3],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,avatars:{girl_02:{visible:!0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`doki`,lookAtTarget:`player`}}},{id:`park_choice`,speaker:``,text:``,location:`Park at Sunset`,scenePreset:`evening_park`,cameraPosition:[0,1.28,.62],cameraTarget:[0,1.28,-.3],cameraZoom:`speaker_close`,choiceDelaySec:0,avatars:{girl_02:{visible:!0,motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.95,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`}},choices:[{text:`I had so much fun too, thank you.`,goto:`park_choice_1`,effectText:`kirakira`},{text:`Let's go on another date together soon.`,goto:`park_choice_2`,effectText:`doki`}]},{id:`park_choice_1`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Park at Sunset`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_15a.wav`),text:`"Hehe, hearing you say that makes me so incredibly happy...♪"`,cameraZoom:`speaker_close`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,effectText:`kirakira`,lookAtTarget:`player`}},goto:`park_ending`},{id:`park_choice_2`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Park at Sunset`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_15b.wav`),text:`"Yeah...! You definitely have to take me on another date. It's a promise♪"`,cameraZoom:`speaker_close`,dreamBackground:`heart`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,effectText:`yatta`,lookAtTarget:`player`}},goto:`park_ending`},{id:`park_ending`,speaker:`Emily`,speakerCharacterId:`girl_02`,location:`Park at Sunset`,scenePreset:`evening_park`,voiceUrl:z(`/voices/date_emili_16.wav`),text:`"Thank you so much for today! I'll be looking forward to... next week too!"`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-.3],cameraZoom:`speaker_close`,dreamBackground:`heart`,avatars:{girl_02:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,lookAtTarget:`player`}}}]}]};function Fr(e=H()){return e===`en`?Pr:Nr}var Ir={id:`teacher_gate`,title:`校門の邂逅 〜シオンと桐島先生の秘密の推し〜`,characters:[{id:`shion`,character:z(`/models/shion/shion-school.vrm`),position:[.12,0,-.4],rotationY:-.22},{id:`teacher`,character:z(`/models/teacher/teacher.vrm`),position:[-.45,0,-.5],rotationY:.3}],bgmUrl:z(`/bgm/bgm.mp3`),bgmVolume:.22,chapters:[{id:`main`,title:`登校と校門の出会い`,scenes:[{id:`walk_1`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`player`,location:`朝の並木道`,text:`「ふぁあ……おはよ……。朝って、なんでこんなに光合成しづらい空気なんだろ……」`,voiceUrl:z(`/voices/teacher/walk_shion_1.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{shion:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`sleepy`,expressionWeight:1,position:[.12,0,-.4],rotationY:-.22,headOffset:[0,-.12]},teacher:{visible:!1}}},{id:`walk_2`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`player`,location:`朝の並木道`,text:`「昨日も……気づいたら朝の四時まで、海外の古生物学会の論文読んでて……」`,voiceUrl:z(`/voices/teacher/walk_shion_2.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{shion:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`sleepy`,expressionWeight:1,position:[.12,0,-.4],rotationY:-.22,headOffset:[0,-.12]},teacher:{visible:!1}}},{id:`walk_choice`,speaker:``,location:`朝の並木道`,text:``,scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{shion:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`sleepy`,expressionWeight:1,position:[.12,0,-.4],rotationY:-.22,headOffset:[0,-.12]},teacher:{visible:!1}},choices:[{text:`「夜更かししすぎ！ 授業中寝たら桐島先生に怒られるぞ」`,flag:`choice_scold`,goto:`walk_route_scold`},{text:`「古生物……？ 相変わらずマニアックなこと調べてるな」`,flag:`choice_maniac`,goto:`walk_route_maniac`}]},{id:`walk_route_scold`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`player`,location:`朝の並木道`,text:`「う……桐島先生、普段は落ち着いてるけど指導は鋭いから……見つかったら怒られちゃう……」`,voiceUrl:z(`/voices/teacher/walk_shion_scold.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,avatars:{shion:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`sad`,expressionWeight:1,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!0},teacher:{visible:!1}},goto:`gate_arrive`},{id:`walk_route_maniac`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`player`,location:`朝の並木道`,text:`「マニアックじゃないよ……。カンブリア紀の不条理な生態系こそ、世界の真理なんだから……」`,voiceUrl:z(`/voices/teacher/walk_shion_maniac.wav`),scrollingBackground:{enabled:!0,textureUrl:z(`/textures/town_far.avif`),speed:.65,blur:1,direction:`left`},cameraZoom:`speaker_close`,cameraStartAngle:`left`,cameraDistance:.88,cameraTarget:[0,1.3,0],cameraPreset:`hold`,avatars:{shion:{visible:!0,motion:z(`/animations/Walking.fbx`),expression:`neutral`,expressionWeight:1,position:[.12,0,-.4],rotationY:-.22,lookAtCamera:!0},teacher:{visible:!1}},goto:`gate_arrive`},{id:`gate_arrive`,speaker:`桐島先生`,speakerCharacterId:`teacher`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「おはよう、二人とも。……あら、シオンさん？ また随分と眠そうな顔をして……」`,voiceUrl:z(`/voices/teacher/walk_teacher_greeting.wav`),scrollingBackground:{enabled:!1},cameraZoom:`wide`,cameraTransitionEasing:`cut`,cameraTransitionDuration:0,cameraPreset:`hold`,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`sleepy`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:1,position:[-.45,0,-.5],rotationY:.3,lookAtCamera:!0}}},{id:`gate_shion_reply`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「う……桐島先生……お、おはようございます……」`,voiceUrl:z(`/voices/teacher/walk_shion_gate.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,avatars:{shion:{visible:!0,motion:z(`/animations/Quick Formal Bow.fbx`),expression:`sad`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:1,position:[-.45,0,-.5],rotationY:.3}}},{id:`gate_teacher_notice`,speaker:`桐島先生`,speakerCharacterId:`teacher`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「ふふ、遅刻ギリギリセーフですよ。……ん？ ちょっと待って。あなたのその鞄のストラップ……」`,voiceUrl:z(`/voices/teacher/walk_teacher_notice.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Acknowledging.fbx`),expression:`surprised`,expressionWeight:1,position:[-.35,0,-.45],rotationY:.35}}},{id:`gate_teacher_discover`,speaker:`桐島先生`,speakerCharacterId:`teacher`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「……これ、まさかハルキゲニアの最新復元モデル！？ 背中のトゲの角度からして、最新論文準拠の造形じゃない！」`,voiceUrl:z(`/voices/teacher/walk_teacher_discover.wav`),cameraZoom:`wide`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.4,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[-.35,0,-.45],rotationY:.35,lookAtCamera:!0}}},{id:`gate_shion_shock`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「えっ……！？ せ、先生……これ、わかるの……！？ イカの足だと思って誰も相手にしてくれなかったのに……！」`,voiceUrl:z(`/voices/teacher/walk_shion_shock.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3,lookAtCamera:!0},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[-.35,0,-.45],rotationY:.35}}},{id:`gate_teacher_geek`,speaker:`桐島先生`,speakerCharacterId:`teacher`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「当たり前でしょう！ あの奇妙極まりない歩行器官と、頭部特定で覆された学説史……あの時代の狂気とロマン、最高に美しいわよね！」`,voiceUrl:z(`/voices/teacher/walk_teacher_geek.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.4,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,position:[-.35,0,-.45],rotationY:.35}}},{id:`gate_shion_passion`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「そう……！ 化石の上下が逆さまだったところから、電子顕微鏡で単眼が見つかった瞬間が一番熱い……！」`,voiceUrl:z(`/voices/teacher/walk_shion_passion.wav`),cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[-.35,0,-.45],rotationY:.35}}},{id:`gate_choice`,speaker:``,location:`校門前`,text:``,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[-.35,0,-.45],rotationY:.35}},choices:[{text:`「（……二人とも、完全に自分の世界に入り込んでる……）」`,flag:`world_in`,goto:`gate_teacher_calmdown`},{text:`「先生……それ、生徒を生活指導する顔じゃないですよ」`,flag:`point_out`,goto:`gate_teacher_calmdown`}]},{id:`gate_teacher_calmdown`,speaker:`桐島先生`,speakerCharacterId:`teacher`,dialogueTarget:`player`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「コホン……！ い、いけないわね。教師たるもの、校門で熱弁を振るうところだったわ」`,voiceUrl:z(`/voices/teacher/walk_teacher_calmdown.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`relax`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Dismissing Gesture.fbx`),expression:`happy`,expressionWeight:1,position:[-.45,0,-.5],rotationY:.3,lookAtCamera:!0}}},{id:`gate_teacher_invite`,speaker:`桐島先生`,speakerCharacterId:`teacher`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「シオンさん。続きは放課後、準備室でじっくり語り合いましょう。私の秘蔵の化石レプリカ、見せてあげるわ」`,voiceUrl:z(`/voices/teacher/walk_teacher_invite.wav`),cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`relax`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[-.45,0,-.5],rotationY:.3}}},{id:`gate_shion_excited`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「……！ 放課後……絶対行く……！ 先生、最高……」`,voiceUrl:z(`/voices/teacher/walk_shion_excited.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Excited.fbx`),expression:`happy`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3,lookAtCamera:!0},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[-.45,0,-.5],rotationY:.3}}},{id:`gate_teacher_condition`,speaker:`桐島先生`,speakerCharacterId:`teacher`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「ふふ。その代わり、今日の小テストで赤点を取ったら準備室立ち入り禁止ですからね？」`,voiceUrl:z(`/voices/teacher/walk_teacher_condition.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3},teacher:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,position:[-.45,0,-.5],rotationY:.3,lookAtCamera:!0}}},{id:`gate_shion_promise`,speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`player`,location:`校門前`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),text:`「……っ、頑張る……！ 今日のテスト、絶対満点取ってみせる……！」`,voiceUrl:z(`/voices/teacher/walk_shion_promise.wav`),cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,avatars:{shion:{visible:!0,motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:1,position:[.45,0,-.5],rotationY:-.3,lookAtCamera:!0},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[-.45,0,-.5],rotationY:.3}}},{id:`ending_scene`,speaker:``,location:`校門前`,text:`――普段はやる気ゼロのシオンが、まさかの古生物オタク仲間を得て情熱に燃え上がった朝。放課後の準備室は、きっと熱い議論で盛り上がることだろう。[シナリオ完]`,scenePreset:`morning_school`,background:z(`/textures/school-gate-far.avif`),cameraZoom:`wide`,cameraStartAngle:`front`,cameraDistance:1.5,cameraPreset:`pullOut`,cameraStrength:.4,cameraTransitionDuration:1.2,cameraTransitionEasing:`smooth`,avatars:{shion:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[.35,0,-.5],rotationY:-.2},teacher:{visible:!0,motion:z(`/animations/Standing Idle.fbx`),expression:`relaxed`,expressionWeight:1,position:[-.35,0,-.5],rotationY:.2}}}]}]},Lr={...Ir,title:`Encounter at the School Gate ~Shion and Ms. Kirishima~`,chapters:[{...Ir.chapters[0],title:`Morning Walk and the School Gate`,scenes:Ir.chapters[0].scenes.map(e=>e.id===`walk_1`?{...e,text:`Yaaawn... morning... Why does the morning air feel so hard to photosynthesize in...`}:e.id===`walk_2`?{...e,text:`Yesterday too... before I knew it, it was 4 AM while reading paleontology papers...`}:e.id===`walk_choice`?{...e,choices:[{text:`Staying up too late! Ms. Kirishima will scold you if you fall asleep.`,flag:`choice_scold`,goto:`walk_route_scold`},{text:`Paleontology...? Researching niche things as always, huh.`,flag:`choice_maniac`,goto:`walk_route_maniac`}]}:e.id===`walk_route_scold`?{...e,text:`Ugh... Ms. Kirishima is usually calm, but her discipline is sharp... I'll get scolded if she catches me...`}:e.id===`walk_route_maniac`?{...e,text:`It's not niche...! The absurd ecosystem of the Cambrian period is the true essence of the world...`}:e.id===`gate_arrive`?{...e,text:`Good morning, both of you. ...Oh? Shion, looking quite sleepy again, aren't you?`}:e.id===`gate_shion_reply`?{...e,text:`Ugh... Ms. Kirishima... g-good morning...`}:e.id===`gate_teacher_notice`?{...e,text:`Fufu, barely on time. ...Wait, that strap on your school bag...`}:e.id===`gate_teacher_discover`?{...e,text:`...Could this be the latest reconstruction model of Hallucigenia!? Look at the angle of those dorsal spines!`}:e.id===`gate_shion_shock`?{...e,text:`Eh...!? M-Ms. Kirishima... you know about this...!? Everyone else just called it squid legs...!`}:e.id===`gate_teacher_geek`?{...e,text:`Of course I do! Those bizarre locomotory organs, the overturned hypotheses... the sheer madness and romance of that era!`}:e.id===`gate_shion_passion`?{...e,text:`Exactly...! Going from upside-down fossils to finding simple eyes under electron microscopy is the peak hype...!`}:e.id===`gate_choice`?{...e,choices:[{text:`(...Both of them are completely lost in their own world...)`,flag:`world_in`,goto:`gate_teacher_calmdown`},{text:`Sensei... that's not the face of a teacher giving morning discipline.`,flag:`point_out`,goto:`gate_teacher_calmdown`}]}:e.id===`gate_teacher_calmdown`?{...e,text:`Ahem...! Oh my, excuse me. As an educator, I almost gave a full lecture at the front gate.`}:e.id===`gate_teacher_invite`?{...e,text:`Shion. Let's discuss this thoroughly after school in the science prep room. I'll show you my treasured fossil replicas.`}:e.id===`gate_shion_excited`?{...e,text:`...! After school... I'm definitely going...! Sensei, you're the best...`}:e.id===`gate_teacher_condition`?{...e,text:`Fufu. However, if you fail today's quiz, you're banned from the prep room, understand?`}:e.id===`gate_shion_promise`?{...e,text:`...I will try my best...! I'm getting a perfect score on today's test...!`}:e.id===`ending_scene`?{...e,text:`--- And so, the normally unmotivated Shion found an unexpected fossil-nerd ally and reignited her passion. [Scenario End]`}:e)}]};function Rr(e=H()){return e===`en`?Lr:Ir}var zr={id:`five_seconds_confession_pv`,title:`【PV】5秒の告白 〜5 Seconds Confession〜`,bgmUrl:z(`/bgm/thema_music.mp3`),bgmVolume:.45,bgmLoop:!1,hideMessageWindow:!0,characters:[{id:`girl_01_school`,character:z(`/models/aoi/aoi-school.vrm`),position:[-.42,-.05,-1.2],rotationY:.2},{id:`girl_02_school`,character:z(`/models/emili/emili.vrm`),position:[0,-.05,-1.1],rotationY:0},{id:`girl_04_school`,character:z(`/models/shion/shion-school.vrm`),position:[.42,-.05,-1.2],rotationY:-.2},{id:`girl_01_private`,character:z(`/models/aoi/aoi-private.vrm`),position:[-.34,-.05,-1.15],rotationY:.15},{id:`girl_02_private`,character:z(`/models/emili/emili-private.vrm`),position:[.34,-.05,-1.15],rotationY:-.15},{id:`girl_04_private`,character:z(`/models/shion/shion-private.vrm`),position:[0,-.05,-1.2],rotationY:0}],chapters:[{id:`pv_main`,title:`5秒の告白 PV`,scenes:[{id:`pv_cut1`,speaker:`ナレーション`,lipSyncCharacterId:null,dialogueTarget:`player`,location:`屋上・青空の下`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),voiceUrl:z(`/voices/pv_cut1_aoi.wav`),text:`「ねえ、もし……あと5秒しかなかったら、何て伝える？」`,cameraPosition:[0,1.25,.95],cameraTarget:[0,1.25,-1.15],cameraZoom:`wide`,cameraTransitionDuration:.8,cameraPreset:`pushIn`,cameraStrength:.7,autoNextSec:.12,avatars:{girl_01_school:{visible:!0,position:[-.42,-.05,-1.2],rotationY:.2,motion:z(`/animations/Standing Greeting.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_02_school:{visible:!0,position:[0,-.05,-1.1],rotationY:0,motion:z(`/animations/Excited.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_04_school:{visible:!0,position:[.42,-.05,-1.2],rotationY:-.2,motion:z(`/animations/Standing Idle.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_01_private:{visible:!1},girl_02_private:{visible:!1},girl_04_private:{visible:!1}}},{id:`pv_cut2`,speaker:`アオイ`,speakerCharacterId:`girl_01_school`,dialogueTarget:`player`,location:`放課後の教室`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school_classroom_far.avif`),backgroundZoom:1,voiceUrl:z(`/voices/pv_cut2_aoi.wav`),text:`「放課後の教室で、君のことばかり目で追ってたの……」`,cameraPosition:[-.19,1.21,-.02],cameraTarget:[-.38,1.18,-1.2],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`hold`,autoNextSec:.5,avatars:{girl_01_school:{visible:!0,position:[-.38,-.05,-1.2],rotationY:.15,motion:z(`/animations/chin_rest.fbx`),motionLoop:!0,expression:`normal`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!1},girl_02_private:{visible:!1},girl_04_private:{visible:!1}}},{id:`pv_cut3`,speaker:`エミリ`,speakerCharacterId:`girl_02_private`,dialogueTarget:`player`,location:`お気に入りのカフェ`,screenTransition:`none`,scenePreset:`bright_indoor`,background:z(`/textures/cafe_far.avif`),voiceUrl:z(`/voices/pv_cut3_emili.wav`),text:`「私のこと、ただの友達としか思ってないんでしょ？ ……ばーか」`,cameraPosition:[.34,1.25,.05],cameraTarget:[.34,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`punchIn`,cameraStrength:.6,autoNextSec:.3,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!1},girl_02_private:{visible:!0,position:[.34,-.05,-1.15],rotationY:-.05,motion:z(`/animations/Idle.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_04_private:{visible:!1}}},{id:`pv_cut4`,speaker:`シオン`,speakerCharacterId:`girl_04_school`,dialogueTarget:`player`,location:`学校の廊下`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-corridor-far.avif`),voiceUrl:z(`/voices/pv_cut4_shion.wav`),text:`「……別に。あんたのことなんて、気にしてないし。……嘘だけど。」`,cameraPosition:[.2,1.25,-.02],cameraTarget:[.42,1.25,-1.2],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6,cameraPreset:`orbitRightHalf`,cameraStrength:.5,autoNextSec:.04,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!0,position:[.42,-.05,-1.2],rotationY:-1.57,motion:z(`/animations/torso_twist_left.fbx`),expression:`normal`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),headLookAtCamera:!0,lookAtCamera:!0,lookAtTarget:`player`},girl_01_private:{visible:!1},girl_02_private:{visible:!1},girl_04_private:{visible:!1}}},{id:`pv_cut5`,speaker:`アオイ`,speakerCharacterId:`girl_01_private`,dialogueTarget:`player`,location:`海の見える公園`,screenTransition:`none`,scenePreset:`day_outdoor`,background:z(`/textures/park-with-sea-far.avif`),voiceUrl:z(`/voices/pv_cut5_aoi.wav`),text:`「風が吹くたび、胸がぎゅってなるの……！」`,cameraPosition:[-.05,1.26,.01],cameraTarget:[-.34,1.26,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.55,cameraPreset:`orbitLeftHalf`,cameraStrength:.7,autoNextSec:1.16,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!0,position:[-.34,-.05,-1.15],rotationY:.15,motion:z(`/animations/clasp_hands_front.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_02_private:{visible:!1},girl_04_private:{visible:!1}}},{id:`pv_cut6`,speaker:`エミリ`,speakerCharacterId:`girl_02_private`,dialogueTarget:`player`,location:`きらめく街角`,screenTransition:`none`,scenePreset:`day_outdoor`,background:z(`/textures/town_far.avif`),voiceUrl:z(`/voices/pv_cut6_emili.wav`),text:`「ねえ、もっとこっち来て！ 手、繋いでもいいよ？」`,cameraPosition:[.34,1.22,-.38],cameraTarget:[.34,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionEasing:`cut`,cameraTransitionDuration:.1,cameraPreset:`spiralRise`,cameraStrength:.8,dreamBackground:`heart`,autoNextSec:2.82,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!1},girl_02_private:{visible:!0,position:[.34,-.05,-1.15],rotationY:-.1,motion:z(`/animations/Excited.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_04_private:{visible:!1}}},{id:`pv_cut7`,speaker:`シオン`,speakerCharacterId:`girl_04_private`,dialogueTarget:`player`,location:`夕暮れの丘・茜色の空`,screenTransition:`none`,scenePreset:`evening_outdoor`,background:z(`/textures/town_far.avif`),voiceUrl:z(`/voices/pv_cut7_shion.wav`),text:`「夕焼けが綺麗だから……じゃない。あんたが隣にいるからだよ。」`,cameraPosition:[0,1.25,0],cameraTarget:[0,1.25,-1.2],cameraZoom:`speaker_close`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.7,cameraPreset:`pushIn`,cameraStrength:.5,autoNextSec:.4,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!1},girl_02_private:{visible:!1},girl_04_private:{visible:!0,position:[0,-.05,-1.2],rotationY:-.1,motion:z(`/animations/Idle.fbx`),expression:`normal`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`}}},{id:`pv_cut8`,speaker:`ナレーション`,lipSyncCharacterId:null,dialogueTarget:`player`,location:`夜の夏祭り・花火の空`,screenTransition:`none`,scenePreset:`night_festival`,background:z(`/textures/night-festival-far.avif`),voiceUrl:z(`/voices/pv_cut8_all.wav`),text:`「あと少しだけ、私たちの気持ち……受け止めて！」`,cameraPosition:[0,1.22,1],cameraTarget:[0,1.22,-1.15],cameraZoom:`wide`,cameraTransitionDuration:.7,cameraPreset:`punchIn`,cameraStrength:.8,autoNextSec:2.94,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!0,position:[-.34,-.05,-1.15],rotationY:.18,motion:z(`/animations/Standing Greeting.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_02_private:{visible:!0,position:[.34,-.05,-1.15],rotationY:-.18,motion:z(`/animations/Excited.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_04_private:{visible:!0,position:[0,-.05,-1.2],rotationY:0,motion:z(`/animations/Standing Idle.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`}}},{id:`pv_cut9_intro`,speaker:`アオイ・エミリ・シオン`,dialogueTarget:`player`,location:`夕暮れの展望台`,screenTransition:`none`,scenePreset:`evening_outdoor`,background:z(`/textures/town_far.avif`),text:`（♪ 〜 恋してるの 〜）`,cameraPosition:[0,1.25,.75],cameraTarget:[0,1.25,-1.15],cameraZoom:`wide`,cameraTransitionDuration:.6,cameraPreset:`orbitLeftHalf`,cameraStrength:.4,autoNextSec:4,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!0,position:[-.34,-.05,-1.15],rotationY:.15,motion:z(`/animations/clasp_hands_front.fbx`),expression:`normal`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`},girl_02_private:{visible:!0,position:[.34,-.05,-1.15],rotationY:-.15,motion:z(`/animations/Standing Idle.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_04_private:{visible:!0,position:[0,-.05,-1.2],rotationY:0,motion:z(`/animations/Standing Idle.fbx`),expression:`normal`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),lookAtTarget:`player`}}},{id:`pv_cut9_climax`,speaker:`3人`,dialogueTarget:`player`,location:`夕暮れの展望台`,screenTransition:`none`,scenePreset:`evening_outdoor`,background:z(`/textures/town_far.avif`),voiceUrl:z(`/voices/pv_cut9_daisuki.wav`),text:`「「「大好きだよっ！」」」 ―― 奇跡の5秒間が、今始まる。`,cameraPosition:[0,1.25,.65],cameraTarget:[0,1.25,-1.15],cameraZoom:`speaker_close`,cameraTransitionDuration:.5,cameraPreset:`pushIn`,cameraStrength:.5,autoNextSec:5,avatars:{girl_01_school:{visible:!1},girl_02_school:{visible:!1},girl_04_school:{visible:!1},girl_01_private:{visible:!0,position:[-.34,-.05,-1.15],rotationY:.15,motion:z(`/animations/Standing Greeting.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_02_private:{visible:!0,position:[.34,-.05,-1.15],rotationY:-.15,motion:z(`/animations/Standing Idle.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`},girl_04_private:{visible:!0,position:[0,-.05,-1.2],rotationY:0,motion:z(`/animations/Standing Idle.fbx`),expression:`normal`,expressionWeight:1,lookAtTarget:`player`}}}]}]};function Br(){return zr}var Vr={id:`rooftop_nap`,title:`屋上の昼寝と、覗き込みハプニング`,bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.3,chapters:[{id:`main`,title:`ぽかぽか陽気の屋上`,scenes:[{id:`rooftop_intro_1`,speaker:`主人公`,location:`学校・屋上`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`（ぽかぽか陽気のお昼休み。あまりに風が心地よくて、屋上の隅で直に寝転がってうとうとしていた……）`,character:`girl_01`,live2d:!1,avatar:{visible:!1},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:1,cameraPreset:`hold`},{id:`rooftop_intro_2`,speaker:`アオイ`,location:`学校・屋上`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「あれ？ こんなところで誰か寝転がってると思ったら……きみだったんだ！」`,voiceUrl:z(`/voices/rooftop_01.wav`),character:`girl_01`,live2d:!1,avatar:{visible:!0,motion:z(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:.8,position:[0,0,-.9]},cameraZoom:`speaker`,cameraDistance:1.5,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.9,cameraPreset:`hold`},{id:`rooftop_walk_3`,speaker:`アオイ`,location:`学校・屋上`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「ふふっ、すっごく気持ちよさそうな寝顔。ちょっといたずらして驚かせちゃおうかな」`,voiceUrl:z(`/voices/rooftop_02.wav`),character:`girl_01`,live2d:!1,avatar:{visible:!0,position:[0,0,-.9],motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.9},cameraZoom:`speaker`,cameraDistance:1.35,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:1.2,cameraPreset:`pushIn`,cameraStrength:.4},{id:`rooftop_live2d_4`,speaker:`アオイ`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「……ねぇ。いつまで寝てるの？ 起こしちゃって悪いんだけど……起きて？」`,voiceUrl:z(`/voices/rooftop_03.wav`),character:`girl_01`,live2d:!0,cameraZoom:`speaker_close`,cameraDistance:.7,cameraPreset:`hold`},{id:`rooftop_live2d_5`,speaker:`アオイ`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「……あ、起きた。ふふ、おはよう。……ん？ なにじっと見てるの？ 私の顔、変……？」`,voiceUrl:z(`/voices/rooftop_04.wav`),character:`girl_01`,live2d:!0,cameraZoom:`speaker_close`,cameraDistance:.7,cameraPreset:`hold`},{id:`rooftop_live2d_6`,speaker:`アオイ`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「……えっ？ ちょっと、待って……どこ見て――きゃあっ！？ わ、わたし、スカートでこんな屈み方……っ！！」`,voiceUrl:z(`/voices/rooftop_05.wav`),character:`girl_01`,live2d:!0,avatar:{faceTexture:z(`/textures/girl_face_blush.png`)},cameraZoom:`speaker_close`,cameraDistance:.65,cameraPreset:`punchIn`,cameraStrength:.9},{id:`rooftop_angry_7`,speaker:`アオイ`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「ば、バカっ！ 見たでしょ今！？ 絶対見えたよね……！？ 最低ぇっ、変態っ！！」`,voiceUrl:z(`/voices/rooftop_06.wav`),character:`girl_01`,live2d:!1,avatar:{visible:!0,position:[0,0,-.9],motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`iraira`},cameraZoom:`speaker`,cameraDistance:1.35,cameraTransitionEasing:`gyuin`,cameraTransitionDuration:.5,cameraPreset:`punchIn`,cameraStrength:1},{id:`rooftop_choice_8`,speaker:``,text:``,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),character:`girl_01`,live2d:!1,avatar:{visible:!0,position:[0,0,-.9],motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`)},cameraZoom:`speaker`,cameraDistance:1.35,cameraPreset:`hold`,choiceDelaySec:.3,choices:[{text:`「ごめん！ でも……すごく綺麗だったから……」`,flag:`rooftop_cute`,goto:`rooftop_route_1`,effectText:`doki`},{text:`「見てない！ 空の雲の形を見てただけ！」`,flag:`rooftop_sky`,goto:`rooftop_route_2`,effectText:`asease`},{text:`「……白でした」`,flag:`rooftop_white`,goto:`rooftop_route_3`,effectText:`gaan`}]},{id:`rooftop_route_1`,conditions:[`rooftop_cute`],speaker:`アオイ`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「〜〜っバカ！ そういうこと堂々と言わないでよ……！ 余計に恥ずかしいじゃん……！」`,voiceUrl:z(`/voices/rooftop_ans_1.wav`),character:`girl_01`,live2d:!1,avatar:{position:[0,0,-.9],motion:z(`/animations/Female Standing Pose.fbx`),expression:`surprised`,expressionWeight:.9,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`doki`},cameraZoom:`speaker_close`,cameraDistance:1.1,cameraPreset:`orbitRightHalf`,cameraStrength:.6,goto:`rooftop_ending`},{id:`rooftop_route_2`,conditions:[`rooftop_sky`],speaker:`アオイ`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「大嘘つき！ 目線が完全に下向いてたの、バッチリ見えてたんだからね……！」`,voiceUrl:z(`/voices/rooftop_ans_2.wav`),character:`girl_01`,live2d:!1,avatar:{position:[0,0,-.9],motion:z(`/animations/Angry.fbx`),expression:`angry`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`gaan`},cameraZoom:`speaker`,cameraDistance:1.2,cameraPreset:`pushIn`,cameraStrength:.8,goto:`rooftop_ending`},{id:`rooftop_route_3`,conditions:[`rooftop_white`],speaker:`アオイ`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`「堂々と報告するなーーっ！！ ほんっと信じられない……！ バカバカバカッ！」`,voiceUrl:z(`/voices/rooftop_ans_3.wav`),character:`girl_01`,live2d:!1,avatar:{position:[0,0,-.9],motion:z(`/animations/Punching.fbx`),expression:`angry`,expressionWeight:1,faceTexture:z(`/textures/girl_face_blush.png`),effectText:`iraira`},cameraTarget:[0,.98,-.9],cameraZoom:`speaker_close`,cameraDistance:1.15,cameraPreset:`punchIn`,cameraStrength:.9,goto:`rooftop_ending`},{id:`rooftop_ending`,speaker:`主人公`,location:`学校・屋上`,screenTransition:`none`,scenePreset:`day_school`,background:z(`/textures/school-rooftop-far.avif`),text:`（……真っ赤な顔で怒るアオイに平謝りしながら、騒がしくも照れくさいお昼休みの時間は過ぎていった。【シナリオ終了】）`,character:`girl_01`,live2d:!1,avatar:{position:[0,0,-.9],motion:z(`/animations/Female Standing Pose.fbx`),expression:`relaxed`,expressionWeight:.7,faceTexture:z(`/textures/girl_face_blush.png`)},cameraZoom:`speaker`,cameraDistance:1.35,cameraPreset:`hold`}]}]};function Hr(e=H()){return Vr}var Ur={id:`ghost-mass`,title:`幽霊の質量（シャフト風）`,hideMessageWindow:!0,instantCameraCut:!0,characters:[{id:`girl_01`,character:`/models/aoi/aoi-school.vrm`,position:`left`},{id:`girl_02`,character:`/models/emili/emili.vrm`,position:`right`}],chapters:[{id:`main`,title:`幽霊の質量`,scenes:[{id:`ghost_0_emili_question`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`教室`,scenePreset:`day_school`,background:`/textures/school-classroom-far2.avif`,text:`アオイ、テストの結果はどうだった？`,voiceUrl:`/voices/shaft_00_emili.wav`,autoNextSec:.6,cameraZoom:`speaker`,cameraPreset:`pushIn`,cameraStrength:.3,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.7},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`}}},{id:`ghost_0_aoi_pause`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,text:`…………`,autoNextSec:1.8,cameraZoom:`speaker`,cameraPreset:`hold`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`relaxed`,expressionWeight:.8},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`}}},{id:`ghost_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`教室`,scenePreset:`day_school`,background:`/textures/school-classroom-far2.avif`,text:`ねぇエミリ`,voiceUrl:`/voices/shaft_01_aoi.wav`,autoNextSec:.6,cameraZoom:`speaker`,cameraPreset:`hold`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.7},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`}}},{id:`ghost_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,text:`なぁに、アオイ？`,voiceUrl:`/voices/shaft_02_emili.wav`,autoNextSec:.6,cameraZoom:`speaker`,cameraPreset:`pushIn`,cameraStrength:.3,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:.5}}},{id:`ghost_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,text:`幽霊って質量あるのかな？`,voiceUrl:`/voices/shaft_03_aoi.wav`,autoNextSec:.6,cameraZoom:`speaker`,cameraPreset:`hold`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`surprised`,expressionWeight:.6},girl_02:{motion:`/animations/Standing Idle.fbx`}}},{id:`ghost_4`,speaker:`アオイ`,speakerCharacterId:`girl_01`,text:`私たちは地球の重力に縛られることによって今この場にいるわけだけど、幽霊はどうなんだろう？`,voiceUrl:`/voices/shaft_04_aoi.wav`,autoNextSec:.6,cameraZoom:`speaker`,cameraPreset:`hold`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:.6},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`}}},{id:`ghost_5_cutin`,speaker:``,text:``,shaftCutIn:`red_trouble`,shaftCutInDuration:1.5,autoNextSec:1.5},{id:`ghost_6_shaft_intro`,speaker:`アオイ`,speakerCharacterId:`girl_01`,shaftMode:!0,text:`例えば私が幽霊になったとする。`,voiceUrl:`/voices/shaft_05_aoi.wav`,autoNextSec:.6,cameraPosition:[-.14,1.28,-.45],cameraTarget:[-.14,1.28,-1.35],cameraFov:24,avatars:{girl_01:{position:[-.1285,.048,-1.3482],rotationY:.26,motion:`/animations/Standing Idle.fbx`,motionSpeed:0,expression:`neutral`},girl_02:{position:[.85,.048,-1.3482],rotationY:-.26,motion:`/animations/Standing Idle.fbx`,expression:`neutral`}}},{id:`ghost_7a_shaft_space_orbit`,speaker:`アオイ`,speakerCharacterId:`girl_01`,shaftMode:!0,shaftSpaceStage:`orbit`,text:`地球は宇宙空間を常に高速で動いてるけど`,voiceUrl:`/voices/shaft_06a_aoi.wav`,autoNextSec:.6,cameraPosition:[0,2.3,5],cameraTarget:[0,.4,0],cameraFov:38,avatars:{girl_01:{visible:!1},girl_02:{visible:!1}}},{id:`ghost_7b_shaft_earth_gravity`,speaker:`アオイ`,speakerCharacterId:`girl_01`,shaftMode:!0,shaftSpaceStage:!1,text:`地球の重力によって、私たちは地球と一緒に動いている。`,voiceUrl:`/voices/shaft_06b_aoi.wav`,autoNextSec:.6,cameraPosition:[0,1.1,2.65],cameraTarget:[0,1.15,0],cameraFov:30,avatars:{girl_01:{visible:!0,position:[-.1285,.048,-1.3482],rotationY:.26},girl_02:{visible:!0,position:[.85,.048,-1.3482],rotationY:-.26,motion:`/animations/Standing Idle.fbx`}}},{id:`ghost_8a_shaft_mass_free`,speaker:`アオイ`,speakerCharacterId:`girl_01`,shaftMode:!0,shaftSpaceStage:!1,text:`もし幽霊に質量がないとしたら、重力に縛られないわけだから、`,voiceUrl:`/voices/shaft_07a_aoi.wav`,autoNextSec:.6,cameraPosition:[0,1.15,3.2],cameraTarget:[0,1.15,0],cameraFov:32,avatars:{girl_01:{visible:!0,position:[-.1285,.048,-1.3482],rotationY:.26,moveTo:{target:[-3.5,.048,-1.3482],duration:1.5}},girl_02:{visible:!0,position:[.85,.048,-1.3482],rotationY:-.26,motion:`/animations/Standing Idle.fbx`}}},{id:`ghost_8b_shaft_left_behind`,speaker:`アオイ`,speakerCharacterId:`girl_01`,shaftMode:!0,shaftSpaceStage:`ghost_left_behind`,text:`地球に置いて行かれて宇宙空間に放り出されちゃうんじゃないかって。`,voiceUrl:`/voices/shaft_07b_aoi.wav`,autoNextSec:.6,cameraPosition:[0,2.3,5],cameraTarget:[0,.4,0],cameraFov:38,avatars:{girl_01:{visible:!1},girl_02:{visible:!1}}},{id:`ghost_9_shaft_room`,speaker:`アオイ`,speakerCharacterId:`girl_01`,shaftMode:!0,shaftSpaceStage:!1,text:`質量があるなら、地球と一緒に動けるから、この部屋にいられる。`,voiceUrl:`/voices/shaft_08_aoi.wav`,autoNextSec:.6,cameraPosition:[0,1.1,2.65],cameraTarget:[0,1.15,0],cameraFov:30,avatars:{girl_01:{visible:!0,position:[-.1285,.048,-1.3482],rotationY:.26,motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1},girl_02:{visible:!0,position:[.85,.048,-1.3482],rotationY:-.26,motion:`/animations/Standing Idle.fbx`}}},{id:`ghost_10_shafudo`,speaker:`エミリ`,speakerCharacterId:`girl_02`,shaftMode:!1,background:`/textures/school-classroom-far2.avif`,text:`質量があるとすると、それはエネルギーを持っていると言うことね`,voiceUrl:`/voices/shaft_09_emili.wav`,autoNextSec:.8,cameraPosition:[.12,1.25,1.25],cameraTarget:[.12,1.25,0],cameraFov:24,avatars:{girl_01:{visible:!1},girl_02:{visible:!0,position:[.1,0,0],rotationY:-48*Math.PI/180,shafudo:!0,eyeLookAtCamera:!0,lookAtCamera:!1,motion:`/animations/Standing Idle.fbx`,expression:`smug`,expressionWeight:.85}}},{id:`ghost_11_emili_mouth`,speaker:`エミリ`,speakerCharacterId:`girl_02`,shaftMode:!1,background:`/textures/school-classroom-far2.avif`,text:`さっきの質問に答える必要はないわ。忘れてちょうだい。`,voiceUrl:`/voices/shaft_10_emili.wav`,autoNextSec:.8,shafudo:!1,cameraPosition:[0,1.345,.24],cameraTarget:[0,1.345,0],cameraFov:20,avatars:{girl_01:{visible:!1},girl_02:{visible:!0,position:[0,0,0],rotationY:0,motion:`/animations/Standing Idle.fbx`,expression:`smug`,expressionWeight:.7}}},{id:`ghost_12_cutin_closed`,speaker:``,text:``,shafudo:!1,shaftCutIn:`green_closed`,shaftCutInDuration:3,autoNextSec:3}]}]};export{dt as A,Qe as B,un as C,J as D,cn as E,Xe as F,Ye as H,Ze as I,et as L,U as M,tt as N,Gt as O,nt as P,V as R,$t as S,sn as T,Ve as U,B as V,Zn as _,Fr as a,gn as b,Er as c,_r as d,hr as f,ar as g,or as h,Rr as i,ut as j,H as k,Cr as l,lr as m,Hr as n,Mr as o,fr as p,Br as r,kr as s,Ur as t,br as u,Vn as v,ln as w,dn as x,_n as y,$e as z};