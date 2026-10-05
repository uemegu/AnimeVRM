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
       '一覧は `python3 app/scripts/voice-todo.py` で作り直す。', '', f'計 {n} 行・{len(todo)} 本', '']
for k, rows in todo.items():
    out.append(f'## {k}（{len(rows)}）')
    out += [f'- `{i}` {sp}「{t}」' for i, sp, t in rows]
    out.append('')
open(os.path.join(REPO, 'app/scenarios/voice_todo.md'), 'w').write('\n'.join(out))
print(f'{n} lines in {len(todo)} scenarios')
