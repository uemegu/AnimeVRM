import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${process.cwd()}/public/voices/lipsync_vowels_female.mp3`]});
const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:8877/?test=expressions');await page.waitForFunction(()=>window.referenceRig?.ready);
const out='output/reference-live2d/expressions';
const captures=[];
for(const name of ['aa','ih','ou','ee','oh'])for(const half of [false,true]){
 const key=`mouth_${name}${half?'_half':''}`;
 const state=await page.evaluate(key=>window.referenceRig.sample(0,{blink:0,angle:0,breathing:0,hl:0,hr:0,rb:0,gx:0,gy:0,mouthWeights:{[key]:1}}),key);
 assert.equal(state.webglError,0);const url=await page.locator('#view').evaluate(c=>c.toDataURL());const buffer=Buffer.from(url.split(',')[1],'base64');
 await fs.writeFile(`${out}/${key}-render.png`,buffer);captures.push({name:key,buffer});
}
const eyeCaptures=[];
for(const blink of [0,.25,.5,.75,1]){
 await page.evaluate(blink=>window.referenceRig.sample(0,{blink,angle:0,breathing:0,hl:0,hr:0,rb:0,mouthWeights:{}}),blink);
 const url=await page.locator('#view').evaluate(c=>c.toDataURL());const buffer=Buffer.from(url.split(',')[1],'base64');await fs.writeFile(`${out}/blink-${blink}-render.png`,buffer);eyeCaptures.push(buffer);
}
await page.evaluate(()=>window.referenceRig.sample(0,{blink:0,angle:0,blush:1,mouthWeights:{}}));await page.screenshot({path:`${out}/blush-preview.png`});
const blushURL=await page.locator('#view').evaluate(c=>c.toDataURL());await fs.writeFile(`${out}/blush-render.png`,Buffer.from(blushURL.split(',')[1],'base64'));
const faceCrop={left:350,top:320,width:400,height:300};
const smallMouth=[];for(const c of captures){smallMouth.push(await sharp(c.buffer).extract({left:530,top:480,width:140,height:140}).png().toBuffer());}
await sharp({create:{width:700,height:280,channels:4,background:'#eee7e2'}}).composite(smallMouth.map((input,i)=>({input,left:Math.floor(i/2)*140,top:i%2*140}))).png().toFile(`${out}/mouth-render-sheet.png`);
const eyes=[];for(const b of eyeCaptures)eyes.push(await sharp(b).extract(faceCrop).resize(320,240).png().toBuffer());
await sharp({create:{width:1600,height:240,channels:4,background:'#eee7e2'}}).composite(eyes.map((input,i)=>({input,left:i*320,top:0}))).png().toFile(`${out}/blink-render-sheet.png`);
await page.evaluate(()=>{window.referenceRig.resume();});
await page.locator('#vowel').selectOption('aa');await page.waitForFunction(()=>window.referenceRig.state.expression.openness>.9,{},{timeout:10000});
assert((await page.evaluate(()=>window.referenceRig.state.expression.openness))>.9);
await page.locator('#vowel').selectOption('ih');await page.waitForTimeout(75);assert((await page.evaluate(()=>window.referenceRig.state.expression.rest))<.01);
await page.locator('#opening').fill('0.5');await page.locator('#opening').dispatchEvent('input');await page.waitForTimeout(600);assert(Math.abs((await page.evaluate(()=>window.referenceRig.state.expression.inputOpenness))-.5)<.03);
await page.locator('#blush').fill('0.7');await page.locator('#blush').dispatchEvent('input');await page.waitForTimeout(800);assert((await page.evaluate(()=>window.referenceRig.state.blush))>.6);
// Exercise the real file/audio analysis path with a local existing voice sample.
await page.locator('#audioFile').setInputFiles('public/voices/lipsync_vowels_female.mp3');await page.locator('#audioPlay').click();
await page.waitForTimeout(500);
const audioStates=[];for(let i=0;i<8;i++){audioStates.push(await page.evaluate(()=>window.referenceRig.state.expression));await page.waitForTimeout(120);}
assert(audioStates.some(s=>s.inputOpenness>.2),'real audio never drove articulation');
await page.locator('#audioPlay').click();
await page.locator('#microphone').click();await page.waitForFunction(()=>document.getElementById('microphone').textContent==='マイクを停止');
await page.waitForFunction(()=>window.referenceRig.state.expression.inputOpenness>.2,{},{timeout:10000});
await page.locator('#microphone').click();assert.equal(await page.locator('#microphone').textContent(),'マイクで話す');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile-controls.png`,fullPage:true});
assert.equal(errors.length,0);await fs.writeFile(`${out}/browser-tests.json`,JSON.stringify({errors,mouthTextures:captures.map(c=>c.name),blinkStates:[0,.25,.5,.75,1],realAudioActive:audioStates.some(s=>s.inputOpenness>.2),audioStates,syntheticMicrophoneStartStop:true,manualControls:true,mobile:true},null,2));
await browser.close();console.log('Passed 10 mouths, 5 blink states, blush, transitions, real audio file, mobile controls');
