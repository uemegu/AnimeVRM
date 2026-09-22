# Gemini Live + ardy-mini

ルートのビューアで **Others → AIアバターリアルタイム会話 → ardy-mini で会話に合わせた動きを生成** を有効にし、「モデルを読み込む」を押します。準備完了後、Gemini APIキーを入力して接続します。「動きを試す」では、APIキーなしで英語の動作説明から生成・再生できます。

Gemini は日本語の応答に `generateArdyMotion` の呼び出しを添え、英語の動作説明・秒数・指の形を指定します。英語の指示は読み上げず、会話欄に生成状況とともに表示します。ツールには生成開始を即時応答し、Web Worker の推論が終わると Core27 の回転を VRM の正規化ボーンへ変換して再生します。動きの生成には時間がかかるため、発話と開始時刻が一致する保証はありません。

## Finger Motion

Gemini は `generateArdyMotion` の `fingerMotion` に、左右それぞれの手の形を YES / NO で追加します。選択肢は motion.html と同じ `index`（人差し指）、`peace`（ピース）、`thumb`（親指）、`fist`（握りこぶし）、`open`（開き手）、`three`（3本指）の6種類です。片手につき YES は最大1つ、すべて NO なら追加指定しません。

```json
{
  "prompt": "A person stands in place and raises their right hand beside their face.",
  "duration": 4,
  "fingerMotion": {
    "right": { "index": "NO", "peace": "YES", "thumb": "NO", "fist": "NO", "open": "NO", "three": "NO" },
    "left": { "index": "NO", "peace": "NO", "thumb": "NO", "fist": "NO", "open": "NO", "three": "NO" }
  }
}
```

指ポーズは ardy-mini の推論から分けて作ります。生成が完了したら、motion.html と同じ指ポーズ処理から指ボーンの回転だけを取り出して重ねます。再生開始時の手の形から1秒で指定の形へ変化し、動作終了まで保持します。腕や手首の動きは ardy-mini が担当します。指の指定内容は会話欄にも表示され、キャンセル・待機動作への復帰は身体と一緒に処理されます。

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
- モーション生成は端末内で実行します。Geminiとの会話は従来どおり Gemini API を使用します。
- 2〜8秒の動きを生成し、水平移動は固定して身振りに適用します。再生終了時は通常の待機動作に戻ります。表情・リップシンク・揺れ物は既存処理を継続します。
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

## Verification

```sh
npx tsc --noEmit
npx vite build --outDir /tmp/animevrm-ardy-build
npx playwright test --config playwright.ardy.config.ts
```

Automated checks cover UI opt-in, tool declarations, cancellation, stale-result
suppression, Core27→VRM clip playback and return to idle, booting the actual
inference worker, and transferring a complete runtime result from a fixture worker
through the service to VRM playback. The automated suite does not download model weights or call a
paid Gemini API.
