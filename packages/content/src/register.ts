/** 読み込むと、簡易3D背景のセット・小物・濡れた服の絵柄が engine に登録される（アプリの入口で import する） */
import { registerProps } from './props';
import { registerSets } from './sets';
import { registerWetTextures } from './wet';

registerSets();
registerProps();
registerWetTextures();
