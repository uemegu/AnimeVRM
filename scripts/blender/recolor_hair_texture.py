"""
Tripo の髪パーツのテクスチャ（編み目などの模様）を、明るさだけ残して別の髪テクスチャの色に塗り直す（Blender で実行）。

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/recolor_hair_texture.py -- <模様.jpg> <色の基準.png> <出力.png>

- 色の基準：基準テクスチャの縦 35〜60%（一番明るい帯）の平均色を中間色、上端の平均色を暗い色にする
- 模様の明るさ（UV の島の外の黒は除く）の 5〜95% を、暗い色〜中間色〜中間色の 1.25 倍へ割り当てる
- 島の外の黒は暗い色で埋める（ミップマップで島の縁に黒がにじまないように）
"""

import sys

import bpy
import numpy as np

src_path, ref_path, out_path = sys.argv[sys.argv.index("--") + 1:][:3]


def load(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)  # 下の行から
    return img, px


_, ref = load(ref_path)
h = ref.shape[0]
# Blender の pixels は下から上。テクスチャの上端（根元）は配列の末尾側
mid = ref[int(h * 0.40):int(h * 0.65), :, :3].reshape(-1, 3).mean(axis=0)
dark = ref[int(h * 0.90):, :, :3].reshape(-1, 3).mean(axis=0)
light = np.clip(mid * 1.25, 0, 1)

img, src = load(src_path)
rgb = src[:, :, :3]
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
island = lum > 0.03
lo, hi = np.percentile(lum[island], [5, 95])
t = np.clip((lum - lo) / max(hi - lo, 1e-6), 0, 1)[..., None]
out = np.where(t < 0.6, dark + (mid - dark) * (t / 0.6), mid + (light - mid) * ((t - 0.6) / 0.4))
out = np.where(island[..., None], out, dark)

result = bpy.data.images.new("recolored", img.size[0], img.size[1], alpha=False)
result.pixels[:] = np.concatenate([out, np.ones_like(out[..., :1])], axis=2).astype(np.float32).ravel()
result.filepath_raw = out_path
result.file_format = "PNG"
result.save()
print(f"mid={mid.round(3)} dark={dark.round(3)} lum5-95={lo:.3f}-{hi:.3f} -> {out_path}")
