"""
『5秒の告白』の演出台本（app/scenarios/script/*.txt）を scenario.json に変換する。
原稿（/Users/ueda/git/novels/5秒の告白/manuscript）に演出（カメラ・モーション・背景）を付けたもの。
  python3 app/scripts/compile-script.py            # 全部
  python3 app/scripts/compile-script.py aoi_d01    # ID に含む文字列で絞る
既存の scenario.json にある voiceUrl は、同じシーン ID・同じ本文なら引き継ぐ。
"""
import json
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(REPO, 'app', 'scenarios', 'script')
OUT = os.environ.get('OUT') or os.path.join(REPO, 'assets', 'scenarios')

BOOK = json.load(open(os.path.join(REPO, 'assets/studio/characters.json')))
LOCATIONS = json.load(open(os.path.join(REPO, 'assets/studio/locations.json')))['presets']


def find_seat(name):
    """席（locations.json の seats）。'library_desk' のように席の ID だけで引く"""
    for loc_id, loc in LOCATIONS.items():
        seat = (loc.get('seats') or {}).get(name)
        if seat:
            return loc_id, seat
    raise ValueError(f'unknown seat {name}')
NAMES = {c['id']: c['name']['ja'] for c in BOOK['characters']}


def parse_value(v):
    v = v.strip()
    if v == '':
        return True
    if re.fullmatch(r'-?\d+', v):
        return int(v)
    if re.fullmatch(r'-?\d+\.\d+', v):
        return float(v)
    if v.startswith('['):
        return json.loads(v)
    return v


def split_directives(line):
    """'本文 {a=1; b}' → ('本文', {'a': 1, 'b': True})"""
    m = re.search(r'\{([^{}]*)\}\s*$', line)
    if not m:
        return line.strip(), {}
    body = line[: m.start()].rstrip()
    d = {}
    for part in m.group(1).split(';'):
        part = part.strip()
        if not part:
            continue
        if '=' in part:
            k, v = part.split('=', 1)
            d[k.strip()] = parse_value(v)
        else:
            d[part] = True
    return body, d


def parse_affinity(v):
    out = {}
    for part in str(v).split(','):
        k, n = part.split(':')
        out[k.strip()] = int(n)
    return out


def parse_condition(opts):
    cond = {}
    for key in ('cond',):
        if key in opts:
            for part in str(opts[key]).split(','):
                part = part.strip()
                m = re.fullmatch(r'(\w+)>=(-?\d+)', part)
                if m:
                    cond.setdefault('minAffinity', {})[m.group(1)] = int(m.group(2))
                elif part.startswith('!'):
                    cond.setdefault('unlessFlags', []).append(part[1:])
                else:
                    cond.setdefault('requireFlags', []).append(part)
    return cond or None


def flags_of(v):
    return {f.strip(): True for f in str(v).split(',') if f.strip()}


AVATAR_KEYS = {
    'expr': 'expression', 'pos': 'position', 'motion': 'motion', 'look': 'lookAtTarget', 'turn': 'headTurn',
    'rot': 'rotationY', 'model': 'modelUrl', 'speed': 'motionSpeed', 'sweat': 'sweat', 'sprite': 'sprite',
}


