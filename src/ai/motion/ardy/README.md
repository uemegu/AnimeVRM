# Gemini Live + ardy-mini

ルートのビューアで **Others → AIアバターリアルタイム会話 → ardy-mini で会話に合わせた動きを生成** を有効にし、「モデルを読み込む」を押します。準備完了後、Gemini APIキーを入力して接続します。「動きを試す」では、APIキーなしで英語の動作説明から生成・再生できます。

Gemini は日本語の応答の前に `generateArdyMotion({motions: [...]})` を呼び出します。各要素は英語の動作説明・秒数・指の形です。1〜6動作を配列順に生成・連続再生し、後続の生成は現在の再生と並行して進めます。指示は読み上げず、会話欄に各動作の生成・再生状況を表示します。

プロンプトでは、抽象的な感情や複雑な振り付けを、頭・胴体・左右の腕などの具体的な位置と方向に分解するよう指示しています。例えば「考える」なら「右肘を曲げ、右手をゆっくり顎へ近づける。左腕は下げたまま」と記述します。複数の動きは1つの長文に詰め込まず、配列の別要素に分けます。

## 発話との同期

最初の動作が準備できてからツール応答を返し、最初のPCM音声と一緒に動作を開始します。音声が先に届いた場合も最大1.5秒まで待ち合わせます。生成が遅い・失敗した・ツールが呼ばれなかった場合は音声を先に進めます。音声のないツール応答は、準備後1.5秒で動作だけを開始します。

音声の受信完了と再生完了を分け、AudioContextの再生キューが空になるまで発話中として扱います。受信完了時に残りの音声時間に合わせて身体モーションの時間を調整します（不自然な速度を避けるため残り時間の0.5〜2倍まで）。Finger Motionの1秒の遷移は維持します。発話が終わると残りの会話用モーションを終了し、自律動作または待機姿勢へ移ります。単語単位でのジェスチャー位置合わせは行いません。

## 無言で続く自律動作

Others の「話していない間も自律的に動く」は標準でONです。接続後、またはモーション終了時に、直近の会話と動作をもとに次の動きを計画します。最後の動作の再生中から次の配列を1つだけ先読みし、ardy-miniで準備します。現在の配列が終わると生成済みの次の配列へ進むため、ユーザーが話さなくても動き続けます。

