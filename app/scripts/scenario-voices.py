"""
シナリオのセリフに Irodori-TTS のボイスを付ける（.agents/skills/irodori-tts を使う）。
  1. python3 app/scripts/scenario-voices.py plan <batch.json>
       … ボイスのないセリフの一覧（Irodori-TTS のバッチJSON）を作る
  2. .agents/skills/irodori-tts の synthesize.py --batch-json <batch.json> で合成
  3. <Irodori-TTS の python> app/scripts/scenario-voices.py attach
       … 生成した wav を mp3 に変換して scenario.json の voiceUrl に結びつける（女神はリバーブ加工）
ファイル名はセリフ本文のハッシュ付きなので、本文を直したセリフだけ作り直しになる。
話者ごとの参照音声は REFS。新しいキャラはボイスデザイン（--no-ref + caption）で参照音声を作ってから加える。
"""
import hashlib
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCEN = os.path.join(REPO, 'assets/scenarios')
CATEGORIES = ['morning', 'action', 'holiday', 'forced', 'ending']

# 話者ごとの参照音声・声の説明・表情ごとの演技指示は Studio と共有する JSON にある
PROFILES = json.load(open(os.path.join(REPO, 'assets/studio/voice-profiles.json')))
REFS = {k: os.path.join(REPO, v['ref']) for k, v in PROFILES['speakers'].items()}
BASE = {k: v['caption'] for k, v in PROFILES['speakers'].items()}
MOOD = PROFILES['moods']
# 画面にいない人物の名前 → 声
VOICE_NAMES = PROFILES['speakerNames']
WHISPER = PROFILES['whisperCaption']
SHOUT = PROFILES['shoutCaption']


def speaker_of(scene):
    sid = scene.get('speakerCharacterId')
    if sid in REFS:
        return sid
    return VOICE_NAMES.get(scene.get('speaker', ''))


def tts_text(text):
    # 伏せ字の「◯」はピー音ネタとして「ピー」と読ませる
    return text.replace('◯', 'ピー')


def lines():
    """(scenario.json のパス, シーン, 話者, 表情, ファイル名)"""
    for cat in CATEGORIES:
        cat_dir = os.path.join(SCEN, cat)
        if not os.path.isdir(cat_dir):
            continue
        for sid in sorted(os.listdir(cat_dir)):
            path = os.path.join(cat_dir, sid, 'scenario.json')
            data = json.load(open(path))
            expr = {}
            for scene in data['scenes']:
                for who, av in (scene.get('avatars') or {}).items():
                    if 'expression' in av:
                        expr[who] = av['expression']
                who = speaker_of(scene)
                text = scene.get('text')
                text = text if isinstance(text, str) else (text or {}).get('ja', '')
                if not who or not text.strip():
                    continue
                digest = hashlib.sha1(f'{who}|{text}'.encode()).hexdigest()[:8]
                yield path, scene, who, expr.get(scene.get('speakerCharacterId') or '', 'neutral'), text, f"v_{scene['id']}_{digest}.wav"
    # 夜の電話
    call_dir = os.path.join(SCEN, 'call')
    for cid in sorted(os.listdir(call_dir)):
        path = os.path.join(call_dir, cid, 'scenario.json')
        data = json.load(open(path))
        for step in data['steps'].values():
            text = (step.get('text') or {}).get('ja', '')
            if not text.strip() or step.get('choices'):
                continue
            who = data['characterId']
            digest = hashlib.sha1(f'{who}|{text}'.encode()).hexdigest()[:8]
            yield path, step, who, step.get('expression', 'neutral'), text, f"v_{step['id']}_{digest}.wav"


def plan(out_json):
    items = []
    for path, scene, who, expression, text, fname in lines():
        out = os.path.join(os.path.dirname(path), fname)
        raw = out + '.raw.wav' if who == 'god' else out
        if os.path.exists(out) or os.path.exists(raw) or os.path.exists(out[:-4] + '.mp3'):
            continue
        caption = BASE[who] + MOOD.get(expression, MOOD['neutral'])
        if text.startswith('（'):
            caption = BASE[who] + WHISPER
        if text.count('！') >= 2:
            caption += SHOUT
        items.append({'id': fname, 'text': tts_text(text), 'ref_wav': REFS[who], 'caption': caption, 'output': raw})
    json.dump(items, open(out_json, 'w'), ensure_ascii=False, indent=1)
    print(len(items), 'lines to synthesize')


def attach():
    sys.path.insert(0, os.path.join(REPO, 'server/python'))
    from voice_effects import apply_file

    by_file = {}
    attached = missing = 0
    for path, scene, who, _, _, fname in lines():
        out = os.path.join(os.path.dirname(path), fname)
        raw = out + '.raw.wav'
        if who == 'god' and os.path.exists(raw) and not os.path.exists(out):
            apply_file('divine_reverb', raw, out)
        if os.path.exists(raw) and os.path.exists(out):
            os.remove(raw)
        # 配信用に mp3（モノラル 96kbps）へ変換する
        mp3 = out[:-4] + '.mp3'
        if os.path.exists(out) and not os.path.exists(mp3):
            import subprocess
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', out, '-ac', '1', '-b:a', '96k', mp3], check=True)
        if os.path.exists(mp3) and os.path.exists(out):
            os.remove(out)
        out, fname = mp3, fname[:-4] + '.mp3'
        data = by_file.setdefault(path, json.load(open(path)))
        target = data['steps'][scene['id']] if 'steps' in data else next(s for s in data['scenes'] if s['id'] == scene['id'])
        if os.path.exists(out):
            target['voiceUrl'] = fname
            attached += 1
        else:
            target.pop('voiceUrl', None)
            missing += 1
    for path, data in by_file.items():
        with open(path, 'w') as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    # 使われなくなった古いボイスを消す
    used = {
        os.path.join(os.path.dirname(p), s['voiceUrl'])
        for p, d in by_file.items()
        for s in (d['steps'].values() if 'steps' in d else d['scenes'])
        if s.get('voiceUrl')
    }
    removed = 0
    for cat in CATEGORIES + ['call']:
        for root, _, files in os.walk(os.path.join(SCEN, cat)):
            for f in files:
                if f.startswith('v_') and f.endswith(('.wav', '.mp3')) and not f.endswith('.raw.wav') and os.path.join(root, f) not in used:
                    os.remove(os.path.join(root, f))
                    removed += 1
    print(f'attached {attached}, missing {missing}, removed {removed}')


if __name__ == '__main__':
    if sys.argv[1] == 'plan':
        plan(sys.argv[2])
    else:
        attach()
