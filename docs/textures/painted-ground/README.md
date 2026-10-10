# 運動場・中庭の素材と最終生成プロンプト

内蔵 `image_gen.imagegen` を使用。生成された PNG から必要な範囲を切り出し、`avifenc -s 6 -q 85` で変換。透過素材には `--qalpha 100` を指定した。

| 保存先（このディレクトリ） | 用途 |
| --- | --- |
| `school-front.avif` | 時計付き校舎の正面、建物の周囲は透過。窓は室内の絵 |
| `school-side.avif` | 校舎・体育館・守衛室の側面。校門の既存 `tile-facade.avif` から切り出した3階分の窓を、室内が見える絵へ編集 |
| `tree.avif` | 校内・外周の木の切り抜き、透過 |
| `conifer.avif` | 中央の円形花壇の針葉樹、透過 |
| `far-tree-belt.avif` | 並木と外周通路の向こうにある樹木帯、透過 |
| `tile-soil.avif` | 運動場の土、繰り返し |
| `thumb.avif` | デモの全景カットから撮った一覧用サムネイル |
| `thumb-courtyard.avif` | 共有マップの中庭の全景カットから撮った一覧用サムネイル |

## 木

Use case: stylized-concept. Asset type: single isolated tree cutout for a hand-painted simple 3D Japanese school campus. Create ONE whole leafy mature Japanese zelkova tree, broad natural rounded airy crown and branching brown trunk. Bright yellow-green sunlit leaf clusters on upper left, rich emerald and cool blue-green shaded clusters on lower right, finely painted individual leaf strokes, crisp natural edges with tiny transparent gaps between leaves. High-quality Japanese anime film background art like a sunny Japanese school campus illustration, believable proportions around 7 meters high and 5 meters wide. Straight-on eye-level elevation, entire tree including narrow trunk base visible and centered, small margin around it, portrait composition. Transparent background. No ground, lawn, shadow cast on ground, scenery, pots, sky, labels, extra trees, people or objects. Genuine alpha transparency around the silhouette and between branches. This is a reusable tree texture, no perspective landscape.

## 土

Use case: stylized-concept. Asset type: seamless repeating soil texture for a Japanese school sports field in a hand-painted simple 3D anime environment. Square image, entire image filled with dry warm pale ochre sandy compacted earth. Orthographic top-down, uniform scale and evenly lit. Fine powdery sand grain, tiny subtly scattered stones, soft low-contrast brushed patches of beige and muted peach. Japanese anime background painting texture with fine organic detail, not photographic and not flat vector art. No large stones, cracks, foot marks, track chalk lines, grass, objects, horizon, borders, shadows, gradients or directional lighting. Seamlessly tileable on all four edges, matching school_aerial reference's warm pale sand field. Low contrast because this will repeat over a large ground plane.

## 中央の針葉樹（学校の俯瞰地図を参照画像として使用）

Use case: stylized-concept. Asset type: single isolated conifer cutout for school courtyard simple 3D. Reference school map central circular planter's tree. Create ONE complete dark green ornamental conifer, a tall elegant tapered triangular tiered canopy like the central Japanese school courtyard tree in the reference. Dense rich cool emerald needle foliage and soft sunlit yellow-green edges from upper left, very short brown trunk base. Height about 7 meters, maximum width about 3 meters, narrowing naturally to a single pointed tip. High-quality hand-painted Japanese anime film background art, fine soft foliage brush detail, not low-poly, not photographic. Straight-on eye-level elevation, entire tree fully visible centered in a portrait frame with small transparent margins. Genuine transparent background. No ground, no cast shadow, no planter, no surrounding shrubs, no scenery, no sky, no text or people. Reference is only for tree identity and painted style, do not reproduce map camera.

## 外周の樹木帯（学校の俯瞰地図を参照画像として使用）

Use case: stylized-concept. Asset type: distant tree-belt cutout panorama for a simple 3D Japanese school sports ground. Reference image: school aerial map, use only the background tree-belt appearance and hand-painted anime style. Create a wide continuous dense green belt of mature deciduous trees and undergrowth, viewed straight on from standing eye level, as in the school map behind the tall sports fence. Dense overlapping irregular crowns in yellow-green and deep emerald, cool blue-green recesses, high-quality Japanese anime background painting with fine leaf brush strokes. A few VERY SMALL pale house roof tips can barely peek through foliage near the far upper background; distant buildings must be mostly hidden behind trees, with no visible walls or street fronts. Bottom edge filled continuously with low hedges and leafy green vegetation, top edge is the irregular transparent silhouette of treetops. No foreground objects, no sports fence, no road, no pavement, no school buildings, no sky or clouds, no horizon line, no people, no visible boundary walls. Wide landscape about 3:1 composition. No giant foreground trees, fairly uniform tree height but varied crown shapes, no dominant central object. Transparent background outside foliage; match opposite edges in height and colors for horizontal repeating. Vegetation is the subject; roofs should be nearly unnoticeable.

