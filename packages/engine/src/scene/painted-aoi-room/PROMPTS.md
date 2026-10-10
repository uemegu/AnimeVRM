# 生成素材

codex CLI の built-in image generation（`codex exec -s workspace-write --skip-git-repo-check "<指示>" -i scratch/aoi-room/reference.png < /dev/null`）で生成。参照は `assets/textures/aoi_room_far.avif` を PNG に復号した `scratch/aoi-room/reference.png`。透過のもの（wall-front・bed-side・bed-foot・table-top・plush-*）は `avifenc -s 6 -q 85 --qalpha 100`、ほかは `avifenc -s 6 -q 85`。thumb.avif はデモの overview の撮影から。

## wall-front.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: interior wall texture for a 3D room set. Save as PNG to scratch/aoi-room/gen/wall-front.png, size 1536x1024, transparent_background=true.
TRUE ORTHOGRAPHIC FLAT FRONT VIEW of ONE wall, 3.6 m wide and 2.4 m tall, filling the image edge to edge (left edge = left corner of the room, right edge = right corner, bottom = floor line, top = ceiling line). No perspective, no side walls, no floor, no ceiling, no furniture standing in the room.
Layout (fractions of image width from the left):
- 0-27%: cream plaster wall with a white baseboard; high up a small light-wood wall shelf with a tiny potted plant and a small framed flower picture. Lower part is plain wall (a 3D bed and nightstand will stand in front of it).
- 27-35% and 73-81%: tied-back sunny yellow curtains with soft white sheer curtains hanging from a curtain rod at about 90% height, down to the floor.
- 33-75%: a two-panel aluminium sliding glass balcony door from 2% above the bottom up to 85% height, thin light frame and a vertical centre mullion. Through the glass: the balcony's pale concrete floor, a white balcony railing, potted yellow flowers and green potted plants on the balcony, and beyond the railing distant city buildings and green treetops.
- 81-100%: cream wall with a framed yellow flower painting at eye height, a slim white air conditioner unit near the top right, white baseboard.
CRITICAL: the sky seen through the glass must be GENUINELY FULLY TRANSPARENT alpha, following the contours of the buildings and treetops. No painted sky, clouds, sun or sky gradient. The walls, frames, curtains, railing, plants and buildings stay fully opaque.
```

## wall-left.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: interior wall texture for a 3D room set. Save as PNG to scratch/aoi-room/gen/wall-left.png, size 1536x1024 (opaque).
TRUE ORTHOGRAPHIC FLAT FRONT VIEW of ONE wall, 3.6 m wide and 2.4 m tall, filling the image edge to edge (bottom = floor line, top = ceiling line). No perspective, no side walls, no floor, no ceiling.
Cream plaster wall with a white baseboard, warm sunlight patches and soft leaf shadows falling across it.
Layout (fractions of image width from the left):
- 0-44%: mostly plain wall: a small cork board with a calendar and a few notes at eye height (about 55-70% height), a light switch, a simple round wall clock higher up.
- 44-100%: wall above a bed (the bed itself is a separate 3D object, do NOT paint any bed, pillow or headboard; the lower 40% of this part is plain wall with baseboard). Above 40% height: a white wire grid panel with clipped photos and postcards, dried flower bundles hanging, a trailing pothos plant from a small wall shelf near the top, and two framed yellow flower paintings.
```

## wall-right.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: interior wall texture for a 3D room set. Save as PNG to scratch/aoi-room/gen/wall-right.png, size 1536x1024 (opaque).
TRUE ORTHOGRAPHIC FLAT FRONT VIEW of ONE wall, 3.6 m wide and 2.4 m tall, filling the image edge to edge (bottom = floor line, top = ceiling line). No perspective, no side walls, no floor, no ceiling.
Cream plaster wall with a white baseboard and warm sunlight.
Layout (fractions of image width from the left):
- 0-29%: wall above a study desk (the desk, chair and lamp are separate 3D objects: do NOT paint them; the lower 30% is plain wall with baseboard). From 35% to 85% height: two small light-wood wall shelves with tiny potted succulents, storage boxes and a few standing books, a framed yellow flower print, a small paper calendar and a couple of pinned notes.
- 29-70%: plain cream wall (a tall 3D bookcase will stand here); only a faint sunlight patch.
- 70-100%: a framed botanical print at eye height, and a small hanging plant pot near the top; plain wall below with baseboard.
```

## wall-back.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: interior wall texture for a 3D room set. Save as PNG to scratch/aoi-room/gen/wall-back.png, size 1536x1024 (opaque).
TRUE ORTHOGRAPHIC FLAT FRONT VIEW of ONE wall, 3.6 m wide and 2.4 m tall, filling the image edge to edge (bottom = floor line, top = ceiling line). No perspective, no side walls, no floor, no ceiling, no freestanding furniture.
This is the entrance side of the bedroom, softly lit by the window behind the viewer.
Layout (fractions of image width from the left):
- 0-8%: cream wall.
- 8-36%: a white-painted wooden room door with a light-wood frame and a silver lever handle, 85% of the wall height, door bottom at the floor; a small round mirror and a tote bag on a hook beside it.
- 36-42%: cream wall with a light switch.
- 42-98%: built-in closet with two pairs of white sliding doors with light-wood trim, full height from floor to 88%; a navy school blazer on a hanger hooked on the closet door and a small yellow wreath.
White baseboard along the bottom where there is wall.
```

