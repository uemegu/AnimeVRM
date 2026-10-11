#   uv run --with pillow --with numpy python soften.py steel.png steel-soft.png
# Calm the steel tile: compress the painted reflection bands to 40%, keep the fine brushing and screws.
import sys, numpy as np
from PIL import Image, ImageFilter
im = Image.open(sys.argv[1]).convert('RGB')
a = np.asarray(im, np.float32)
base = np.asarray(im.filter(ImageFilter.GaussianBlur(3)), np.float32)
mean = a.reshape(-1, 3).mean(0)
out = mean + (base - mean) * 0.4 + (a - base) * 1.2
# a little cooler and lighter, like the lavender-silver steel of the painting
out = out * np.array([0.97, 0.98, 1.05]) + 14
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(sys.argv[2])
