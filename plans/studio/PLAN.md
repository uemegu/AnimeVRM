# Studio 化リファクタリング計画

ルート（素の TS + 複数 HTML）を React の Studio アプリに作り直し、描画コードとシナリオ形式を app/ と共有する。

## 決定事項（2026-09-26）

| 項目 | 決定 |
| --- | --- |
| 描画コード | app/ と共有パッケージにする。分離が必要になったら再検討 |
| シナリオ形式 | app/ の `scenario.json` を拡張して唯一の形式にする。ルートの TS シナリオは JSON へ移す |
| GitHub Pages | 「シナリオ再生」だけの静的版を出す。Studio はローカル専用 |
| サーバー | ローカル専用 Node サーバー（認証なし・localhost のみ）。JSON 保存・アセット一覧・app/ のシナリオ読み書き・音声生成 |
| モーション生成 | ardy-mini を Studio に入れる。補正込みで数パターン同時生成し、候補から採用を選ぶ |
| UI | React、白基調、日本語・英語対応 |
| 追加ライブラリ | React Flow、Zustand、ルーター、スキーマ検証（zod）などを追加してよい |
| 進め方 | 新ディレクトリに作り、機能が揃ってから旧 `src/` と HTML 群を消す |

### 削除するもの

- Gemini 関連（`src/ai/live`、ardy README の Gemini 連携部分）
- VAD（`@ricky0123/vad-web`、`public/vad`）、`onnxruntime-web@1.23`、`@huggingface/transformers`
- ヒストグラム（`src/histogram`）
- Motion Mixer（`motion.html`）、LipSync Analyzer（`lipsync.html`）。リップシンク処理本体は再生に必要なので engine に残す
- Live2D（`src/live2d`、`reference-live2d`）
- 群衆（`src/crowd`、`crowd-test.html`）
- パノラマ背景による擬似3D（`PanoramaBackgroundController`）と、それ前提の「背後のエミリ」シナリオ

### 残すもの（削除候補から外したもの）

- ardy-mini 本体と品質補正（`src/ai/motion/ardy`、`src/ai/motion/quality`）。`ardy-onnxruntime-web` と `@huggingface/tokenizers` は ardy が使うので残す
- `quality-calibrate.html` の中身：ardy の補正に使う VRM 接触点の校正なので、Studio のモーション画面へ移す
- `cli-runner.html` の中身：`scripts/ardy-generate.ts`（CLI でのモーション生成）が使う headless 実行口。Studio のモーション機能に置き換えたうえで、CLI 用の入口として残す
- Eye Atelier（`tools/eye-editor`）
- 簡易3Dの教室・図書室（`src/scene/painted-*`）。Studio の背景の種類の1つにする
- `blender/`（gitignore 済み）、`assembly/`（WASM。追跡されているが今回は触らない）

### 削除に伴う影響

- 群衆・Live2D・パノラマ背景はサポートしない。`corridor-mob`・`cafe-monitoring`・`painted-classroom` は群衆なし、`rooftop-nap` は Live2D なしで JSON 化する

## 目標の構成

npm workspaces を使ったモノレポにする。

```text
packages/
  scenario/   シナリオ・シーンの JSON スキーマ（zod）、型、検証、旧形式からの変換
  engine/     Three.js / VRM の描画、背景（一枚絵・glb・組み込み3D）、演出、シナリオ実行。React 非依存
  motion/     ardy-mini、補正（接触点・手の補正・スコア）、FBX 出力
studio/       React SPA（Vite）。ローカル開発用
server/       Node API（Hono）。ファイル保存、アセット一覧、TTS 呼び出し
player/       Pages 向けの静的シナリオ再生（studio の再生画面を単独ビルド）
app/          既存ゲーム。packages/engine と packages/scenario を使う形へ移行
assets/       モデル・モーション・背景・BGM・SE・ボイスを1か所にまとめる（現状は public/ と app/public/ に重複）。app/ の切り出しは今は考えない
tools/eye-editor/
```

## Studio の画面

1. **ビューア**：アバターとシーン（場所×時間帯）を選び、見た目と動きを確認する
2. **シーン編集**：背景の種類（一枚絵 / glb + テクスチャ / 組み込み3D。painted 教室・図書室は組み込み3D）、遠景・中景・近景、ライト、ポストプロセス、アバター配置、カメラプリセットを編集する。一枚絵も含めて簡易3Dで表示し、カメラの位置と見え方を調整できる
3. **シナリオ編集**
   - フローチャート（React Flow）：シーンのつながり、選択肢、フラグの設定と条件
   - カット編集：アバター・背景・シーン配置、カメラ、モーション、音声、BGM、表情、感情エフェクト、視線、顔の向き
   - タイムライン：カメラワーク・モーション・音声・表情をキーフレームで細かく調整する
   - プレビュー小窓：実際の見え方を表示する
   - JSON のインポート・エクスポート、app/public/scenarios の直接読み書き
