---
name: scenario-authoring
description: >-
  シナリオ（assets/scenarios/<種類>/<ID>/scenario.json）と Studio データ（assets/studio/*.json：キャラ・場所・時間帯・BGM・モーション・プロジェクト）を
  作る・直すときの手順。JSON を直接編集し、npm run validate で検証し、npm run shot で撮影して見た目を確かめる。
  セリフ・カット・分岐・カメラ・表情・モーション・背景・発生条件の追加や修正、新しいシナリオの作成、場所やキャラの設定変更のときに使う。
---

# シナリオ・Studio データの編集

Studio の画面を使わず、JSON を直接編集して「編集 → 検証 → 撮影して確認」を回す。サーバーも Studio も起動しなくてよい。

## 1. 書く前に読むもの

- 形式の正は `packages/scenario/src/schema.ts`（シナリオ）、`scene.ts`（場所・時間帯）、`characters.ts`、`stage.ts`（BGM・モーション）、`projects.ts`。各項目のコメントに意味が書いてある
- 書き方と演出の説明：`app/FEATURES.md` の「シナリオファイル」「シーンの書き方」「発生条件」
- 近い既存シナリオを1本読んで真似る（演出の見本は `assets/scenarios/demo/`）
- 開発ルール（表情の強さ・カメラ・選択肢のシーンなど）は `GEMINI.md`

## 2. 使える ID を確かめる

推測で書かず、マスターデータから選ぶ。

| 参照 | 場所 |
| --- | --- |
| キャラ（`speakerCharacterId`・`avatars` のキー・`characterId`・好感度のキー・視線の先） | `assets/studio/characters.json` の `characters[].id`。主人公は `player` |
| 場所（`background`・`location`・`availability.locations`） | `assets/studio/locations.json` の `presets` のキー |
| 時間帯（`timeOfDay`） | `assets/studio/time-of-day.json` の `presets` のキー |
| BGM（`bgm`） | `assets/studio/bgm.json` の `bgm` のキー、または `silence` |
| モーション（`motion`） | `assets/animations/<名前>.fbx` の `<名前>`（拡張子なし）。ループさせるものは `assets/studio/motions.json` |
| ファイル（`voiceUrl`・`seUrl`・`ambience`・`modelUrl`・画像） | `/` 始まりは `assets/` 基準、それ以外はシナリオのディレクトリ基準 |

## 3. 編集の決まり

- 新しいシナリオは `assets/scenarios/<種類>/<ID>/scenario.json`。`id` はディレクトリ名と同じにする。種類とプロジェクトの対応は `assets/studio/projects.json`
- セリフの話者は必ず `speakerCharacterId` で指定する（声だけの話者も）。`speaker` は表示名の上書きだけ
- 背景・時間帯・BGM・登場キャラは、書いた項目だけ変わり、前のシーンから引き継ぐ
- 知らない項目はスキーマで拒否される。綴りを確かめる
- ボイスはここでは作らない。必要なら Studio の音声生成か `irodori-tts` Skill を使う

## 4. 検証する

```bash
npm run validate                    # 全体。エラーがあれば終了コード 1
npm run validate -- demo/trio       # 表示を <種類>/<ID> に絞る
npm run validate -- --json          # 機械向け（problems[].severity / file / path / message）
npm run validate -- --fix           # app の目次 scenarioIndex.json が古ければ作り直す
```

- エラーは必ず直す。`path`（例 `scenes.3.avatars.aoi.motion`）が JSON の中の場所
- 警告（たどり着けないシーン、話者 ID のないセリフ、どこでも立てていないフラグ）は、意図したものか確かめる。app のコードで立てるフラグもある
- シナリオを足したり発生条件を変えたりしたら `--fix` で目次を作り直す

## 5. 撮影して見た目を確かめる

```bash
npm run shot -- demo/trio                            # 全カット → scratch/shots/demo/trio/<番号>_<シーンID>.png
npm run shot -- demo/trio --scene s3,s4              # 直したカットだけ（シーン ID か番号）
npm run shot -- demo/trio --scene s3 --time 2.5      # カット内のその時刻（タイムラインのキーを反映）
npm run shot -- demo/trio --file draft.json          # 保存前の下書き
```

- 画像を開いて、構図（誰が映っているか・切れていないか）、立ち位置、表情、背景・近景との重なり、セリフ枠を確かめる
- 左上に場所・時間帯・構図が出る。邪魔なら `--no-hud`、セリフ枠を消すなら `--no-dialogue`
- `--outfit private` で私服（休日の見え方）
- モーションは撮影時点の1コマなので、身振りの途中を見たいときは `--time` と `--settle` で時刻をずらす
- 音は鳴らない（`--mute-audio`）。ブラウザで確かめるときも音を出さない（`GEMINI.md`）

## 6. サーバーの API で保存する場合

Studio のサーバー（`npm run server`、`127.0.0.1:5190`）が動いていれば API でも保存できる。`?strict=1` を付けると、参照先にエラーがあるとき保存しない。

```bash
curl -s -X PUT 'http://127.0.0.1:5190/api/scenarios/demo/trio?strict=1' -H 'content-type: application/json' --data @assets/scenarios/demo/trio/scenario.json
```

API の一覧は `server/README.md`。ファイルを直接編集した場合は、4 の検証で足りる。

## 7. 終わる前に

- `npm run validate` がエラー 0
- 直したカットを撮影して確認した
- スキーマや検証のコードを変えたときは `npm test -w packages/scenario`
