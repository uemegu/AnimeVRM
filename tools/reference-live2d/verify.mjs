import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1250,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:8877');await page.waitForFunction(()=>window.referenceRig?.ready);
const samples=[];
for(const t of [0,1,3.5,3.62,3.74,5,10,20]){samples.push(await page.evaluate(t=>window.referenceRig.sample(t),t));}
assert(samples.every(s=>s.webglError===0));assert(samples.some(s=>s.blink>.99));assert(samples.every(s=>Math.abs(s.angleDegrees)<=5));
await page.evaluate(()=>{window.referenceRig.setNeutral(true);window.referenceRig.sample(0)});
await page.screenshot({path:'output/reference-live2d/preview-neutral.png'});
const gpuBuffers=[];
for(const compare of [false,true]){
 const url=await page.evaluate(c=>{window.referenceRig.setCompare(c);window.referenceRig.sample(0);return document.getElementById('view').toDataURL()},compare);
 const bytes=Buffer.from(url.split(',')[1],'base64');
 await fs.writeFile(`output/reference-live2d/gpu-${compare?'original':'recomposed'}.png`,bytes);gpuBuffers.push(await sharp(bytes).raw().toBuffer());
}
await page.evaluate(()=>window.referenceRig.setCompare(false));
let maxGPU=0,sumGPU=0,changedGPU=0;for(let i=0;i<gpuBuffers[0].length;i++){let d=Math.abs(gpuBuffers[0][i]-gpuBuffers[1][i]);maxGPU=Math.max(maxGPU,d);sumGPU+=d;if(d)changedGPU++;}
const gpuComparison={maxChannelDifference:maxGPU,meanAbsoluteDifference:sumGPU/gpuBuffers[0].length,changedChannels:changedGPU};
await fs.writeFile('output/reference-live2d/gpu-comparison.json',JSON.stringify(gpuComparison,null,2));
for(const [name,override]of [['closed',{blink:1}],['head-plus5',{angle:5*Math.PI/180}],['head-minus5',{angle:-5*Math.PI/180}]]){
 const endpoint=await page.evaluate(o=>{window.referenceRig.setNeutral(false);return window.referenceRig.sample(3.62,o)},override);
 if(override.angle)assert(Math.abs(endpoint.angleDegrees-override.angle*180/Math.PI)<.001);
 await page.screenshot({path:`output/reference-live2d/preview-${name}.png`});
}
await page.evaluate(()=>{window.referenceRig.setNeutral(true);window.referenceRig.setMode('handwear');window.referenceRig.sample(0)});
await page.screenshot({path:'output/reference-live2d/hand-layer.png'});
await page.evaluate(()=>{window.referenceRig.setMode('face');window.referenceRig.sample(0)});await page.screenshot({path:'output/reference-live2d/face-layer.png'});
await page.evaluate(()=>{window.referenceRig.setMode('all');window.referenceRig.setNeutral(false);window.referenceRig.resume()});
await page.locator('#pause').click();await page.locator('#original').click();await page.locator('#original').click();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/reference-live2d/preview-mobile.png'});
assert.equal(errors.length,0);await fs.writeFile('output/reference-live2d/browser-validation.json',JSON.stringify({errors,samples,checks:['WebGL rendered','auto blink reached full closure','head within 5 degrees','both angle endpoints rendered','layer inspection','pause and comparison controls','mobile layout']},null,2));
console.log(JSON.stringify({errors,samples:samples.length,gpuComparison,result:'passed'}));await browser.close();