def apply_directives(scene, d, meta):
    d = {**d, '_keys': tuple(d)}
    for k, v in d.items():
        if k == '_keys':
            continue
        if '.' in k:
            who, attr = k.split('.', 1)
            av = scene.setdefault('avatars', {}).setdefault(who, {})
            seated = meta.setdefault('_seated', {})
            if attr == 'seat':
                # 席に座る（位置・向き・座りのモーションは席の設定から。カメラは座っている間、席のカメラになる）
                _, seat = find_seat(v)
                av['position'] = seat['position']
                av['rotationY'] = seat.get('rotationY', 0)
                av['motion'] = seat['motion']
                seated[who] = seat
                continue
            if attr == 'pos' or attr == 'out':
                seated.pop(who, None)
            elif attr == 'motion' and who in seated and not {f'{who}.seat', f'{who}.pos', f'{who}.out'} & set(d['_keys']):
                raise ValueError(f'{who} は席に座ったまま motion を変えています（立たせるなら {who}.pos も指定）: {v}')
            if attr == 'expr':
                av['expression'] = v
                av['expressionWeight'] = 1
            elif attr == 'out':
                av['visible'] = False
            elif attr == 'loop':
                av['motionLoop'] = True
            elif attr == 'once':
                av['motionLoop'] = False
            elif attr in ('blush', 'anger', 'tears', 'fastMotion'):
                av[attr] = bool(v) if v is not True else True
                if v == 0:
                    av[attr] = False
            elif attr == 'fast':
                av['fastMotion'] = v is True or bool(v)
            elif attr == 'item':
                # 手に持つ小物（off で手放す。item=can_coffee@left で持つ手を指定）
                if v == 'off':
                    av['heldItem'] = False
                elif '@' in str(v):
                    item, hand = v.split('@')
                    av['heldItem'] = {'item': item, 'hand': hand}
                else:
                    av['heldItem'] = v
            elif attr == 'wander':
                av['eyeWander'] = True if v is True else v
            elif attr == 'fx':
                if isinstance(v, str) and ':' in v:
                    p, t = v.split(':', 1)
                    av['effectText'] = {'preset': p, 'text': t}
                else:
                    av['effectText'] = v
            elif attr in AVATAR_KEYS:
                av[AVATAR_KEYS[attr]] = v
            else:
                raise ValueError(f'unknown avatar directive {k}')
            continue
        if k == 'cam':
            scene['camera'] = v
            meta['_cam'] = v
        elif k == 'shift':
            scene['cameraShift'] = v
        elif k == 'campose':
            # campose=[位置x, y, z, 注視点x, y, z, 画角]
            scene['cameraPose'] = {'position': v[0:3], 'target': v[3:6], **({'fov': v[6]} if len(v) > 6 else {})}
        elif k == 'bg':
            scene['background'] = v
        elif k == 'time':
            scene['timeOfDay'] = v
        elif k == 'bgm':
            scene['bgm'] = v
        elif k == 'se':
            scene['seUrl'] = v
        elif k == 'focus':
            scene['focusLines'] = True
        elif k == 'trans':
            scene['screenTransition'] = v
        elif k == 'flash':
            scene['flashEffect'] = 'white'
        elif k == 'clear':
            scene['clearCast'] = True
            meta['_seated'] = {}
        elif k == 'scroll':
            if v == 'off':
                scene['scrollingBackground'] = False
            elif v is True:
                scene['scrollingBackground'] = {}
            else:
                scene['scrollingBackground'] = {'speed': v}
        elif k in ('cg', 'cutin'):
            if v == 'off':
                scene[k] = False
            elif k == 'cutin' and isinstance(v, str) and '@' in v:
                url, side = v.split('@')
                scene[k] = {'url': url, 'side': side}
            else:
                scene[k] = v
        elif k == 'rain':
            scene['rain'] = v != 'off'
        elif k == 'flags':
            scene.setdefault('setFlags', {}).update(flags_of(v))
        elif k == 'auto':
            scene['autoNextSec'] = v
        elif k == 'ambience':
            scene['ambience'] = False if v == 'off' else v
        elif k == 'name':
            scene['speaker'] = v
        elif k == 'timeout':
            scene.setdefault('choiceTimeout', {})['seconds'] = v
        elif k == 'timeout_goto':
            scene.setdefault('choiceTimeout', {})['goto'] = v
        elif k == 'timeout_flags':
            scene.setdefault('choiceTimeout', {})['setFlags'] = flags_of(v)
        elif k == 'if':
            scene['condition'] = parse_condition({'cond': v})
        elif k == 'fallback_choice':
            scene['choiceFallback'] = 'highest_affinity'
        elif k == 'effects':
            scene['effects'] = json.loads(v) if isinstance(v, str) else v
        else:
            raise ValueError(f'unknown directive {k}')


