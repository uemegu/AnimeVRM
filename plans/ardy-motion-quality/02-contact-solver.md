# タスク02：顔接触・合掌の補正

読む：`contract.md`、タスク01の実装、`src/motion/engine.ts` の `reach()`、`src/ai/motion/FingerMotion.ts`。

## 実装順

1. `solveContacts.ts` を追加し、合成リグ＋手書きプロファイルで2ボーンIKを実装する。
2. 頬・口元・顎の目標を実装する。
3. 合掌の左右目標を実装する。
4. デバッグ表示でアンカー、掌中心、掌法線、肘の方向、目標点を確認できるテスト用画面を作る。
5. 追跡済みaoi・emiliのプロファイルを作る。モデルを上書きしない。

## 2ボーンIKの具体的な計算

肩A、肘B、手首C、目標T、腕長L1/L2をワールド座標で用意する。

```text
epsilon = 1e-4 * W
rawDistance = |T - A|
d = clamp(rawDistance, |L1-L2|+epsilon, L1+L2-epsilon)
v = normalize(T-A)
along = (L1²-L2²+d²)/(2d)
height = sqrt(max(0, L1²-along²))
pole = 身体基底で (側方の符号*1, -0.65, +0.35)
pole = normalize(pole - v*dot(pole,v))
desiredElbow = A + v*along + pole*height
reachableWrist = A + v*d
```

右側方の符号は負、左は正。poleが退化したら身体前方向、次に上方向から直交成分を取る。`T==A` でもNaNを出さず、レスト基底の方向を使い到達不能を記録する。到達不能をclampで隠して合格にしない。

上腕の「現在の肩→肘」と「肩→desiredElbow」を一致させるworld delta quaternionを作る。親world quaternionをPとして、local回転に `inverse(P) * delta * P` を前掛けする。行列を更新し、同じ方法で前腕を手首目標へ向ける。

関節のposition・scaleを変更して腕を伸ばさない。肩ボーンの連動は初版では追加しない。到達できない場合は品質不合格を返す。

## 掌の向きと手首の位置

手首原点を接触目標に置くだけでは指や掌がめり込むので、必ず掌中心を使用する。

1. `HandFrame` のfingerDirectionとpalmNormalを直交化し、ローカルの手基底を作る。
2. 目標の指方向と掌法線でワールド手基底を作る。
3. `Qdesired = QworldBasis * inverse(QlocalBasis)` とする。左右で同じ固定Euler角を使わない。
4. ワールド手首目標は `palmTarget - rotatedAndScaled(palmPoint, Qdesired)`。
5. その手首へ腕IKを解く。
6. 最終的な手首親のworld quaternionを取り直し、`hand.localQ = inverse(parentWorldQ) * Qdesired`。

補間時は、元の掌位置→目標位置、元の手のworld回転→目標world回転を強さwで補間し、その結果へIKを解く。肘も急に反転しないよう、元肘を軸vの直交平面へ射影した方向からpoleへwで遷移させる。w=0はreturnして元姿勢を完全保持する。w=1で規定poleと接触位置を満たす。完成した関節回転だけを後からslerpして接触を崩さない。

## 顔の目標

- `side` は動かす手、`targetSide` は触れる頬の左右。両者を別々に指定し、右手で左頬へ触れる交差動作も扱う。
- 口元・顎は顔中央の `mouth` / `chin` アンカー。
- 口元・顎：`mouth` / `chin`。
- 掌目標 = アンカーのworld位置 + world法線 * faceGapMeters（アバターのscale込み）。
- 掌法線 = アンカー法線の逆向き。指方向 = アンカーtangent。
- アンカーはheadのローカル座標に置き、頭だけを回しても追従すること。
- 初版の顎は「掌を顎へ添える」。拳で顎を支える動作は別ポーズなのでJev分類でも混同しない。

## 合掌の目標

prayerCenterのworld点をM、身体左方向をX、gapをgとする。

- 右掌位置 `M-X*g/2`、左掌位置 `M+X*g/2`。
- 右掌法線 `+X`、左掌法線 `-X`。両方の指先は胸の上方向。
- 左右とも同じ姿勢スナップショットから目標を計算してから解く。片手の補正結果をもう片手の目標にしない。
- 保持区間で右肘は右側、左肘は左側に保つ。
- 手の厚みを無視したgap=0を固定値にしない。

## 指とプロファイル

接触時は既存FingerMotionServiceのopenポーズを再利用し、強さwで元の指姿勢から補間する。腕・手首トラックをFingerMotion処理で上書きしない。タスク05の軽い指曲げより接触ポーズを優先する。

プロファイルは `public/motion-profiles/aoi-school.json`, `emili.json` に保存する。元モデルのSHA-256、頭・手のnormalized boneローカル値を記録する。

初期候補は頭と目ボーン、手首と中指付け根の位置から作ってよいが、骨だけでは皮膚表面・掌表裏を保証できない。正面・側面で目標点と手の向きを確認して位置・gapを調整する。目視できない場合は `calibrated:false` のまま残し、未検証と報告する。計測を通すためにアンカーを誤った手の位置へ移動しない。

## 必須テストと完了条件

`test/motion-quality-contact.spec.ts` を追加。

- 左右の頬・口元・顎、合掌でタスク01の数値基準を満たす。
- 頭を左右に30度回しても顔接触を保つ。
- 肩幅・腕長の異なる2つの合成リグで成立する。
- 初期姿勢を腕の交差にしても、保持区間で合掌位置・肘側が正しくなる。
- 時刻を 2→0→1→2 と評価して、2秒の姿勢が一致する。
- 到達不能、短い腕、手指の欠損は例外または不合格理由として扱い、NaNを出さない。
- 区間外とcontacts空配列で元の姿勢を変更しない。

```sh
npx tsc --noEmit
npx playwright test --config playwright.ardy.config.ts test/motion-quality-measure.spec.ts test/motion-quality-contact.spec.ts
```
