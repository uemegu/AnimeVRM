---
name: tripo-outfit-fitting
description: >-
  Tripo などで作った服・髪の GLB を、VRoid 製の VRM 素体に着せて Studio の衣装・キャラにするときに使う。
  scripts/fit_tripo_clothing.py（Blender）と scripts/merge_tripo_clothing.mjs（統合・揺れの骨）の使い方、
  設定ファイル（scripts/outfits/*.json）の項目、Studio の描画での確認のしかた、これまでに分かった崩れの原因と直し方。
---

# Tripo の服・髪を VRM に着せる

服・髪の GLB を素体の VRM に合わせ、骨・ウェイト・揺れの骨を付けて 1 つの VRM にする。どの服を着せるかは設定ファイル 1 本で決まり、素材を作り直しても同じコマンドを流し直せば作り直せる（手作業はない）。

肌マスクは脇・胸・股間に近い腿の付け根に限定し、腕・首・背中・腹部・腿の下側は残す。布の貫通を胴や袖の一括マスクで隠さず、服側を合わせる。ユーザーが別の範囲を明示した場合はその指示を優先する。

以下のパスとコマンドはリポジトリルート基準。

## 1. 作り方

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/fit_tripo_clothing.py -- scripts/outfits/<名前>.json
node scripts/merge_tripo_clothing.mjs scripts/outfits/<名前>.json
```

1 本目（数分）が服・髪を素体に合わせて `work_dir` に GLB を書き出し、2 本目が素体の VRM にまとめて `output_vrm` に書く。できた VRM を `assets/models/<キャラ>/` にコピーし、`assets/studio/characters.json` の `models` に登録する（Studio を開き直すと反映）。

- 素材の GLB は `tmp/`（git 管理外）に置かれる。設定の `input` はそのパス。
- 作業完了後は、この作業で作った一時モデル、候補・バックアップ、確認画像・ログ・一時スクリプト、`work_dir` の生成物を削除する。元の入力素材、完成モデル、再生成用の設定・姿勢・テクスチャ・実装、ユーザーに渡した完成イラストは保持する。他の作業の一時ファイルは巻き込まない。
- 今ある設定：`akane_shion.json`（アカネの私服：ペプラム・ショートパンツ・赤い髪、素体シオン）、`akane_gothic.json`（アカネのゴシック）、`peplum_shorts.json`・`peplum_tpose.json`（アオイの素体で試したもの）、`redhair.json`。新しく作るときはこれを写して直す。

## 2. 素材の条件

- **上衣は T ポーズ（袖が横に伸びた形）で作る。** A ポーズ（袖が斜め下）の服は袖の下側と脇腹がくっついていて、袖と身頃を分けられず、腕を上げると腕が袖から抜ける。これはウェイトの調整では直らない。Tripo に「T ポーズ」と指定しても袖は 20° 前後下がるが、袖と脇腹が離れていれば問題ない。
- 素体は VRoid 製（骨の名前 `J_Bip_*`、メッシュ `Body`・`Face`・`Hair`）が前提。基準の姿勢は T ポーズのまま（VRM の決まりで、エンジンのモーションも T ポーズ前提。素体を A ポーズにはできない）。
- 対応する服の種類（`kind`）：`top`（袖のある上衣）、`bottom`（脚が左右に分かれる下衣）、`skirt`、`hair`。袖なし・ワンピースは未対応。

## 3. 設定ファイルの項目

全体：
- `body`（素体の VRM）、`work_dir`、`output_vrm`
- `fit_body`：出力用の `body` とは別に、服の寸法合わせに使う素体を指定できる。骨名と体形が一致する素体に限る。`garment_offset: [x,y,z]`（m、Y 上）で合わせた服を統合先の位置へ移す。服の高さ設定・`engine_poses` は `fit_body` 基準、`skin_mask_regions` は出力用 `body` 基準。省略した衣装は従来の処理のまま
- `tailor_body`：体にぴったり沿わせるための、肌の省略がない体表参照（エミリは `emili-swim.vrm`）。腰の骨で `fit_body` の位置へ合わせ、服ごとの `tailor_surface` を有効にした衣装だけに使う。表示用の体・顔・髪・タイツ・靴は差し替えない。体形と骨の位置関係が一致するモデルを使う
- `strip_body_materials`：素体に作り込まれた服のマテリアル名の一部（例 `["Onepiece", "Bottoms"]`）。当たり判定から外し、統合時に消す
- `remove_body_materials_under_garments`：服の下に入るインナー（アオイの `Onepiece` など）を消す
- `engine_poses`：Studio で撮った実際の姿勢（`scripts/outfits/poses/*.pose.json`）。めり込みの補正と「突き抜ける肌を消す」判定に加わる。素体を変えたらその素体で撮り直す（4 章）
- `preserve_neck_and_hands`：胴・袖の肌を広く隠す衣装で、首・手・手首を残す。首の付け根をまたぐ面は境界で切り、背中の三角形の先端が襟から出ないようにする
- `skin_mask_regions`：肌を隠す局所範囲の配列（`name`、`min`、`max`。元の VRM のバインド姿勢、Y 上、m）。指定時は古い自動マスク・一括マスク・首や裾の切断を使わず、この範囲内だけを隠す。`[]` なら肌を一切消さない。エミリのミリタリーはこの方式で、`mask_sleeve_arm: false` にする

服ごと（よく使うもの）：
- `ease`：体との隙間（m）。`shade_color`・`outline_color`：MToon の影・輪郭線の色
- `material_overrides`：元の GLB のマテリアル名ごとに見た目だけを変更する。`base_color_texture` に画像パス（リポジトリルート基準）、`base_color` に RGBA、`shade_color` に RGB を指定できる。`base_color_texture: false` は無地化。ソース画像は AVIF を使え、統合時に `avifdec` で PNG に戻して VRM 内に格納する（VRM の画像互換性のため）。フィッターを再実行せず統合だけで更新できる。変更前後の全アクセサのバイト・骨・肌マスク・揺れの一致と、実際の前後左右の表示を確かめる
- `sway`：揺れの骨（スカート・裾）。省略で自動、`false` で付けない、`{"gravity":…, "stiffness":[…], "chains":8}` で調整
- `dangle`：細長く垂れた紐に重力で下がる骨。省略で自動、`false` で付けない
- 下衣：`fit_legs: true` と `leg_ease`（裾を太ももに沿わせる）
- スカート：`waist_height`・`length` は腰と丈の実寸（m）。`shape_profile` は高さの割合 `at` ごとの `width`・`depth`・`center_z`。元の布が不自然な場合は `rebuild_pleats` で上の装飾を残して下の布を作り直せる（`emili_military.json` を参照）。`sway.hug_legs: false` は下の布を左右の脚へ分けず揺れの骨で動かす。`body_clearance: true` は Studio で元の体より外側に布を保つ
  - `rebuild_pleats.anatomical_profile: true` は方向ごとの体表を使い、お尻の前後の厚みに合わせて横幅まで一律に膨らむのを防ぐ。`body_clearance_profile: true` は元の肌の面を `bodySurfaceIndices` に保存し、描画時も高さごとの断面を使う。既存衣装の既定の当たり判定は変えない
  - `waist_overlap` は裾と下部の輪郭を固定して腰の上端だけを上着へ重ねる。`height: [補正開始,全適用開始]`（`fit_body` の高さ）、`rise`（上げ幅）、`inset`（内側へ寄せる幅、m）。`front_relief`・`front_width: [全適用の半幅,終了の半幅]` は開いた上着の中央で内寄せを緩め、ベルトがインナーへ埋まるのを防ぐ。エミリは 18mm 上げ、側面・背面を 4mm 内寄せ、中央だけ 8mm 緩めている。プリーツ再構成の後、ウェイトを写す前に適用する
- 上衣：
  - `mask_skin_depth`（例 0.04）：服の内側の胴の肌を消す。`mask_sleeve_arm`（既定 true）：袖の中の腕の肌も消す
  - `legacy_sleeve: true`：袖の調整をアオイの素体で決めた作り方にする（シオンではこちらが良かった）
  - `sleeve_angle`：袖の角度を直接決める（普段は自動）
  - `preserve_shape: true`：型を保ち、体への押し込み・重ね着の面削除をしない。`collar_back_offset` は後ろ襟が首の内側へ入る場合の補正量（m）
  - `surface_max_edge`：粗い布の面を UV を保って細分化する辺の上限（m）。`fit_unmasked_body` は身頃・袖の断面をまとめて広げる補正。体の骨から袖の太さを測り、身頃の奥行きは設定のプロファイルで合わせる（`emili_military.json` を参照）
  - `fit_unmasked_body.sleeve_fit: "clearance"`：体から十分離れた袖を膨らませず、必要な太さだけを確保する。`sleeve_slim_blend` で肩の可動域から細い上腕へつなぐ。`waist_fit` は指定した高さの腰を体の外周に寄せ、`ease` の隙間と `gap_keep` の割合で余裕を残す。表示に残る肌の面を基準にし、肌マスクは増やさない
  - `fit_unmasked_body.sleeve_gap_keep`：`clearance` で元から太い袖も詰めたいとき、必要な太さを超える余裕を残す割合（エミリは `0.3`）。`sleeve_cuff_ease` で手首側だけに余裕を足せる。肩の遷移は保ち、袖だけの変位を最後に適用する。腰のウェイト再計算へ波及させず、袖以外の位置・UV・ウェイトの一致を確認する
  - `front_contour`：合わせ済みの腹部前面だけを最後に整える。`height: [開始,全適用開始,全適用終了,終了]`、`width_fade`、`depth`（前方 Z の基準）で範囲を指定し、それを超えた張り出しを `excess_keep` の割合まで圧縮する。`inner_ease` はシャツとの余裕、`project_weights: true` は重なった布を同じ体表の骨へ合わせる。指定しない服には作用しない。層を同じ平面へ押しつぶすと赤いシャツがジャケットへ出るため、深さ方向の順序と隙間を残す
  - `tailor_surface`：`scripts/tailor_clothing.py` で身頃と袖の断面を `tailor_body` の体表へ合わせ直す。`torso_ease`・`sleeve_ease` は体との隙間、`layer_keep` は布の層や装飾の奥行きを残す割合。変位を滑らかにし、体表と同じ骨の重みを写す。`pose_clearance: true` は `engine_poses` で肘の必要な部分だけを補正する。`cuff_lining` の `material`・`span`・`ease` で袖口の隙間の内側へ開口した布の筒を追加できる。肌マスクで手首を消さず、裏地が表地を突き抜けないことも拡大して確認する
  - `tailor_surface.tailored_cuffs` は不自然な尖りがある袖口を細いカフスと小さなフリルへ作り直す。`wine_material` はフリルの色を取る素材、`keep_materials` は残す金ボタンなどの素材名。`cuff_lining` と併用せず、内側の布も含めた筒を作る
  - `tailor_surface.elbow_refine` は通常の肘の補正後に `iterations` 回だけ追加で確認し、`ease`（m）を確保する。`sides: ["L"]` のように片側へ限定できる。反対の腕・身頃・袖口の形状とウェイトを保ち、肌マスクを増やさない
- 髪を Blender で手で置き直したとき：素体と同じ座標で髪だけを GLB に書き出し、`placed: true` にする（大きさ探し・前髪の持ち上げをせず、置いた位置のまま使う。`scale`・`bangs_above_brow` は効かない）。素体ごと書き出したファイルは顔の位置が数 mm ずれることがあるので、顔の位置を合わせて髪だけ取り出す（アカネのゴシックは `tmp/hair.glb` → `tmp/hair_placed.glb`）
- 髪：`scale`（大きさ。0.26 前後。長い髪まで含めて大きさが揃えてあるウィッグは 0.48 前後）、`bangs_above_brow`（前髪の下端の高さ。負で眉より下）、`base_color`（隙間から見える素体の髪の土台の色。髪色に合わせる）

## 4. 確かめ方（必ず Studio の描画で）

Blender の写実的な描画は Studio（トゥーン・MToon）と見え方が違い、髪の大きさなどの判断を誤る。見た目の判断は Studio の撮影で行う。

- 衣装を変えて撮る：`scripts/dump_engine_pose.ts` は `scripts/shot.ts` の写しで、`--outfit` に任意のキー（`tripo`・`gothic` など）を指定でき、撮った姿勢を `<出力>.pose.json` に書き出す。カメラは下書きのシナリオ JSON（scratch に置く）の `cameraPose`（`position`・`target` は `[x, y, z]`）で決める。キャラは `avatars` のキーで指定（アカネは `akane`、`motion` に `Standing Idle`・`Walking`）。
  ```bash
  node scripts/dump_engine_pose.ts demo/demo_test --file <下書き.json> --scene <ID> --outfit default --no-dialogue --no-hud --time 1.5 --settle 6 -o <出力.png>
  ```
- 書き出した姿勢を Blender で再現すると、体を隠して服だけ見る・裏面を色分けする、などで原因を切り分けられる。服だけにして穴がなければ「肌の突き抜け」、服だけでも穴があれば「布の裏返り・折れ」。
- 確認する姿勢：待機（`Standing Idle`）、歩き（`Walking`）、腕を上げる。正面・斜め前・斜め後ろ・背中。
- 全身だけでは首・袖口・ベルト・裾の欠けを見落とす。これらも拡大して撮り、隠した肌の境界と服との位置関係を確認する。
- 両腕を前・後ろ・横から撮り、背中と肩も待機・歩行・腕上げで拡大する。貫通の残る候補を確認中に登録済みの VRM へ上書きしない。別ファイルで撮影し、問題の箇所を実際に見てから反映する。
- 上着を絞ったら、全身の正面・背面・左右で、肩幅→胸→ウエスト→ベルト→ヒップ→裾の比率とつながりを目標画像に照らして評価する。スカートのデータを以前と同じに保つだけでは、変更後の全身バランスの保証にならない。全身画像を撮った事実と、全体の不自然さを確認・修正した事実を混同しない。
- 完了報告の前に、最後に更新した候補で変更箇所以外も含めて上記の全身・拡大表示を実際に見る。見直しで不具合を直した場合は、その後の版で全体を再確認する。確認した姿勢・角度と実際に残る問題を区別して報告し、撮影だけで「問題なし」としない。過去の別衣装を再テストする必要はない。

## 5. これまでに分かった崩れの原因

- **袖・肩が破れる／肩の肌が袖山を突き抜ける**：素体ごとに脇の下から肩の上までの長さが違う（シオンはアオイより長い）。脇の高さと胴の幅だけで合わせると袖山が肩より低くなる。今は肩先で服の上端を肌より上に来るよう縦に伸ばしている。
- **腕を下ろすと袖が折れ曲がる**：袖の下側に胴のウェイトが混ざっている。袖は腕のウェイトだけにし、脇のウェイトのぼかしは身頃だけに掛ける。
- **脇の下に穴**：姿勢ごとにめり込みを広げる補正が、脇の下では向きが逆になって布を裏返していた。脇の下ではこの補正をせず、突き抜ける肌を消す方に任せている。裏返った面の数は Blender で数えられる（元の GLB と面の向きを比べる）。
- **歩くと脇に穴**：脇の布が肌と同じウェイトだと肌の折れ目に沿って沈む。脇の周りだけ腕と胴のウェイトをぼかす。
- **布の表と裏が入れ替わって裏面が見える**：Tripo の服は厚みのある殻。表と裏の組を作って同じだけ動かしている。
- **貫通を直したら袖・ウエストが太くなる**：既に肌から離れた布まで断面を広げない。袖は `sleeve_fit: "clearance"`、腰は `waist_fit` で必要な隙間を確保する。腰を絞った後は、その位置で腰のウェイトも写し直す（処理内で自動）。局所的に余裕が必要なシャツには `waist_fit.front_support` の高さ・幅・補正量を設定できる。
- **制服付きの別 VRM へ変えると衣装が縮む**：制服の下の肩・胸の肌が元から削除されていると、自動フィットの寸法探しが誤る。合わせ済みの完全な素体を `fit_body` に残し、出力用の `body` に新しい VRM を指定する。ブーツ・タイツの素材と画像はそのまま保ち、元の制服の `Tops`・`Bottoms`・ネクタイだけを外す。
- **肌を隠すとスカートが体へ沈む**：描画に残した面だけから体を測ると、腰の当たり判定まで失う。統合時に元の肌の頂点番号を primitive の `extras.bodySurfaceVertices` に残し、エンジンの `handShape.forEachVertex` は `geometry.userData.bodySurfaceVertices` から本来の体を測る。
- **スカートのベルトが胸の下へ上がる／裾が釣り鐘になる**：自動の腰探しが胴の細い部分を選ぶことがある。ジャケットの裾と実際の腰に `waist_height` を合わせる。横幅だけ縮めず、腰・ヒップ・裾の断面と前後左右の裾高を確認する。
- **髪がグニャッと曲がる**：押し出しを周りに広げると毛束が曲がる。髪は形を変えずに載せる。
- **こめかみ・後ろの髪の穴**：髪の内側のマネキンの面が隙間から見えていた。渡された GLB の面は使える形として渡されているので、消さない（消すのは `remove_mannequin: true` を頼まれたときだけ）。隙間は素体の髪の土台を髪色（`base_color`）にして埋める。髪の写しを重ねる、面を削るなど、頼まれていない手は加えない。
- **後頭部がパキッと暗く切れる**：Tripo の髪はテクスチャに陰影が描いてあり、エンジンのトゥーンの影と二重になる。髪のマテリアルに `extras.hairRing: false`・`bakedShading: true` を付けて、天使の輪とライトの影を付けない（統合時に自動）。

うまくいかないときは、症状を見た目で直そうとせず、同じスクリプトで別の素体（`tmp/girl.vrm`＝アオイ）にも着せて比べ、素体の違いか処理の違いかを先に切り分ける。
