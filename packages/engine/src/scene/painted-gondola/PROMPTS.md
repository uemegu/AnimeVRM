# 観覧車のゴンドラの素材生成

参照画像: `tmp/夕暮れの観覧車ゴンドラから望む遊園地.png`（`scratch/gondola/reference.png` に控え）。codex exec の built-in image generation で生成した（`codex exec -s workspace-write --skip-git-repo-check "<指示>" < /dev/null`）。codex は指示を自分で詳しく書き直してから生成する。作業ファイル・書き直された指示（`*.prompt.txt`）は `scratch/gondola/` にある。

## タイル（steel / cushion / floor / ground）

`steel.avif` は生成した絵の照り返しの縞が強く木目のように見えたので、`scripts/painted-gondola/soften.py` で縞の濃さを 40% に抑え、少し明るく青みに寄せてから変換した。

### steel.avif

```text
Use the built-in image generation tool. Image 1 (scratch/gondola/reference.png) is the exact art-style reference: a richly detailed painted anime background of the inside of a Ferris wheel gondola at sunset, warm orange-gold low sun, violet-blue shadows, brushed stainless steel with warm reflections, navy-blue vinyl bench cushions, and through the windows an amusement park (roller coasters, carousels, a lit tower, castle-like halls, trees with fairy lights), a calm bay reflecting the sunset, islands, hazy blue mountains and a coastal city with twinkling lights. Keep the fine hand-painted detail and glowing lights; not a low-poly render, not flat colours.
Seamless tileable square texture (1024x1024) of the brushed stainless steel wall panel of the gondola interior from Image 1: TRUE FLAT FRONTAL VIEW, uniform scale (about 1 x 1 metre), fine vertical brushing, soft warm orange-gold and violet reflections as vertical bands, a few small screw heads. No perspective, no window, no corner, no seat, no frame lines along the edges. Edges must tile cleanly in both directions. Save as PNG to scratch/gondola/steel.png
```

### cushion.avif

```text
Use the built-in image generation tool. Image 1 (scratch/gondola/reference.png) is the exact art-style reference: a richly detailed painted anime background of the inside of a Ferris wheel gondola at sunset, warm orange-gold low sun, violet-blue shadows, brushed stainless steel with warm reflections, navy-blue vinyl bench cushions, and through the windows an amusement park (roller coasters, carousels, a lit tower, castle-like halls, trees with fairy lights), a calm bay reflecting the sunset, islands, hazy blue mountains and a coastal city with twinkling lights. Keep the fine hand-painted detail and glowing lights; not a low-poly render, not flat colours.
Seamless tileable square texture (1024x1024) of the navy-blue / indigo vinyl leather bench cushion upholstery from Image 1: TRUE FLAT FRONTAL VIEW, uniform scale (about 0.6 x 0.6 metre), subtle leather grain, soft sheen, faint warm sunset reflections, no seams, no piping, no edges, no shadows of bars. Edges must tile cleanly in both directions. Save as PNG to scratch/gondola/cushion.png
```

### floor.avif

```text
Use the built-in image generation tool. Image 1 (scratch/gondola/reference.png) is the exact art-style reference: a richly detailed painted anime background of the inside of a Ferris wheel gondola at sunset, warm orange-gold low sun, violet-blue shadows, brushed stainless steel with warm reflections, navy-blue vinyl bench cushions, and through the windows an amusement park (roller coasters, carousels, a lit tower, castle-like halls, trees with fairy lights), a calm bay reflecting the sunset, islands, hazy blue mountains and a coastal city with twinkling lights. Keep the fine hand-painted detail and glowing lights; not a low-poly render, not flat colours.
Seamless tileable square texture (1024x1024) of the gondola floor from Image 1: polished dark grey-violet metal floor plate seen TRUE TOP-DOWN, uniform scale (about 1 x 1 metre), faint fine anti-slip texture, glossy with soft warm orange reflections and small sparkles. No perspective, no seat, no cast shadows, no edges or frame. Edges must tile cleanly in both directions. Save as PNG to scratch/gondola/floor.png
```

