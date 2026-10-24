---
name: tripo-outfit-fitting
description: >-
  Tripo などで作った服・髪の GLB を、VRoid 製の VRM 素体に着せて Studio の衣装・キャラにするときに使う。
  scripts/fit_tripo_clothing.py（Blender）と scripts/merge_tripo_clothing.mjs（統合・揺れの骨）の使い方、
  設定ファイル（scripts/outfits/*.json）の項目、Studio の描画での確認のしかた、これまでに分かった崩れの原因と直し方。
---

# Tripo の服・髪を VRM に着せる

服・髪の GLB を素体の VRM に合わせ、骨・ウェイト・揺れの骨を付けて 1 つの VRM にする。どの服を着せるかは設定ファイル 1 本で決まり、素材を作り直しても同じコマンドを流し直せば作り直せる（手作業はない）。

以下のパスとコマンドはリポジトリルート基準。

## 1. 作り方

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/fit_tripo_clothing.py -- scripts/outfits/<名前>.json
node scripts/merge_tripo_clothing.mjs scripts/outfits/<名前>.json
```

1 本目（数分）が服・髪を素体に合わせて `work_dir` に GLB を書き出し、2 本目が素体の VRM にまとめて `output_vrm` に書く。できた VRM を `assets/models/<キャラ>/` にコピーし、`assets/studio/characters.json` の `models` に登録する（Studio を開き直すと反映）。

- 素材の GLB は `tmp/`（git 管理外）に置かれる。設定の `input` はそのパス。
- 今ある設定：`akane_shion.json`（アカネの私服：ペプラム・ショートパンツ・赤い髪、素体シオン）、`akane_gothic.json`（アカネのゴシック）、`peplum_shorts.json`・`peplum_tpose.json`（アオイの素体で試したもの）、`redhair.json`。新しく作るときはこれを写して直す。

## 2. 素材の条件

- **上衣は T ポーズ（袖が横に伸びた形）で作る。** A ポーズ（袖が斜め下）の服は袖の下側と脇腹がくっついていて、袖と身頃を分けられず、腕を上げると腕が袖から抜ける。これはウェイトの調整では直らない。Tripo に「T ポーズ」と指定しても袖は 20° 前後下がるが、袖と脇腹が離れていれば問題ない。
- 素体は VRoid 製（骨の名前 `J_Bip_*`、メッシュ `Body`・`Face`・`Hair`）が前提。基準の姿勢は T ポーズのまま（VRM の決まりで、エンジンのモーションも T ポーズ前提。素体を A ポーズにはできない）。
- 対応する服の種類（`kind`）：`top`（袖のある上衣）、`bottom`（脚が左右に分かれる下衣）、`skirt`、`hair`。袖なし・ワンピースは未対応。

## 3. 設定ファイルの項目

全体：
- `body`（素体の VRM）、`work_dir`、`output_vrm`
- `strip_body_materials`：素体に作り込まれた服のマテリアル名の一部（例 `["Onepiece", "Bottoms"]`）。当たり判定から外し、統合時に消す
- `remove_body_materials_under_garments`：服の下に入るインナー（アオイの `Onepiece` など）を消す
- `engine_poses`：Studio で撮った実際の姿勢（`scripts/outfits/poses/*.pose.json`）。めり込みの補正と「突き抜ける肌を消す」判定に加わる。素体を変えたらその素体で撮り直す（4 章）

服ごと（よく使うもの）：
- `ease`：体との隙間（m）。`shade_color`・`outline_color`：MToon の影・輪郭線の色
- `sway`：揺れの骨（スカート・裾）。省略で自動、`false` で付けない、`{"gravity":…, "stiffness":[…], "chains":8}` で調整
- `dangle`：細長く垂れた紐に重力で下がる骨。省略で自動、`false` で付けない
- 下衣：`fit_legs: true` と `leg_ease`（裾を太ももに沿わせる）
- 上衣：
  - `mask_skin_depth`（例 0.04）：服の内側の胴の肌を消す。`mask_sleeve_arm`（既定 true）：袖の中の腕の肌も消す
  - `legacy_sleeve: true`：袖の調整をアオイの素体で決めた作り方にする（シオンではこちらが良かった）
  - `sleeve_angle`：袖の角度を直接決める（普段は自動）
- 髪：`scale`（大きさ。0.26 前後）、`bangs_above_brow`（前髪の下端の高さ。負で眉より下）、`base_color`（素体の後ろ髪の土台の色）、`inner_layer`（内側の暗い毛の層。既定あり）

## 4. 確かめ方（必ず Studio の描画で）

Blender の写実的な描画は Studio（トゥーン・MToon）と見え方が違い、髪の大きさなどの判断を誤る。見た目の判断は Studio の撮影で行う。

- 衣装を変えて撮る：`scripts/dump_engine_pose.ts` は `scripts/shot.ts` の写しで、`--outfit` に任意のキー（`tripo`・`gothic` など）を指定でき、撮った姿勢を `<出力>.pose.json` に書き出す。カメラは下書きのシナリオ JSON（scratch に置く）の `cameraPose`（`position`・`target` は `[x, y, z]`）で決める。キャラは `avatars` のキーで指定（アカネは `akane`、`motion` に `Standing Idle`・`Walking`）。
  ```bash
  node scripts/dump_engine_pose.ts demo/demo_test --file <下書き.json> --scene <ID> --outfit default --no-dialogue --no-hud --time 1.5 --settle 6 -o <出力.png>
  ```
- 書き出した姿勢を Blender で再現すると、体を隠して服だけ見る・裏面を色分けする、などで原因を切り分けられる。服だけにして穴がなければ「肌の突き抜け」、服だけでも穴があれば「布の裏返り・折れ」。
- 確認する姿勢：待機（`Standing Idle`）、歩き（`Walking`）、腕を上げる。正面・斜め前・斜め後ろ・背中。

## 5. これまでに分かった崩れの原因

- **袖・肩が破れる／肩の肌が袖山を突き抜ける**：素体ごとに脇の下から肩の上までの長さが違う（シオンはアオイより長い）。脇の高さと胴の幅だけで合わせると袖山が肩より低くなる。今は肩先で服の上端を肌より上に来るよう縦に伸ばしている。
- **腕を下ろすと袖が折れ曲がる**：袖の下側に胴のウェイトが混ざっている。袖は腕のウェイトだけにし、脇のウェイトのぼかしは身頃だけに掛ける。
- **脇の下に穴**：姿勢ごとにめり込みを広げる補正が、脇の下では向きが逆になって布を裏返していた。脇の下ではこの補正をせず、突き抜ける肌を消す方に任せている。裏返った面の数は Blender で数えられる（元の GLB と面の向きを比べる）。
- **歩くと脇に穴**：脇の布が肌と同じウェイトだと肌の折れ目に沿って沈む。脇の周りだけ腕と胴のウェイトをぼかす。
- **布の表と裏が入れ替わって裏面が見える**：Tripo の服は厚みのある殻。表と裏の組を作って同じだけ動かしている。
- **髪がグニャッと曲がる**：押し出しを周りに広げると毛束が曲がる。髪は形を変えずに載せる。
- **こめかみ・後ろの髪の穴**：髪の内側のマネキンの面が隙間から見えていた。マネキンの面は消し、少し小さく回した暗い内側の毛の層を重ねる。
- **後頭部がパキッと暗く切れる**：Tripo の髪はテクスチャに陰影が描いてあり、エンジンのトゥーンの影と二重になる。髪のマテリアルに `extras.hairRing: false`・`bakedShading: true` を付けて、天使の輪とライトの影を付けない（統合時に自動）。

うまくいかないときは、症状を見た目で直そうとせず、同じスクリプトで別の素体（`tmp/girl.vrm`＝アオイ）にも着せて比べ、素体の違いか処理の違いかを先に切り分ける。
