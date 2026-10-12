# Water mask of the gondola panorama, for the shader-drawn water (Panorama.ts / Water.ts).
# White = water the shader redraws (open water, canals, ponds, with the painted reflections in
# them); black = land, the far shore, the rides, and everything above the horizon.
# Run in the folder holding the decoded tiles pano-0..3.png (avifdec pano-N.avif pano-N.png):
#   uv run --with pillow --with numpy --with scipy python <repo>/scripts/painted-gondola/sea-mask.py
# Writes sea-mask.png (4 tiles side by side, quarter resolution) and sea-mask-preview.png;
# convert with `avifenc -l sea-mask.png sea-mask.avif` (lossless: G is a row number).
# R = water (soft edge). G = the far shore's waterline in that column: the top row of the
# water, as rows below the horizon (full-resolution rows, 0-255); the shader mirrors the
# painting about it for the reflections.
import numpy as np
from PIL import Image
from scipy import ndimage

HORIZON = 248  # row of the horizon in a 1024-row tile
SCALE = 4      # mask is a quarter of the tile resolution
tiles = [np.asarray(Image.open(f'pano-{i}.png').convert('RGBA'), np.float32) / 255 for i in range(4)]
strip = np.concatenate(tiles, axis=1)  # 1024 x 8192, column c = heading c/8192*360 - 45 deg
H, W = strip.shape[:2]
rgb, alpha = strip[..., :3], strip[..., 3]
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
luma = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
rows = np.arange(H)[:, None]

# 1. Blue water: blue over red and green, not too dark (shadowed trees are dark blue-green),
#    smooth (the foliage is busy), below the horizon.
blue = (b > r * 1.25) & (b > g * 1.12) & (b > 0.30)
busy = ndimage.uniform_filter(luma ** 2, 7) - ndimage.uniform_filter(luma, 7) ** 2
water = blue & (busy < 0.004) & (rows > HORIZON + 2) & (alpha > 0.5)
water = ndimage.binary_opening(water, np.ones((3, 3)))
# Drop specks: keep only regions of some size.
labels, n = ndimage.label(water)
sizes = ndimage.sum(water, labels, range(1, n + 1))
water = np.isin(labels, np.nonzero(sizes >= 5000)[0] + 1)

# 2. The painted reflections inside the water (light streaks and the sun's path): pixels with
#    water close by on both the left and the right, in the same rows. Thin streaks only, except
#    where the sun's path is (wide), so piers, islands and the rides stay painted.
def both_sides(mask, reach):
    left = ndimage.maximum_filter1d(mask.astype(np.uint8), reach, axis=1, origin=reach // 2 - 1) > 0
    right = ndimage.maximum_filter1d(mask.astype(np.uint8), reach, axis=1, origin=-(reach // 2)) > 0
    return left & right
# Only light streaks: bright pixels (the dark trees along the near shore stay painted).
streaks = both_sides(water, 24) & ~water & (luma > 0.35)
sun_path = np.zeros_like(water)
SUN = (1000, 1280, 270, 520)  # strip columns and rows of the painted sun's path
sun_path[SUN[2]:SUN[3], SUN[0]:SUN[1]] = both_sides(water, 260)[SUN[2]:SUN[3], SUN[0]:SUN[1]]
water = water | streaks | sun_path
# Things standing in front of the water: the drop tower (centre column 1452), kept painted with
# a margin wider than a mask pixel so its thin spire survives the quarter-resolution mask.
# Inside its box the water is told from the tower by colour (the shaft is a lighter blue).
r0, r1, c0, c1 = 335, 580, 1410, 1495
plain = blue & (busy < 0.004) & (luma < 0.48)
tower = ~ndimage.binary_opening(plain[r0:r1, c0:c1], np.ones((3, 3)))
tower = ndimage.binary_dilation(tower, np.ones((7, 7)))
water[r0:r1, c0:c1] = ~tower
water = ndimage.binary_closing(water, np.ones((5, 5)))

# 3. Soft edge, quarter resolution (the shader samples it bilinearly).
small = np.asarray(Image.fromarray((water * 255).astype(np.uint8)).resize((W // SCALE, H // SCALE), Image.BOX))
# Waterline per column: the first water row below the horizon, filled across dry columns
# from the nearest wet one so the bilinear lookup stays smooth at the ends of the bays.
has = water.any(axis=0)
top = np.where(has, water.argmax(axis=0), 0).astype(np.float32)
idx = np.where(has, np.arange(W), 0)
np.maximum.accumulate(idx, out=idx)
filled = top[idx]
first = np.argmax(has)
filled[:first] = top[first]
shore = np.clip(filled - HORIZON, 0, 255).reshape(W // SCALE, SCALE).min(axis=1)
# Smoothed along the strip (wrapping round), so the mirror line has no steps between columns.
shore = ndimage.gaussian_filter1d(ndimage.median_filter(shore, 31, mode='wrap'), 8, mode='wrap')
mask = np.zeros((H // SCALE, W // SCALE, 3), np.uint8)
mask[..., 0] = small
mask[..., 1] = shore[None, :].astype(np.uint8)
Image.fromarray(mask).save('sea-mask.png')
body = rgb[water & ~streaks & ~sun_path]
print('mean water colour (sRGB 0-255):', (np.median(body, axis=0) * 255).round())
preview = (rgb * 0.45 + water[..., None] * np.array([0.0, 0.55, 0.3], np.float32)).clip(0, 1)
Image.fromarray((preview * 255).astype(np.uint8)).resize((W // 4, H // 4)).save('sea-mask-preview.png')
print('water fraction below the horizon:', water[HORIZON:].mean())
