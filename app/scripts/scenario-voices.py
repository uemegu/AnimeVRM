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
SCEN = os.path.join(REPO, 'app/public/scenarios')
CATEGORIES = ['morning', 'action', 'holiday', 'forced', 'ending']

REFS = {
    'aoi': f'{REPO}/public/voices/001.wav',
    'emili': f'{REPO}/public/voices/trio_intro_2.wav',
    'shion': f'{REPO}/public/voices/girl4_ref.wav',
    'god': f'{REPO}/scratch/god_exp_02_god_raw.wav',
    'teacher': f'{REPO}/public/voices/teacher/sample_03_cool_strict.wav',
    'naruse': f'{REPO}/public/voices/naruse_ref.wav',
    'yui': f'{REPO}/public/voices/yui_ref.wav',
    'kana': f'{REPO}/public/voices/kana_ref.wav',
    'sp_leader': f'{REPO}/public/voices/sp_leader_ref.wav',
    'sp_member': f'{REPO}/public/voices/sp_member_ref.wav',
    'shopkeeper': f'{REPO}/public/voices/shopkeeper_ref.wav',
}

BASE = {
    'aoi': '穏やかで優しい、清楚な幼馴染の女子高校生の声。',
    'emili': '天真爛漫で元気いっぱいな、お嬢様の女子高校生の声。',
    'shion': 'ダウナーでクールな、気だるげで低めの女子高校生の声。',
    'god': '神々しく威厳のある女神の声。理不尽でせっかちな一面もある。',
    'teacher': 'クールで厳格な、若い女性教師の声。',
    'naruse': 'お調子者で自信満々な男子高校生の声。',
    'yui': '噂話が大好きな、はしゃいだ女子高校生の声。',
    'kana': '少しクールで気だるげな女子高校生の声。',
    'sp_leader': '低く威厳のある、軍人のようなSP部隊の隊長の声。',
    'sp_member': '屈強なSP部隊員の、張りのある男性の声。',
    'shopkeeper': '陽気な商店街のおじさんの声。',
}

MOOD = {
    'happy': '明るく嬉しそうに、弾むようなトーンで話す。',
    'relaxed': '柔らかく穏やかに、少し照れながら親しげに話す。',
    'sad': '少し寂しそうに、しおらしく弱々しいトーンで話す。',
    'angry': '語気を強めて、怒ったように話す。',
    'surprised': '驚いて動揺し、声が上ずる。',
    'neutral': '自然な会話のトーンで話す。',
}

# 画面にいない人物の名前 → 声
VOICE_NAMES = {
    '女神の声': 'god', 'エミリの声': 'emili', '白石先生': 'teacher',
    '黒服リーダー': 'sp_leader', '黒服の男': 'sp_leader', '黒服たち': 'sp_member',
    '黒服A': 'sp_member', '黒服B': 'sp_member', '商店街のおじさん': 'shopkeeper',
}


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
            caption = BASE[who] + '周りに聞こえないよう、小声で囁くように話す。'
        if text.count('！') >= 2:
            caption += '感情が高ぶり、大きな声で叫ぶ。'
        items.append({'id': fname, 'text': tts_text(text), 'ref_wav': REFS[who], 'caption': caption, 'output': raw})
    json.dump(items, open(out_json, 'w'), ensure_ascii=False, indent=1)
    print(len(items), 'lines to synthesize')


def attach():
    import numpy as np
    import scipy.signal
    import soundfile as sf

    def divine_reverb(audio, sr, decay=2.3, wet=0.45):
        rng = np.random.default_rng(0)
        n = int(sr * decay)
        t = np.linspace(0, decay, n, endpoint=False)
        ir = rng.standard_normal(n) * np.exp(-3.2 * t / decay)
        for d, g in zip([0.032, 0.058, 0.086, 0.124, 0.168], [0.55, 0.42, 0.32, 0.22, 0.14]):
            ir[int(d * sr)] += g
        ir /= np.max(np.abs(ir)) + 1e-9
        rev = scipy.signal.fftconvolve(audio, ir, mode='full')[: len(audio) + int(sr * 1.4)]
        mixed = (1 - wet) * np.pad(audio, (0, len(rev) - len(audio))) + wet * rev
        peak = np.max(np.abs(mixed))
        return mixed / peak * 0.95 if peak > 0.95 else mixed

    by_file = {}
    attached = missing = 0
    for path, scene, who, _, _, fname in lines():
        out = os.path.join(os.path.dirname(path), fname)
        raw = out + '.raw.wav'
        if who == 'god' and os.path.exists(raw) and not os.path.exists(out):
            audio, sr = sf.read(raw)
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            sf.write(out, divine_reverb(audio, sr), sr)
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
