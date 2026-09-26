# 参考衣装テクスチャ v1

- `tshirt-basecolor-v1.png`: 2048×2048、白い綿・小さなフランス語ロゴ。マテリアル `N00_010_01_Onepiece_00_CLOTH (Instance)`。
- `cardigan-basecolor-v1.png`: 2048×2048、淡いブルーグレーのニット・リブ・ボタン。マテリアル `N00_005_01_Tops_01_CLOTH (Instance)`。
- `pants-basecolor-v1.png`: 1024×1024、チャコールデニム・縫い目・折り返し。マテリアル `N00_001_01_Bottoms_01_CLOTH (Instance)`。

すべて sRGB / RGBA PNG。MToon の Lit Color Texture と Shade Color Texture に同じ画像を指定し、Alpha Mode は MASK を維持。元の UV 配置と衣服の透明マスクを利用。パンツは下部の不要な色漏れを透明化。

`aoi-outfit-preview-v1.blend` は適用済みの別名保存、`before-textures.blend` は適用前のバックアップ。元 VRM は未変更。正面・背面を Blender のマテリアル表示で確認。

注意: 正面の胸の左右に、既存モデルの重ね着部分に由来すると考えられる白い干渉が残る。透明マスクの調整のみでは解消しなかったため、元のマスクを維持している。メッシュ形状・バッグ・靴は今回の制作対象外。

生成方法: 内蔵 image_gen。生成プロンプトは `generation-prompts.json`。生成後に解像度と既存アルファチャンネルを合わせ、パンツの縦位置を補正。
