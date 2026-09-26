# ardy-mini

英語の動作説明から、ブラウザー内（WebGPU）でモーションを生成します。今は CLI（下の「CLI でのモーション生成」）から使います。Studio のモーション画面へ移す予定です（`plans/studio/PLAN.md`）。

## Finger Motion

`FingerMotion.ts` は、生成した体の動きに指の形を重ねます。選択肢は `index`（人差し指）、`peace`（ピース）、`thumb`（親指）、`fist`（握りこぶし）、`open`（開き手）、`three`（3本指）の6種類で、片手につき1つまで指定できます。指ポーズは ardy-mini の推論とは別に作り、再生開始時の手の形から1秒で指定の形へ変化し、動作終了まで保持します。腕や手首の動きは ardy-mini が担当します。

## 生成時間のデバッグ出力

開発者ツールの Console で **Verbose / Debug** を有効にし、`[ardy-mini] generation timing` で絞り込んでください。生成ごとに1つのオブジェクトを出力します。

| 項目 | 意味 |
| --- | --- |
| `status` | success / cancelled / error |
| `requestId`, `prompt`, `modelVariant` | 生成の識別情報・指示・モデルの種類 |
| `wallMs` | 要求から結果の配列変換までの実測時間。キュー待ちを含む |
| `queueMs` | 前の生成・キャンセルが完了するまでの待ち時間 |
| `workerRoundTripMs` | ワーカーに生成を依頼して結果を受け取るまで |
| `inferenceMs` | ワーカー内で計測した生成全体の時間 |
| `textEncodeMs`, `denoiseMs`, `decodeMs` | テキスト条件化・拡散生成・動作データへの変換の内訳 |
| `normalizeMs` | 受け取った配列をアプリ用に変換する時間 |
| `frameCount`, `motionSeconds` | 実際に生成したフレーム数・動作の長さ |
| `framesPerSecond` | ワーカーの生成全体に対する毎秒の生成フレーム数 |
| `realTimeFactor` | 生成時間 ÷ 動作時間。1未満なら動作時間より速く生成 |

時間の単位は `Ms` がミリ秒、`Seconds` が秒です。モデルの読み込み時間、指ポーズの準備、VRMへの変換・再生時間は生成計測に含めません。失敗・キャンセル時は、取得できなかった推論時間を `null` で出力します。初回生成はGPUの初期化などで遅くなる場合があるため、同じモデルで複数回の結果を比較できます。

## 動作条件

- HTTPS または localhost と WebGPU が必要です。CPU フォールバックはありません。
- モデルは初回に Hugging Face から約653 MiB（shader-f16対応）または約685 MiB（FP32）を取得します。圧縮ファイルのハッシュを検証して Cache Storage に保存し、以後再利用します。キャッシュの削除はブラウザーのサイトデータ設定から行えます。
- 2〜8秒の動きを生成します。水平移動は固定します。

## Upstream and distribution