def parse_option(line):
    """> id | 本文 | goto | key=val | ..."""
    parts = [p.strip() for p in line[1:].split('|')]
    cid, text, goto = parts[0], parts[1], parts[2] if len(parts) > 2 else ''
    opts = {}
    for p in parts[3:]:
        if '=' in p:
            k, v = p.split('=', 1)
            opts[k.strip()] = v.strip()
        elif p:
            opts[p] = True
    choice = {'id': cid, 'text': text}
    if goto:
        choice['goto'] = goto
    if 'flags' in opts:
        choice['setFlags'] = flags_of(opts['flags'])
    if 'aff' in opts:
        choice['addAffinity'] = parse_affinity(opts['aff'])
    cond = parse_condition(opts)
    if cond:
        choice['condition'] = cond
    return choice, opts


def parse_units(text):
    units = []
    cur = None
    for raw in text.split('\n'):
        if raw.startswith('=== '):
            m = re.match(r'=== (\w+) (\S+)\s*\|\s*(.+)$', raw)
            cur = {'category': m.group(1), 'id': m.group(2), 'title': m.group(3).strip(), 'meta': {}, 'hints': [], 'body': [], 'in_body': False}
            units.append(cur)
            continue
        if cur is None:
            continue
        if not cur['in_body']:
            if raw.strip() == '---':
                cur['in_body'] = True
            elif ':' in raw:
                k, v = raw.split(':', 1)
                k = k.strip()
                if k == 'hint':
                    cur['hints'].append(v.strip())
                else:
                    cur['meta'][k] = v.strip()
            continue
        cur['body'].append(raw)
    return units


def speaker_line(line):
    """'aoi: 本文' → ('aoi', '本文')。': 本文' は地の文"""
    m = re.match(r'^([a-z_]*)\s*:\s?(.*)$', line)
    if not m:
        return None
    return m.group(1), m.group(2)


def common_meta(u):
    data = {'id': u['id'], 'title': {'ja': u['title']}}
    meta = u['meta']
    if 'priority' in meta:
        data['priority'] = parse_value(meta['priority'])
    if 'avail' in meta:
        data['availability'] = json.loads(meta['avail'])
    return data


def build_story(u):
    meta = u['meta']
    data = common_meta(u)
    for key, target in (('location', 'location'), ('bgm', 'bgm'), ('time', 'timeOfDay'), ('ambience', 'ambience')):
        if key in meta:
            data[target] = meta[key]
    if meta.get('consumesTurn') == 'true':
        data['consumesTurn'] = True
    if meta.get('fallback') == 'true':
        data['fallback'] = True
    if 'description' in meta:
        data['description'] = meta['description']
    if u['hints']:
        hints = []
        for h in u['hints']:
            loc, chars, txt = [p.strip() for p in h.split('|')]
            hint = {'locationId': loc}
            if chars:
                hint['hintCharacterIds'] = [c.strip() for c in chars.split(',')]
            if txt:
                hint['hintText'] = {'ja': txt}
            hints.append(hint)
        data['actionHints'] = hints
    # 本文
    scenes = []
    pending = {}
    label = None
    n = 0

    def new_scene(text, speaker=None, d=None):
        nonlocal label, n, pending
        n += 1
        scene = {'id': label or f's{n}'}
        label = None
        if speaker:
            scene['speakerCharacterId'] = speaker
            scene['speaker'] = NAMES.get(speaker, speaker)
        scene['text'] = text
        apply_directives(scene, pending, meta)
        pending = {}
        if d:
            apply_directives(scene, d, meta)
        # 座っているキャラがいれば、カメラは席のカメラ（構図の自動決定は立ち姿の高さで撮るため）
        seated = meta.get('_seated') or {}
        if seated and 'cameraPose' not in scene:
            seat = next(iter(seated.values()))
            cams = seat.get('cameras') or {}
            shot = meta.get('_cam', 'medium')
            pose = cams.get(shot) or cams.get('medium')
            if pose:
                scene['cameraPose'] = pose
        scenes.append(scene)
        return scene

    for raw in u['body']:
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        s = line.strip()
        if s.startswith('@'):
            _, d = split_directives('x ' + s[1:].strip() if s[1:].strip().startswith('{') else 'x {' + s[1:].strip() + '}')
            pending.update(d)
            continue
        if s.startswith('*'):
            label = s[1:].strip()
            continue
        if s.startswith('->'):
            target = s[2:].strip()
            if target == 'end':
                scenes[-1]['end'] = True
            else:
                scenes[-1]['nextSceneId'] = target
            continue
        if s.startswith('?'):
            _, d = split_directives('x ' + s[1:].strip())
            sc = new_scene('', None, d)
            sc['choices'] = []
            continue
        if s.startswith('>'):
            choice, _ = parse_option(s)
            scenes[-1]['choices'].append(choice)
            continue
        sp = speaker_line(s)
        if sp is None:
            raise ValueError(f'{u["id"]}: cannot parse line: {s}')
        who, rest = sp
        text, d = split_directives(rest)
        try:
            new_scene(text, who or None, d)
        except ValueError as err:
            raise ValueError(f'{u["id"]}: {err}\n  行: {s}') from None
    # 選択肢の goto 省略は「次のシーン」
    for i, sc in enumerate(scenes):
        for c in sc.get('choices', []):
            if 'goto' not in c:
                c['goto'] = scenes[i + 1]['id']
    # スピーカー名：表示名を省くと app は話者IDから名前を出さないので、明示する
    data['scenes'] = scenes
    return data