## 窓の室内表現

内蔵 `image_gen.imagegen` で正面・側面を編集。校門の主景 `assets/textures/painted-gate/scene.avif` を表現の参照にした。固定された青空・雲の反射を取り除き、カーテン、机、廊下・階段の奥行きを窓の中に描く。ガラス越しの室内は素材に描かれた絵で、透明な穴や反射シェーダーではない。

### 正面の最終編集プロンプト

Use case: precise-object-edit. Asset type: front facade cutout texture for the shared Japanese school sports-ground and courtyard 3D set.
Input image 1 is the EDIT TARGET: the wide three-story school facade with central clock tower.
Input image 2 is a STYLE REFERENCE ONLY: the existing simple-3D school-gate scene. Match how its windows show the interior, not blue sky reflection. Do not copy trees, pavement, camera angle, or number of floors from image 2.
Change ONLY the contents of EVERY glazed pane in image 1, including classroom windows, the central tall glass bay, and entrance doors. Replace the vivid blue sky / cloudy reflected gradients with clear non-mirrored glazing through which shaded school interiors are visible. Use restrained desaturated blue-gray / charcoal / warm gray tones, pale curtains pulled to the edges, faint classroom desk silhouettes and ceiling depth behind windows. Central bay shows neutral indoor stair landings and corridor railings; entrance glass shows a subdued lobby. Interiors should be readable but discreet, as in an anime school background. No sky, clouds, outdoor tree reflections, mirror highlights or broad blue gradients inside any pane. No bright fixed sunlight glare or lit fluorescent streaks; interior lights are off, so this reusable texture fits both day and evening.
Preserve the entire original facade silhouette and exact three-story arrangement, every wall, window opening, frame, clock, roof fence, entrance canopy and door position, and pale ivory wall color. Keep the orthographic straight-on view, wide approximately 3:1 framing, entire facade touching the bottom edge. No scene additions or text. Keep transparency around the building and above the silhouette; glass itself contains painted interiors, not alpha holes. Hand-painted Japanese anime background art matching the reference's understated architectural detail.

編集後の正面素材は2171×706px、上部の時計塔の中心はx=1057px。立体の正面を左右2区間に分け、中央のUVを1057/2171にして時計塔を中庭の軸に合わせる。両端は元の校舎の端に固定。時計塔の厚みも絵の内側に収める。

### 側面の最終編集プロンプト

Use case: precise-object-edit. Asset type: horizontally repeating three-story school side-wall facade texture for a simple 3D map.
Input image 1 is the EDIT TARGET: the narrow vertical facade strip with exactly three rows of windows. Input image 2 is STYLE REFERENCE ONLY: the school-gate scene, showing subdued interiors behind glazing.
Change ONLY what is seen inside all window panes of image 1. Replace bright blue cloud / sky reflections with non-mirrored clear glazing showing shaded classroom interiors: muted desaturated blue-gray and warm charcoal recesses, soft off-white curtains at the edges, faint desks / ceiling depth. No sky, cloud gradients, outdoor-tree reflections, mirror glare, bright blue reflective glass or fixed illuminated lamp streaks; the interior lamps are off. Make a reusable neutral-daylight texture also believable in evening scenes.
Preserve the exact three-floor count, each window opening and metal frame position, cream concrete wall and pillar spacing, original front-facing orthographic view, narrow vertical framing and horizontally repeating left/right edges. Entire image is the wall tile; NO transparent background, margins, scenery, extra facade bays or extra floors. Crisp softly hand-painted Japanese anime architectural background art consistent with the school-gate reference.

生成 PNG：`/Users/ueda/.codex/generated_images/01a10283-35e0-7922-9af9-a54f5e1efb7d/exec-6a1f026c-1e6f-4a60-9f65-aa7ce92dec97.png`。幅512pxの `scratch/painted-ground/school-side-interior.png` に縮小し、`school-side.avif` に変換。
