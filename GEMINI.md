# AnimeVRM プロジェクト開発ガイドライン & インストラクション

## 画像アセット変換 (`avifenc`)

プロジェクト内で使用する背景やテクスチャ画像は、パフォーマンスと軽量化のため **AVIF形式 (`.avif`)** を標準として採用します。画像を追加・更新する際は `avifenc` を使用して変換してください。

### 変換コマンド

1. **通常画像（背景・遠景・不透明テクスチャ）**:
   ```bash
   avifenc -s 6 -q 85 input.png output.avif
   ```

2. **透過画像（中景・近景・アルファチャンネル付きテクスチャ）**:
   ```bash
   avifenc -s 6 -q 85 --qalpha 100 input.png output.avif
   ```
   > `--qalpha 100` を指定することで、透過部分の境界や半透明グラデーションが劣化せず完全ロスレスで維持されます。

---

## 多層背景設計 (Background / Midground / Nearground)

- **遠景 (Background)**: `scene.background` に設定。画面全体に広がる背景。
- **中景 (Midground)**: `ViewerCore.midgroundMesh`。アバターより奥（`renderOrder = -1`）に配置される環境オブジェクト（公園の樹木など）。
- **近景 (Nearground)**: `ViewerCore.neargroundMesh`。アバターより手前（`renderOrder = 2`）に配置される前景オブジェクト（カフェのテーブルなど）。アバターを挟み込むことで「座っている」「奥に立っている」シチュエーションを表現する。
