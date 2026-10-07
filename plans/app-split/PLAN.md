# app（『5秒の告白』）のリポジトリ分離

2026-10-04 に方針を決めた。2026-10-07〜08 に分離を済ませた（push は未）。

## 進み具合

1. **済**：Studio が外部プロジェクトを読む（下の「外部プロジェクトの仕組み」）。app はまだこのリポジトリの中（`assetsDir` は `../assets`）
2. **済**：app が素材を2か所（共有の素材・app の素材）から読む（下の「app の置き場」）。リポジトリの複製で app の素材を `app/assets/` に移し、validate・全テスト・app の起動と再生・Studio の編集と保存が動くことを確かめた
3. **済**：app の素材を `app/assets/` へ移した（下の「新リポジトリに移すもの」のうち、シナリオと app でしか使わない素材・licenses.json。`studio-project.json` の assetsDir は `assets`）
4. **済**（2026-10-08）：`app/` を /Users/ueda/git/confession_in_5_seconds へ移した。新リポジトリは `app/` と、このリポジトリのサブモジュール `anime-vrm/` の構成。`studio-projects.txt` は空にし、新リポジトリの npm スクリプトが `STUDIO_PROJECTS=../app` を渡す。app 専用の計画（plans/5byou-feedback）・規則（GEMINI.md の app 部分）・起動設定も移した
   - app にあって共有していた口パク再生（AudioLipSync）は `packages/engine/src/audio/` へ移した（mini-game/pool も使う）
   - push はまだしていない。サブモジュールは手元のこのリポジトリから取り込んでいる（オブジェクトを共有）

## app の置き場

- `app/scripts/paths.js`（Python は `paths.py`）：`STUDIO_ROOT`（Studio のリポジトリ直下）・`WORKSPACE_ROOT`（package-lock.json のある所）・共有の素材・app の素材（`studio-project.json` の assetsDir）
- vite：publicDir は共有の素材、app の素材は `contentDirsPlugin` で重ねて配信し、ビルドではコピーする。Studio データの JSON は別名 `@studio-root/`（`tsconfig.json` の paths と vite の alias）
- 新リポジトリに移すときに直すのは `STUDIO_ROOT`・`WORKSPACE_ROOT`（paths.js・paths.py）と `tsconfig.json` の paths だけ

## 外部プロジェクトの仕組み

- プロジェクトのディレクトリ直下の `studio-project.json`：ID・名前・シナリオの種類、`assetsDir`（シナリオと素材の置き場。assets/ と同じ並び）、`hooks`（保存後の処理と検証のモジュール）
- Studio は、リポジトリ直下の `studio-projects.txt` に並べたディレクトリを読む。環境変数 `STUDIO_PROJECTS`（: 区切り。相対パスは Studio のリポジトリ直下が基準）があればそちらを使う
- 種類ごとに置き場が決まる。サーバーの一覧・読み書き、`npm run validate`・`shot`・`check:framing` はこれに従う。置き場でない所にあるシナリオは validate がエラーにする
- 素材の URL は1つの並びのまま。Studio の開発サーバーは assets/ のほかに外部の置き場も重ねて配信する
- app の hooks（`app/scripts/studio-hooks.js`）：保存後に目次を作り直し、validate で目次が古くないか調べる（`--fix` で作り直す）

## 決めたこと

- 分離先：https://github.com/uemegu/confession_in_5_seconds （空のリポジトリ）
- 新リポジトリには、このリポジトリ（Studio、AnimeVRM）を**サブモジュール**として入れる。エンジンは1本のまま。エンジンを直したら、サブモジュール側でコミットし、app 側で参照する版を進める
- Studio（サーバー・validate・shot）では、引き続き app のシナリオを開けるようにする
- 公開は game_box 側で Firebase にアップする（このリポジトリの Pages には載せない）
- このリポジトリにある app の過去の履歴は書き換えない（リポジトリ全体が約 1.8GB あるため）

## 新リポジトリに移すもの

2026-10-07：下の表のシナリオと app でしか使わない素材は `app/assets/` に移した。新リポジトリへは `app/` ごと移せばよい（`scratch/novel/` は別）。

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

- ~~**app の vite・import**~~：済（2026-10-07。上の「app の置き場」）
- **workspace**：新リポジトリ直下の package.json の workspaces に `app` とサブモジュールの `packages/*`・`studio`・`server` を並べ、npm install を1回で済ませる
- ~~**Studio の外部コンテンツ指定**~~：済（2026-10-07。上の「外部プロジェクトの仕組み」）
- ~~**app/scripts の Python**~~：済（`paths.py`）
- サブモジュールを clone すると履歴 1.8GB ごと取得する。手元では `git submodule add --reference <このリポジトリ>` でオブジェクトを共有できる
