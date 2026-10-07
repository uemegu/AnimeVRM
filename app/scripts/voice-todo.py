"""
ボイスが未生成のセリフを app/scenarios/voice_todo.md に書き出す（原稿・台本を直して本文が変わった行、新しい行）。
  python3 app/scripts/voice-todo.py
声を付けないもの（主人公・地の文）は除く。電話・メールは相手のヒロインのセリフだけ。
"""
import collections
import glob
import json
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
book = json.load(open(os.path.join(REPO, 'assets/studio/characters.json')))
names = {c['id']: c['name']['ja'] for c in book['characters']}
todo = collections.OrderedDict()
for f in sorted(glob.glob(os.path.join(REPO, 'assets/scenarios/*/*/scenario.json'))):
    cat, sid = f.split(os.sep)[-3:-1]
    if cat == 'demo':
        continue
    s = json.load(open(f))
    rows = []
    for sc in s.get('scenes', []):
        sp = sc.get('speakerCharacterId')
        if sp and sp != 'player' and not sc.get('voiceUrl') and (sc.get('text') or '').strip():
            rows.append((sc['id'], names.get(sp, sp), sc['text']))
    hero = names.get(s.get('characterId'))
    for k, st in (s.get('steps') or {}).items():
        t = st.get('text')
        t = t.get('ja') if isinstance(t, dict) else t
        if st.get('speaker') == hero and not st.get('voiceUrl') and (t or '').strip():
            rows.append((k, hero, t))
    if rows:
        todo[f'{cat}/{sid}'] = rows
n = sum(len(v) for v in todo.values())
out = ['# ボイス ToDo（未生成のセリフ）', '',
       '原稿・台本を直して本文が変わったセリフと、新しく足したセリフ。最後に `app/scripts/scenario-voices.py` で一括生成する（話者・声の方針は `5byou_resources.md` の 1）。',
       '一覧は `python3 app/scripts/voice-todo.py` で作り直す。', '',
       '## 一覧の外でやること', '',
       '- ナルセ：参照音声（`assets/voices/naruse_ref.mp3`）を差し替えた（元の声がひどかったため）。既存のナルセのボイスは全部この参照音声で作り直す（未生成の行だけでなく、生成済みの行も対象）。', '',
       '## 生成のしかた（Colab でバッチ生成）', '',
       '前回（2026-10-04、全794件）と同じく、Colab の Irodori-TTS v4-Large で一括生成して取り込む。前回のセット一式は `scratch/novel/voice/colab-full/`（手順は同ディレクトリの `README.txt`・`verification.txt`）。', '',
       '1. 生成対象を決める：この一覧の行 ＋ ナルセの全セリフ（生成済みも含む）。',
       '2. 前回のセットを元に入力ZIPを作り直す（`batch.tsv`・`refs/`・`package.json`・`colab_runner.py`、ノートブック `5byou_Irodori_v4_Large_MP3_Colab.ipynb`）。',
       '   - `batch.tsv` は前回の794件分なので、今回の対象で作り直す（列・caption・絵文字の付け方は前回の `voice-list.tsv` に合わせる）。',
       '   - `refs/` は `assets/voices/*_ref.mp3` から入れ直す。前回の `refs/naruse.mp3` は差し替え前の古い声なので使わない。',
       '   - `package.json` の `batch_id` とノートブックの `EXPECTED_BATCH_ID` を新しい値でそろえる。',
       '3. Colab（GPU）でノートブックを上から実行し、`5byou_voice_results.zip` をダウンロードする。',
       '4. プロジェクトのルートで取り込む：',
       '   - `unzip -o ~/Downloads/5byou_voice_results.zip -d .`',
       '   - `/Users/ueda/git/practice/tts/Irodori-TTS/.venv/bin/python app/scripts/scenario-voices.py attach`',
       '5. `python3 app/scripts/voice-todo.py` で一覧を作り直し、残りがないことを確かめる。済んだら「一覧の外でやること」のナルセの行をこのスクリプトから消す。', '',
       f'計 {n} 行・{len(todo)} 本', '']
for k, rows in todo.items():
    out.append(f'## {k}（{len(rows)}）')
    out += [f'- `{i}` {sp}「{t}」' for i, sp, t in rows]
    out.append('')
open(os.path.join(REPO, 'app/scenarios/voice_todo.md'), 'w').write('\n'.join(out))
print(f'{n} lines in {len(todo)} scenarios')