自律動作は同じAPIキーで **Gemini generateContentへの追加リクエスト** を使います。標準モデルは `gemini-3.5-flash-lite` で、接続前に変更できます。`systemInstruction` に「前の動作が終わるので次を投機的に計画する」と指示し、音声なしのJSONだけを受け取ります。[Live APIでは接続中にシステム指示を更新できず、clientContentは生成を割り込ませる](https://ai.google.dev/api/live)ため、会話とは別のリクエストにしています。無言の動作は会話履歴へ追加せず、Consoleの `[ardy-mini] sequence playback` で確認できます。

自律動作は接続中でもOFFにできます。ユーザーの音声入力・テキスト入力・割り込み・切断・アバター交換時は、先読みと再生を中止し、古い結果を破棄します。生成エラーは間隔を空けて再試行し、3回続けて失敗すると自律動作だけをOFFにします。会話は継続できます。

## Finger Motion

Gemini は `generateArdyMotion` の各 `motions[]` の `fingerMotion` に、左右それぞれの手の形を YES / NO で追加します。選択肢は motion.html と同じ `index`（人差し指）、`peace`（ピース）、`thumb`（親指）、`fist`（握りこぶし）、`open`（開き手）、`three`（3本指）の6種類です。片手につき YES は最大1つ、すべて NO なら追加指定しません。

```json
{
  "motions": [
    {
      "prompt": "A person stands in place and raises their right forearm beside their face. Their left arm remains lowered.",
      "duration": 4,
      "fingerMotion": {
        "right": { "index": "NO", "peace": "YES", "thumb": "NO", "fist": "NO", "open": "NO", "three": "NO" },
        "left": { "index": "NO", "peace": "NO", "thumb": "NO", "fist": "NO", "open": "NO", "three": "NO" }
      }
    },
    {
      "prompt": "A person slowly lowers their right arm to their side, keeping their torso upright.",
      "duration": 3,
      "fingerMotion": {
        "right": { "index": "NO", "peace": "NO", "thumb": "NO", "fist": "NO", "open": "YES", "three": "NO" },
        "left": { "index": "NO", "peace": "NO", "thumb": "NO", "fist": "NO", "open": "NO", "three": "NO" }
      }
    }
  ]
}
```

指ポーズは ardy-mini の推論から分けて作ります。生成が完了したら、motion.html と同じ指ポーズ処理から指ボーンの回転だけを取り出して重ねます。再生開始時の手の形から1秒で指定の形へ変化し、動作終了まで保持します。腕や手首の動きは ardy-mini が担当します。指の指定内容は会話欄にも表示され、キャンセル・待機動作への復帰は身体と一緒に処理されます。

## 生成時間のデバッグ出力

開発者ツールの Console で **Verbose / Debug** を有効にし、`[ardy-mini] generation timing` で絞り込んでください。生成ごとに1つのオブジェクトを出力します。配列の各動作と自律動作の先読みもそれぞれ計測します。別途 `[ardy-mini] planner timing` には、次の動作の文章をGeminiが考える時間を出力します。

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
- モーション生成は端末内で実行します。Geminiとの会話は従来どおり Gemini API を使用します。
- 2〜8秒の動きを生成し、水平移動は固定して身振りに適用します。配列間はクロスフェードで接続し、次が未準備または自律動作がOFFなら通常の待機動作に戻ります。表情・リップシンク・揺れ物は既存処理を継続します。
- 新しい指示、ユーザーの割り込み、切断、アバター交換時には古い生成をキャンセルします。生成失敗は会話欄に表示し、会話を継続できます。
- 読み込み失敗時は再試行できます。GPUメモリの解放には切断後にチェックを外してください。
- モーション方式は接続前に選択します。チェックを外した状態では既存のFBX再生・合成ツールを使用します。

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
The viewer's existing ONNX Runtime used by audio features is unchanged.

Model files are fetched from immutable revision
`1c21362effeecec0454bfc0d818661525ae6b387` of
`intsuc/Llama-3-ARDY-Mini-Core40-Browser`. Model weights are not included in this
repository or build. Their separate
[model terms](https://huggingface.co/intsuc/Llama-3-ARDY-Mini-Core40-Browser/blob/1c21362effeecec0454bfc0d818661525ae6b387/MODEL_TERMS.md)
apply. Source and dependency notices ship under `public/notices/ardy-mini/`.

## CLI でのモーション生成 (WebGPU)

Playwright 経由で macOS 上の Google Chrome（WebGPU / Metal）を実行し、コマンドラインから直接モーション（FBX または JSON）を高速生成できます。モデルは初回のみダウンロードされ、以後は永続キャッシュから約0.5秒で高速生成されます。

### 基本コマンド

```bash
# 単発生成 (FBX)
npm run ardy:generate -- -p "A person raises their right hand and waves" -d 3 -o public/animations/ardy_wave.fbx

# 秒数指定 (2〜8秒)
npm run ardy:generate -- -p "A person bows politely" -d 4 -o public/animations/ardy_bow.fbx

# JSON 形式で出力
npm run ardy:generate -- -p "A person points forward" -d 3 -o public/animations/ardy_point.json

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
npm run ardy:generate -- -p "A person puts hands on hips and laughs happily" -d 4 -n 6 --lock-legs --avatar /models/aoi/aoi-school.vrm --preview -o public/animations/ardy_laugh.fbx
```

「顎に手を当てて考える」で手が顔の中央を覆うのは、変換ではなく ardy-mini の生成結果そのものです（手のひらが鼻の前に来ます）。"A person rests their chin on their right hand" の方が顎の下に手が来ます。同様に「力強い万歳」は `--amplitude` で縮めても腕が横に広がるだけで可愛くならないため、"A person claps their hands together in front of their chest excitedly" のようにプロンプトで動き自体を変えてください。

### 候補から選ぶ

拡散モデルはseedで当たり外れがあるため、`-n 8` などで複数生成し、`src/ai/motion/ardy/scoreMotion.ts` の採点で並べます。出力は1位、`.cand2.fbx` 以降が次点、`.candidates.json` に全候補のseed・cfg・指標を保存します。

```bash
npm run ardy:generate -- -p "A person raises their right hand and waves" -d 3 -n 8 --cfg 2,3.5 -o public/animations/ardy_wave.fbx
```

採点するのは欠陥だけで、プロンプトどおりに動いているかは測りません。

- 足の滑り：書き出しでは腰の水平位置を固定するため、生成時に腰が動くと接地中の足が滑ります。
- 手の胴体へのめり込み
- 手首の曲げすぎ

他の候補の半分未満しか手が動かない候補は、指示を無視している可能性が高いため後ろに回します。ardy-miniの出力は5Hz以上の成分がほぼなくガタつかないため、ジャークは採点しません。最終的な選択は、書き出したファイルを見て決めてください。

quality生成には、同じVRMを `npm run ardy:calibrate -- --avatar /models/aoi/aoi-school.vrm --output public/motion-profiles/aoi-school.json` で一度校正します。profileに埋め込まれるモデルhashが違うと補正を適用しません。Jevで作った時間プランは `.review.fbx` へ保存されるので、目視後に必要なら手書きplanへ確定してください。
