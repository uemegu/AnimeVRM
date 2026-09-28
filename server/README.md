# Studio サーバー

Studio 用のローカルサーバー。`127.0.0.1:5190` だけで待ち受け、Host が localhost 以外の要求と、他のサイトからの書き込みを断る。認証はないので外部に公開しない。

```bash
npm run server
```

## API

| メソッド・パス | 内容 |
| --- | --- |
| `GET /api/scenarios` | シナリオの一覧（通常・電話・メール） |
| `GET /api/scenarios/:category/:id` | シナリオ JSON |
| `PUT /api/scenarios/:category/:id` | 保存（なければ作る）。`packages/scenario` のスキーマに合わなければ 400 と問題の場所を返す。参照先の問題（下記）は `problems` で返し、`?strict=1` ならエラーがあるとき保存しない。保存後に app の `scenarioIndex.json` を作り直す |
| `GET /api/assets/:kind` | アセットの一覧（models / environments / animations / textures / bgm / se / voices） |
| `PUT /api/assets/:kind/:name` | アップロード（本文がファイルの中身）。同名があれば `?overwrite=1` のときだけ上書き |
| `GET /api/studio-data` ・ `GET/PUT /api/studio-data/:name` | Studio が管理する JSON（`assets/studio/<name>.json`）。PUT はシナリオと同じく `problems` と `?strict=1` がある |
| `GET /api/characters` ・ `PUT /api/characters` | キャラクター管理（`assets/studio/characters.json`）。名前・モデル・参照音声・ボイス指導・キャラ設定。PUT は `problems` と `?strict=1` がある |
| `GET /api/characters/:id/usage` | 逆引き。そのキャラが出るシナリオと、セリフ・ボイスの一覧 |
| `GET /api/tts/lines/:category/:id/:lineId` | セリフから決まる話者・表情・声の説明 |
| `POST /api/tts/jobs` | 音声生成ジョブ。`{ category, id, lineId, candidates?, speaker?, caption? }` |
| `GET /api/tts/jobs/:jobId` | ジョブの状態と候補の番号 |
| `GET /api/tts/jobs/:jobId/candidates/:index` | 候補の mp3（試聴用） |
| `POST /api/tts/jobs/:jobId/adopt` | `{ index }` の候補をシナリオのディレクトリへ置き、`voiceUrl` を書き換える |

## 検証

保存時の参照チェックは、シーンの行き先・キャラ・場所・時間帯・BGM・モーション・先行シナリオと、モデル・ボイス・効果音・画像などのファイルが実在するかを調べる（`packages/scenario/src/references.ts`）。`problems` の各項目は `{ severity: 'error' | 'warning', path, message }`。

サーバーを立てずに、リポジトリ全体をまとめて検証することもできる。ファイルを直接編集したあとはこちらを使う。

```bash
npm run validate                    # すべて。エラーがあれば終了コード 1
npm run validate -- demo/test_demo  # 表示を <種類>/<ID> やパスに絞る
npm run validate -- --json          # 機械向け
npm run validate -- --fix           # app の scenarioIndex.json が古ければ作り直す
```

## 音声生成

Irodori-TTS（`.agents/skills/irodori-tts`）を子プロセスで動かす。ジョブは1本ずつ順に実行し、候補は `scratch/studio-tts/` に置く。ボイスのファイル名は `app/scripts/scenario-voices.py` と同じ規則（話者と本文のハッシュ付き）。

環境変数で場所を変えられる: `IRODORI_TTS_ROOT`（既定 `/Users/ueda/git/practice/tts/Irodori-TTS`）、`IRODORI_TTS_PYTHON`、`IRODORI_TTS_DEVICE`（既定 `mps`）、`FFMPEG`、`STUDIO_SERVER_PORT`。

話者の参照音声・声質・ボイス指導はキャラクター管理（`characters.json`）の `voice` にある。
