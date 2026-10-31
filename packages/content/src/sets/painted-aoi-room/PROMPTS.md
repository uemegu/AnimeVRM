# 生成素材

codex CLI の built-in image generation（`codex exec -s workspace-write --skip-git-repo-check "<指示>" -i scratch/aoi-room/reference.png < /dev/null`）で生成。参照は `assets/textures/aoi_room_far.avif` を PNG に復号した `scratch/aoi-room/reference.png`。透過のもの（wall-front）は `avifenc -s 6 -q 85 --qalpha 100`、ほかは `avifenc -s 6 -q 85`。thumb.avif はデモの overview の撮影から。

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

## props/*.glb

家具・小物は Tripo で元絵から部品ごとに作った GLB（ベッド・ナイトテーブル・勉強机・椅子・本棚・ローテーブル・ラグ・黄色いクッション・花のクッション・くま）。Blender で1つのメッシュにまとめ、傾いて出たクッションを主軸で水平に戻し、底を y=0・x/z の中心を原点に置き、テクスチャを 2048px（小物は 1024px）の JPEG に縮めて書き出している。向きは正面が +z。実寸への拡大縮小と配置は `layout.ts` の `PROPS`。
