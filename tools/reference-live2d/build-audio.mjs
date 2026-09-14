import { build } from 'vite';
// Reuse the project's existing MFCC/formant vowel detector in the portable
// preview. This does not rebuild or alter the main VRM application.
await build({configFile:false,publicDir:false,base:'./',build:{outDir:'public/reference-live2d',emptyOutDir:false,lib:{entry:'src/AudioLipSync.ts',formats:['es'],fileName:()=> 'audio-analyser.js'},minify:true}});
