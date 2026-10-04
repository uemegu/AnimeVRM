# 元絵から素材を作る指示例

その環境の `imagegen` スキルに従い、元絵を実際に確認したうえで参照画像に渡す。以下の文章は雛形。建物の寸法、階の比率、色、植物の種類、明かりは対象の元絵に置き換える。

実例は `packages/engine/src/scene/shopping-street/PROMPTS.md`。商店街の素材は元の `assets/textures/town2_far.avif` を参照し、書店・花屋・ギャラリーの立面を個別に生成した。

## 建物の立面

```text
Asset type: architectural elevation texture for a 3D game building.
Image 1 is the exact art-style and material reference.
Match its detailed painted anime background, [壁の材料・色],
[窓枠・店内], [蔦・花], and [光の方向・色].

Create ONE facade, [幅] metres wide and [高さ] metres tall,
tightly filling the image edge to edge. TRUE ORTHOGRAPHIC FRONT VIEW:
parallel horizontal and vertical lines, no vanishing point,
no perspective, no visible side walls.
Ground floor occupies the lower [比率]% of the image;
[階数] upper floors occupy the remaining area.
Opaque walls and window interiors. Show [室内・商品・カーテンなど].
The top ends at a straight cornice; the roof is modeled separately.

No sky, pavement, trees standing in front, people, ground flower boxes,
benches or freestanding signboards.
No canvas awning: a projecting awning will be modeled separately.
No white margin or sheet around the facade.
Keep fine stone wear, wood grain, foliage and shop merchandise;
not a low-poly render or generic flat colours.
[店の種類、特徴、文字、左右の配置を具体的に記述]
```

店舗が奥に開いた屋台なら、箱を塞ぐ立面とは別に「看板」「奥の壁」「前板」を指定する。夏祭りの `STALL_BANDS` のように、生成後に帯の境界を測ってUVと形状を合わせる。

側面・背面が固有の窓や入口を持つ場合は別の立面を生成する。前面の上階を流用する場合も、窓の高さと間隔を側面の実寸に合わせ、下階を別に組む。

## 地面・壁のタイル

```text
Seamless tileable texture, [石畳／土／石壁] from Image 1,
same painted background style and fine surface wear.
For ground: true top-down orthographic view, uniform scale throughout.
For wall: true flat frontal view, no corners or perspective.
No horizon, sky, people, props, frames or fixed cast shadows.
Consistent lighting across all edges; tiles must meet cleanly.
```

床用と壁用を区別する。斜めから見た石畳を平面へ貼ると、絵の遠近感と3Dの遠近感が二重になる。

## 花・低木

```text
Foliage-only cutout for a REAL 3D planter in a game.
Match the detailed painted leaves and flowers in Image 1,
[植物と色], [光の方向].
One lush cluster, full silhouette visible with fine trailing leaves.
Neutral front view suitable for crossed planes.
Genuine fully transparent alpha outside every leaf/flower silhouette.
No wooden planter, flowerpot, container, ground, backdrop,
blurred coloured background, labels, or cast shadow.
```

**生成ツールの transparent_background を有効にする。** 指示文だけで済ませない。透明なRGBAでもRGBにぼけた色が見える場合があるため、実際のalphaとalphaTest後の画面で四角い背景が出ないか確認する。背景が残る場合は同じ画像を参照して背景除去の追加編集を行う。

## 木

```text
One full [木の種類] tree, from roots to canopy tip, isolated on transparent
background. Match Image 1's painted background detail and sunlight.
Trunk base touches the bottom centre; entire crown visible.
Neutral view suitable for three intersecting vertical cards.
No soil, planter rim, surrounding trees, sky, scenery or cast shadow.
```

余白や根の位置によって接地・実寸がずれるため、画像の外寸だけから高さを決めない。再利用できる既存素材が元絵の質感に合えば、新規生成せず使ってよい。共有素材の配信登録も忘れない。

## 遠景の樹木帯・町並み

```text
Wide panoramic painted [樹木帯／町並み], matching Image 1's style.
Bottom edge is the ground line; tops of trees/buildings form a clean
silhouette against genuine transparent alpha. No painted sky.
Designed to repeat horizontally with consistent height and light.
No foreground props, pavement in perspective or strong vanishing point.
```

遠景に大きな店舗や近景の家具を描くと、実際の建物・小物と二重に見える。奥に必要な低密度の要素として生成する。
