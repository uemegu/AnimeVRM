# Stitch the panorama pieces into an 8192-wide strip (column c = heading c/8192*360 - 45 deg)
# and cut it into four 90-degree tiles (pano-0..3: front, right, back, left).
# Run in the folder holding pano-F/R1..R3/L1..L3/C.png (see packages/content/src/sets/painted-gondola/README.md):
#   uv run --with pillow --with numpy python <repo>/scripts/painted-gondola/stitch.py
import os, numpy as np
from PIL import Image
W, H = 8192, 1024
# name, strip column of the piece's column 0, ramp side(s)
PIECES = [('F', 256, ''), ('R1', 1280, 'L'), ('L1', 7424, 'R'), ('R2', 2304, 'L'), ('L2', 6400, 'R'),
          ('R3', 3328, 'L'), ('L3', 5376, 'R'), ('C', 4352, 'LR')]
strip = np.zeros((H, W, 4), np.float32)  # premultiplied
x = np.arange(1536, dtype=np.float32)
def ramp(t):  # 0 before the middle 384 px of the 512 px overlap, 1 after
    return np.clip((t - 64) / 384, 0, 1)
for name, c0, side in PIECES:
    path = f'pano-{name}.png'
    if not os.path.exists(path): continue
    im = np.asarray(Image.open(path).convert('RGBA').resize((1536, 1024)), np.float32) / 255
    im[..., :3] *= im[..., 3:]
    w = np.ones(1536, np.float32)
    if 'L' in side: w = np.minimum(w, ramp(x))
    if 'R' in side: w = np.minimum(w, ramp(1535 - x))
    cols = (c0 + np.arange(1536)) % W
    filled = strip[:, cols, 3].max(axis=0) > 0
    w = np.where(filled, w, 1.0)[None, :, None]
    strip[:, cols] = strip[:, cols] * (1 - w) + im * w
a = strip[..., 3:]
rgb = np.where(a > 0, strip[..., :3] / np.maximum(a, 1e-6), 0)
out = (np.concatenate([rgb, a], -1) * 255 + 0.5).clip(0, 255).astype(np.uint8)
Image.fromarray(out).save('pano-strip.png')
for i in range(4):
    Image.fromarray(out[:, i * 2048:(i + 1) * 2048]).save(f'pano-{i}.png')
print('done')
