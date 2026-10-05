# 体育館（簡易3D）

場所 `gym`（app の体育館イベントで使用）と `painted_gym`（デモ用、同じ設定）、背景 `builtin:painted-gym`、デモ `demo/painted_gym`。
元絵 `assets/textures/gym_far.avif` の夕日、大窓、木の床、赤い舞台幕、鉄骨天井を再構成した室内セット。

- 床 y=0、北は -z。幅24m、奥行32m、壁高8.5m、屋根の棟10.7m。寸法と撮影点は `layout.ts`。
- 舞台は北端。実際の生成画像の幕の下端に合わせて高さ1.35m、幅14m、奥行3.2m。両側に7段の階段。
- 四方の壁は面ごとの正投影素材。左右の窓壁は同じ立面を使い、東側を少し暗くする。生成された7窓の区切りに柱を合わせる。
- **空と雲は既存のThree.js `SkyBackground` が描画する。** 窓枠・樹木・壁を残して空部分だけ透過したAVIFを使用。窓の裏の壁は開口し、背景に共通の `textures/painted-classroom/sky-only.png` を使用。
- 床は4mの木目タイル。コート線と固定の夕日パッチは床の上の形状。屋根の傾斜面、妻面、鉄骨トラス、吊り照明、ギャラリーの床と手すりも立体。
- バスケットゴールは両側壁、リングは高さ3.05m。網は細い立体線。跳び箱2台、積んだマット、開いたボールかご、個別のボールと車輪、入口脇のベンチを実形状で作る。
- 素材は `assets/textures/painted-gym/`。生成元PNGと参照は `scratch/painted-gym/`。生成指示は `PROMPTS.md`。
- 体育館だけ `stage.postProcessing` で夕方の共通フレア・光条・追加の色補正を抑え、ブルームも控えめにする。時間帯の空や人物の光は維持し、他の場所へ移ると元の画作りへ戻る。
- 絵の陰影を保つ `MeshBasicMaterial`、SRGB、toneMapped=false。静的形状を同じ素材でまとめ、退出時に形状・素材・テクスチャを重複なく解放する。

## 確認

同じ `[0,1.65,5]` から正面・左90度・右90度・後ろ180度を水平に撮影。舞台の斜め、運動用具、舞台から入口への逆方向、ギャラリーからの俯瞰、人物の既定wide/mediumカメラもデモに含む。

```sh
npm run validate
npm run typecheck
npm run shot -- demo/painted_gym --no-dialogue --no-hud
PAGES_OUT_DIR="$PWD/scratch/painted-gym-pages" npm run build:pages -w studio
```

元の2D場所 `gym` と元絵は維持。確認対象は体育館内部とギャラリーからの撮影。壁・幕・窓外の木は絵であり、窓外への移動や舞台幕の開閉、屋外からの外観は対象外。素材に描いた夕日の陰影は時間帯で変化しない。

検証: 全体のvalidateはエラー0（既存festival_dateの到達不能警告1）。全体typecheck成功、scenarioの204テスト成功。10カットを無音撮影して四方の壁・窓の空・屋根・家具・人物を目視確認。スキルのquick_validate成功。
素材込みPagesビルド成功。出力の体育館素材5点・共通の空画像・デモJSON・APIを確認済み。
