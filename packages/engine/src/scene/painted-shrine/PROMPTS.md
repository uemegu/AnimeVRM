# 神社の素材生成

参照画像: `assets/textures/shrine_far.avif`（元の神社・晴天）。codex exec の built-in image generation で、正面の透視図を投影せず正投影の立面・継ぎ目のないタイル・透過の切り抜きとして個別に生成した。各指示の先頭に共通の絵柄指定を付けている。

## haiden-front.avif

```text
Asset type: front-on architectural elevation texture for a 3D game building, NOT a perspective background. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
Create the FRONT WALL of the shrine worship hall (haiden) from Image 1, 9 metres wide and 6 metres tall, tightly filling the entire 3:2 landscape image edge to edge. TRUE ORTHOGRAPHIC FRONT VIEW: parallel horizontal and vertical lines, no vanishing point, no visible side walls, no roof.
Bottom 12% of the image: grey granite foundation plinth. Above it: four thick round dark-brown wooden pillars dividing three bays; the centre bay (wider) has open folding lattice doors showing a dim wooden interior with a small altar, mirror and white paper streamers in shadow; side bays have fine square wooden lattice (koshi) doors with paper behind and white plaster panels above. Top 15%: horizontal tie beams (nageshi) and a row of carved wooden bracket sets (kumimono) with small gold metal end-caps; the top border ends at a straight beam line because the eaves and roof are modelled separately.
All surfaces opaque. NO sky, NO roof, NO eaves, NO steps, NO railing, NO veranda floor in front, NO offering box, NO bell rope, NO shimenawa rope, NO lanterns, NO trees, NO people, NO ground. No white margin. Save as PNG.
```

## haiden-side.avif

```text
Asset type: front-on architectural elevation texture for a 3D game building, NOT a perspective background. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
Create the SIDE WALL of the same shrine worship hall (haiden), 9 metres long and 6 metres tall, tightly filling the entire 3:2 landscape image edge to edge. TRUE ORTHOGRAPHIC VIEW: parallel lines, no perspective, no corners turning away, no roof.
Bottom 12%: grey granite foundation plinth. Above it: five round dark-brown wooden pillars evenly spaced; between them solid weathered vertical-board wooden walls (itakabe), one bay with closed wooden lattice doors, small horizontal lattice windows high in two bays. Top 15%: tie beams (nageshi) and a row of carved bracket sets (kumimono) with small gold end-caps; top border ends at a straight beam line.
All surfaces opaque. NO sky, roof, eaves, steps, railing, veranda, ropes, trees, people or ground. No white margin. Save as PNG.
```

## annex-front.avif

```text
Asset type: front-on architectural elevation texture for a 3D game building, NOT a perspective background. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
Create one section of the long single-storey auxiliary shrine building (shrine office / storehouse, seen in Image 1 behind the left lanterns), 6 metres wide and 4 metres tall, tightly filling the entire 3:2 landscape image edge to edge. The section must TILE SEAMLESSLY HORIZONTALLY: the left and right edges each cut exactly through the middle of a square wooden post so two copies join invisibly.
TRUE ORTHOGRAPHIC FRONT VIEW, no perspective, no roof. Bottom 8%: grey stone foundation strip. Walls: dark-brown timber posts and beams framing white plaster panels in the upper part, lower part weathered vertical wooden boards; a pair of wooden sliding doors with fine lattice in the middle; one small lattice window. Top border ends at a straight horizontal beam (eaves are modelled separately).
Opaque everywhere. NO sky, roof, eaves, trees, people, lanterns, ema boards, ground. No white margin. Save as PNG.
```

## gable.avif

```text
Asset type: transparent cutout texture for a 3D roof gable. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
Create the ornate TRIANGULAR GABLE FACE (tsuma) of the worship hall from Image 1, seen in TRUE ORTHOGRAPHIC FRONT VIEW, filling a 3:2 landscape image: the triangle's base runs along the full bottom edge of the image and the apex touches the top centre. Inside: dark-brown timber with a vertical king post, horizontal beams, carved frog-leg strut (kaerumata) and gold ornamental metal fittings; the triangle edges are trimmed by wide dark bargeboards (hafu) with gold end fittings and a hanging carved gegyo ornament under the apex.
Everything OUTSIDE the triangle must be genuinely fully transparent alpha. No roof tiles, no sky, no background colour, no shadow. Use the image generation tool with a transparent background. Save as PNG with alpha.
```

## roof-copper.avif