### ground.avif

```text
Use the built-in image generation tool. Image 1 (scratch/gondola/reference.png) is the exact art-style reference: a richly detailed painted anime background of the inside of a Ferris wheel gondola at sunset, warm orange-gold low sun, violet-blue shadows, brushed stainless steel with warm reflections, navy-blue vinyl bench cushions, and through the windows an amusement park (roller coasters, carousels, a lit tower, castle-like halls, trees with fairy lights), a calm bay reflecting the sunset, islands, hazy blue mountains and a coastal city with twinkling lights. Keep the fine hand-painted detail and glowing lights; not a low-poly render, not flat colours.
Seamless tileable square texture (1024x1024) of the evening amusement park seen from straight above (TRUE TOP-DOWN, from about 80 metres high, covering about 60 x 60 metres): dense round tree crowns with warm fairy lights, winding paved promenades lit by lamps, small kiosk and pavilion roofs, flower beds, a small fountain. Warm sunset tones with violet shadows. No horizon, no perspective, no big landmark. Edges must tile cleanly in both directions. Save as PNG to scratch/gondola/ground.png
```

## パノラマ（pano-0..3）

正面の1枚を生成し、左右へ継ぎ足し、背面で閉じる。手順と並びは README の「パノラマの作り方」。

### 正面（pano-F）

```text
Use the built-in image generation tool. Image 1 (scratch/gondola/reference.png) is the exact art-style reference: a richly detailed painted anime background of the inside of a Ferris wheel gondola at sunset, warm orange-gold low sun, violet-blue shadows, brushed stainless steel with warm reflections, navy-blue vinyl bench cushions, and through the windows an amusement park (roller coasters, carousels, a lit tower, castle-like halls, trees with fairy lights), a calm bay reflecting the sunset, islands, hazy blue mountains and a coastal city with twinkling lights. Keep the fine hand-painted detail and glowing lights; not a low-poly render, not flat colours.
Asset type: one 90-degree segment of a 360-degree CYLINDRICAL PANORAMA of the landscape seen from a Ferris wheel gondola about 80 metres above the ground, for a 3D game backdrop. Landscape 3:2 image, 1536x1024.
Camera is LEVEL (looking horizontally, not tilted): the true horizon is a straight horizontal line at 23% from the top of the image. Above the horizon only the hazy distant mountain ridge rises a little (at most to 15% from the top); EVERYTHING ABOVE the mountains (the whole sky, clouds, sun) must be genuinely FULLY TRANSPARENT alpha. No painted sky, no clouds, no sun disc, no sky gradient.
This segment looks toward the SUNSET over the sea: the calm bay fills the middle distance with a golden glittering sun reflection path running down from the horizon near the centre, small dark islands, distant mountains along the horizon with a coastal city's twinkling lights along the shore on the left and right. Below that (lower 55% of the image), seen looking down from high above: the evening amusement park full of warm lights — a looping blue roller coaster, a carousel with a domed roof, a European castle-like main hall with lit windows, a slim lit observation tower, tree-lined promenades with fairy lights, fountains. Near the bottom of the image the view looks steeply down onto park paths, trees and roofs with warm lamps. NO Ferris wheel in this segment.
Left and right edges should continue naturally (no frame, no vignette). No gondola frame, no window frame, no railing, no people, no text. Save as PNG with alpha to scratch/gondola/pano-front.png
```

### 継ぎ足し（R1〜R3・L1〜L3・C）

下書き（`draft-<名前>.png`）は、前の絵の端 512px を残し、残りを灰色で塗ったもの（空は透過のまま）。`$KEEP` は継ぎ足す向きで「左の 1/3 を残して右へ続ける」「右の 1/3 を残して左へ」「左右の 1/3 を残して中央を埋める」のどれか。

