# 共通仕様：全タスクで読む

## データの流れ

Nodeで計画を読む／Jevに問い合わせる → Chromeでardy生成 → 実際のVRMへ変換 → 演技調整 → 接触補正 → 計測 → Mixamo形式へ戻して保存 → FBXを再読込して同じVRMで再計測。

シナリオ再生では、生成時と同じ接触計画を読み、頭のLookAtなどが終わった後に接触だけ再補正する。演技調整は二重に適用しない。

## 新設する共通型

`src/ai/motion/quality/types.ts` に定義する。ここにある名前を各タスクで統一する。

```ts
export type Vec3 = [number, number, number];
export type Side = 'left' | 'right';
export type Style = 'neutral' | 'soft-compact';

export interface ContactWindow {
  start: number;       // 補正を開始する秒
  holdStart: number;   // 補正の強さが1になる秒
  holdEnd: number;     // 補正の強さ1を維持する最後の秒
  end: number;         // 補正の強さが0に戻る秒
}
export type Contact = ContactWindow & (
  | { kind: 'face'; side: Side; target: 'cheek'; targetSide: Side }
  | { kind: 'face'; side: Side; target: 'mouth' | 'chin' }
  | { kind: 'palmsTogether' }
);
export interface MotionQualityPlan {
  version: 1;
  duration: number;
  style: Style;
  styleStrength: number; // 0〜1
  timingSource: 'authored' | 'template';
  contacts: Contact[];
}
export interface Anchor {
  bone: string;       // VRMHumanBoneNameとして存在確認する
  point: Vec3;        // normalized boneのローカル座標、メートル
  normal: Vec3;       // 顔アンカーでは外向き。prayerCenterでは左右の接触軸
  tangent: Vec3;      // 表面上の指先方向。normalと直交
}
export interface HandFrame {
  palmPoint: Vec3;    // normalized handローカルの掌中心
  palmNormal: Vec3;   // 掌側へ向く単位ベクトル
  fingerDirection: Vec3; // 手首から中指へ向く単位ベクトル
}
export interface AvatarContactProfile {
  version: 1;
  avatarSha256: string;
  calibrated: boolean;
  anchors: Record<'leftCheek' | 'rightCheek' | 'mouth' | 'chin', Anchor>;
  prayerCenter: Anchor; // 胸に追従する両掌の中間位置
  hands: Record<Side, HandFrame>;
  armLengths: Record<Side, { upper: number; lower: number }>;
  bodyFrame: { left: Vec3; up: Vec3; forward: Vec3 }; // シーンローカルのレスト軸
  shoulderWidthMeters: number; // 正規化誤差に使うレスト肩幅
  faceGapMeters: number;
  palmGapMeters: number;
}
```

`Anchor.bone` の文字列を任意オブジェクトの探索に使わない。VRMHumanoidの既知ボーン名として検証する。
`bodyFrame`は校正時のレスト軸を保存し、再生中の腕位置から左右方向や肩幅を再計算しない。合掌の`prayerCenter.normal`はactor-left/right接触軸。
顔接触の`side`は動かす手、頬接触の`targetSide`は触れる頬を表し、左右の値は独立させる。

## 入力検証と既定値

- `duration`：有限、2〜8秒。時刻はすべて秒。
- 各接触は `0 <= start < holdStart <= holdEnd < end <= duration`。
- 初版は1クリップにつき接触0〜1個まで。配列が2個以上なら未対応エラー。勝手に先頭だけ使わない。
- 列挙値、配列の長さ、有限数、強さ0〜1、単位ベクトル、ベクトルの直交性を検証する。単位長の誤差と直交内積の許容値は1e-4。hashは64文字の16進文字列。gapは有限かつ0以上。
- 手書き計画と実際のクリップのdurationが1フレームを超えて違えばエラー。
- `soft-compact` はタスク05で限定実装済み。接触目標を保ちながら肘の向きを体側へ寄せるだけで、性別や自然さの保証ではない。
- Jevは開始位置・接近時間・保持時間の分類回答から秒数をコードで組み立てる。これは動作区間の検出結果ではない。`timingSource:'template'` と報告し、レビューを要求する。
- 接触の強さは開始→保持でsmootherstep(0→1)、保持中1、保持→終了でsmootherstep(1→0)。区間外は完全に0。
- smootherstepは `u=clamp(u,0,1); u*u*u*(10-15u+6u*u)`。
- 接触が無いときは手指・腕を接触ソルバーが変更しない。