```text
Seamless tileable square texture of the green oxidised copper sheet roof from Image 1's worship hall. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
TRUE FLAT FRONTAL VIEW of the roof surface, uniform scale: vertical raised standing seams (copper battens) every ~12% of the width, running top to bottom, with subtle horizontal sheet joints; verdigris green with slight teal and grey weathering streaks. No perspective, no eaves edge, no sky, no ornaments. Left/right and top/bottom edges must meet cleanly when tiled. Save as PNG.
```

## roof-kawara.avif

```text
Seamless tileable square texture of the dark grey Japanese ceramic kawara roof tiles from Image 1 (temizuya and side buildings). Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
TRUE FLAT FRONTAL VIEW of the roof surface, uniform scale: about 8 rounded tile channels running top to bottom across the width, with overlapping courses forming ~8 horizontal rows; subtle grey-blue sheen and painted highlights. No perspective, no ridge, no eave edge, no sky. Edges must tile cleanly in both directions. Save as PNG.
```

## ground-gravel.avif

```text
Seamless tileable square ground texture of the fine tan/beige compacted sand-and-gravel shrine courtyard from Image 1. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
TRUE TOP-DOWN ORTHOGRAPHIC view, uniform scale (the square covers about 3 x 3 metres), tiny pebbles and grains, subtle variations. NO cast leaf shadows, no horizon, no props, no paving stones. Edges must tile cleanly in both directions; consistent lighting. Save as PNG.
```

## sando-stone.avif

```text
Seamless tileable square ground texture of the grey granite slab approach path (sando) from Image 1. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
TRUE TOP-DOWN ORTHOGRAPHIC view, uniform scale: the square is 2.4 x 2.4 metres, rectangular granite slabs about 0.6 x 1.2 m laid in a running-bond pattern, thin dark joints, subtle moss in a few joints, worn surface. NO cast shadows, no horizon, no props, no gravel border. Edges must tile cleanly in both directions. Save as PNG.
```

## stone-granite.avif

```text
Seamless tileable square texture of the pale grey weathered granite used for the stone torii, stone lanterns and stone fence in Image 1. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
TRUE FLAT FRONTAL VIEW of a stone surface (no blocks, no edges, no corners): fine speckled granite grain, faint lichen and patches of soft green moss, subtle weathering streaks. No perspective, no props. Edges tile cleanly. Save as PNG.
```

## wood-timber.avif

```text
Seamless tileable square texture of the aged dark-brown hinoki cypress timber of the shrine buildings in Image 1. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
TRUE FLAT FRONTAL VIEW: vertical wood grain running top to bottom, weathered with soft highlights, no planks seams, no knots larger than small, no perspective. Edges tile cleanly in both directions. Save as PNG.
```

## shrub.avif

```text
Foliage-only cutout for crossed planes in a 3D game. Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
One lush rounded Japanese evergreen shrub (like the dense bushes beside the fence in Image 1, small glossy leaves, sunlit yellow-green on the upper left, deep teal-green in shade), about 1.6 m tall, full silhouette visible, base touching the bottom centre of a 3:2 landscape image, foliage filling most of the frame. Genuine fully transparent alpha outside the leaves. NO pot, ground, soil, backdrop, blurred background or cast shadow. Use the image generation tool with a transparent background. Save as PNG with alpha.
```

## ema.avif

```text
Asset type: flat frontal texture of the wooden ema votive-plaque rack board from Image 1 (left side, behind the torii). Image 1 is the exact art-style and materials reference: a richly detailed painted anime background of a Japanese Shinto shrine in bright summer daylight (warm sunlight from upper left), weathered dark-brown cypress timber, pale grey granite with moss, green oxidised copper roofs, grey ceramic kawara tiles, white plaster panels, tan gravel. Keep fine hand-painted wear, wood grain and detail; not a low-poly render, not flat colours.
TRUE ORTHOGRAPHIC FRONT VIEW, filling the whole 3:2 landscape image edge to edge: a dark timber backboard with two horizontal hanging rails, densely covered with many overlapping pentagonal light-wood ema plaques hanging on red and white strings, with faint handwritten-looking ink marks (illegible scribbles, no readable text) and a few small painted motifs. No posts, no roof, no ground, no sky, no people. Opaque. Save as PNG.
```

## 既存素材

`tree.avif`・`far-tree-belt.avif` は商店街（運動場由来）の素材を複製。`thumb.avif` は demo/painted_shrine の正面カット。

不透明素材は AVIF quality 85、`gable`・`shrub` は `--qalpha 100`。元 PNG は `scratch/shrine/gen/`。