Browser runtime, worker, motion validation, and retargeting are vendored from
[intsuc/ardy-mini](https://github.com/intsuc/ardy-mini/tree/5e9ce2da35af26583646cc8b73ac04b13a7c604a),
commit `5e9ce2da35af26583646cc8b73ac04b13a7c604a` (Apache-2.0).
The application adapter is local. Upstream source modifications:
- `vendor/runtime/sessions.ts`: use the isolated `ardy-onnxruntime-web` npm alias and
  Vite-managed URLs for matching ONNX Runtime 1.27.0 module/WASM assets.
- `vendor/motion-data.ts`: exclude typed arrays and ArrayBuffers from nested-record
  detection, so the runtime's `motion` feature array is not mistaken for a wrapper
  hiding the sibling `joints` and rotation arrays.

Model files are fetched from immutable revision
`1c21362effeecec0454bfc0d818661525ae6b387` of
`intsuc/Llama-3-ARDY-Mini-Core40-Browser`. Model weights are not included in this
repository or build. Their separate
[model terms](https://huggingface.co/intsuc/Llama-3-ARDY-Mini-Core40-Browser/blob/1c21362effeecec0454bfc0d818661525ae6b387/MODEL_TERMS.md)
apply. Source and dependency notices ship under `assets/notices/ardy-mini/`.

## CLI でのモーション生成 (WebGPU)

Playwright 経由で macOS 上の Google Chrome（WebGPU / Metal）を実行し、コマンドラインから直接モーション（FBX または JSON）を高速生成できます。モデルは初回のみダウンロードされ、以後は永続キャッシュから約0.5秒で高速生成されます。

### 基本コマンド

```bash
# 単発生成 (FBX)
npm run ardy:generate -- -p "A person raises their right hand and waves" -d 3 -o assets/animations/ardy_wave.fbx

# 秒数指定 (2〜8秒)
npm run ardy:generate -- -p "A person bows politely" -d 4 -o assets/animations/ardy_bow.fbx

# JSON 形式で出力
npm run ardy:generate -- -p "A person points forward" -d 3 -o assets/animations/ardy_point.json

# バッチ一括生成
npm run ardy:generate -- -b test/fixtures/ardy_batch_sample.json
```

オプション一覧:
- `-p, --prompt <text>`: 英語の動作プロンプト
- `-d, --duration <sec>`: モーションの長さ（2〜8秒、デフォルト 4秒）
- `-o, --output <path>`: 保存先パス（`.fbx` または `.json`）
- `-f, --format <fbx|saved-motion|raw>`: 出力形式（拡張子から自動判定）
- `-n, --candidates <n>`: cfgごとに試すseed数（1〜32、デフォルト1）。採点が最良の1本を出力に保存
- `--seed <text>`: 基準seed。`-n 1` なら `.candidates.json` に記録された候補をそのまま再現
- `--cfg <w[,w...]>`: cfgWeight（デフォルト3.5）。カンマ区切りで複数指定すると、同じseedで比較
- `--keep <n>`: 良い順に書き出すファイル数（候補が複数ならデフォルト3）
- `--avatar <URL>`: このVRMに合わせて焼き込む（手の位置補正・プレビュー・下半身固定・振幅に必要）
- `--preview`: 書き出した FBX をゲームと同じ読み込み処理で再生し、正面・横・上半身アップのコマ割りを `.preview.png` に保存
- `--no-fit-hands`: `--avatar` 指定時の手の位置補正を切る（比較用）
- `--lock-legs`: 脚・腰の回転・腰の高さを最初のフレームに固定（その場での身振り用。膝を曲げて沈むのを防ぐ）
- `--amplitude <a>`: 動きの大きさ（0.3〜1.5、デフォルト1）。背筋を伸ばし腕を下ろした姿勢に向けて回転を縮める
- `--loop`: 最後の0.5秒を最初の姿勢へなじませる。シナリオなどで繰り返し再生する動作の、繰り返し時のガクつきを防ぐ
- `-b, --batch <file>`: 一括生成用 JSON 定義ファイル（各要素に `candidates` / `seed` / `cfg` / `keep` / `preview` / `lockLegs` / `amplitude` / `loop` も指定可）
- `--headed`: ブラウザ画面を表示（デバッグ用）
- `--quality-plan <file>`: 校正済みavatar profileと一緒に使うMotionQualityPlan JSON
- `--jev`: Jevに9つの型付き質問を1回で送り、接触プランを構成（`.env` の `JEV_API_KEY` を使用。`TYPESAFE_API_KEY` も互換対応）
- `--acting-note <text>`: Jevとardy-mini両方へ渡す演技方針。例: `soft, graceful, restrained`
- `--avatar <URL>` / `--contact-profile <file>`: 対象VRMとその校正profile（quality設定では必須）
- `--port <port>`: 開発サーバーポート（省略時はViteのデフォルト5173）

### アバターの体型に合わせる

ardy-mini は実写の体（身長約1.8m）の動きを出力します。アニメ体型のVRMは腰の高さを1とした比率で見ると、肩幅が約4割狭く、腕と胴が約2.5割短いです。そのため関節の角度をそのまま移すと、腰や胸に当てた手が体にめり込みます。`--avatar` を指定すると、`fitHandsToAvatar.ts` が次の処理を行います。

1. VRMのメッシュ（服を含む）から、胸・腹・腰の大きさを楕円体として測る
2. ardy-mini 側で手が体に触れる位置を基準に、手のひらの位置を同じ部位の表面へ置き直す
3. 両手が近いとき（手のひらの間隔30cm未満）は ardy-mini での左右の位置関係を保つ。肩幅が狭いと、胸や顔の前で合わせた手が中心を越えて交差し、手の甲どうしが合わさったように見えるため
4. 手のひらがおおむね向き合っていて近いとき（拍手など）は、手のひらどうしが向き合うように手を最大60°回し、手首を曲げる
5. 手首から各指先までをカプセルの連なりとして扱い（太さはVRMの手のメッシュから測った厚み、指はその6割）、両手のカプセルが重なる場合は離す。手のひらの向き・体の前後/上下/左右・両手を結ぶ方向のうち、押す量が最も少ない方向を選ぶ（最大で手の厚みの3倍）。体の前方へ押すときは外側の手だけを動かし、胸の上に重ねた手がそのまま乗るようにする
6. IKで腕を解き直す（回した手の手のひらが目標に来るように手首の位置を決める）

顔に近い手は ardy-mini の姿勢のままにします。アニメの顔は手に比べて小さいため、手のひらの中心を口に合わせると指が目を覆ってしまい、角度をそのまま移した方が自然に見えたためです。FBXは指定したVRMの体型に合わせて焼き込まれるので、体型が大きく違うモデル（例: mob/girl は aoi より肩がさらに狭い）には別に生成してください。

```bash
npm run ardy:generate -- -p "A person puts hands on hips and laughs happily" -d 4 -n 6 --lock-legs --avatar /models/aoi/aoi-school.vrm --preview -o assets/animations/ardy_laugh.fbx
```

「顎に手を当てて考える」で手が顔の中央を覆うのは、変換ではなく ardy-mini の生成結果そのものです（手のひらが鼻の前に来ます）。"A person rests their chin on their right hand" の方が顎の下に手が来ます。同様に「力強い万歳」は `--amplitude` で縮めても腕が横に広がるだけで可愛くならないため、"A person claps their hands together in front of their chest excitedly" のようにプロンプトで動き自体を変えてください。

### 候補から選ぶ

拡散モデルはseedで当たり外れがあるため、`-n 8` などで複数生成し、`src/ai/motion/ardy/scoreMotion.ts` の採点で並べます。出力は1位、`.cand2.fbx` 以降が次点、`.candidates.json` に全候補のseed・cfg・指標を保存します。

```bash
npm run ardy:generate -- -p "A person raises their right hand and waves" -d 3 -n 8 --cfg 2,3.5 -o assets/animations/ardy_wave.fbx
```

採点するのは欠陥だけで、プロンプトどおりに動いているかは測りません。

- 足の滑り：書き出しでは腰の水平位置を固定するため、生成時に腰が動くと接地中の足が滑ります。
- 手の胴体へのめり込み
- 手首の曲げすぎ

他の候補の半分未満しか手が動かない候補は、指示を無視している可能性が高いため後ろに回します。ardy-miniの出力は5Hz以上の成分がほぼなくガタつかないため、ジャークは採点しません。最終的な選択は、書き出したファイルを見て決めてください。

quality生成には、同じVRMを `npm run ardy:calibrate -- --avatar /models/aoi/aoi-school.vrm --output assets/motion-profiles/aoi-school.json` で一度校正します。profileに埋め込まれるモデルhashが違うと補正を適用しません。Jevで作った時間プランは `.review.fbx` へ保存されるので、目視後に必要なら手書きplanへ確定してください。
