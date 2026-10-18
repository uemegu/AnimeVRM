# AnimeVRM engine

VRM をアニメ調に描画するエンジン（Three.js / @pixiv/three-vrm）。トゥーンシェーダー、ポストプロセス、感情演出、舞台（`stage/StageManager`）を持つ。シナリオの形式には依存しない。

## 使い方

```ts
import { StageManager } from '@anime-vrm/engine/stage/StageManager';
import { configureAssets } from '@anime-vrm/engine/utils/path';

// 素材の置き場所（省略時は Vite の BASE_URL、モーションは /animations/<名前>.fbx）
configureAssets({ motionUrl: (name) => `/motions/${name}.fbx`, idleMotion: 'Standing Idle' });
```

- 描画に渡す形（舞台のキャラ・カメラ・演出・カットの状態）は `schema/stage.ts`、見た目の設定（時間帯・場所）は `schema/visual.ts`。
- カットのタイムラインは `StageManager.setCutTimeline({ stateAt, screenTransition, cameraShift, innerVoice })` で渡す。
- 中身は外から登録する：
  - 組み込みの3D背景（`builtin:<名前>`）… `registerEnvironment`（`stage/environments.ts`）
  - 手に持つ小物 … `registerHeldItem`（`avatar/heldItem.ts`）
  - 濡れた服の絵柄 … `registerWetTexture`（`shader/WetCloth.ts`）

口パク解析の WASM（`assembly/` → `src/audio/lipsync.wasm`、`npm run build:wasm`）と、顔に重ねる絵は同梱している（`new URL(..., import.meta.url)` で読む）。

AnimeVRM（Studio・シナリオ・デモの中身）から使う例は https://github.com/uemegu/AnimeVRM 。
