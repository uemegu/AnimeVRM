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
| `PUT /api/scenarios/:category/:id` | 保存（なければ作る）。`packages/scenario` のスキーマに合わなければ 400 と問題の場所を返す。保存後に app の `scenarioIndex.json` を作り直す |
| `GET /api/assets/:kind` | アセットの一覧（models / environments / animations / textures / bgm / se / voices） |
| `PUT /api/assets/:kind/:name` | アップロード（本文がファイルの中身）。同名があれば `?overwrite=1` のときだけ上書き |
| `GET /api/studio-data` ・ `GET/PUT /api/studio-data/:name` | Studio が管理する JSON（`assets/studio/<name>.json`） |
| `GET /api/tts/profiles` | 話者ごとの参照音声・声の説明（`assets/studio/voice-profiles.json`） |
| `GET /api/tts/lines/:category/:id/:lineId` | セリフから決まる話者・表情・声の説明 |
| `POST /api/tts/jobs` | 音声生成ジョブ。`{ category, id, lineId, candidates?, speaker?, caption? }` |
| `GET /api/tts/jobs/:jobId` | ジョブの状態と候補の番号 |
| `GET /api/tts/jobs/:jobId/candidates/:index` | 候補の mp3（試聴用） |
| `POST /api/tts/jobs/:jobId/adopt` | `{ index }` の候補をシナリオのディレクトリへ置き、`voiceUrl` を書き換える |

## 音声生成

Irodori-TTS（`.agents/skills/irodori-tts`）を子プロセスで動かす。ジョブは1本ずつ順に実行し、候補は `scratch/studio-tts/` に置く。ボイスのファイル名は `app/scripts/scenario-voices.py` と同じ規則（話者と本文のハッシュ付き）。

環境変数で場所を変えられる: `IRODORI_TTS_ROOT`（既定 `/Users/ueda/git/practice/tts/Irodori-TTS`）、`IRODORI_TTS_PYTHON`、`IRODORI_TTS_DEVICE`（既定 `mps`）、`FFMPEG`、`STUDIO_SERVER_PORT`。

女神（`god`）の参照音声は `scratch/`（git 管理外）にある。
