/** 読み込むだけで、AnimeVRM のセット・小物・濡れた服の絵柄を engine に登録する（アプリの入口で import する） */
import { registerProps } from './props';
import { registerSets } from './sets';
import { registerWetTextures } from './wet';

registerSets();
registerProps();
registerWetTextures();
