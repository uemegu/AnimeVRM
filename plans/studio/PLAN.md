# Studio 化リファクタリング計画

ルート（素の TS + 複数 HTML）を React の Studio アプリに作り直し、描画コードとシナリオ形式を app/ と共有する。

## 決定事項（2026-09-26）

| 項目 | 決定 |
| --- | --- |
| 描画コード | app/ と共有パッケージにする。分離が必要になったら再検討。Studio の描画は app/ の描画（StageManager・Avatar）を土台にする（2026-09-26 変更。app/ の見た目とプレビューを一致させるため） |
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
- シャフト風演出・ヤンデレ・雨のエフェクトと、それを使うシナリオ（幽霊の質量・覗き穴の訪問者）。高速アクション演出は残して移植する

### 残すもの（削除候補から外したもの）

- ardy-mini 本体と品質補正。`packages/motion/` に移した（2026-09-27）。`ardy-onnxruntime-web` と `@huggingface/tokenizers` は ardy が使うので残す
- `quality-calibrate.html` の中身：ardy の補正に使う VRM 接触点の校正。Studio のモーション画面へ移した（2026-09-27）
- `cli-runner.html` の中身：`scripts/ardy-generate.ts`（CLI でのモーション生成）が使う headless 実行口。`studio/cli-runner.html` に移し、Studio の開発サーバーで動かす（2026-09-27）
- Eye Atelier（`tools/eye-editor`）。モデルを作るときだけ使うので Studio には入れず、単独のツールのまま残す（2026-09-27 決定）
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
   - プロジェクト（2026-09-28）：`assets/studio/projects.json` で、シナリオの種類ごとに「本編（app）」「デモ」などへ振り分ける。一覧と再生はプロジェクトで切り替える。シナリオを開いていないときは、プロジェクト全体のチャート（フラグを立てる→条件に使う、先行シナリオでシナリオ同士をつなぐ）を出す。日付などの発生条件は app 固有なので Studio には持ち込まない
4. **シナリオ再生**：これまで作ったシナリオの一覧と再生（Pages 版と同じ部品）
5. **モーション**：英語プロンプトから ardy-mini で複数候補を補正込みで生成し、並べて比較して採用する。接触点の校正もここで行う
6. ~~**ツール**~~（2026-09-27 取りやめ）：音声生成はキャラクター管理とシナリオ編集に入れた。MorphTarget 調整はバックログ、Eye Atelier は単独のツールのまま使う
7. **キャラクター管理**：ID・名前・関連アバター（制服・私服など）・音声生成の参照音声とボイス指導・キャラ設定を編集する。キャラから登場シナリオ・セリフ・ボイスを逆引きできる。データは `assets/studio/characters.json`。セリフの話者は必ず `speakerCharacterId` で指定する（画面に出ない声だけの話者も。主人公は `player`）

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
3. **engine 統合**（2026-09-26 完了。その後、Studio の描画は app/ を土台にすると決めたので、ルートの `Avatar`・`ViewerCore` は、必要な演出（高速アクションなど）を移植したあと旧ルートと一緒に消す）：ルートの描画コードを `packages/engine` に移し、app/ と中身が同じ・ほぼ同じだったもの（シェーダー、ポストプロセス、空の背景、ToonShader、CinematicAnimeShader など）は app/ も engine の版を使う。違いがあったものはルートの版（機能の多い方）に、app/ の使い方を足して1本にした。統合前後のスクリーンショットで、ルート・app/ とも見た目が変わらないことを確認済み
   - app/ の `Avatar`・`StageManager`・`ScrollingBackground` は作りが別物なので、まだ app/ 側にある。第10段階で engine の `Avatar`・`ViewerCore` に載せ替える。それまでは、この3つに関わる描画の修正は両方に入れる
4. **サーバー**（2026-09-26 完了）：ファイル保存、アセット一覧、シナリオ読み書き、TTS の API を作る。`server/README.md`。音声の話者設定はキャラクター管理（`assets/studio/characters.json`）に移し、`app/scripts/scenario-voices.py` と共有
5. **Studio の土台・ビューア・キャラクター管理**（2026-09-26 完了。app/ の描画を `packages/engine/src/stage/` に移して共有し、時間帯・場所のプリセットは `assets/studio/*.json` にした）
6. **シーン編集**（2026-09-26 完了）：時間帯・場所の設定をスキーマから作ったフォームで編集し、プレビューに即時反映・保存する。場所ごとに立ち位置・カメラの画角と構図・遠景の置き方（画面に貼る／3D空間に置く）・3D背景（組み込みの painted 教室・図書室、または glb）を持てる。俯瞰の簡易3D表示でキャラ・立ち位置・カメラの視野・背景の位置関係を確認できる
7. **シナリオ編集**（2026-09-26 ほぼ完了）：シナリオ一覧・新規作成・読み込み／書き出し・保存、カットの編集（セリフ・舞台・キャラ・分岐・JSON）、プレビュー、フローチャート、タイムライン（表情・モーション・視線・表示・カメラのキーフレーム、ボイスに合わせた再生、カメラを手で動かして記録）、音声生成（候補の試聴と採用）
   - 未対応：プレビューの口パク