def build_call(u):
    meta = u['meta']
    data = common_meta(u)
    data['characterId'] = meta['character']
    if 'model' in meta:
        data['modelUrl'] = meta['model']
    if meta.get('audioOnly') == 'true':
        data['audioOnly'] = True
    steps = {}
    order = []
    label = None
    n = 0
    pending = {}
    for raw in u['body']:
        s = raw.strip()
        if not s or s.startswith('#'):
            continue
        if s.startswith('@'):
            _, d = split_directives('x {' + s[1:].strip() + '}')
            pending.update(d)
            continue
        if s.startswith('*'):
            label = s[1:].strip()
            continue
        if s.startswith('->'):
            target = s[2:].strip()
            steps[order[-1]]['nextStepId'] = None if target == 'end' else target
            continue
        if s.startswith('?'):
            n += 1
            sid = label or f'c{n}'
            label = None
            steps[sid] = {'id': sid, 'speaker': '', 'text': '', 'choices': []}
            order.append(sid)
            continue
        if s.startswith('>'):
            choice, _ = parse_option(s)
            steps[order[-1]]['choices'].append(choice)
            continue
        who, rest = speaker_line(s)
        text, d = split_directives(rest)
        d = {**pending, **d}
        pending = {}
        n += 1
        sid = label or f'step_{n}'
        label = None
        step = {'id': sid, 'speaker': NAMES.get(who, '') if who else '', 'text': {'ja': text}}
        if 'expr' in d:
            step['expression'] = d['expr']
            step['expressionWeight'] = 1
        if 'motion' in d:
            step['motion'] = d['motion']
        steps[sid] = step
        order.append(sid)
    # つながり：明示がなければ次のステップ、最後は終了
    for i, sid in enumerate(order):
        st = steps[sid]
        for c in st.get('choices', []):
            c['text'] = {'ja': c['text']}
            if 'goto' not in c:
                c['goto'] = order[i + 1]
        if 'choices' in st:
            continue
        if 'nextStepId' not in st:
            st['nextStepId'] = order[i + 1] if i + 1 < len(order) else None
    data['initialStepId'] = order[0]
    data['steps'] = steps
    return data


def mail_content(text):
    """'本文 [stamp=/x.avif; retract=1.5]' → メッセージの中身"""
    m = re.search(r'\[([^\[\]]*)\]\s*$', text)
    d = {}
    body = text.strip()
    if m:
        body = text[: m.start()].strip()
        _, d = split_directives('x {' + m.group(1) + '}')
    out = {}
    if body:
        out['text'] = {'ja': body}
    if 'stamp' in d:
        out['stamp'] = d['stamp']
    if 'image' in d:
        out['image'] = d['image']
    if 'retract' in d:
        out['retractAfterSec'] = d['retract']
    return out


