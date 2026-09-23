# タスク03：手書き計画で生成・補正・保存する

読む：`contract.md`、`src/ai/motion/ardy/cliRunner.ts`、`scripts/ardy-generate.ts`、`src/motion/createArdySavedMotion.ts`、`src/motion/fbx.ts`、`src/Avatar.ts` の `loadMixamoAnimation()`。

## CLIの追加仕様

既存の引数を維持し、次を追加する。このタスクではJevを呼ばない。

```text
--quality-plan <json path>      MotionQualityPlan
--avatar <URL>                 Viteから読める対象VRMのURL
--contact-profile <json path>   AvatarContactProfile
```

3つはセットで必須。従来の指定だけなら従来の経路を通る。qualityと `--format raw` の組み合わせは、未補正データを補正済みと誤解させないため引数エラーにする。

Node側でJSONの読込・検証・モデルのSHA-256照合を行い、ブラウザへは `{plan, profile, avatarUrl}` を渡す。モデルがURLにしか無い場合は取得したバイト列のhashで照合する。ブラウザにローカルファイルの絶対パスをそのまま渡さない。

`BatchItem` に `qualityPlan`, `avatar`, `contactProfile` を追加する。JSONのファイルパスは `qualityPlan` と `contactProfile`、VRMのURLは `avatar` に入れる。相対ファイルパスは既存のoutputと同じく実行時のcwd基準とし、helpに書く。CLI全体の既定値より各taskの値を優先する。

## 実行用の計画サンプル

`test/fixtures/motion-quality/prayer-plan.json` として追加する。

```json
{
  "version": 1,
  "duration": 4,
  "style": "neutral",
  "styleStrength": 0,
  "timingSource": "authored",
  "contacts": [
    { "kind": "palmsTogether", "start": 0.5, "holdStart": 1.4, "holdEnd": 2.8, "end": 3.6 }
  ]
}
```

```sh
node scripts/ardy-generate.ts \
  -p "A person slowly presses their open palms together in front of their chest, holds them there, then lowers their hands." \
  -d 4 -o public/animations/quality-prayer.fbx \
  --quality-plan test/fixtures/motion-quality/prayer-plan.json \
  --avatar /AnimeVRM/models/aoi/aoi-school.vrm \
  --contact-profile public/motion-profiles/aoi-school.json
```

上記の新引数は**このタスクで作る仕様**。この指示書作成時点では動かない。

## ブラウザ側の処理

1. `GenerateOptions` にquality設定、`GenerateResult` に任意のqualityレポート・元モーション・制約データを追加する。quality有効時のfailed/unsupportedでは `data:null` を返せる型にし、Nodeはレポートを先に判定してから書き込む。quality無効時は従来どおりdataを返す。
2. 既存GLTFLoader＋VRMLoaderPlugin＋VRMUtils.rotateVRM0の経路を参考に、対象VRMを読み込む。描画の有無で骨格が変わらないようにする。
3. 元のardyデータから `createArdyAnimationClip(rawMotion, vrm)` でnormalized clipを作る。
4. `polishClip.ts` で30fpsのサンプル時刻を作る。0とdurationを含み、最後の時刻がdurationを超えないようにする。
5. 各フレームはボーンを保存済み基準姿勢へ戻す→元clipをその時刻に評価→演技→接触→計測→回転を記録。MixerはLoopOnce、終端は最後の姿勢を保持する。前の補正結果を次フレームの入力にしない。
6. 補正後のnormalized回転をMixamoの `SavedMotion` に戻す。追加した指のトラックも含める。
7. saved-motionとFBXの両方が同じ補正結果を使用する。
8. VRM・Mixerの一時オブジェクトを解放する。元clip・元rawを破壊しない。

## VRM → Mixamoの回転変換

既存の `createArdySavedMotion()` の逆変換コメントと、`loadMixamoAnimation()` を照合する。

```text
Qv = 補正後のnormalized VRM local quaternion
Qr = VRM0ならQvのx,zを反転、VRM1ならQv
Qmixamo = inverse(mixamoRest.parentWorld) * Qr * mixamoRest.world
```

各qはnormalizeする。VRM1で `q` と `-q` は同一姿勢。アバターのscene回転をlocal quaternionへ混ぜない。

各フレームのMixamo positionは既存レスト位置。hipsの高さは元の `createArdySavedMotion()` と同じ値を保つ。腕・脚のpositionでVRMの骨長をFBXへコピーしない。

補正前後比較とFBX往復検証を通すまでは、この数式が実装に合っていると決めつけない。`exportFBX()` の後に出力を再ロードし、同じVRM上で接触位置を再計測する。

## 出力

出力 `quality-prayer.fbx` に対して次を保存する。パスの作り方は拡張子を外したbasenameに統一。

- `quality-prayer.source.saved-motion.json`：今回生成した補正前の素材。比較時にardyを再実行しない。
- `quality-prayer.quality.json`：前後・FBX往復後の計測、判定、失敗理由。

接触補正はFBXへベイク済みのため、ゲーム再生用のconstraints sidecarは出力しない。品質レポートにはplanとavatar hashを残し、補正前素材はsourceファイルに保存する。

`pass` のとき指定の出力先へ保存する。`needs-review` は `<basename>.review.fbx` または `.review.json` へ保存し、指定の最終出力を上書きしない。`failed` / `unsupported` はレポートと補正前素材だけ保存する。未合格が1つでもあるバッチは最後に非ゼロ終了。既存の最終出力ファイルが残っていても今回の成功として報告しない。

## 必須テスト

`test/motion-quality-export.spec.ts` を追加。推論には既存の `test/fixtures/motion-editor-ardy.worker.ts` のようなworker差し替えを使う。

- quality未指定では従来動作とトラック値・durationが一致する（ランダムIDは比較対象外）。
- 手書きの顔接触・合掌がsaved-motionとFBXの両方に入る。
- VRM0/1の変換を往復し、同じ対象VRM上で接触基準を満たす。
- beforeとafterが同じrawから作られる。sourceデータが変更されない。
- 接触に無関係な脚・hipsの姿勢が変化しない。
- 再ロード後の保持区間でも接触誤差 <= .03W。FBX読込前後の掌位置差 <= .005W。
- 不正な引数・モデルhash不一致で推論前に失敗する。
- review/failedで既存の最終出力を上書きしない。

```sh
npx tsc --noEmit
npx playwright test --config playwright.ardy.config.ts test/motion-quality-export.spec.ts test/motion-editor-ardy.spec.ts
node scripts/ardy-generate.ts --help
```

`tsconfig.json` のincludeはsrcのみ。Nodeスクリプトのimportは `--help` と実行テストでも確認する。Nodeから共有validatorを読む場合は `.ts` importを使用し、共有validatorの実行時依存もNodeで解決可能にする。