8. **演出の移植・再生と Pages**：
   - 演出（2026-09-27 完了）：高速アクション（残像）、集中線、文字演出、頬赤、汗、怒りマーク、目が泳ぐ、涙、瞼を閉じる・まばたき・暗転を共有の描画に移した。シナリオでは `avatars` と `screenTransition`・`focusLines` で指定し、Studio のカット編集・タイムラインで編集できる
   - ルートのシナリオを JSON に移す（2026-09-27 完了。5秒告白PVは対象外）：`assets/scenarios/demo/`（ゲーム本編の目次には載せない）。場所がなかった公園（並木）・カフェ・カフェ店内・海の見える公園・夏祭りを場所設定に追加。中景・近景は旧ルートと同じく画面に貼り付く置き方にした。カフェ監視の暗い店内（時間帯 `indoor_dark`）と窓の外の明るさ（遠景の露出・キャラの `daylight`）も移した。移せなかったもの：カメラの動き（寄り・回り込みなど）、夢のような背景、魚眼、座り姿勢（図書室）、ステレオの左右。休み時間の教室（モブが前提）と屋上の昼寝（Live2D が前提）は移さない（2026-09-27）。歩きながらの会話は旧ルートと同じく横からのカメラで撮る。旧ルートの時間帯「室内・明」は不要（昼で代用）
   - 再生と Pages（2026-09-27 完了）：Studio の「シナリオ再生」で保存済みのシナリオを分岐・ボイス・BGM・演出つきで通して再生できる（`studio/src/player/`）。同じ部品で Pages 用の静的版（`studio/pages/`、`npm run build:pages`）を作り、`docs/` を差し替えた。素材は再生するシナリオが使うものだけをコピーする（約180MB。以前は約700MB）。旧 Pages の各シナリオの URL は、共有カード（OGP）を残したまま新しい再生画面へ転送する
   - Pages は Studio 本体の読み取り専用版に置き換えた（2026-09-29）：本番ビルドは保存・生成ができず、API は `bakeApi.ts` がビルド時に JSON へ書き出したもの（`api/<パス>.json`）を読む。公開範囲は `studio/pages/catalog.ts` のデモと、それが使う素材だけ。URL は `#/` 形式（再生は `#/player/demo/<ID>`）。普段は dev 起動で使い、`npm run build:pages` は Pages を更新するときだけ
   - 再生の口パクは声の大きさだけで動かす（母音の解析はしない）
9. **モーション**（2026-09-27 完了）：ardy まわりを `packages/motion/` に移し、Studio のモーション画面で候補の生成・比較・採用（体型への合わせ込み・指の形・接触の補正つき）、モーション一覧（ループの指定）、接触点の校正ができる。CLI は Studio の開発サーバーで動く。テストは vitest に移し、削除済み機能（Gemini 連携・Motion Mixer）のテストは消した
   - app と Studio のモーションの読み込みが指のボーンを移していなかったので、旧ルートと同じく移すようにした
10. **旧ルートの削除**（2026-09-27 完了）：app/ は第5段階から engine の描画を使っているので、載せ替えは不要だった。旧 `src/`・直下の HTML 群・旧 vite 設定・旧ビューア向けの Playwright 設定と、engine の中で旧ルートだけが使っていたもの（旧 `Avatar`・`ViewerCore`・`ScenePresets`・シャフト演出・雨・風・MorphTarget など）を消した。README を書き直した
   - 旧ルートの削除前の状態はコミット `a582c47`
11. **AI での編集**（2026-09-28 完了）：多くの作業を AI に任せる前提で、JSON を直接編集しても確かめられるようにした。手順は Skill `scenario-authoring`（`.agents/skills/`。`.claude/skills` はそこへのリンク）にまとめ、GEMINI.md から案内する
   - 検証（`npm run validate`）：スキーマに加えて、参照先（シーンの行き先・キャラ・場所・時間帯・BGM・モーション・先行シナリオ・ファイル）が実在するか、シナリオ ID の重複、app の目次が最新かを調べる。サーバーなしで動く。サーバーの保存でも同じチェックを行い `problems` で返す（`?strict=1` ならエラーがあると保存しない）
   - 撮影（`npm run shot`）：Studio のプレビューと同じ描画でカットをヘッドレスで撮る（`studio/shot.html`）。サーバーなしで動き、音は鳴らさない
   - GEMINI.md の開発ルール（表情の強さ・カメラ・選択肢のシーンなど）は検証しない。Skill と指示でカバーする
   - 未対応：Studio の画面は、保存に成功したときの `problems`（参照の問題）をまだ表示しない

## バックログ

- **モブ（背景の生徒など）**（2026-09-27 バックログへ）：旧ルートの群衆・半透明のモブ生徒は削除した。これを前提にしていた「休み時間の教室」（corridor-mob）は移していない

- **MorphTarget 調整**（2026-09-27 バックログへ。あまり使っていないため）：旧ルートの `src/ui/components/MorphTargetPanel.ts` と `packages/engine/src/avatar/MorphTargetPreview.ts`。第10段階で旧ルートと一緒に消すので、必要になったらコミット `dc8bfa5` 時点のコードを参考に Studio へ作り直す

## 未確定・要検証

- `assets/` を共有した結果、app のビルドに使わない素材まで入る（約750MB）。Pages 版は使う素材だけをコピーするようにした（`studio/pages/collectAssets.ts`）ので、app も同じ仕組みにできる
- ardy の生成はブラウザの WebGPU で動く。Studio 上で直接生成し、サーバーはファイル保存だけを担う想定