4. **シナリオ再生**：これまで作ったシナリオの一覧と再生（Pages 版と同じ部品）
5. **モーション**：英語プロンプトから ardy-mini で複数候補を補正込みで生成し、並べて比較して採用する。接触点の校正もここで行う
6. **ツール**：MorphTarget 調整、Eye Atelier、音声生成（Irodori-TTS をサーバー経由で呼ぶ）
7. **キャラクター管理**：ID・名前・関連アバター（制服・私服など）・音声生成の参照音声とボイス指導・キャラ設定を編集する。キャラから登場シナリオ・セリフ・ボイスを逆引きできる。データは `assets/studio/characters.json`

## シナリオ形式の拡張方針

- app/ の現行 JSON をそのまま読めることを前提にし、`schemaVersion` を足す
- 現行のプリセット指定（`camera: "close"`、`location`、`timeOfDay`、`transitions[].at` など）は残す。タイムラインで編集したら、明示的なキーフレームに変換して保存する
- カットに任意の `timeline` を足す。トラックはカメラ、アバターごとのモーション・表情・視線・顔の向き、音声・SE・BGM、演出エフェクト
- ルートの TS シナリオにしかないコード依存の演出（シャフト風カットイン、ヤンデレ、高速アクション、集中線、涙、雨、文字演出など）は、エフェクトトラックのイベントとして表す
- シーン（場所×時間帯の見た目）は、シナリオとは別の JSON ファイルに切り出す。今は `locationVisualPresets.ts` と `timeOfDayPresets.ts` にコードで書かれている

## 進める順番

各段階の終わりに、旧ルート・app/ のどちらかが動く状態を保つ。

1. **整理**（2026-09-26 完了）：上の「削除するもの」を消す。旧ルートがビルドできることを確認する
2. **基盤**（2026-09-26 完了）：workspaces を作る。TS / Vite のバージョンをそろえる（ルートは TS7/Vite8、app/ は TS5.7/Vite6）。`packages/scenario` のスキーマを作り、app/ の全82シナリオが検証を通ることを確かめる。アセットを `assets/` に集約する
3. **engine 統合**（2026-09-26 完了）：ルートの描画コードを `packages/engine` に移し、app/ と中身が同じ・ほぼ同じだったもの（シェーダー、ポストプロセス、空の背景、ToonShader、CinematicAnimeShader など）は app/ も engine の版を使う。違いがあったものはルートの版（機能の多い方）に、app/ の使い方を足して1本にした。統合前後のスクリーンショットで、ルート・app/ とも見た目が変わらないことを確認済み
   - app/ の `Avatar`・`StageManager`・`ScrollingBackground` は作りが別物なので、まだ app/ 側にある。第10段階で engine の `Avatar`・`ViewerCore` に載せ替える。それまでは、この3つに関わる描画の修正は両方に入れる
4. **サーバー**（2026-09-26 完了）：ファイル保存、アセット一覧、シナリオ読み書き、TTS の API を作る。`server/README.md`。音声の話者設定はキャラクター管理（`assets/studio/characters.json`）に移し、`app/scripts/scenario-voices.py` と共有
5. **Studio の土台・ビューア・キャラクター管理**
6. **シーン編集**（簡易3D表示とカメラ調整、painted-* の組み込み）
7. **シナリオ編集**（フロー → カット編集 → タイムライン → プレビュー → インポート・エクスポート）
8. **再生と Pages**：ルートの20シナリオを JSON に移し、player をビルドして `docs/` を差し替える
9. **モーション・音声・ツール**：ardy の複数候補生成、接触点の校正、TTS、MorphTarget、Eye Atelier
10. **app/ を engine に載せ替え**、旧 `src/`・HTML 群・旧 vite 設定を削除する

## 未確定・要検証

- `assets/` を共有した結果、app と Pages 版のビルドに使わない素材まで入る（app のビルドは約750MB）。公開用ビルドでは使う素材だけをコピーする仕組みが要る
- ardy の生成はブラウザの WebGPU で動く。Studio 上で直接生成し、サーバーはファイル保存だけを担う想定
