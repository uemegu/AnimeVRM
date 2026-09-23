# タスク04：Jevで意図を分類する

> 実装済みの現行仕様は下記の通り。この文書の後半に残る初期設計（質問ID、confidence閾値、キャッシュ、再試行、`--jev-model`）は提案であり、実装済みと読み違えない。現行コードを変更する際はREADMEの状態表を確認する。

現行CLIは `--jev` と任意の `--acting-note` を受け取る。`jev-motion-plan.ts` が1回の `jev-latest` リクエストへ9個のChoice/Score質問をまとめる。action（face_touch / palms_together / none）、動かす手の左右、顔位置、頬の左右、接触開始、接近時間、保持時間、neutral / soft_compact、style強度を問い合わせる。Action・手・顔位置・頬の左右はconfidenceが0.65未満なら停止する。タイミングや演技強度の低信頼回答は決めた既定値へ置き換え、レポートへ記録する。座標・骨回転はJevへ尋ねず、secondsは回答を使ってコードで構成する。JevのtimingSourceはtemplateなので結果はレビュー用となる。fetchモックテストに加え、9問版で12件の実API分類テストを行い、合計27回APIを呼び出した。ardy-mini自体の2秒FBX生成は成功。校正profileを使ったJev＋接触補正のFBX生成と目視は未実施。

