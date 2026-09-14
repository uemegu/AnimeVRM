import {ExpressionController, VOWELS, blinkWeights} from './expression-controller.js';
import {AudioLipSync} from './audio-analyser.js';
const $=id=>document.getElementById(id), canvas=$('view');
const expressions=new ExpressionController();
const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true});
if(!gl)throw new Error('WebGLが利用できません');
const manifest=await fetch('manifest.json').then(r=>r.json()),W=manifest.width,H=manifest.height;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const vs=`attribute vec2 p;uniform float angle,breathing,hairL,hairR,ribbon;uniform vec4 crop;uniform vec2 gaze;uniform float iris;varying vec2 uv;varying vec2 sourcePoint;
float bell(vec2 p,vec2 c,vec2 s){vec2 q=(p-c)/s;return exp(-dot(q,q)*2.0);}
void main(){vec2 q=p;float hw=1.0-smoothstep(600.0,1050.0,p.y);vec2 pivot=vec2(725.0,516.0);vec2 d=p-pivot;float a=angle*hw; q=pivot+mat2(cos(a),sin(a),-sin(a),cos(a))*d;
 q.y-=breathing*3.0*(1.0-smoothstep(620.0,1190.0,p.y));
 q.x+=hairL*bell(p,vec2(335.0,545.0),vec2(100.0,140.0));
 q.x+=hairR*bell(p,vec2(827.0,452.0),vec2(52.0,115.0));
 q.x+=ribbon*bell(p,vec2(570.0,930.0),vec2(53.0,125.0));
 uv=(p-crop.xy)/crop.zw;sourcePoint=p;gl_Position=vec4((q.x/${W}.0*2.0-1.0)*0.94,(1.0-q.y/${H}.0*2.0)*0.94,0,1);}`;
