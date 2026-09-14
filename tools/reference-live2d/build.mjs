import fs from 'node:fs/promises';
import sharp from 'sharp';
import psd from './ag-psd.cjs';
const out='output/reference-live2d', pub='public/reference-live2d';
const source='/Users/ueda/Downloads/reference.png';
const {data:src,info:{width:W,height:H}}=await sharp(source).raw().toBuffer({resolveWithObject:true});
const N=W*H;
const hidden=await sharp(`${out}/hidden-underpainting.png`).resize(W,H).raw().toBuffer();
const closed=await sharp(`${out}/blink-source.png`).raw().toBuffer();
await fs.mkdir(`${pub}/layers`,{recursive:true});
await fs.copyFile(source,`${pub}/reference.png`);
await sharp(source).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(`${pub}/reference-padded.png`);
async function mask(path){const a=await sharp(Buffer.from(`<svg width="${W}" height="${H}"><path d="${path}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();return Uint8Array.from({length:N},(_,i)=>a[i*4+3]>127?1:0)}
// Paths trace the supplied artwork in original image coordinates. They are
// ownership masks, not painted replacement pixels. Every source pixel has one owner.
const paths={
 head:'M 200 0 H 900 V 540 L 798 594 L 710 612 L 621 617 L 509 592 L 496 671 L 385 644 L 241 575 L 200 490 Z',
 face:'M 397 313 L 422 320 L 450 388 L 476 407 L 505 393 L 598 366 L 640 263 L 697 307 L 721 375 L 750 411 L 756 484 L 733 531 L 682 580 L 623 618 Q 505 599 451 548 L 414 514 L 397 477 Z',
 hand:'M 721 467 Q 734 451 755 465 L 777 490 L 796 439 Q 807 433 815 444 L 834 475 L 835 497 L 819 538 Q 818 567 799 586 L 704 650 L 736 741 L 737 757 L 660 809 Q 643 746 633 689 Q 617 630 628 604 Q 646 569 700 540 L 723 524 L 716 506 L 720 489 Z',
 ribbon:'M 565 714 L 584 714 L 611 758 L 646 731 L 656 750 L 632 771 L 651 784 L 631 807 L 619 806 L 635 1008 L 608 1010 L 612 819 L 571 1004 L 546 1005 L 578 832 Q 544 881 525 880 Q 501 865 484 839 Q 488 815 513 798 L 559 773 L 586 759 Z',
 leftHair:'M 200 0 L 410 0 L 401 260 Q 397 370 420 458 Q 435 551 519 631 L 500 668 Q 401 650 336 598 L 201 538 Z',
 rightHair:'M 631 0 L 900 0 L 900 601 L 781 610 L 714 546 Q 752 475 721 367 Q 708 229 631 0 Z',
 eyeL:'M 403 430 Q 438 393 478 404 Q 501 408 508 426 L 506 453 Q 471 478 435 475 L 413 464 Z',
 eyeR:'M 615 367 Q 647 334 687 339 L 713 350 L 719 378 Q 704 408 666 412 L 636 410 L 617 399 Z',
 irisL:'M 444 418 Q 470 408 490 422 Q 511 446 487 465 Q 461 480 447 456 Z',
 irisR:'M 639 353 Q 664 340 685 357 Q 701 380 685 401 Q 655 419 638 394 Z',
 mouth:'M 558 521 L 640 516 L 645 536 L 600 554 L 558 553 Z',
 brow:'M 398 368 Q 424 344 448 348 L 450 357 Q 423 355 401 378 Z M 581 300 Q 624 281 666 292 L 669 303 Q 625 292 585 309 Z'
};
const masks={};for(const [k,v]of Object.entries(paths))masks[k]=await mask(v);
const owner=new Uint8Array(N);
const names=['bottomwear','topwear','face','front hair_1','back hair_1','back hair_2','handwear','ribbon','mouth_close','eyebrow','eyewhite','irides','eyelash'];
for(let i=0;i<N;i++){
 const y=Math.floor(i/W); let n=y>1135?0:1;
 if(masks.head[i])n=3;
 if(masks.leftHair[i])n=4;
 if(masks.rightHair[i])n=5;
 if(masks.face[i])n=2;
 // Remove dark bang pixels included by the conservative face outline.
 if(n===2&&y<420&&src[i*4]<205&&src[i*4+1]<180)n=3;
 if(masks.hand[i])n=6;
 // The small gap between the fingertips contains hair, not hand paint.
 if(n===6&&y<510&&i%W>765&&src[i*4]<170&&src[i*4+1]<140)n=5;
 if(masks.ribbon[i])n=7;
 if(masks.mouth[i]&&n===2)n=8;
 if(masks.brow[i]&&[2,3,4,5].includes(n))n=9;
 if(masks.eyeL[i]||masks.eyeR[i]){
   n=10;
   if(masks.irisL[i]||masks.irisR[i])n=11;
   const r=src[i*4],g=src[i*4+1],b=src[i*4+2];
   if(n===10&&r<155&&g<125&&b<145)n=12;
 }
 owner[i]=n;
}
const buffers=names.map(()=>Buffer.alloc(N*4));
for(let i=0;i<N;i++)src.copy(buffers[owner[i]],i*4,i*4,i*4+4);
// The source's solid interior is alpha 251–253, not 255. Keep source pixels
// untouched; restoration under these nearly opaque pixels changes alpha <= 5.
const under=Buffer.alloc(N*4);let restored=0;
for(let i=0;i<N;i++)if((owner[i]===6||owner[i]===7)&&src[i*4+3]>=250){hidden.copy(under,i*4,i*4,i*4+4);under[i*4+3]=255;restored++;}
// A closed-eye patch uses generated pixels only inside two bounded eye windows.
const blink=Buffer.alloc(N*4);
for(let i=0;i<N;i++)if(masks.eyeL[i]||masks.eyeR[i]){closed.copy(blink,i*4,i*4,i*4+4);}
const layers=[{name:'underpaint',buf:under},...names.map((name,i)=>({name,buf:buffers[i]}))];
layers.splice(layers.findIndex(l=>l.name==='eyewhite'),0,{name:'eye_close',buf:blink});
// Tight cropping keeps PSD decoding and GPU texture allocation modest.
const manifest={width:W,height:H,contact:[725,516],layers:[],restoredPixels:restored};
const children=[];
for(const layer of layers){
 let x0=W,y0=H,x1=0,y1=0;
 for(let i=0;i<N;i++)if(layer.buf[i*4+3]){const x=i%W,y=Math.floor(i/W);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const width=x1-x0+1,height=y1-y0+1;
 const cropped=await sharp(layer.buf,{raw:{width:W,height:H,channels:4}}).extract({left:x0,top:y0,width,height}).raw().toBuffer();
 const file=`layers/${layer.name.replaceAll(' ','_')}.png`;
 await sharp(cropped,{raw:{width,height,channels:4}}).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(`${pub}/${file}`);
 manifest.layers.push({name:layer.name,file,x:x0-2,y:y0-2,width:width+4,height:height+4,hidden:!!layer.hidden});
 children.push({name:layer.name,left:x0,top:y0,hidden:!!layer.hidden,imageData:{width,height,data:new Uint8ClampedArray(cropped)}});
}
psd.initializeCanvas((w,h)=>({width:w,height:h,getContext:()=>({createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})})}));
const document={width:W,height:H,children,imageData:{width:W,height:H,data:new Uint8ClampedArray(src)}};
await fs.writeFile(`${out}/reference-layered.psd`,psd.writePsdBuffer(document,{generateThumbnail:false}));
const parsed=psd.readPsd(await fs.readFile(`${out}/reference-layered.psd`),{useImageData:true,skipThumbnail:true});
const composite=Buffer.alloc(N*4);
for(const l of parsed.children){if(l.hidden)continue;const d=l.imageData;for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){
 const si=(y*d.width+x)*4,di=((y+l.top)*W+x+l.left)*4,a=d.data[si+3]/255,b=composite[di+3]/255,oa=a+b*(1-a);
 if(!oa)continue;for(let c=0;c<3;c++)composite[di+c]=Math.round((d.data[si+c]*a+composite[di+c]*b*(1-a))/oa);composite[di+3]=Math.round(oa*255);
}}
let max=0,changed=0,sum=0;const diff=Buffer.alloc(N*4);
for(let i=0;i<N;i++){let pixel=0;for(let c=0;c<4;c++){const delta=(src[i*4+3]===0&&c<3)?0:Math.abs(src[i*4+c]-composite[i*4+c]);max=Math.max(max,delta);sum+=delta;pixel+=delta;diff[i*4+c]=c===3?255:Math.min(255,delta*16)}if(pixel)changed++;}
await sharp(composite,{raw:{width:W,height:H,channels:4}}).png().toFile(`${out}/recomposed.png`);
await sharp(diff,{raw:{width:W,height:H,channels:4}}).png().toFile(`${out}/difference-x16.png`);
const report={canvas:[W,H],layers:children.length,maxChannelDifference:max,changedVisiblePixels:changed,meanAbsoluteDifference:sum/(N*4),restoredPixels:restored,psdBytes:(await fs.stat(`${out}/reference-layered.psd`)).size};
await fs.writeFile(`${out}/comparison.json`,JSON.stringify(report,null,2));
await fs.writeFile(`${pub}/manifest.json`,JSON.stringify(manifest,null,2));
await fs.copyFile(`${out}/reference-layered.psd`,`${pub}/reference-layered.psd`);
console.log(report);
