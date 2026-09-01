---
name: irodori-tts
description: >-
  Generate Japanese speech audio (.wav) with voice cloning and text-prompted Voice Design using Irodori-TTS.
  Use this skill whenever you need to synthesize character dialogue voices, scenario lines,
  voice acting audio files, create new voices from descriptions, or batch generate speech for VRM avatars/games.
---

# Irodori-TTS Speech Synthesis & Voice Design Skill

This skill provides step-by-step instructions and executable tools to synthesize high-quality Japanese voice audio using **Irodori-TTS** (`Aratako/Irodori-TTS-v4.1-Small` or `Aratako/Irodori-TTS-500M-v2`).

It supports:
1. **Zero-shot Voice Cloning**: Clone any voice identity from a reference audio file (`--ref-wav`).
2. **Text-Prompted Voice Design**: Create new voices purely from natural language description (`--caption` with `--no-ref`).
3. **Style/Emotion-Controlled Voice Cloning**: Retain a speaker's voice identity while altering mood, emotion, whisper, screaming, or crying via prompt (`--ref-wav` + `--caption`).
4. **Fast Batch Generation**: Synthesize entire game scenario dialogues in one pass with `--batch-json`.

---

## 🚀 Environment & Paths

- **Repository Path**: `/Users/ueda/git/practice/tts/Irodori-TTS`
- **Python Virtualenv**: `/Users/ueda/git/practice/tts/Irodori-TTS/.venv/bin/python`
- **Helper Script**: `.agents/skills/irodori-tts/scripts/synthesize.py`
- **Default Checkpoint**: `Aratako/Irodori-TTS-v4.1-Small` (supports 3-branch conditioning: Text + Voice Clone + Voice Design)

---

## 🎙 1. Simple Voice Cloning (from Reference Audio)

Synthesize speech matching the exact speaker identity of the reference `.wav`:

```bash
/Users/ueda/git/practice/tts/Irodori-TTS/.venv/bin/python \
  .agents/skills/irodori-tts/scripts/synthesize.py \
  --ref-wav "public/voices/001.wav" \
  --text "あ、来てくれたんだ！急に呼び出したりして、ごめんね。" \
  --output-wav "public/voices/dialogue_01.wav" \
  --device mps
```

---

## 🎨 2. Voice Design (Text-Prompted Style & Emotion Control)

### Mode A: Style-Controlled Voice Cloning (`--ref-wav` + `--caption`)
Keep the original speaker's timbre, but direct their acting/emotion (e.g. crying, anger, whispering, joyful):

```bash
/Users/ueda/git/practice/tts/Irodori-TTS/.venv/bin/python \
  .agents/skills/irodori-tts/scripts/synthesize.py \
  --ref-wav "public/voices/001.wav" \
  --caption "深く傷つき、今にも泣き出しそうな様子。声が震えており、悲痛なトーンで弱々しく話す。" \
  --text "どうしてもっと早く教えてくれなかったの？私、ずっと待ってたのに……っ。" \
  --output-wav "public/voices/confess_crying.wav" \
  --device mps
```

### Mode B: Pure Voice Design without Reference (`--no-ref` + `--caption`)
Generate a brand-new character voice entirely from a descriptive prompt:

```bash
/Users/ueda/git/practice/tts/Irodori-TTS/.venv/bin/python \
  .agents/skills/irodori-tts/scripts/synthesize.py \
  --no-ref \
  --caption "落ち着いた女性の声で、近い距離感でやわらかく自然に読み上げてください。" \
  --text "こんにちは。本日もお疲れ様でした。" \
  --output-wav "public/voices/calm_lady.wav" \
  --device mps
```

### 💡 Effective Caption Prompt Examples:
- **歓喜・告白成功**: `「満面の笑みで飛び跳ねるように大喜びしている。声が高揚しており、弾けるような明るく愛らしいトーン」`
- **怒り・ツンデレ**: `「少し怒ったように語気を強めつつ、照れ隠しで早口にまくしたてるツンデレな少女の声」`
- **囁き・内緒話**: `「耳元で囁くようなウィスパーボイス。息成分が多く、吐息混じりの親密で静かなトーン」`
- **ショック・動揺**: `「予期せぬ事態に激しく動揺し、言葉に詰まりながら途切れ途切れに話す様子」`

---

## 📦 3. Fast Batch Synthesis (Full Game Scenarios)

Synthesize all dialogue lines for a scenario in a single run. The model loads **once** and processes each line in sequence.

### Batch JSON Format (`scratch/scenario_lines.json`):
```json
[
  {
    "id": "intro_1",
    "text": "あ、来てくれたんだ！急に呼び出したりして、ごめんね。",
    "caption": "少し緊張しながらも嬉しそうに微笑む明るいトーン",
    "output": "public/voices/confess_intro_1.wav"
  },
  {
    "id": "route_love_1",
    "text": "やったーっ！ え……！？ ほんとに……！？ 夢じゃないよね……！？",
    "caption": "飛び上がるほど大喜びし、感極まって声が弾んでいるトーン",
    "output": "public/voices/confess_love_1.wav"
  },
  {
    "id": "route_money_2",
    "text": "そ、そんな理由でこんな呼び出しに応じたの……！？ 私の心の準備とドキドキを返してよー！！",
    "caption": "激怒してぷんぷんと怒鳴りつけるようなコミカルな怒り声",
    "output": "public/voices/confess_money_2.wav"
  }
]
```

### Execute Batch Command:
```bash
/Users/ueda/git/practice/tts/Irodori-TTS/.venv/bin/python \
  .agents/skills/irodori-tts/scripts/synthesize.py \
  --ref-wav "public/voices/001.wav" \
  --batch-json "scratch/scenario_lines.json" \
  --device mps
```

---

## 🎛 4. Tuning Parameters

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `--caption` | `None` | Prompt string controlling vocal characteristics, emotion, age, or delivery. |
| `--num-steps` | `35` | Diffusion Euler sampling steps (30-40 recommended). |
| `--duration-scale` | `1.0` | Output speed/duration scaling (`> 1.0` slower, `< 1.0` faster). |
| `--cfg-scale-text` | `3.0` | Guidance strength for pronunciation and text accuracy. |
| `--cfg-scale-caption` | `3.0` | Guidance strength for matching the Voice Design caption. |
| `--cfg-scale-speaker` | `5.0` | Guidance strength for matching the reference speaker's voice timbre. |
| `--hf-checkpoint` | `Aratako/Irodori-TTS-v4.1-Small` | Model weights repository. |
