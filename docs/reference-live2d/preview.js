const $=id=>document.getElementById(id), canvas=$('view');
const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true});
if(!gl)throw new Error('WebGLが利用できません');
const manifest=await fetch('manifest.json').then(r=>r.json()),W=manifest.width,H=manifest.height;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const vs=`attribute vec2 p;uniform float angle,breathing,hairL,hairR,ribbon;uniform vec4 crop;uniform vec2 gaze;uniform float iris;varying vec2 uv;
float bell(vec2 p,vec2 c,vec2 s){vec2 q=(p-c)/s;return exp(-dot(q,q)*2.0);}
void main(){vec2 q=p;float hw=1.0-smoothstep(600.0,1050.0,p.y);vec2 pivot=vec2(725.0,516.0);vec2 d=p-pivot;float a=angle*hw; q=pivot+mat2(cos(a),sin(a),-sin(a),cos(a))*d;
 q.y-=breathing*3.0*(1.0-smoothstep(620.0,1190.0,p.y));
 q.x+=hairL*bell(p,vec2(335.0,545.0),vec2(100.0,140.0));
 q.x+=hairR*bell(p,vec2(827.0,452.0),vec2(52.0,115.0));
 q.x+=ribbon*bell(p,vec2(570.0,930.0),vec2(53.0,125.0));
 uv=(p-crop.xy)/crop.zw;gl_Position=vec4((q.x/${W}.0*2.0-1.0)*0.94,(1.0-q.y/${H}.0*2.0)*0.94,0,1);}`;
