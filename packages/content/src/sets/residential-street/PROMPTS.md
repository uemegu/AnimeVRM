# 住宅街の素材生成

絵柄の参照画像: `assets/textures/painted-ground/school-front.avif`（運動場の校舎。同じ世界の描き込みと日差し）。
住宅街の元絵はないので、家・塀・道路は「夏の昼の日本の住宅街」として新しく描く。

生成は `codex exec -m gpt-6.1-sol -s workspace-write --skip-git-repo-check "<指示>" < /dev/null`。
元 PNG は `scratch/residential-street/`、変換後は `assets/textures/residential-street/`。

## house-front-a.avif（家の道路側の面・その1）

透明背景: false

Use case: stylized-concept. Asset type: front-on architectural elevation texture for a three-dimensional game building, NOT a perspective background. Image 1 is the exact art-style reference: match its richly detailed hand-painted Japanese anime film background quality, clean sunlit colours and strong summer midday light from the upper left. Create ONE rectangular facade of a modern Japanese two-storey detached family house, width 9.5 metres, height 6.2 metres, tightly filling the entire landscape image edge to edge. TRUE ORTHOGRAPHIC FRONT VIEW, parallel horizontal and vertical lines, NO vanishing point, NO perspective, NO side walls visible. Ground floor occupies the lower 48% of the image height, the upper floor the remaining 52%. Warm cream horizontal siding, a dark brown entrance door with a small tiled porch step on the left third, a wide sliding glass door with white lace curtains on the right, two upper-floor windows with aluminium frames and a narrow balcony with a white railing where a futon is hung to air. A drain pipe, an outdoor light and a small mailbox on the wall. All wall and window surfaces opaque; windows show curtains and dim interiors. The roof is modeled separately, so the top border ends at a straight eave line. Building touches the exact left/right/bottom/top borders. No sky, ground, garden trees, fences, cars, people, labels or white margin. Not a low-poly render, not flat generic colours.

## house-front-b.avif（家の道路側の面・その2）

透明背景: false

Same asset type, reference, size (9.5 by 6.2 metres), true orthographic front view and rules as house-front-a. A different house: light grey mortar walls with a dark wood-panel accent around the entrance, a white entrance door in the centre with a small canopy modeled separately (do not draw a projecting canopy), a bay window with potted plants on the left, a garage shutter door on the right third, three upper-floor windows of different widths with pale blue curtains, an air-conditioner outdoor unit bracket and drain pipe. Ground floor lower 48%, upper floor 52%. Top ends at a straight eave line. Opaque surfaces, no sky, ground, trees, fences, cars, people or margin.

## house-side.avif（家の側面・背面）

透明背景: false

Same asset type, reference and rules. ONE side elevation of a modern Japanese two-storey house, width 8 metres, height 6.2 metres, true orthographic view filling the image edge to edge. Plain cream-to-light-grey wall with subtle painted weathering, two small frosted bathroom/kitchen windows on the ground floor, one upper-floor window with a curtain, a gas meter, a water heater box, a vertical drain pipe and an air-conditioner outdoor unit at the bottom. Ground floor lower 48%, upper floor 52%. Top ends at a straight eave line. Opaque surfaces, no sky, ground, plants, fences, people or margin.

## tile-asphalt.avif（道路の路面）

透明背景: false

Seamless tileable texture of a sunlit Japanese residential asphalt road surface, same hand-painted anime background style as Image 1. True top-down orthographic view, uniform scale throughout, covering about 4 by 4 metres. Mid-dark warm grey asphalt with fine aggregate grain, faint patched repairs and hairline cracks, slightly paler worn wheel paths. No road markings, no manholes, no kerbs, no horizon, no objects, no cast shadows, no frames. Consistent lighting across all edges; the four edges must tile cleanly.

## tile-block-wall.avif（ブロック塀）

透明背景: false

Seamless tileable texture of a Japanese concrete block garden wall, same hand-painted anime background style as Image 1. True flat frontal orthographic view, uniform scale, covering about 2.4 metres wide by 1.2 metres tall (six blocks wide, six courses tall, running bond). Pale grey concrete blocks with painted mortar joints, light rain streaks and a little moss near the bottom. No coping, no gate, no ground, no sky, no plants, no shadows of other objects, no frames. The left/right and top/bottom edges must tile cleanly.

## 既存素材

`tree.avif`・`far-tree-belt.avif` は運動場の素材を同ディレクトリへ複製して使う。屋根瓦は CanvasTexture。