def build_mail(u):
    meta = u['meta']
    data = common_meta(u)
    data['characterId'] = meta['character']
    data['previewText'] = {'ja': meta['preview']}
    data['time'] = meta['time']
    messages = []
    options = []
    for raw in u['body']:
        if not raw.strip() or raw.strip().startswith('#'):
            continue
        s = raw.strip()
        if s.startswith('>'):
            choice, opts = parse_option(s)
            opt = {'id': choice['id'], 'text': {'ja': choice['text']}, 'reactions': []}
            for k in ('setFlags', 'addAffinity', 'condition'):
                if k in choice:
                    opt[k] = choice[k]
            options.append(opt)
            continue
        m = re.match(r'^(\w+)(?:\s+(\d\d:\d\d))?\s*:\s?(.*)$', s)
        who, time, text = m.group(1), m.group(2), m.group(3)
        content = mail_content(text)
        if raw.startswith('  ') and options:
            if time:
                content['time'] = time
            options[-1]['reactions'].append(content)
        else:
            messages.append({'id': f'm{len(messages) + 1}', 'sender': 'player' if who == 'player' else 'heroine', **content, 'time': time or meta['time']})
    data['messages'] = messages
    if options:
        data['replyOptions'] = options
    return data


MISSING = set()


def asset_exists(url):
    return os.path.exists(os.path.join(REPO, 'assets', url.lstrip('/')))


def drop_missing_images(data):
    """まだ描いていない一枚絵・カットイン・スタンプ・写真は外す（描けたら作り直すと入る）"""
    for scene in data.get('scenes', []):
        for key in ('cg', 'cutin'):
            v = scene.get(key)
            url = v if isinstance(v, str) else (v or {}).get('url') if isinstance(v, dict) else None
            if url and not asset_exists(url):
                MISSING.add(url)
                del scene[key]
    def fix(m):
        for key in ('stamp', 'image'):
            if m.get(key) and not asset_exists(m[key]):
                MISSING.add(m[key])
                del m[key]
                m.pop('retractAfterSec', None)
        return m.get('text') or m.get('stamp') or m.get('image')
    if 'messages' in data:
        data['messages'] = [m for m in data['messages'] if fix(m)]
        for i, m in enumerate(data['messages']):
            m['id'] = f'm{i + 1}'
        for r in data.get('replyOptions', []):
            r['reactions'] = [m for m in r.get('reactions', []) if fix(m)]
            if not r['reactions']:
                del r['reactions']


def carry_voices(path, data):
    """既存ファイルの voiceUrl を、同じ ID・同じ本文なら引き継ぐ"""
    if not os.path.exists(path):
        return
    old = json.load(open(path))
    text = lambda t: t if isinstance(t, str) else (t or {}).get('ja', '')
    if 'scenes' in old and 'scenes' in data:
        prev = {s['id']: s for s in old['scenes']}
        for s in data['scenes']:
            o = prev.get(s['id'])
            if o and o.get('voiceUrl') and text(o.get('text')) == text(s.get('text')) and o.get('speakerCharacterId') == s.get('speakerCharacterId'):
                s['voiceUrl'] = o['voiceUrl']
    if 'steps' in old and 'steps' in data:
        for sid, s in data['steps'].items():
            o = old['steps'].get(sid)
            if o and o.get('voiceUrl') and text(o.get('text')) == text(s.get('text')):
                s['voiceUrl'] = o['voiceUrl']


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    count = 0
    for fname in sorted(os.listdir(SRC)):
        if not fname.endswith('.txt'):
            continue
        for u in parse_units(open(os.path.join(SRC, fname)).read()):
            if only and only not in u['id']:
                continue
            cat = u['category']
            data = build_call(u) if cat == 'call' else build_mail(u) if cat == 'mail' else build_story(u)
            d = os.path.join(OUT, cat, u['id'])
            os.makedirs(d, exist_ok=True)
            path = os.path.join(d, 'scenario.json')
            drop_missing_images(data)
            carry_voices(path, data)
            with open(path, 'w') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write('\n')
            count += 1
    print(f'{count} scenarios written')
    with open(os.path.join(REPO, 'scratch', 'missing_images.txt'), 'w') as f:
        f.write('\n'.join(sorted(MISSING)) + ('\n' if MISSING else ''))
    if MISSING:
        print(f'{len(MISSING)} images not drawn yet (left out): scratch/missing_images.txt')


if __name__ == '__main__':
    main()
