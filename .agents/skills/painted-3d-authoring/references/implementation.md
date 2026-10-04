# 実装と統合の注意点

このファイルのパスはリポジトリルート基準。数値は商店街の例で、すべての場所への固定値ではない。

## 基準になる実装

| 用途 | 読むファイル |
| --- | --- |
| 建物・屋根・ひさし・両面看板 | `packages/engine/src/scene/shopping-street/Buildings.ts` |
| ベンチ・プランター・A型看板・書籍台・街灯 | 同 `StreetFurniture.ts` |
| 木・花・遠景・床・バッチ化・dispose | 同 `ShoppingStreet.ts` |
| 補助的な木目と瓦の素材 | 同 `materials.ts` |
| 広い校地、中空の植栽囲い、ネット、駐輪場 | `packages/engine/src/scene/painted-ground/PaintedGround.ts` |
| 共通の床・外周・空 | `packages/engine/src/scene/painted-gate/PaintedGate.ts` の `groundPlane`、`farStandee`、`skyDome` |
| 複数の場所への座標の対応 | `painted-ground/layout.ts` の `COURTYARD_ORIGIN`、`COURTYARD_SHOTS` と `assets/studio/locations.json` |

校門にはカメラ投影の実装もある。共通の床・空を再利用するために、`projectedMaterial` や基準カメラまで新しい多方向セットへコピーしない。

## 単位と向き

形状の寸法、配置、cameraPoseのposition／targetはメートル。Three.jsの `rotation.y` は**ラジアン**、カメラの `fov` と場所JSONの `environment.rotationY` は**度**。`placeEnvironment()` が場所の向きをラジアンへ変換する。アバター等の項目も現在のスキーマと適用コードを確認する。

建物のローカル正面を +z にすると、側面に並ぶ店舗の向きは次のようになる。

```ts
const faceEast = Math.PI / 2;   // 通りの左側の建物が +x を向く
const faceWest = -Math.PI / 2;  // 通りの右側の建物が -x を向く
```

BoxGeometryのマテリアル配列は `[+x, -x, +y, -y, +z, -z]`。正面を貼る位置を取り違えない。各面に必要な素材が違う場合、壁を面ごとに分ける方がわかりやすい。

中庭のようにセットを `(-27, 0, -8)` にずらした場所では、元のセット内の `(27, 0, 8)` が場所の原点になる。回転・スケールもある場合は平行移動だけで考えず、対応する変換を使う。

## 画像の読み込みと素材

```ts
const map = await new THREE.TextureLoader().loadAsync(
  resolveAssetUrl('/textures/<セット名>/building-front.avif')
);
map.colorSpace = THREE.SRGBColorSpace;
map.anisotropy = 8;
const wall = new THREE.MeshBasicMaterial({
  map, toneMapped: false, fog: false,
});
```

`resolveAssetUrl` は `packages/engine/src/utils/path.ts`。ローカル開発だけでなくPagesのパスにも対応させる。

絵の陰影を維持する素材は光の影響を受けないため、Three.jsのライトを増やすだけで壁や木の陰影は変わらない。日中の絵を夜に使いたい場合は、素材の差分などの設計が必要。昼の壁を人物の照明だけで夜景にできるとは説明しない。

透明な植物は通常 `alphaTest: 0.5`、`side: THREE.DoubleSide`。まず alphaTest で輪郭を切り、必要な場合に柔らかい境界を調整する。`transparent: true` にした板を多数重ねると描画順の問題が出るため、柔らかい影と植物を同じ扱いにしない。

## 階・窓・UVの比率

立面素材の比率はメッシュの幅／高さに合わせる。例えば7.2m×10.8mの建物には2:3の立面が合う。屋根を別に作るなら、素材の上端は水平な軒で終える。

画像の下端から上階が始まる位置を `b`（0〜1）として切り出す場合：

```ts
const upper = frontMap.clone();
upper.offset.set(0, b);
upper.repeat.set(1, 1 - b);
upper.needsUpdate = true;
```

通常のTextureLoaderで、UVの y=0 は画像の下側。上階の素材は上階の高さのメッシュへ貼り、下階は別の壁・扉にする。上階の切り出しを建物全高へ貼ると、窓と階が縦に伸びる。

