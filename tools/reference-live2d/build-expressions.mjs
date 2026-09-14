import fs from 'node:fs/promises';
import sharp from 'sharp';
import psd from './ag-psd.cjs';
const out='output/reference-live2d',pub='public/reference-live2d';
const vowels=['aa','ih','ou','ee','oh'];
const {data:src,info:{width:W,height:H}}=await sharp(`${pub}/reference.png`).raw().toBuffer({resolveWithObject:true});
const {width:AW,height:AH}=await sharp(`${out}/expressions/mouth-atlas-source.png`).metadata();
const entries=[];const psdLayers=[];
const smooth=(lo,hi,v)=>{const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return t*t*(3-2*t)};
const S=128,X=536,Y=484;
for(let row=0;row<2;row++)for(let col=0;col<5;col++){
 const left=Math.round(col*AW/5),top=Math.round(row*AH/2),width=Math.round((col+1)*AW/5)-left,height=Math.round((row+1)*AH/2)-top;
 const tile=await sharp(`${out}/expressions/mouth-atlas-source.png`).extract({left,top,width,height}).resize(S,S).raw().toBuffer();
 const pixels=Buffer.alloc(S*S*4);
 const mean=(data,width,x,y,c)=>{let sum=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)sum+=data[((y+dy)*width+x+dx)*4+c];return sum/25;};
 const targetPlane=Array.from({length:3},(_,c)=>[mean(src,W,X+10,Y+20,c),mean(src,W,X+118,Y+20,c),mean(src,W,X+10,Y+90,c)]);
 const genPlane=Array.from({length:3},(_,c)=>[mean(tile,S,12,35,c),mean(tile,S,115,35,c),mean(tile,S,12,75,c)]);
 // Registration/color matching only. The lip artwork itself is imagegen output.
 // Remove the generated skin lighting using samples outside the drawn lips,
 // and match the source skin gradient on either side of its resting mouth.
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
   const i=(y*S+x)*4,si=((Y+y)*W+X+x)*4;
   const radius=Math.hypot((x-64)/64,(y-58)/58);
   const alpha=1-smooth(.88,1,radius);
   const [ggl,ggr,ggb]=genPlane[1];
   const baselineGreen=ggl+(ggr-ggl)*(x-12)/103+(ggb-ggl)*(y-35)/40;
   const ink=smooth(20,40,baselineGreen-tile[i+1]);
   for(let c=0;c<3;c++){
     const [tl,tr,tb]=targetPlane[c],[gl,gr,gb]=genPlane[c];
     const target=tl+(tr-tl)*(x-10)/108+(tb-tl)*(y-20)/70;
     const gen=gl+(gr-gl)*(x-12)/103+(gb-gl)*(y-35)/40;
     // Outside the lip drawing, use the matched skin plane rather than the
     // generated atlas' soft transparent perimeter.
     const artwork=1-smooth(.72,.95,Math.hypot((x-64)/66,(y-59)/49));
     pixels[i+c]=Math.max(0,Math.min(255,target+(tile[i+c]-gen)*artwork*ink));
   }
   pixels[i+3]=Math.round(src[si+3]*alpha);
 }
 const name=`mouth_${vowels[col]}${row?'_half':''}`,file=`expressions/${name}.png`;
 await sharp(pixels,{raw:{width:S,height:S,channels:4}}).png().toFile(`${pub}/${file}`);
 entries.push({name,file,x:X,y:Y,width:S,height:S,kind:'mouth'});
 psdLayers.push({name,hidden:true,left:X,top:Y,imageData:{width:S,height:S,data:new Uint8ClampedArray(pixels)}});
}
const manifest=JSON.parse(await fs.readFile(`${pub}/manifest.json`));
const eye=manifest.layers.find(l=>l.name==='eye_close');
const eyeMask=await sharp(`${pub}/${eye.file}`).raw().toBuffer();
const half=await sharp(`${out}/expressions/eye-half-source.png`).resize(W,H).extract({left:eye.x,top:eye.y,width:eye.width,height:eye.height}).raw().toBuffer();
for(let i=0;i<half.length;i+=4)half[i+3]=eyeMask[i+3];
await sharp(half,{raw:{width:eye.width,height:eye.height,channels:4}}).png().toFile(`${pub}/expressions/eye_half.png`);
entries.push({...eye,name:'eye_half',file:'expressions/eye_half.png',kind:'eye'});
const openEye=await sharp(`${pub}/reference.png`).extract({left:eye.x,top:eye.y,width:eye.width,height:eye.height}).raw().toBuffer();
for(let i=0;i<openEye.length;i+=4)openEye[i+3]=eyeMask[i+3];
await sharp(openEye,{raw:{width:eye.width,height:eye.height,channels:4}}).png().toFile(`${pub}/expressions/eye_open.png`);
entries.push({...eye,name:'eye_open',file:'expressions/eye_open.png',kind:'eye'});
psdLayers.push({name:'eye_half',hidden:true,left:eye.x,top:eye.y,imageData:{width:eye.width,height:eye.height,data:new Uint8ClampedArray(half)}});
await fs.writeFile(`${pub}/expressions/manifest.json`,JSON.stringify({mouthRegion:{x:X,y:Y,width:S,height:S},entries},null,2));
await sharp({create:{width:S*5,height:S*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(entries.filter(e=>e.kind==='mouth').map((e,i)=>({input:`${pub}/${e.file}`,left:(i%5)*S,top:Math.floor(i/5)*S}))).png().toFile(`${pub}/expressions/mouth-atlas.png`);
psd.initializeCanvas(null,(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
const document=psd.readPsd(await fs.readFile(`${out}/reference-layered.psd`),{useImageData:true});
document.children.push(...psdLayers);
await fs.writeFile(`${out}/reference-expressions.psd`,psd.writePsdBuffer(document,{generateThumbnail:false}));
await fs.copyFile(`${out}/reference-expressions.psd`,`${pub}/reference-expressions.psd`);
// A contact sheet for inspecting all ten registered mouth overlays.
const cells=[];
for(const e of entries.filter(e=>e.kind==='mouth')){
 const original=await sharp(`${pub}/reference.png`).extract({left:X,top:Y,width:S,height:S}).png().toBuffer();
 const composed=await sharp(original).composite([{input:`${pub}/${e.file}`}]).png().toBuffer();
 cells.push(await sharp(composed).resize(256,256).png().toBuffer());
}
await sharp({create:{width:1280,height:512,channels:4,background:'#ffe0ce'}}).composite(cells.map((input,i)=>({input,left:(i%5)*256,top:Math.floor(i/5)*256}))).png().toFile(`${out}/expressions/mouth-contact-sheet.png`);
console.log({expressions:entries.length,psdLayers:document.children.length});
