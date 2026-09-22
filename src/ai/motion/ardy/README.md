# Gemini Live + ardy-mini

ルートのビューアで **Others → AIアバターリアルタイム会話 → ardy-mini で会話に合わせた動きを生成** を有効にし、「モデルを読み込む」を押します。準備完了後、Gemini APIキーを入力して接続します。「動きを試す」では、APIキーなしで英語の動作説明から生成・再生できます。

Gemini は日本語の応答に `generateArdyMotion({ prompt: "A person ...", duration: 4 })` を添えます。英語の指示は読み上げず、会話欄に生成状況とともに表示します。ツールには生成開始を即時応答し、Web Worker の推論が終わると Core27 の回転を VRM の正規化ボーンへ変換して再生します。動きの生成には時間がかかるため、発話と開始時刻が一致する保証はありません。

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
