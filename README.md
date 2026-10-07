# AnimeVRM

VRM のキャラクターをセルルック（アニメ調）で描き、会話シナリオを演じさせるプロジェクトです。シナリオやシーンを作る **Studio** と、シナリオ再生だけの **Pages 版** が、同じ描画とシナリオ形式を使います。

作品はそれぞれのリポジトリに置き、このリポジトリをサブモジュールとして使います（ギャルゲー『5秒の告白』は [confession_in_5_seconds](https://github.com/uemegu/confession_in_5_seconds)）。作品のシナリオは Studio の外部プロジェクトとして開けます（下の「外部プロジェクト」）。

- シナリオ再生（Pages）: [https://uemegu.github.io/AnimeVRM/](https://uemegu.github.io/AnimeVRM/)

## 構成

npm workspaces のモノレポです。

| ディレクトリ | 中身 |
| :--- | :--- |
| `studio/` | Studio（React、ローカル専用）。ビューア・シーン設定・シナリオ編集・シナリオ再生・キャラクター管理・モーション。`studio/pages/` は Pages 版（再生だけ） |
| `server/` | Studio 用のローカルサーバー（Hono、localhost のみ）。シナリオや設定の保存、素材の一覧、音声生成。[server/README.md](server/README.md) |
| `packages/engine/` | 描画（Three.js / VRM）。舞台（`stage/`）、トゥーンシェーダー、ポストプロセス、感情演出 |
| `packages/scenario/` | シナリオ・シーン設定・キャラクターの形式（zod スキーマ）と、舞台の状態を決める処理・分岐の進行 |
| `packages/motion/` | ardy-mini によるモーション生成、体型への合わせ込み、接触の補正、FBX 書き出し。[README](packages/motion/src/ardy/README.md) |
| `mini-game/pool/` | ミニゲーム「水上ヒップアタック相撲」（プール）。浮島の上で 2 人がお尻で押し合う勝者予想ゲーム。水面・しぶき・レンズの水滴、押し合いの物理、BGM・SE。`assets/` に専用のモーション・ボイス・BGM・SE。`scripts/` に Playwright の動作確認 |
| `assets/` | 素材（モデル・モーション・背景・BGM・SE・ボイス・シナリオ）。`assets/studio/*.json` は Studio で編集する設定（場所・時間帯・キャラクター・モーション・BGM） |
| `docs/` | Pages 版の出力（`npm run build:pages` で作る。手で編集しない）。`docs/pool/` はプールのビルド |
| `tools/eye-editor/` | Eye Atelier（モデルを作るときに使う、目元の調整ツール。Blender 連携） |
| `assembly/` | 口パク解析の WASM（`npm run build:wasm`） |
| `plans/` | 計画と決定事項 |

## 使い方

```bash
npm install

# Studio（http://localhost:5175）。保存や音声生成のためにサーバーも起動する
npm run server
npm run studio

# ミニゲーム（プール。http://localhost:5178）
npm run pool

# Pages 版を docs/ に書き出す（再生するシナリオが使う素材だけをコピーする。プールも docs/pool/ に出す）
npm run build:pages

# プールだけをビルドする（docs/pool/。Pages では /AnimeVRM/pool/）
npm run build:pool

npm run typecheck
npm test
```

### Studio の画面

- **ビューア**：キャラクター・場所・時間帯・モーション・表情を選んで見え方を確かめる
- **シーン**：場所（遠景・中景・近景、3D背景、立ち位置、カメラの構図）と時間帯（ライト・ポストプロセス・マテリアル）の設定。俯瞰の簡易3Dで配置を確かめられる
- **シナリオ**：シナリオの一覧・作成・保存、カットの編集（セリフ・舞台・キャラ・演出・分岐）、プレビュー、フローチャート、カット内のタイムライン、ボイスの生成（Irodori-TTS）
- **シナリオ再生**：保存したシナリオを分岐・ボイス・BGM・演出つきで通して再生する（Pages 版と同じ画面）
- **キャラクター**：名前・モデル・音声生成の参照音声・設定。登場するシナリオやセリフの逆引き
- **モーション**：ardy-mini で候補を作って比べ、採用したものを保存する。登録済みモーションの一覧、接触点の校正

### シナリオ

演出の見本は `assets/scenarios/demo/<ID>/scenario.json`（Pages で再生する）。形式は `packages/scenario/src/schema.ts` が正です。演出の書き方の説明は作品側の FEATURES.md（confession_in_5_seconds の `app/FEATURES.md`）にあります。

### 外部プロジェクト

作品のシナリオと素材は、作品のリポジトリに置いたまま Studio・検証・撮影で扱えます。作品のディレクトリに `studio-project.json`（ID・名前・シナリオの種類・置き場 `assetsDir`・保存後の処理 `hooks`）を置き、環境変数 `STUDIO_PROJECTS`（: 区切り。このリポジトリ直下からの相対パス）か `studio-projects.txt` で読み込みます。素材は `assets/` と同じ URL の並びで重ねて配信します。

### サーバーなしで確かめる（AI での編集向け）

JSON を直接編集したあとは、検証と撮影で確かめます。どちらもサーバー・Studio を起動しなくても動きます。

```bash
# スキーマ・参照先（シーン・キャラ・場所・モーション・ファイルなど）と、外部プロジェクトの検証（hooks）を行う。エラーがあれば終了コード 1
npm run validate
npm run validate -- demo/trio --json

# カットを Studio のプレビューと同じ描画で撮影する（既定は scratch/shots/<種類>/<ID>/。音は鳴らさない）
npm run shot -- demo/trio
npm run shot -- demo/trio --scene trio_choice --time 2 -o out.png
```

オプションは `scripts/validate.ts`・`scripts/shot.ts` の先頭に書いてあります。サーバーの API で保存するときは `?strict=1` を付けると、参照先にエラーがあれば保存しません（[server/README.md](server/README.md)）。

## 描画

- **トゥーンシェーディング**（`ToonShader.ts`）：肌・髪・服を自動で分けて MToon の値を当てる。影の乗算色、顔の SDF 陰影、天使の輪、前髪の影、足元のグラデーション
- **輪郭線**：スムーズ法線による裏面押し出し。画面上で一定の太さ、視線の角度による線の強弱
- **背景**：遠景・中景・近景の3層、または3D背景（組み込みの簡易3D教室・図書室、glb）。歩きながらの会話用に背景を横に流す
- **光**：時間帯ごとのライト、光条、レンズフレア
- **ポストプロセス**：ブルーム、光条、ライトラップ、パラ（空気感）、ディフュージョン・カラーグレーディング・色収差・周辺減光、SMAA
- **演出**：表情のクロスフェード、自動まばたき、視線と顔の向き、口パク、頬赤・怒りマーク・涙・汗・目が泳ぐ・漫画風の文字、速い動きの残像、集中線、暗転・瞼を閉じる・まばたき

## 素材

画像は AVIF にします（変換コマンドは [GEMINI.md](GEMINI.md)）。透過画像は `--qalpha 100` でアルファを劣化させないこと。

## 開発ルール

[GEMINI.md](GEMINI.md)（Claude Code 向けは [CLAUDE.md](CLAUDE.md) から参照）。

## 技術スタック

Three.js（r183）、@pixiv/three-vrm（v3.5）、React 19、React Router、React Flow、zod、Hono、Vite 8、TypeScript 7、Vitest、Playwright。モーション生成は [ardy-mini](https://github.com/intsuc/ardy-mini)（WebGPU・ONNX Runtime Web）、音声生成は Irodori-TTS。