生成画像は「下階32%」と頼んでも正確に32%にはならない。看板、窓台、軒を画像で確認して `b` を決める。幅も切る場合は窓数・窓間隔を合わせる。

面を箱の表面へ重ねるときは、商店街の前面のように数mmだけ外へ出し、同一平面のちらつきを防ぐ。影の平面も床の数mm上に置く。

## 形状と植栽

- 屋根は実際の傾斜面と妻面。瓦は反復素材。煙突・棟・軒を必要に応じて追加する。
- 店舗のひさしは幅・張り出し・勾配・垂れ幕・支えを作る。素材からひさしを省き、扉の上へ一つだけ付ける。
- 家具は元絵の脚・金属フレーム・木の板を再現し、人物と比較して高さを決める。
- 花壇は囲いの内側に土が見える中空形状。低木は縁を隠しすぎないよう余白を取る。
- 木は通常3枚の縦板を `angle = i * Math.PI / 3` で交差させる。花も同様。全体の縮尺は根元から先までの画像に合わせ、透明な余白が大きければ足元を補正する。
- `onBeforeRender` などで近くの家具・木をカメラに向けて回さない。向きを変えても物体がその位置に立っている構成にする。
- 地面のタイルは `wrapS = wrapT = THREE.RepeatWrapping`。面の実寸からrepeat回数を決め、元絵に近い石の大きさにする。
- 葉の影・接地影は固定の透過面で補助できる。床の模様と区別し、光の方向や季節に合う範囲へ置く。
- 遠景の `farStandee` は素材の下端を地面に合わせる。平面幅と画像比率から高さが決まるので、repeatEveryを確認する。背景を巨大化して建物の側面不足を隠さない。

`skyDome()` は `userData.setSky` が付いたメッシュを返す。Stageはこれを隠して時間帯の空を表示する。独自の空が必要な夜景は祭りの実装を参照し、共通の空と二重に出さない。

## バッチ化と解放

細かな柱・手すりなどは、同じマテリアルごとにまとめると描画呼び出しを減らせる。先に見た目を確かめ、動く物・特殊なrenderOrder・カメラ追従処理のある物は静的バッチへ混ぜない。

- `root.updateMatrixWorld(true)` を行い、形状に変換を適用してから `mergeGeometries` する。
- BoxGeometryなどのindexed形状とExtrudeGeometryなどのnon-indexed形状を混ぜると失敗する。混在時は `toNonIndexed()` などで統一し、position／normal／uv属性も揃える。
- 商店街は配置前のidentityなrootで world matrix を適用する。すでにrootを配置した後にまとめる場合はrootの逆行列を掛けてrootローカルに戻し、二重変換を避ける。
- material配列を持つ物やShaderMaterialは、単一マテリアル前提の簡易バッチから除外する。
- まとめ終わった中間のgeometryは破棄する。共有形状を複数メッシュで使っている場合、その所有関係にも注意する。

`dispose...()` はSetでgeometry／material／textureを集め、一度ずつ解放する。共有マップのclone、CanvasTexture、ShaderMaterialのuniformや独自プロパティに保持した素材も漏らさない。`Mesh.material` は配列の場合がある。

## 場所・配信・撮影

既定カメラは場所の `stage.camera`、人物は `stage.slots`。背景の見栄えに合わせて人物を原点から大きく追い出すのではなく、通常の会話カメラでも使える立ち位置を作る。建物や樹木が人物の頭の真後ろに重なる場合は配置を調整する。

`stage.camera.far` はカメラから最遠の形状まで届く距離にする。商店街は180m、運動場・中庭は200mを使うが、必要な値はセットの大きさで決まる。

Pagesでは、JSONから見つかる画像だけでなくコードが直接読むテクスチャも収集登録が必要。`collectAssets.ts` の組み込み背景ディレクトリと、他セットから使う素材を確認する。元絵を再利用したい場合も、開発サーバーで読めるだけで配信完了と判断しない。

完成後のスクリーンショットからサムネイルを作る。旧版の絵や別セットのサムネイルを残さない。`PROMPTS.md` に実際に使った生成・編集指示、既存素材の出典を残す。