## floor.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: SEAMLESS TILEABLE floor texture. Save as PNG to scratch/aoi-room/gen/floor.png, size 1024x1024 (opaque).
True top-down orthographic view of light honey-coloured wooden flooring planks (like the reference floor), planks running vertically in the image, about 9 planks across (the tile covers 1.8 m x 1.8 m), staggered butt joints, fine grain, satin finish, uniform soft light. Edges must tile seamlessly. No perspective, no furniture, no rug, no reflections of objects, no cast shadows, no sun patches.
```

## rug.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: SEAMLESS TILEABLE rug texture. Save as PNG to scratch/aoi-room/gen/rug.png, size 1024x1024 (opaque).
True top-down orthographic view of a fluffy cream-white shaggy rug pile like the one in the reference, the tile covers 1 m x 1 m, soft warm-white tufts with gentle warm shading, uniform light. Edges must tile seamlessly. No border, no fringe, no perspective, no furniture, no shadows.
```

## bed-side.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: cut-out elevation for a 3D bed in a game. Save as PNG to scratch/aoi-room/gen/bed-side.png, size 1536x1024, transparent_background=true.
TRUE ORTHOGRAPHIC SIDE VIEW (long side) of the single bed from the reference, no perspective: the bed is 2.0 m long; the visible part spans the FULL IMAGE WIDTH edge to edge (left edge = head end, right edge = foot end). From the floor up: a light-wood bed base 0.30 m tall with three storage drawers with small handles, then the white duvet with yellow flower pattern hanging over the mattress edge, and a yellow knitted throw blanket with tassel fringe draped over the foot half, hanging down the side. Total height of the bed side 0.50 m. The top of the bed is flat at the mattress line (no pillows, no headboard, no plush toys visible).
Everything above the bed and around it is GENUINELY FULLY TRANSPARENT. No floor, no wall, no shadow.
```

## bed-foot.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: cut-out elevation for a 3D bed in a game. Save as PNG to scratch/aoi-room/gen/bed-foot.png, size 1536x1024, transparent_background=true.
TRUE ORTHOGRAPHIC END VIEW of the FOOT END of the single bed from the reference, no perspective: 1.0 m wide and 0.50 m tall, filling the full image width edge to edge. A light-wood bed base 0.30 m tall (plain wood foot panel, no drawers), the white duvet with yellow flower pattern hanging over the mattress end, and a yellow knitted throw blanket with tassel fringe draped over it hanging down. The top edge is the flat mattress line (no pillows, no headboard).
Everything above and around is GENUINELY FULLY TRANSPARENT. No floor, no wall, no shadow.
```

## bed-top.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: top texture for a 3D bed. Save as PNG to scratch/aoi-room/gen/bed-top.png, size 1024x1536 (opaque).
TRUE TOP-DOWN ORTHOGRAPHIC view of the top surface of the single bed from the reference, filling the image edge to edge: 1.0 m wide (image width) and 1.5 m long (image height). Top of the image is toward the pillows (pillows are separate 3D objects; do not paint them), bottom of the image is the foot end. White duvet with a scattered yellow and pale green flower pattern, soft folds, and over the bottom 45% a yellow knitted throw blanket laid across the bed. Soft uniform light. No perspective, no pillows, no plush toys, no sides of the bed, no floor.
```

## bookshelf.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: front elevation of a bookcase for a 3D room. Save as PNG to scratch/aoi-room/gen/bookshelf.png, size 1024x1536 (opaque).
TRUE ORTHOGRAPHIC FRONT VIEW, no perspective, of a white-and-light-wood bookcase like the one at the right of the reference, 1.2 m wide and 1.8 m tall, its outer frame filling the image edge to edge. Five shelves: colourful books (spines), picture books facing out, small potted plants, woven storage boxes, a small photo frame, a little ceramic bird. Bottom shelf: two white storage bins. Lit by warm sunlight from the left. No wall, floor or anything outside the bookcase.
```

## table-top.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: top texture for a 3D low table. Save as PNG to scratch/aoi-room/gen/table-top.png, size 1536x1024, transparent_background=true.
TRUE TOP-DOWN ORTHOGRAPHIC view (camera straight above) of the oval light-wood low table top from the reference: a rounded oval (stadium shape) touching all four image edges, 1.0 m x 0.55 m proportions. Glossy honey wood with sunlight sheen. On it, seen straight from above: a yellow gingham table runner across the middle, a small glass vase with yellow and white flowers (seen from above), two stacked books, and a white mug with tea. Everything outside the oval is GENUINELY FULLY TRANSPARENT. No legs, no perspective, no floor.
```

## plush-bear.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: cut-out sprite. Save as PNG to scratch/aoi-room/gen/plush-bear.png, size 1024x1024, transparent_background=true.
The fluffy light-brown teddy bear with a ribbon bow from the reference, sitting, front view, whole bear visible, bottom touching the image bottom centre. GENUINELY FULLY TRANSPARENT background, no floor, no shadow, no basket.
```