```text
Use the built-in image generation tool (edit mode with input images).
Image 1 (scratch/gondola/reference.png) is the art-style reference: a richly detailed painted anime background at sunset, warm orange-gold light, violet-blue shadows, a coastal amusement park with countless warm lights, a calm bay, hazy mountains, a city with twinkling lights. Keep fine hand-painted detail; not low-poly, not flat colours.
Image 2 (scratch/gondola/pano-F.png) is the FRONT segment of the same panorama, for consistency of scale, colours and style.
Image 3 (scratch/gondola/draft-<名前>.png) is the canvas to complete, 1536x1024. $KEEP Transparent areas of the kept part are sky.
Asset type: part of a 360-degree CYLINDRICAL PANORAMA seen from a Ferris wheel gondola about 80 metres above the ground, LEVEL camera. The true horizon stays a straight horizontal line at row 248 (24% from the top), exactly where it is in the kept part; buildings, mountains and the far ridge may rise above it a little, but EVERYTHING that would be sky (above the mountains / skyline) must be genuinely FULLY TRANSPARENT alpha: no painted sky, clouds, sun or sky gradient. Same scale as the kept part: near the bottom of the image we look steeply down onto the park below.
Content of the new area: $CONTENT
Lighting: the sun is setting over the sea in the FRONT segment; facing away from it the scene is in dusk blue-violet light with a pink glow on the far hills, and all windows, streets and attractions are lit warmly.
No frame, no window, no railing, no Ferris wheel structure, no people, no text, no vignette. Output exactly 1536x1024 RGBA PNG saved to scratch/gondola/pano-<名前>.png
```

`$CONTENT`（新しく描く部分の中身）:

- R1: the bay curves round to the right; on its far shore a beautiful harbour town with a marina full of sailing boats and lit waterfront promenade; in the foreground the amusement park continues: a drop tower, a swing ride, a pirate ship ride, food court pavilions with string lights, tree-lined lit paths.
- L1: the amusement park continues to the left: a grand domed carousel, a fairy-tale castle with turrets lit gold, a log flume ride with water channels, flower gardens and lit promenades; beyond the park the bay shore runs left with a lit coastal road and a town of white houses climbing the hills under the distant mountains.
- R2: the bay ends here and the shore curves inland: a beautiful old European-style harbour town spreads across the middle distance and up the hills: church spires, a clock tower, red-brick warehouses along a canal, narrow lit streets and countless warm windows, a lit arched stone bridge; in the foreground the amusement park ends with its grand entrance plaza, an ornate lit gate and a tree-lined boulevard of lamps leading into the town.
- L2: the park continues: a lake with a lit water ride and a rocky mountain coaster, flower gardens and lit promenades; beyond it a river flows into the bay, crossed by a lit suspension bridge, and a pretty hillside town of houses with warm windows climbs towards the mountains.
- R3: no more sea: the beautiful old town fills the whole middle distance and climbs gentle hills: a cathedral with twin spires, a domed town hall on a square, tree-lined avenues of lamps, tiled roofs with countless warm windows, a canal with small lit bridges; farther away the hills are dotted with lit houses up to the mountain ridge. In the foreground, below the park entrance, a wide lit boulevard and a plaza with a fountain, a tram line with a lit tram.
- L3: no more sea: beyond the river the land rises into a city: a lively modern city centre with lit glass high-rise towers and a slim TV tower in the middle distance, a railway viaduct with a lit train crossing in front of it, streets glowing with traffic lights; hills with lit houses behind. In the foreground the amusement park's back-lot: a big lit dome theatre, a parking area with rows of lamps, tree belts with fairy lights.
- C: the old town on the left blends into the modern city on the right: lit streets, a river with a lit bridge, apartment blocks and houses with warm windows climbing the hills towards the mountain ridge; in the foreground the edge of the amusement park with lit trees and a promenade.
