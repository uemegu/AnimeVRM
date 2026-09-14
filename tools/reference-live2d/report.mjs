import fs from 'node:fs/promises';
import sharp from 'sharp';
import psd from './ag-psd.cjs';
import rigger from './rigger.cjs';
const root='output/reference-live2d';
psd.initializeCanvas(null,(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
const doc=psd.readPsd(await fs.readFile(`${root}/reference-layered.psd`),{useImageData:true});rigger.validatePsd(doc);const rig=rigger.buildRig(doc);
await fs.writeFile(`${root}/rig-validation.json`,JSON.stringify({layers:rig.layers.map(l=>l.name),anchors:rig.anchors,warnings:rig.warnings},null,2));
const a=await sharp(`${root}/gpu-original.png`).raw().toBuffer(),b=await sharp(`${root}/gpu-recomposed.png`).raw().toBuffer();
let max=0,sum=0;for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++){const d=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);max=Math.max(max,d);sum+=d;}
const visibleComparison={premultipliedRGBMaxDifference:max,premultipliedRGBMeanDifference:sum/(a.length/4*3)};
await fs.writeFile(`${root}/gpu-visible-comparison.json`,JSON.stringify(visibleComparison,null,2));
console.log({rigLayers:rig.layers.length,warnings:rig.warnings,visibleComparison});