const frag=`precision highp float;uniform sampler2D tex;uniform float opacity,iris,blush,wet,mouthMode,eyeStage,eyeClosure;uniform float mouthWeights[10];uniform vec2 gaze;uniform vec4 crop;varying vec2 uv;varying vec2 sourcePoint;
float spot(vec2 center,vec2 size){vec2 d=(sourcePoint-center)/size;return exp(-dot(d,d)*2.0);}
void main(){if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)discard;
vec4 c=texture2D(tex,uv);
if(eyeStage>=0.0){
 vec2 center=sourcePoint.x<560.0?vec2(464.0,443.0):vec2(665.0,379.0);
 float localY=sourcePoint.y-center.y+(sourcePoint.x-center.x)*0.30;
 float targetLid=mix(-19.0,8.0,eyeClosure),sourceLid=mix(-19.0,8.0,eyeStage);
 float mappedY=localY<targetLid?mix(-45.0,sourceLid,clamp((localY+45.0)/(targetLid+45.0),0.0,1.0)):mix(sourceLid,28.0,clamp((localY-targetLid)/(28.0-targetLid),0.0,1.0));
 if(localY<=-45.0||localY>=28.0||abs(eyeClosure-eyeStage)<0.00001)mappedY=localY;
 float eyeInfluence=1.0-smoothstep(39.0,54.0,abs(sourcePoint.x-center.x));
 vec2 coord=uv+vec2(0.0,(mappedY-localY)*eyeInfluence/crop.w);
 float pupil=spot(center,vec2(24.0,23.0));coord-=gaze/crop.zw*pupil*(1.0-eyeClosure);
 vec4 sampleEye=texture2D(tex,coord);
 if(sampleEye.a>0.1)c.rgb=sampleEye.rgb*c.a/sampleEye.a;
}
if(mouthMode>0.5){c=vec4(0.0);for(int i=0;i<10;i++){float f=float(i);vec2 tile=vec2(mod(f,5.0),floor(f/5.0));c+=texture2D(tex,(tile+uv)/vec2(5.0,2.0))*mouthWeights[i];}}
if(iris>0.5){vec4 shifted=texture2D(tex,uv-gaze/crop.zw);c.rgb=mix(vec3(0.96,0.94,0.95)*c.a,shifted.rgb*c.a/max(shifted.a,0.001),min(1.0,shifted.a/max(c.a,0.001)));}
float cheeks=spot(vec2(473.0,493.0),vec2(55.0,29.0))+spot(vec2(690.0,439.0),vec2(38.0,26.0));
c.rgb=mix(c.rgb,vec3(0.97,0.40,0.49)*c.a,min(0.30,cheeks*blush*0.30));
float highlights=spot(vec2(476.0,430.0)+gaze,vec2(5.0,6.0))+spot(vec2(666.0,367.0)+gaze,vec2(5.0,6.0));
float rim=spot(vec2(478.0,458.0)+gaze,vec2(14.0,3.0))+spot(vec2(665.0,397.0)+gaze,vec2(13.0,3.0));
float purple=smoothstep(0.025,0.10,(c.b-c.g)/max(c.a,0.001));
c.rgb=mix(c.rgb,vec3(1.0,0.95,1.0)*c.a,min(0.65,wet*(highlights*.65+rim*.32)*purple));
gl_FragColor=vec4(c.rgb*opacity,c.a*opacity);}`;
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const u={};for(const n of ['angle','breathing','hairL','hairR','ribbon','crop','gaze','iris','opacity','blush','wet','mouthMode','mouthWeights','eyeStage','eyeClosure'])u[n]=gl.getUniformLocation(program,n==='mouthWeights'?'mouthWeights[0]':n);
// All pieces use the SAME global triangulation and deformation field. Vertices
// on the cheek/hand boundary cannot separate, including at the 5-degree limit.
const vertices=[],nx=60,ny=80;for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let l=x*W/nx,r=(x+1)*W/nx,t=y*H/ny,b=(y+1)*H/ny;vertices.push(l,t,r,t,l,b,l,b,r,t,r,b);}
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);let a=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
async function texture(file){const im=new Image();im.src=file;await im.decode();const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);return t;}
for(const l of manifest.layers)l.texture=await texture(l.file);const original={name:'original',x:-2,y:-2,width:W+4,height:H+4,texture:await texture('reference-padded.png')};
const expressionManifest=await fetch('expressions/manifest.json').then(r=>r.json());
const halfEye=expressionManifest.entries.find(e=>e.name==='eye_half');halfEye.texture=await texture(halfEye.file);
const openEye=expressionManifest.entries.find(e=>e.name==='eye_open');openEye.texture=await texture(openEye.file);
const mouthAtlas={...expressionManifest.mouthRegion,texture:await texture('expressions/mouth-atlas.png')};
const flags={blink:true,gaze:true,breath:true,head:true,hair:true,ribbon:true};for(const k in flags)$(k).onchange=()=>flags[k]=$(k).checked;
let paused=false,compare=false,neutral=false,clock=0,last=performance.now(),forced=-10,halfUntil=-1,mode='all',frozenOverrides={};
$('halfBlink').onclick=()=>{halfUntil=clock+1.5;};
let mouthSource='manual',demo=false,manualVowel='rest',audioLoaded=false;
const audio=new AudioLipSync({onStatsUpdate(stats){if(mouthSource==='audio')expressions.setPhoneme(stats.phoneme,Math.min(1,.5+stats.rms*6));},onPlayStateChange(playing){$('audioPlay').textContent=playing?'音声を一時停止':'音声を再生';if(!playing&&mouthSource==='audio')expressions.stopSpeaking();},onEnded(){if(mouthSource==='audio')expressions.stopSpeaking();},onError(error){$('audioStatus').textContent=error.message;}});
function stopAudio(){audio.pause();audio.stopMicrophone();$('microphone').textContent='マイクで話す';}
function manual(){mouthSource='manual';demo=false;stopAudio();$('lipDemo').textContent='連続発話デモ';expressions.setPhoneme(manualVowel,+$('opening').value);}
$('vowel').onchange=()=>{manualVowel=$('vowel').value;manual();};$('opening').oninput=()=>{$('openingLabel').textContent=`${Math.round(+$('opening').value*100)}%`;manual();};
$('lipDemo').onclick=()=>{demo=!demo;mouthSource='manual';stopAudio();$('lipDemo').textContent=demo?'デモを停止':'連続発話デモ';if(!demo)expressions.stopSpeaking();};
$('blush').oninput=()=>{expressions.setBlush(+$('blush').value);$('blushLabel').textContent=`${Math.round(+$('blush').value*100)}%`;};
$('audioFile').onchange=()=>{const file=$('audioFile').files[0];if(!file)return;stopAudio();demo=false;mouthSource='audio';audio.loadAudioFile(file);audioLoaded=true;$('audioStatus').textContent=file.name;};
$('audioPlay').onclick=async()=>{if(!audioLoaded){$('audioStatus').textContent='音声ファイルを選んでください';return;}try{demo=false;mouthSource='audio';audio.stopMicrophone();if(audio.isPlaying)audio.pause();else await audio.play();}catch(e){$('audioStatus').textContent=e.message;}};
$('microphone').onclick=async()=>{try{if(audio.isMicrophoneActive){audio.stopMicrophone();expressions.stopSpeaking();$('microphone').textContent='マイクで話す';}else{audio.pause();demo=false;mouthSource='audio';await audio.startMicrophone();$('microphone').textContent='マイクを停止';$('audioStatus').textContent='マイク入力中';}}catch(e){$('audioStatus').textContent=e.message;}};
window.addEventListener('pagehide',()=>audio.dispose());
const spring={l:{x:0,v:0},r:{x:0,v:0},ribbon:{x:0,v:0}};
function step(s,target,dt){s.v+=(target-s.x)*18*dt;s.v*=Math.exp(-6*dt);s.x+=s.v*dt;return s.x;}
function pause(){paused=!paused;$('pause').textContent=paused?'再生する':'一時停止';}
$('pause').onclick=pause;document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT'].includes(e.target.tagName)){e.preventDefault();pause();}});
$('original').onclick=()=>{compare=!compare;$('original').textContent=compare?'アニメーションへ戻る':'原画と比較';};$('neutral').onclick=()=>{neutral=!neutral;$('neutral').textContent=neutral?'動きに戻す':'ニュートラル姿勢';};$('angle').oninput=()=>$('angleLabel').textContent=`${$('angle').value}°`;$('mode').onchange=()=>mode=$('mode').value;$('close').onclick=()=>forced=clock;
function blinkAt(t){const cycle=t%4.9;const p=(cycle-3.5)/.24;return p>=0&&p<=1?Math.sin(p*Math.PI)**1.1:0;}
let current={};
function render(t,dt=1/60,override={}){
 if(demo)expressions.setPhoneme(VOWELS[Math.floor(t/.64)%5],.95);
 const expression=expressions.update(dt);
 const still=neutral||compare;let angle=still?0:Math.min(5,Math.max(0,+$('angle').value))*Math.PI/180*Math.sin(t*.49)*(flags.head?1:0);
 let breathing=still?0:Math.sin(t*1.35)*(flags.breath?1:0),blink=still?0:Math.max(flags.blink?blinkAt(t):0,(t-forced>=0&&t-forced<.45)?Math.sin((t-forced)/.45*Math.PI):0);
 if(!still&&t<halfUntil)blink=.5;
 let hl=step(spring.l,flags.hair&&!still?Math.sin(t*1.4)*1.25:0,dt),hr=step(spring.r,flags.hair&&!still?Math.sin(t*1.23+1)*.8:0,dt),rb=step(spring.ribbon,flags.ribbon&&!still?Math.sin(t*1.1)*.7:0,dt);
 if(still){hl=hr=rb=0;}let gx=flags.gaze&&!still?Math.sin(t*.7)*.7:0,gy=flags.gaze&&!still?Math.sin(t*.43)*.35:0;
 ({angle,blink,breathing,hl,hr,rb,gx,gy}={angle,blink,breathing,hl,hr,rb,gx,gy,...override});
 const eyeWeights=blinkWeights(blink),blushValue=still?0:(override.blush??expression.blush);
 for(const [key,val]of Object.entries({angle,breathing,hairL:hl,hairR:hr,ribbon:rb}))gl.uniform1f(u[key],val);gl.uniform2f(u.gaze,gx,gy);
 gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ONE,gl.ONE);
 let ls=compare?[original]:[...manifest.layers,halfEye,openEye];
 // Closing patches sit beneath the open eyes, which fade away together.
 gl.uniform1f(u.mouthMode,0);
 for(const l of ls){
  if(!compare&&mode!=='all'&&!(mode==='hair'?l.name.includes('hair'):l.name===mode))continue;
  let opacity=1;if(mode==='all'&&!compare){if(['underpaint','eyewhite','irides','eyelash'].includes(l.name))continue;if(l.name==='eye_close')opacity=eyeWeights.closed;else if(l.name==='eye_half')opacity=eyeWeights.half;else if(l.name==='eye_open')opacity=eyeWeights.open;}
  gl.uniform1f(u.eyeStage,l.name==='eye_open'?0:l.name==='eye_half'?.5:l.name==='eye_close'?1:-1);gl.uniform1f(u.eyeClosure,mode==='all'?blink:l.name==='eye_half'?.5:1);
  gl.uniform1f(u.blush,l.name==='face'?blushValue:0);gl.uniform1f(u.wet,['irides','eye_half','eye_open'].includes(l.name)?blushValue:0);
  gl.uniform1f(u.opacity,opacity);gl.uniform1f(u.iris,l.name==='irides'?1:0);gl.uniform4f(u.crop,l.x,l.y,l.width,l.height);gl.bindTexture(gl.TEXTURE_2D,l.texture);gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);
 }
 if(!still&&mode==='all'){
   gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   gl.uniform1f(u.mouthMode,1);gl.uniform1f(u.eyeStage,-1);gl.uniform1f(u.opacity,1);gl.uniform1f(u.iris,0);gl.uniform1f(u.blush,0);gl.uniform1f(u.wet,0);
   const weights=override.mouthWeights??expression.weights;
   gl.uniform1fv(u.mouthWeights,new Float32Array([...VOWELS.map(v=>weights[`mouth_${v}`]??0),...VOWELS.map(v=>weights[`mouth_${v}_half`]??0)]));
   gl.uniform4f(u.crop,mouthAtlas.x,mouthAtlas.y,mouthAtlas.width,mouthAtlas.height);gl.bindTexture(gl.TEXTURE_2D,mouthAtlas.texture);gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);
 }
 current={time:t,angleDegrees:angle*180/Math.PI,blink,eyeWeights,expression,blush:blushValue,gaze:[gx,gy],breathing,hair:[hl,hr],ribbon:rb,contactConstraint:'shared global vertices and vertex shader for face and hand',webglError:gl.getError()};
 $('metrics').textContent=`頭 ${current.angleDegrees.toFixed(2)}° · 接触点を共有 · ${manifest.layers.length} layers`;
}
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!paused)clock+=dt;render(clock,paused?0:dt,paused?frozenOverrides:{});requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.referenceRig={manifest,expressionManifest,get state(){return current},setVisemes(weights,openness){demo=false;mouthSource='external';expressions.setVisemes(weights,openness);},setPhoneme(v,openness=1){demo=false;mouthSource='external';expressions.setPhoneme(v,openness);},stopSpeaking(){expressions.stopSpeaking();},setBlush(v){expressions.setBlush(v);},sample(t,overrides={}){paused=true;clock=t;frozenOverrides=overrides;render(t,1/60,overrides);return current},setMode(m){mode=m},setNeutral(v){neutral=v},setCompare(v){compare=v},setAngle(a){$('angle').value=String(a)},resume(){paused=false;frozenOverrides={}},ready:true};$('status').textContent='LIVE · WebGL / 頬杖の接触を保持';