読む：`contract.md`、タスク03のCLI、[公式API](https://docs.typesafe.ai/api)、[入力仕様](https://docs.typesafe.ai/concepts/state)、[質問仕様](https://docs.typesafe.ai/primitives)。

## このタスクでJevにさせること

英語の動作説明・キャラの演技方針から、既知の動作と演技プリセットを選ぶ。Jevに座標、角度、quaternion、毎フレームの姿勢を生成させない。画像・動画を送らない。Jevが見た目を採点したという報告をしない。

追加CLI：`--jev`、`--acting-note <text>`、`--jev-model <id>`（既定 `jev-latest`）。`--jev` でもavatarとcontact-profileは必要。

手書きquality-planを最優先し、その場合はJevを呼ばない。`--jev` が無ければネットワーク通信しない。

## 送信するstate

```json
{
  "motionPrompt": "A person presses their open palms together in front of the chest.",
  "actingNote": "Reserved, gentle movements with relaxed shoulders.",
  "durationSeconds": 4,
  "supportedActions": ["face_contact", "palms_together", "none"]
}
```

送信先 `POST https://api.typesafe.ai/v1/systemone`。Node側の `.env` にある `JEV_API_KEY` を優先し、旧名 `TYPESAFE_API_KEY` もBearer認証に利用できる。bodyは `{model, state, questions}`。回答は `answers[id]` を参照する。

## 1リクエストに入れる全質問

全質問を同じ `questions` オブジェクトへ入れる。質問IDだけに意味を書かず、instructionsにも対象・判定内容を明記する。同一リクエスト内の他の回答を参照しない。

| ID | type | instructions（この英文を使ってよい） | criteria |
|---|---|---|---|
| action | choice | Which supported action best describes `motionPrompt`? Select unsupported for clapping, interlaced fingers, a fist supporting the chin, multiple sequential gestures, or any other unlisted contact. | 下記参照 |
| hand | choice | Which hand performs the face contact described in `motionPrompt`? Choose unspecified if the text does not specify exactly one hand or no face contact is requested. | left / right / unspecified |
| target | choice | Which part of the face is contacted in `motionPrompt`? Choose unspecified if no single listed part is clearly requested. | cheek / mouth / chin / unspecified |
| actual_contact | noul | Does `motionPrompt` explicitly request sustained contact, rather than only moving a hand near the face or near the other hand? | yes/noの意味を上記で定義 |
| style | choice | Which acting style is supported by `actingNote` and `motionPrompt`? Do not infer a style from gender alone. | neutral / soft_compact |
| intensity | score | How strongly do `actingNote` and `motionPrompt` request soft, compact movement? | 0: Not requested. / 1: Mildly requested. / 2: Clearly requested. |
| multiple_actions | noul | Does `motionPrompt` request more than one distinct gesture, excluding approach, hold, and release of the same contact? | yes/no |

actionのcriteriaは説明付きで定義する。

```json
{
  "face_contact": "One open hand touches or rests against a cheek, mouth area, or chin.",
  "palms_together": "Both open palms press together and hold in front of the chest, with fingers pointing up.",
  "none": "No sustained hand-to-face or hand-to-hand contact is requested.",
  "unsupported": "Another contact or a gesture outside the supported set is requested."
}
```

styleの `soft_compact` は回答時の識別子。アプリのenumへ変換するときだけ `soft-compact` とする。neutralは「無指定または普通の動作」、soft_compactは「小さく柔らかい動作」。

## 回答から計画へ変換する規則

閾値は暫定値。Jevのconfidenceを正解率80%などと表現しない。

1. 型、列挙値、数値範囲、必要な回答の存在を検証。不正応答は計画を作らず理由を返す。
2. `multiple_actions.noul >= .8` または `action=unsupported` ならunsupported。
3. actionのconfidence < .8、またはmultiple_actionsが.2〜.8の曖昧域ならneeds-review。強い接触補正を有効化しない。
4. action=noneならcontacts=[]。
5. 接触を有効化するにはactual_contact.noul >= .8が必要。条件を満たさなければneeds-review。
6. face_contactはhandとtargetのconfidence >= .8、かつunspecified以外が必要。左・右をランダムに決めない。
7. palms_togetherはhand/target回答を無視して両手制約を作る。
8. styleのconfidence >= .8でsoft_compact、intensityのconfidence >= .8なら `styleStrength=clamp(score/2,0,1)`。それ以外はneutral/0。
9. 時刻は共通仕様のテンプレートで作る。`timingSource:'template'` のため最終出力はreview扱い。ユーザーまたは実装担当が区間を確認し、手書きplanに保存してauthoredにすると通常出力へ進める。
10. 生回答、モデル応答のmodel名、判定理由をレポートに保存する。APIキーは絶対に保存しない。

曖昧な回答が出たときに同じ質問を何十回も繰り返して多数決しない。情報が不足していれば、手書き計画で決める。Jevはシナリオの英文自体を書き換える生成器としては使わない。

## 通信・キャッシュ

- 30秒timeout。429/529と一時的な通信エラーは最大2回再試行。Retry-Afterを尊重し、それ以外は1秒・2秒の待機。
- 401/422、キー未設定、応答検証エラーは再試行しない。明確な理由を返す。
- キャッシュキーはmodel・state・questions・質問仕様versionの安定JSONのhash。保存先はgit管理しないローカルキャッシュ。
- 認証情報を含むオブジェクトをログ出力しない。
- キャッシュは成功応答のみ。`jev-latest` のキャッシュ期限は24時間。返された具体的モデルIDも記録する。

## 必須テスト

`test/jev-motion-plan.spec.ts` にNode側のfetchモックで実装する。

- 正常な顔接触、合掌、none、unsupported。
- 低confidence、左右不明、複数動作、actual_contact低値で補正しない。
- score=1を強さ.5へ変換。Noulにconfidenceがあると仮定しない。
- 必須回答欠損、未知choice、NaN、401、429、timeout。
- 手書き計画ではfetch 0回。Jev経路では質問7個が1つのリクエストに入る。
- キャッシュが別のprompt・model・質問versionへ誤流用されない。
- キーがブラウザ引数・レポート・キャッシュに出ない。

```sh
npx playwright test --config playwright.ardy.config.ts test/jev-motion-plan.spec.ts
node scripts/ardy-generate.ts --help
```

APIキー未設定でもモックテストを完成させる。実API未検証ならそう報告する。
