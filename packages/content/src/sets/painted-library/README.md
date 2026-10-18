# 簡易3Dの図書室（面ごとの1枚絵 + 手前の机 + 家具のアクスタ）

シオンが窓際の閲覧机で頬杖をつく場面用の撮影用セット。カメラは机の向かいの席（プレイヤーの席）で、手前に机、奥にシオン、周りを図書室の絵で囲む。作り方は painted-classroom と同じで、窓の外の空は絵に描かず透過にし、ビューアの空（SkyBackground）を後ろに描く。

- 場所: `painted_library`（`assets/studio/locations.json` の組み込み3D背景 `builtin:painted-library`）。Studio のシーン設定で見え方を確認できる
- シナリオ: `assets/scenarios/demo/painted_library/`（時間帯で朝・昼・放課後を切り替える）
- 素材: `assets/textures/painted-library/*.avif`（絵柄の参照は `assets/textures/school-library-far.png`）

## 構成

- 寸法・家具の配置・カメラは `layout.ts` に集約（幅8m×奥行10.5m×天井3.2m、左が窓）。
- 床・天井・奥/左/右の壁: 面全体を1枚で生成。
- 手前の机: 天板を真上からの1枚絵（`table-top.avif`）にした箱。どの角度から見ても遠近が合う。
- シオンの後ろの本棚の列・シオンの椅子: 正面から描いたアクスタ。不透明部分の外接矩形を実寸に合わせて置く。
- 奥の閲覧テーブル: `painted-library-blockout.html` の下書き（基準カメラから見た灰色の箱）の上に生成し、同じカメラから垂直な板へ投影。`layout.ts` の `FAR_TABLE` や基準カメラを変えたら作り直すこと。下書きのページ（`*-blockout.html`・`blockout.ts`）と確認ページは、2026-09-27 に旧ルートと一緒に消した。作り直すときはコミット `a582c47` 時点のものを戻して使う。

## シオンの姿勢

`chin_rest.fbx` は座面のない中腰のモーションなので、旧ルートでは脚だけ座り姿勢に差し替え（`seated: true`）、腰を椅子の座面の高さに下げていた。今の描画には座り姿勢がないので、シオンは立ったまま頬杖をつく（旧ルートのシナリオを移したときに外した）。