## plush-shiba.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy teenage girl's bedroom in a Japanese apartment, cream plaster walls, honey-coloured light wood, sunny yellow and white textiles, small flower motifs, warm afternoon sunlight. Keep its painted detail (fine wood grain, fabric texture, soft sunlight); not a low-poly render or flat colours. No people, no text labels, no borders or white margins.
Asset: cut-out sprite. Save as PNG to scratch/aoi-room/gen/plush-shiba.png, size 1024x1024, transparent_background=true.
The lying-down shiba-inu plush toy from the reference, seen from the front-side three-quarter view, whole toy visible, bottom touching the image bottom. GENUINELY FULLY TRANSPARENT background, no bed, no shadow.
```


## wood.avif

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: a detailed painted anime background of a bright, cosy bedroom. Keep its painted detail; not a photo, not a low-poly render or flat colours. No text, no borders.
Asset: SEAMLESS TILEABLE wood material texture for modelled furniture (desk, chair, nightstand, headboard, table edge). Save as PNG to scratch/aoi-room/gen/wood.png, size 1024x1024 (opaque).
Flat frontal orthographic view of light honey-coloured natural wood (the same light wood as the reference bed frame, desk and table), fine straight grain running horizontally, subtle painted warmth and soft satin sheen, uniform light. ONLY the wood surface: no planks seams, no edges, no knobs, no objects, no shadows, no sun patches, no perspective. All four edges must tile seamlessly.
```

## bed-top / bed-side / bed-foot（ひざ掛けを消した版）

最初の生成（ひざ掛け入り）を Image 2 に渡して編集した。

### bed-top2

```text
Precise edit of Image 2 (scratch/aoi-room/gen/bed-top-with-throw.png, a top-down texture of a bed duvet). Image 1 is the art-style reference. Save as PNG to scratch/aoi-room/gen/bed-top.png, size 1024x1536 (opaque).
Remove the yellow knitted throw blanket completely: the white duvet with the scattered yellow and pale green flower pattern and soft folds must continue over the whole image, edge to edge, as if the throw was never there. Keep the exact same canvas size, orthographic top-down view, colours, pattern scale and painted style. No pillows, no other objects, no shadows of a blanket.
```

### bed-side2

```text
Precise edit of Image 2 (scratch/aoi-room/gen/bed-side-with-throw.png, an orthographic side elevation cut-out of a bed on transparent background). Image 1 is the art-style reference. Save as PNG to scratch/aoi-room/gen/bed-side.png, size 1536x1024, transparent_background=true.
Remove the yellow knitted throw blanket and its tassels completely: the white duvet with the yellow flower pattern hangs evenly over the mattress edge along the whole length, and the light-wood bed base with its three drawers is fully visible below. Keep the exact same position, size and outline of the bed in the canvas, the same flat top line, and everything outside the bed GENUINELY FULLY TRANSPARENT. No new objects, no shadow.
```

### bed-foot2

```text
Precise edit of Image 2 (scratch/aoi-room/gen/bed-foot-with-throw.png, an orthographic end elevation cut-out of the foot of a bed on transparent background). Image 1 is the art-style reference. Save as PNG to scratch/aoi-room/gen/bed-foot.png, size 1536x1024, transparent_background=true.
Remove the yellow knitted throw blanket and its tassels completely: the white duvet with the yellow flower pattern hangs evenly over the mattress end, and the plain light-wood foot panel is fully visible below. Keep the exact same position, size and outline of the bed in the canvas, the same flat top line, and everything outside the bed GENUINELY FULLY TRANSPARENT. No new objects, no shadow.
```

### throw

```text
Image 1 (scratch/aoi-room/reference.png) is the exact art-style, colour and material reference: the sunny yellow knitted throw blanket with tassel fringe draped over the bed in this painted anime bedroom.
Asset: texture of ONE whole throw blanket laid perfectly flat, for a 3D cloth mesh in a game. Save as PNG to scratch/aoi-room/gen/throw.png, size 1536x1024, transparent_background=true.
TRUE TOP-DOWN ORTHOGRAPHIC view. The blanket is a rectangle filling the image width and height edge to edge (about 1.4 m x 1.0 m), sunny yellow chunky knit with a subtle cable/rib texture, soft painted shading but NO folds, NO wrinkles and NO perspective (the folds come from the 3D mesh). Along the LEFT and RIGHT short edges only, a row of hanging tassel fringe about 6% of the width long, ending in the image's left and right borders. Uniform soft light, no cast shadows, no bed, no floor. Everything between the tassels GENUINELY FULLY TRANSPARENT.
```