const frag=`precision highp float;uniform sampler2D tex;uniform float opacity,iris;uniform vec2 gaze;uniform vec4 crop;varying vec2 uv;void main(){if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)discard;vec4 c=texture2D(tex,uv);if(iris>0.5){vec4 shifted=texture2D(tex,uv-gaze/crop.zw);c.rgb=mix(vec3(0.96,0.94,0.95)*c.a,shifted.rgb*c.a/max(shifted.a,0.001),min(1.0,shifted.a/max(c.a,0.001)));}gl_FragColor=vec4(c.rgb*opacity,c.a*opacity);}`;
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const u={};for(const n of ['angle','breathing','hairL','hairR','ribbon','crop','gaze','iris','opacity'])u[n]=gl.getUniformLocation(program,n);
// All pieces use the SAME global triangulation and deformation field. Vertices
// on the cheek/hand boundary cannot separate, including at the 5-degree limit.
const vertices=[],nx=90,ny=120;for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let l=x*W/nx,r=(x+1)*W/nx,t=y*H/ny,b=(y+1)*H/ny;vertices.push(l,t,r,t,l,b,l,b,r,t,r,b);}
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);let a=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
async function texture(file){const im=new Image();im.src=file;await im.decode();const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);return t;}
for(const l of manifest.layers)l.texture=await texture(l.file);const original={name:'original',x:-2,y:-2,width:W+4,height:H+4,texture:await texture('reference-padded.png')};
const flags={blink:true,gaze:true,breath:true,head:true,hair:true,ribbon:true};for(const k in flags)$(k).onchange=()=>flags[k]=$(k).checked;
let paused=false,compare=false,neutral=false,clock=0,last=performance.now(),forced=-10,mode='all',frozenOverrides={};
const spring={l:{x:0,v:0},r:{x:0,v:0},ribbon:{x:0,v:0}};
function step(s,target,dt){s.v+=(target-s.x)*18*dt;s.v*=Math.exp(-6*dt);s.x+=s.v*dt;return s.x;}
function pause(){paused=!paused;$('pause').textContent=paused?'再生する':'一時停止';}
$('pause').onclick=pause;document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT'].includes(e.target.tagName)){e.preventDefault();pause();}});
$('original').onclick=()=>{compare=!compare;$('original').textContent=compare?'アニメーションへ戻る':'原画と比較';};$('neutral').onclick=()=>{neutral=!neutral;$('neutral').textContent=neutral?'動きに戻す':'ニュートラル姿勢';};$('angle').oninput=()=>$('angleLabel').textContent=`${$('angle').value}°`;$('mode').onchange=()=>mode=$('mode').value;$('close').onclick=()=>forced=clock;
function blinkAt(t){const cycle=t%4.9;const p=(cycle-3.5)/.24;return p>=0&&p<=1?Math.sin(p*Math.PI)**1.1:0;}
let current={};
function render(t,dt=1/60,override={}){
 const still=neutral||compare;let angle=still?0:Math.min(5,Math.max(0,+$('angle').value))*Math.PI/180*Math.sin(t*.49)*(flags.head?1:0);
 let breathing=still?0:Math.sin(t*1.35)*(flags.breath?1:0),blink=still?0:Math.max(flags.blink?blinkAt(t):0,(t-forced>=0&&t-forced<.45)?Math.sin((t-forced)/.45*Math.PI):0);
 let hl=step(spring.l,flags.hair&&!still?Math.sin(t*1.4)*1.25:0,dt),hr=step(spring.r,flags.hair&&!still?Math.sin(t*1.23+1)*.8:0,dt),rb=step(spring.ribbon,flags.ribbon&&!still?Math.sin(t*1.1)*.7:0,dt);
 if(still){hl=hr=rb=0;}let gx=flags.gaze&&!still?Math.sin(t*.7)*.7:0,gy=flags.gaze&&!still?Math.sin(t*.43)*.35:0;
 ({angle,blink,breathing,hl,hr,rb,gx,gy}={angle,blink,breathing,hl,hr,rb,gx,gy,...override});
 for(const [key,val]of Object.entries({angle,breathing,hairL:hl,hairR:hr,ribbon:rb}))gl.uniform1f(u[key],val);gl.uniform2f(u.gaze,gx,gy);
 gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ONE,gl.ONE);
 let ls=compare?[original]:manifest.layers;
 // Closing patches sit beneath the open eyes, which fade away together.
 if(mode==='all'&&!compare){ls=ls.filter(l=>l.name!=='eye_close');ls.splice(ls.findIndex(l=>l.name==='eyewhite'),0,manifest.layers.find(l=>l.name==='eye_close'));}
 for(const l of ls){
  if(!compare&&mode!=='all'&&!(mode==='hair'?l.name.includes('hair'):l.name===mode))continue;
  let opacity=1;if(mode==='all'&&!compare){if(l.name==='underpaint')continue;if(l.name==='eye_close')opacity=blink;else if(['eyewhite','irides','eyelash'].includes(l.name))opacity=1-blink;}
  gl.uniform1f(u.opacity,opacity);gl.uniform1f(u.iris,l.name==='irides'?1:0);gl.uniform4f(u.crop,l.x,l.y,l.width,l.height);gl.bindTexture(gl.TEXTURE_2D,l.texture);gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);
 }
 current={time:t,angleDegrees:angle*180/Math.PI,blink,gaze:[gx,gy],breathing,hair:[hl,hr],ribbon:rb,contactConstraint:'shared global vertices and vertex shader for face and hand',webglError:gl.getError()};
 $('metrics').textContent=`頭 ${current.angleDegrees.toFixed(2)}° · 接触点を共有 · ${manifest.layers.length} layers`;
}
function frame(now){const dt=Math.min((now-last)/1000,.033);last=now;if(!paused)clock+=dt;render(clock,paused?0:dt,paused?frozenOverrides:{});requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.referenceRig={manifest,get state(){return current},sample(t,overrides={}){paused=true;clock=t;frozenOverrides=overrides;render(t,1/60,overrides);return current},setMode(m){mode=m},setNeutral(v){neutral=v},setCompare(v){compare=v},setAngle(a){$('angle').value=String(a)},resume(){paused=false;frozenOverrides={}},ready:true};$('status').textContent='LIVE · WebGL / 頬杖の接触を保持';
