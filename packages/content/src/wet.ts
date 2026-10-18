import { registerWetTexture } from '@anime-vrm/engine/shader/WetCloth';

/** 雨で濡れた服の絵柄（服と同じ UV で描いた濡れた版） */
export function registerWetTextures(): void {
  // VRoid の制服Yシャツ N00_007_02_Tops
  registerWetTexture(/^N00_007_02_Tops_01_CLOTH/, '/textures/wet/school_shirt_wet.avif');
}
