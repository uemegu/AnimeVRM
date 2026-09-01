#!/usr/bin/env python3
"""
Irodori-TTS Synthesis Helper Script with Voice Design & Voice Cloning
Designed for Antigravity Skill: irodori-tts
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Add Irodori-TTS repository to Python path
IRODORI_REPO = Path("/Users/ueda/git/practice/tts/Irodori-TTS")
if str(IRODORI_REPO) not in sys.path:
    sys.path.insert(0, str(IRODORI_REPO))

try:
    from irodori_tts.inference_runtime import (
        InferenceRuntime,
        RuntimeKey,
        SamplingRequest,
        default_runtime_device,
        download_hf_checkpoint,
        resolve_cfg_scales,
        save_wav,
    )
except ImportError as e:
    print(f"[Error] Failed to import irodori_tts from {IRODORI_REPO}: {e}", file=sys.stderr)
    print(f"[Hint] Ensure Python is run via {IRODORI_REPO}/.venv/bin/python", file=sys.stderr)
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(description="Generate voice audio with Irodori-TTS & Voice Design")

    # Input modes (single text or batch JSON)
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--text", type=str, help="Text dialogue line to synthesize.")
    input_group.add_argument(
        "--batch-json",
        type=str,
        help="Path to JSON file containing list of lines: [{'text': '...', 'output': '...', 'caption': '...'}, ...]",
    )

    parser.add_argument(
        "--output-wav",
        type=str,
        default="output.wav",
        help="Output .wav path (used with --text). Default: output.wav",
    )
    parser.add_argument(
        "--ref-wav",
        type=str,
        default=None,
        help="Path to reference audio .wav file for voice cloning.",
    )
    parser.add_argument(
        "--no-ref",
        action="store_true",
        help="Run without reference audio (Pure Voice Design mode from caption text).",
    )
    parser.add_argument(
        "--caption",
        type=str,
        default=None,
        help="Voice Design prompt describing vocal style, mood, emotion, or persona (e.g. '落ち着いた女性の声で、近い距離感でやわらかく自然に')",
    )
    parser.add_argument(
        "--hf-checkpoint",
        type=str,
        default="Aratako/Irodori-TTS-v4.1-Small",
        help="Hugging Face model checkpoint repo id. Default: Aratako/Irodori-TTS-v4.1-Small",
    )
    parser.add_argument(
        "--codec-repo",
        type=str,
        default="Aratako/Semantic-DACVAE-Japanese-32dim",
        help="DACVAE codec repo. Default: Aratako/Semantic-DACVAE-Japanese-32dim",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="mps" if default_runtime_device() == "mps" else default_runtime_device(),
        help="Compute device (mps, cuda, cpu). Default: auto",
    )
    parser.add_argument(
        "--num-steps",
        type=int,
        default=35,
        help="Sampling steps (default: 35 for balance of speed and quality).",
    )
    parser.add_argument(
        "--duration-scale",
        type=float,
        default=1.0,
        help="Scale predicted duration (>1 longer, <1 shorter). Default: 1.0",
    )
    parser.add_argument(
        "--cfg-scale-text",
        type=float,
        default=3.0,
        help="CFG scale for text conditioning. Default: 3.0",
    )
    parser.add_argument(
        "--cfg-scale-caption",
        type=float,
        default=3.0,
        help="CFG scale for Voice Design caption conditioning. Default: 3.0",
    )
    parser.add_argument(
        "--cfg-scale-speaker",
        type=float,
        default=5.0,
        help="CFG scale for speaker conditioning. Default: 5.0",
    )
    parser.add_argument(
        "--cfg-guidance-mode",
        choices=["independent", "joint", "alternating"],
        default="independent",
        help="CFG formulation mode. Default: independent",
    )

    return parser.parse_args()


def get_runtime(checkpoint_path: str, codec_repo: str, device: str) -> InferenceRuntime:
    return InferenceRuntime.from_key(
        RuntimeKey(
            checkpoint=str(checkpoint_path),
            model_device=device,
            codec_repo=codec_repo,
            model_precision="fp32",
            codec_device=device,
            codec_precision="fp32",
            codec_deterministic_encode=True,
            codec_deterministic_decode=True,
            compile_model=False,
            compile_dynamic=False,
        )
    )


def synthesize_line(
    runtime: InferenceRuntime,
    text: str,
    ref_wav: str | None,
    caption: str | None,
    no_ref: bool,
    output_path: Path,
    args: argparse.Namespace,
):
    output_path.parent.mkdir(parents=True, exist_ok=True)

    use_speaker = runtime.model_cfg.use_speaker_condition_resolved and not no_ref and ref_wav is not None
    use_caption = bool(
        runtime.model_cfg.use_caption_condition
        and caption is not None
        and str(caption).strip() != ""
    )

    cfg_scale_text, cfg_scale_caption, cfg_scale_speaker, _ = resolve_cfg_scales(
        cfg_guidance_mode=args.cfg_guidance_mode,
        cfg_scale_text=args.cfg_scale_text,
        cfg_scale_caption=args.cfg_scale_caption,
        cfg_scale_speaker=args.cfg_scale_speaker,
        cfg_scale=None,
        use_caption_condition=use_caption,
        use_speaker_condition=use_speaker,
    )

    req = SamplingRequest(
        text=text,
        caption=caption,
        ref_wav=ref_wav if use_speaker else None,
        no_ref=no_ref or not use_speaker,
        ref_normalize_db=-16.0,
        ref_ensure_max=True,
        num_candidates=1,
        decode_mode="sequential",
        duration_scale=args.duration_scale,
        num_steps=args.num_steps,
        cfg_scale_text=cfg_scale_text,
        cfg_scale_caption=cfg_scale_caption,
        cfg_scale_speaker=cfg_scale_speaker,
        cfg_guidance_mode=args.cfg_guidance_mode,
        cfg_min_t=0.5,
        cfg_max_t=1.0,
        context_kv_cache=True,
        speaker_uncond_mode="mask",
        trim_tail=True,
    )

    result = runtime.synthesize(req)
    save_wav(str(output_path), result.audio, result.sample_rate)
    print(f" -> Saved: {output_path}")


def main():
    args = parse_args()

    ref_wav = str(Path(args.ref_wav).resolve()) if args.ref_wav else None
    if ref_wav and not os.path.isfile(ref_wav):
        print(f"[Error] Reference audio file not found: {ref_wav}", file=sys.stderr)
        sys.exit(1)

    if not args.no_ref and not ref_wav and not args.batch_json:
        if args.caption:
            print("[Irodori-TTS] No --ref-wav provided with --caption; enabling --no-ref for pure Voice Design.")
            args.no_ref = True
        else:
            print("[Error] Either --ref-wav, --no-ref, or --caption must be specified.", file=sys.stderr)
            sys.exit(1)

    print(f"[Irodori-TTS] Resolving checkpoint: {args.hf_checkpoint}...")
    checkpoint_path = download_hf_checkpoint(args.hf_checkpoint)

    print(f"[Irodori-TTS] Initializing runtime on device: {args.device}...")
    runtime = get_runtime(checkpoint_path, args.codec_repo, args.device)

    if args.text:
        # Single line synthesis
        out_path = Path(args.output_wav).resolve()
        caption_info = f" (Caption: '{args.caption}')" if args.caption else ""
        mode_info = "Voice Design + Cloning" if (ref_wav and args.caption) else ("Pure Voice Design" if args.no_ref else "Voice Cloning")
        print(f"[Irodori-TTS] Mode: [{mode_info}] Synthesizing: {args.text}{caption_info}")
        synthesize_line(runtime, args.text, ref_wav, args.caption, args.no_ref, out_path, args)
        print(f"[Irodori-TTS] Completed!")
    elif args.batch_json:
        # Batch synthesis
        batch_file = Path(args.batch_json).resolve()
        if not batch_file.is_file():
            print(f"[Error] Batch JSON file not found: {batch_file}", file=sys.stderr)
            sys.exit(1)

        with open(batch_file, "r", encoding="utf-8") as f:
            items = json.load(f)

        if not isinstance(items, list):
            print(f"[Error] Expected JSON list in {batch_file}", file=sys.stderr)
            sys.exit(1)

        print(f"[Irodori-TTS] Starting batch synthesis for {len(items)} items...")
        for i, item in enumerate(items, start=1):
            text = item.get("text", "")
            out_str = item.get("output") or item.get("output_wav") or f"output_{i:03d}.wav"
            out_path = Path(out_str).resolve()
            
            item_ref = item.get("ref_wav", ref_wav)
            if item_ref:
                item_ref = str(Path(item_ref).resolve())
            
            item_caption = item.get("caption", args.caption)
            item_no_ref = item.get("no_ref", args.no_ref or (item_ref is None and item_caption is not None))

            caption_info = f" [Caption: {item_caption}]" if item_caption else ""
            print(f"[{i}/{len(items)}] Synthesizing: {text}{caption_info}")
            synthesize_line(runtime, text, item_ref, item_caption, item_no_ref, out_path, args)

        print(f"[Irodori-TTS] All {len(items)} lines synthesized successfully!")


if __name__ == "__main__":
    main()
