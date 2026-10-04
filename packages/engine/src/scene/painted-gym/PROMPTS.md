# 生成素材

built-in image_gen / imagegenスキルを使用。参照は `gym_far.avif` をPNGへ復号した `scratch/painted-gym/reference.png`。元の描き込まれたアニメ背景、蜂蜜色の木、ベージュ壁、赤い幕、夕日の色を維持。

## 共通

Use case: stylized-concept. Orthographic school gymnasium interior wall elevation, horizontal 3:1, edge-to-edge, no perspective, floor, ceiling, people, labels, borders. Preserve detailed painted wood, warm plaster and rich burgundy curtains from the reference. Furniture, railings, hoops and beams are separately modeled in 3D.

## stage-wall.avif

24m × 8.5m end wall. Center closed burgundy velvet curtain, gold-trimmed valance, wood proscenium, two speakers, upper ventilation grille and doors at both outer edges. No stage platform or stairs. Actual image measured: curtain lower edge about 16% from bottom, width about 57%; platform height adjusted to1.35m and width14m.

## window-wall.avif

32m × 8.5m side wall. Large evenly spaced gridded windows and tied burgundy curtains, lower honey wood wainscot, doors and vents. Requested8bays, generated7; structural layout follows7. The initial generation incorrectly included sky; it is an intermediate only.

## rear-wall.avif

24m × 8.5m entrance wall. Four upper clerestory grid windows, central double entry doors, side doors, two noticeboards, wooden lower wall and plaster above. Initial painted sky is removed before use.

## Window/rear alpha edit

Use case: precise-object-edit. Preserve the exact canvas dimensions and orthographic wall layout. Keep opaque walls, frames, mullions, curtains, doors and trees. Remove ALL painted sky/clouds/sky gradients through every window pane to genuine fully transparent alpha, following leafy treetop contours. Never make the walls transparent. Small frosted door panes become opaque neutral beige glass. No crop, extra objects or borders. transparent_background=true. Sky and clouds are drawn by Three.js SkyBackground.

## floor-tile.avif

Seamless square overhead wooden sports floor tile covering4m × 4m. Honey amber maple planks, fine grain, satin finish, uniform soft light. No court lines, shadows, object reflections, furniture or perspective. Runtime court lines are separate geometry.

## Encoding

Opaque: `avifenc -s 6 -q 85`. Window/rear cutouts: same plus `--qalpha 100`.
