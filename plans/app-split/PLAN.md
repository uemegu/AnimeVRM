# app（『5秒の告白』）のリポジトリ分離

2026-10-04 に方針だけ決めた。開発を優先し、分離作業はまだ行っていない。

## 決めたこと

- 分離先：https://github.com/uemegu/confession_in_5_seconds （空のリポジトリ）
- 新リポジトリには、このリポジトリ（Studio、AnimeVRM）を**サブモジュール**として入れる。エンジンは1本のまま。エンジンを直したら、サブモジュール側でコミットし、app 側で参照する版を進める
- Studio（サーバー・validate・shot）では、引き続き app のシナリオを開けるようにする
- 公開は game_box 側で Firebase にアップする（このリポジトリの Pages には載せない）
- このリポジトリにある app の過去の履歴は書き換えない（リポジトリ全体が約 1.8GB あるため）

## 新リポジトリに移すもの

| 対象 | 備考 |
| --- | --- |
| `app/` | src・scripts・log・scenarios（資料）・FEATURES など |
| デモ以外のシナリオ | `assets/scenarios/{morning,action,holiday,forced,ending,call,mail,special}`。ボイスの mp3 も同じフォルダにある（約 53MB） |
| app でしか使わない素材 | `assets/cg`・`assets/cutins`・`assets/stamps`・`assets/mail`・`assets/img`・`assets/sounds`。ただし `stamps` はスキーマ（`packages/scenario/src/schema.ts`）からも参照されているので確認する |
| 原稿の変換一式 | `scratch/novel/`（compile.py・src・jobs・gen_images.py など）。今は `/scratch` が gitignore で、**履歴に残っていない**。生成画像の置き場（img 190MB・poses・bg）は入れない |

## このリポジトリに残すもの

エンジン（`packages/*`）、Studio、server、共通の素材（models・animations・textures・bgm・se・voices・wasm・worklets・`assets/assets`）、`assets/studio/*.json`、デモシナリオ。

- `assets/studio/characters.json` には app 専用の話者（母・モブ・セバスチャンなど）も入っている。当面は共有のままにする
- `assets/assets`（旧 app の背景・立ち絵・タイトル）は app と Studio の両方が参照しているので、ここに残す

## 分離するときに直すところ

- **app の vite**：`publicDir: '../assets'` は1か所しか指定できない。app 側の素材とサブモジュールの素材を重ねて配信するプラグイン（開発時はミドルウェア、ビルド時は両方をコピー）が必要
- **app の import**：`app/src/data/*.ts` が `../../../assets/studio/*.json` を、テストが `../../../../assets` を直接読んでいる。サブモジュールのパスに変える
- **workspace**：新リポジトリ直下の package.json の workspaces に `app` とサブモジュールの `packages/*`・`studio`・`server` を並べ、npm install を1回で済ませる
- **Studio の外部コンテンツ指定**：環境変数などで「シナリオと素材をもう1か所から読む」設定を足す
  - `server/src/scenarioStore.ts`（`assets/scenarios` 決め打ち）：両方を一覧し、保存はファイルがある側へ
  - Studio の vite（`publicDir: '../assets'`）：外部の素材も配信する
  - `server/src/index.ts`：保存時に `app/scripts/generate-scenario-index.js` を直接 import している。保存後の処理を外から指定できるようにする
  - `scripts/validate.ts`・`scripts/shot.ts`：`assets/scenarios/<種類>/<ID>` 決め打ち
- **app/scripts/scenario-voices.py**：`assets/studio/characters.json` と `server/python/voice_effects.py` のパス
- サブモジュールを clone すると履歴 1.8GB ごと取得する。手元では `git submodule add --reference <このリポジトリ>` でオブジェクトを共有できる