## 座標と骨格の規則

- 接触ソルバーは実際のVRMの **normalized bone** に適用する。raw boneと混ぜない。
- Mixamoの既存 `reach()` のcm定数やボーンローカル軸をVRMにコピーしない。
- IK計算はワールド座標。アバター親の位置・回転・正の一様スケールを考慮する。非一様／負スケールは初版で明示エラー。
- プロファイルの点はボーンの `localToWorld()` で変換する。法線・方向はワールド回転で変換する。
- 距離の閾値は身長より「左右上腕の根元間の距離」Wで正規化する。Wはレスト姿勢で計測して固定し、退化したWはエラー。
- 校正時のactor-leftはレスト姿勢の右上腕→左上腕。上はhips→head。両者を直交化してシーンローカルprofileへ保存し、再生中はprofile値を使う。
- 方向を毎フレームの手の位置から作らない。身体方向はレスト基底と胸のレストからの回転差で更新する。
- `VRMUtils.rotateVRM0()` とquaternionの符号変換は別の処理。既存変換との往復テストを必須にする。

## 関数の境界

新規モジュールは `src/ai/motion/quality/` に置く。

- `validate.ts`：計画・プロファイルの検証。ブラウザ／Node共用の純粋関数。
- `rig.ts`：VRMからボーン、レスト基底、W、腕長を得る。足りないボーンを報告する。
- `measure.ts`：姿勢を変更せずに数値を取得する。
- `solveContacts.ts`：現在の姿勢＋時刻＋計画＋プロファイルから、対象の腕・手指だけを変更する。Jev通信をしない。
- `polishClip.ts`：元クリップをサンプリングし、演技→接触→計測して補正済みクリップとレポートを返す。
- `solveContacts.ts`：soft-compactの控えめな肘経路も含む。
- `calibrate.ts`：対象VRMに対して7点をクリックして校正profileを作る。
- `scripts/lib/jev-motion-plan.ts`：Node専用のJev通信と回答解釈。ブラウザからimportしない。

APIキーはNodeの `.env` にある `JEV_API_KEY` を優先し、旧名 `TYPESAFE_API_KEY` も利用できる。`VITE_*`・生成物・レポート・ブラウザ引数へ入れない。

Nodeで共用する `validate.ts` は実行時のThree.jsやブラウザAPIに依存させない。typesへのtype-only importはよい。これによりNodeのTypeScript直接実行とViteの双方で利用できる。

## 品質レポート

最低限 `version`, `status`, `avatarSha256`, `plan`, `timingSource`, `before`, `after`, `exportRoundTrip`, `reasons` を記録する。各計測群は `Record<string, QualityMetric>` とし、次の型を使う。

```ts
export interface QualityMetric {
  value: number | null;
  unit: 'ratio' | 'degrees' | 'radians/second' | 'radians/second2' | 'count';
  threshold: number | null; // 閾値なしの情報値はnull
  worstFrame: number | null;
  passed: boolean | null; // 未計測／情報値はnull
}
```

`before` の不合格は改善対象なので最終statusへそのまま伝播させない。最終statusはafter・exportRoundTrip・入力の対応状況・校正状態・timingSourceで決める。生の幾何検査を実施できなかった場合も理由が必要。

`status` は `pass | needs-review | failed | unsupported`。機械検査を通っても、プロファイル未校正や時間テンプレート未確認なら `needs-review`。`pass` は「指定の機械検査を通過した」の意味で、見た目の自動保証ではない。

各計測値は `value`, `unit`, `threshold` と対象フレームを持つ。データ不足はnull／理由を記録し、0点や合格として扱わない。Jevの確信度を幾何学的な合格条件に使わない。

元データ・手書き計画・プロファイルを変更せず、補正結果は複製へ書く。時刻を飛ばしても同じ姿勢を得ること。前回の補正の蓄積を禁止する。
