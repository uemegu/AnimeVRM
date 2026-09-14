import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ExpressionController,VOWELS,blinkWeights} from '../../public/reference-live2d/expression-controller.js';
const pairs=[];
for(const from of VOWELS)for(const to of VOWELS){if(from===to)continue;
 const c=new ExpressionController();c.setPhoneme(from);for(let i=0;i<100;i++)c.update(1/60);
 c.setPhoneme(to);let min=1,maxRest=0,usedHalf=false;
 for(let i=0;i<60;i++){const s=c.update(1/60);min=Math.min(min,s.openness);maxRest=Math.max(maxRest,s.rest);usedHalf ||= VOWELS.some(v=>s.weights[`mouth_${v}_half`]>.1);assert(Math.abs(Object.values(s.weights).reduce((a,b)=>a+b,0)+s.rest-1)<1e-8);}
 assert(maxRest<.001,`${from}->${to} closed during speech`);assert(usedHalf);pairs.push({from,to,minOpenness:min,maxRest,usedHalf});
}
const c=new ExpressionController();c.setPhoneme('aa');for(let i=0;i<100;i++)c.update(1/60);c.setPhoneme('nn');for(let i=0;i<4;i++)c.update(1/60);assert(c.state.openness>.99,'brief silence closed mouth');c.stopSpeaking();for(let i=0;i<90;i++)c.update(1/60);assert(c.state.rest>.999);
c.setVisemes({aa:NaN,ih:Infinity});c.setBlush(Infinity);assert(Number.isFinite(c.update(1/60).openness));
for(let i=0;i<=100;i++){const w=blinkWeights(i/100);assert(Math.abs(w.open+w.half+w.closed-1)<1e-10);}assert.deepEqual(blinkWeights(.5),{open:0,half:1,closed:0});
const report={pairs,briefSilenceHold:true,explicitStop:true,blinkIntermediate:true,invalidInputsFinite:true};await fs.writeFile('output/reference-live2d/expressions/controller-tests.json',JSON.stringify(report,null,2));console.log('Passed 20 vowel transitions, silence hold, stop, blink basis, invalid inputs');
