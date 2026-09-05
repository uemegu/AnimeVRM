# AnimeVRM Agent Instructions

本ドキュメントは、このプロジェクトにおけるコーディング・検証・ビジュアル確認を行うエージェント（AIアシスタント）向けの作業ガイドラインです。

---

## 1. Playwright によるビジュアルキャプチャ検証・報告ガイドライン

シェーダー、マテリアルパラメータ、法線処理、アウトライン、ライティング、ポストプロセスなどの見た目に関わる修正を行った際は、**推測や思い込みで報告せず、必ず Playwright によるヘッドレス画面キャプチャを撮影し、客観的な実測画像で検証・報告すること**。

### 1.1 キャプチャ実行の前提条件
- ローカル開発サーバーが起動していること（`http://localhost:5173`）
  - 未起動の場合は `npm run dev` で起動する。

### 1.2 キャプチャスクリプト (`scripts/capture.mjs`) の構成
- `playwright` を使用し、macOS の Google Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`) をヘッドレス起動する。
- WebGL を有効にするため、起動引数に以下を指定する：
  ```javascript
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization'
  ]
  ```
- モデルロードとテクスチャ初期化を確実に待機（約5〜6秒）。
- グローバル変数 `window.__viewerCore` や `window.__avatarManager` を介して、カメラ位置（顔アップ等）や主光源（Directional Light）の向きを直接制御できる。

### 1.3 キャプチャ実行コマンド
```bash
npm run capture
# または node scripts/capture.mjs
```

### 1.4 検証すべきアングル・照明条件
顔やシェーダーの確認時は、以下の主要パターンを網羅して撮影すること：
1. **正面光 (`face_lighting_front.png`)**: 通常時の全体バランス・ハイライト確認
2. **斜め45度光 (`face_lighting_45deg.png`)**: 鼻の下・ほうれい線・頬のゴミ影や割れの確認
3. **真横光 (`face_lighting_side.png`)**: 輪郭線やフェイスラインに落ちるセル影の確認
4. **斜め視点（3/4アングル） (`face_side_profile.png`)**: アウトラインの整合性と立体感の確認

### 1.5 ユーザーへの報告作法
- 撮影したスクリーンショットは、アーティファクト `walkthrough.md` にカルーセル（`carousel`）形式で埋め込む。
- 画像を埋め込む際は、必ず絶対パス（またはアーティファクト配下のパス）を使用し、`![説明](絶対パス)` で記述する。
- 画像をもとに、どの不具合がどう解消されたか（あるいは残課題があるか）を事実ベースで客観的に説明する。

---

## 2. セルルック顔面陰影制御の基本設計

- **頂点法線を無理に曲げて影を消そうとしないこと**:
  - 顔全体の法線を歪めると、輪郭線（アウトライン）の消失や不自然なポリゴン変形を引き起こす。
- **影の抑制はテクスチャマスク（`shadingShiftTexture`）で行うこと**:
  - `public/textures/face_shadow_mask.png`（白＝影消去、黒＝通常影）を顔マテリアルに適用してピクセル単位で制御する。
  - `Avatar.ts` の `setFaceShadowMask` / `initFaceShadowMask` を経由して割り当てる。
