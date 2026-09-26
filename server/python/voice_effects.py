"""
生成したボイスの後処理。
  python voice_effects.py divine_reverb <入力.wav> <出力.wav>
Irodori-TTS の仮想環境の python（numpy / scipy / soundfile 入り）で動かす。
"""
import sys

import numpy as np
import scipy.signal
import soundfile as sf


def divine_reverb(audio, sr, decay=2.3, wet=0.45):
    """女神の声用の、広い空間に響くリバーブ"""
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


EFFECTS = {'divine_reverb': divine_reverb}


def apply_file(effect, src, dst):
    audio, sr = sf.read(src)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    sf.write(dst, EFFECTS[effect](audio, sr), sr)


if __name__ == '__main__':
    apply_file(sys.argv[1], sys.argv[2], sys.argv[3])
