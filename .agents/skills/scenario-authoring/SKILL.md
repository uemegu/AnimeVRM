---
name: scenario-authoring
description: >-
  シナリオ（<置き場>/scenarios/<種類>/<ID>/scenario.json。Studio のデモは assets/scenarios/demo/、作品は作品のリポジトリ。『5秒の告白』は app/assets/scenarios/）と Studio データ（assets/studio/*.json：キャラ・場所・時間帯・BGM・モーション・プロジェクト）を
  作る・直すときの手順。JSON を直接編集し、npm run validate で検証し、npm run shot で撮影して見た目を確かめる。
  セリフ・カット・分岐・カメラ・表情・モーション・背景・発生条件の追加や修正、新しいシナリオの作成、場所やキャラの設定変更のときに使う。
---

# シナリオ・Studio データの編集

Studio の画面を使わず、JSON を直接編集して「編集 → 検証 → 撮影して確認」を回す。サーバーも Studio も起動しなくてよい。

## 1. 書く前に読むもの

- 形式の正は `packages/scenario/src/schema.ts`（シナリオ）、`scene.ts`（場所・時間帯）、`characters.ts`、`stage.ts`（BGM・モーション）、`projects.ts`。各項目のコメントに意味が書いてある
- 書き方と演出の説明：作品側の FEATURES.md（confession_in_5_seconds では `app/FEATURES.md`）の「シナリオファイル」「シーンの書き方」「発生条件」
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
| 手に持つ小物（`heldItem`） | `schema.ts` の `HeldItemId`（缶・紙パック・スマホ・本・ノート）。形は `packages/content/src/props.ts`、持ち方は `packages/engine/src/avatar/heldItem.ts`。小物を足すときは `schema.ts` の `HeldItemId` と `props.ts` の `ITEMS` に追加する。モーションだけ変えると手放す |
| ファイル（`voiceUrl`・`seUrl`・`ambience`・`modelUrl`・画像） | `/` 始まりは素材の置き場（Studio の `assets/` と、作品の置き場。同じ URL の並びで重なる）基準、それ以外はシナリオのディレクトリ基準。一枚絵・カットイン・スタンプなど作品だけで使う素材は作品の置き場（『5秒の告白』は `app/assets/`）に置く |

## 3. 編集の決まり

- 新しいシナリオは `<置き場>/scenarios/<種類>/<ID>/scenario.json`。デモは `assets/scenarios/demo/`（`assets/studio/projects.json`）。作品（外部プロジェクト。`STUDIO_PROJECTS` か `studio-projects.txt` で読み込んだもの）の種類は、その `studio-project.json` の `assetsDir` の下に置く（『5秒の告白』は `app/assets/scenarios/`）。作品のリポジトリでは、そちらの `npm run validate`・`npm run shot` を使う（外部プロジェクトを読み込んだ状態で動く）。`id` はディレクトリ名と同じにする。validate・shot は `<種類>/<ID>` で指定すれば置き場を自動で選ぶ
- セリフの話者は必ず `speakerCharacterId` で指定する（声だけの話者も）。`speaker` は表示名の上書きだけ
- 背景・時間帯・BGM・登場キャラは、書いた項目だけ変わり、前のシーンから引き継ぐ
- 音量の倍率（`voiceVolume`・`seVolume`・`bgmVolume`、0〜1、省略時 1）とチャネル（`voicePan`・`sePan`・`bgmPan`、`stereo` / `left` / `right`、省略時 `stereo`）。ボイス・効果音はそのシーンだけ、BGM は BGM が変わるまで引き継ぐ
- 知らない項目はスキーマで拒否される。綴りを確かめる
- ボイスはここでは作らない。必要なら Studio の音声生成か `irodori-tts` Skill を使う
- 座る・机に肘をつくモーション（`motions.json` の `seated`）は、場所の席（`locations.json` の `seats`）の位置・向きで使う。席のない場所や立ち位置（`left` など）で使わない。座っている間のカメラは席の `cameras` を `cameraPose` に書く
- 流れる背景（`scrollingBackground`）の間は、構図を省略すると横から（`side`）撮る。歩き・走り（`motions.json` の `locomotion`）を正面の構図（`medium`・`close` など）で撮らない
- カメラの動き（`cameraMove`。パン・ティルト・ドリー・ズーム・オービット・クレーン・ドリーズーム・手持ち風・ダッチ。種類は `schema.ts` の `CameraMoveType`）は、カットの頭から構図に重ねて動かす。`{ "type": "dolly_in", "duration": 2, "amount": 0.5 }` で秒数と大きさを変えられる。途中から始めるときはキー（`transitions`）に書き、`false` で止める。構図を切り替えるキーに動きを書かないと、その時点で止まる。`dolly_in` は遠くから構図へ着地し、`zoom_in` は構図から約2倍まで寄っていく（顔のアップになるので多用しない）。オービットは1周して構図へ戻り、`amount` が周回数。後ろまで映るので、絵の背景（2D）の場所では使わず簡易3D・3D の場所で使う。動きの途中の絵は `npm run shot -- ... --time 秒` で確かめる
- 寄りながら・引きながら何人かが話し続けるときは、続くシーンすべて（最初のシーンも）に同じ構図と同じ種類の動きを書き、`"continue": true` を付ける（`{ "type": "dolly_in", "duration": 11, "amount": 0.7, "continue": true }`）。動きを頭からやり直さずに続け、オートでも動きの終わりを待たずに次へ進む。`duration` は続くセリフ全部とその間の待ちを足した長さにする
- 構図（`camera`）は `wide`（全員が入る引き）・`medium`（話者中心の会話）・`speaker`（話者のウェストアップ）・`close`（バストアップ）・`face`（顔アップ。肩口から頭まで。山場だけで続けて使わない）・`side`（横から）・`ots`（肩越し）。寄る相手は話者が既定で、話していない人の反応を撮るときは `cameraFocus` にキャラ ID を書く。`ots` は手前の人の肩の後ろから寄る相手を撮り、手前の人は `cameraOver`（省略で寄る相手が見ている人→話者→一番近い人）。`close`・`face` は寄る相手が誰かを見ていれば斜め前から撮る。どちらもキー（`transitions`）にも書ける。肩越し・アップのために `cameraPose` の座標を計算しない
- 構図が変わるとカメラはその場で切り替わる（カット）。滑らかに動かすのは、キーで `cameraTransitionDuration` を書いたときだけ。構図もカメラの位置も同じまま話者が替わると、ピントが前の話者から次の話者へ送られる
- 背景（場所）が変わるシーンは自動で暗転し、一枚絵・カットインは下がる。続けて出したいときはそのシーンで指定し直す

### カメラワークは「何を表現したいか」から選ぶ

セリフごとに構図を選ばない。場面の区切りごとに表現したいことを決め、それに合うカメラワークにする。

| 表現したいこと | カメラワーク |
| --- | --- |
| 気まずさ・凍りつく空気・言葉が出ない | 固定の引き。割らずに何セリフも続ける |
| 間で笑わせる（ボケとツッコミ） | 固定の2ショット・3ショット。両方が同じ画面にいるから笑える |
| 感情が高まる・気づき・決意に近づく | 話している間ずっとゆっくり寄る（`dolly_in`、複数セリフなら `continue`） |
| 取り残される・事態の大きさ・締め | 話している間に引く（`dolly_out`・`crane_up`） |
| 二人だけの世界・時間が止まる | 回り込む（`orbit`。簡易3D・3D の場所だけ） |
| 勢い・動揺 | 手持ち（`handheld`） |
| 言い合いがエスカレートする | 切り返し。だんだん寄り、短くする |
| 疑いや主導権が移る | 肩越しの同じ画面のまま話者を替え、ピントを送る |
| これが鍵だ | 物のインサート（一枚絵 `cg` にセリフを重ねる） |
| オチ・ツッコミの瞬間 | キーで一瞬の `zoom_in`（`duration` 0.15 前後） |

- ダッチ・手持ち・急な寄りは、山場や転換点で一度だけ使う。序盤から使うと山場で効かない
- 人物を横一列でカメラに向けて立たせない。会話する相手を向かせ（`rotationY`）、強い側を画面の右に置く

表情は基本 `neutral` のままにする。感情を付けるのは山場の、漫画記号や赤面と組み合わせて一目で読める反応だけ。

話者の目・首の細かい芝居は、ボイスとセリフの文字から自動で付く（`packages/scenario/src/speechTone.ts`）。文末の `！`（勢い：見開く）・`？`（問いかけ：首をかしげる）・`…`（ためらい：伏し目）、言い出しの `えっ` や `！？`（驚き）、`えへへ`・`ふふ`（照れ：目を細める）で変わるので、セリフの記号は話し方どおりに書く。

## 4. 検証する

```bash
npm run validate                    # 全体。エラーがあれば終了コード 1
npm run validate -- demo/trio       # 表示を <種類>/<ID> に絞る
npm run validate -- --json          # 機械向け（problems[].severity / file / path / message）
npm run validate -- --fix           # 作品の検証（hooks）で直せるもの（『5秒の告白』の目次 scenarioIndex.json など）を直す
```

- エラーは必ず直す。`path`（例 `scenes.3.avatars.aoi.motion`）が JSON の中の場所
- 警告（たどり着けないシーン、話者 ID のないセリフ、どこでも立てていないフラグ）は、意図したものか確かめる。作品のコードで立てるフラグもある
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

### 構図のチェック（話者の顔が映っているか）

```bash
npm run check:framing                               # ゲーム本編のシナリオ全部（時間がかかる）
npm run check:framing -- forced/shion_d15_reveal    # <種類>/<ID> か <種類> で絞る
npm run check:framing -- action --shots             # 外れたカットを scratch/shots/framing/ に撮る
```

話者の頭が画面の外・上端・セリフ枠に隠れる高さにあるカットを一覧にする。直したら同じシナリオで再実行する。

## 6. サーバーの API で保存する場合

Studio のサーバー（`npm run server`、`127.0.0.1:5190`）が動いていれば API でも保存できる。`?strict=1` を付けると、参照先にエラーがあるとき保存しない。

```bash
curl -s -X PUT 'http://127.0.0.1:5190/api/scenarios/demo/trio?strict=1' -H 'content-type: application/json' --data @assets/scenarios/demo/trio/scenario.json
```

API の一覧は `server/README.md`。ファイルを直接編集した場合は、4 の検証で足りる。

## 7. 終わる前に

- `npm run validate` がエラー 0
- 直したカットを撮影して確認した
- 構図を変えたシナリオは `npm run check:framing -- <種類>/<ID>` で外れが 0
- スキーマや検証のコードを変えたときは `npm test -w packages/scenario`
