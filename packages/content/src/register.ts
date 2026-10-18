/** 読み込むだけで、AnimeVRM のセットと小物を engine に登録する（アプリの入口で import する） */
import { registerProps } from './props';
import { registerSets } from './sets';

registerSets();
registerProps();
