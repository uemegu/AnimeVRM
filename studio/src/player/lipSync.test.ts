import { describe, expect, it } from 'vitest';
import { VOICE_REFERENCE_RMS, VOICE_SILENCE_RMS, VoiceMouthEnvelope } from '@anime-vrm/engine/audio/lipSync';

describe('音声の声量に合わせた口の開き', () => {
  it('共通の基準で、小さな声から大きな声へ口の開きが増える', () => {
    const levels = [0, VOICE_SILENCE_RMS, 0.02, 0.1, VOICE_REFERENCE_RMS];
    const openings = levels.map((rms) => {
      const envelope = new VoiceMouthEnvelope();
      envelope.update(rms, 0);
      return envelope.update(rms, 1);
    });

    expect(openings[0]).toBe(0);
    expect(openings[1]).toBe(0);
    expect(openings[2]).toBeGreaterThan(0);
    expect(openings[2]).toBeLessThan(openings[3]);
    expect(openings[3]).toBeLessThan(openings[4]);
    expect(openings[4]).toBeCloseTo(1);
  });

  it('無音になると滑らかに閉じ、最後は完全に閉じる', () => {
    const envelope = new VoiceMouthEnvelope();
    envelope.update(VOICE_REFERENCE_RMS, 0);
    const open = envelope.update(VOICE_REFERENCE_RMS, 1);
    const closing = envelope.update(0, 1.02);
    const quieter = envelope.update(VOICE_SILENCE_RMS, 1.08);

    expect(closing).toBeGreaterThan(0);
    expect(closing).toBeLessThan(open);
    expect(quieter).toBeGreaterThan(0);
    expect(quieter).toBeLessThan(closing);
    expect(envelope.update(0, 2)).toBe(0);
  });

  it('30・60・120fps で、同じ時間後の開きと閉じ方が揃う', () => {
    const trajectories = [30, 60, 120].map((fps) => {
      const envelope = new VoiceMouthEnvelope();
      envelope.update(0, 0);
      let attack = 0;
      for (let frame = 1; frame <= fps / 10; frame++) {
        attack = envelope.update(VOICE_REFERENCE_RMS, frame / fps);
      }
      let release = 0;
      for (let frame = 1; frame <= fps / 5; frame++) {
        release = envelope.update(0, 0.1 + frame / fps);
      }
      return { attack, release };
    });

    expect(trajectories[0].attack).toBeGreaterThan(0.9);
    expect(trajectories[0].release).toBeGreaterThan(0);
    expect(trajectories[0].release).toBeLessThan(trajectories[0].attack);
    for (const trajectory of trajectories.slice(1)) {
      expect(trajectory.attack).toBeCloseTo(trajectories[0].attack, 10);
      expect(trajectory.release).toBeCloseTo(trajectories[0].release, 10);
    }
  });

  it('リセットすると、前のボイスの開きと経過時間を次のボイスへ持ち越さない', () => {
    const envelope = new VoiceMouthEnvelope();
    envelope.update(VOICE_REFERENCE_RMS, 100);
    envelope.update(VOICE_REFERENCE_RMS, 101);
    envelope.reset();

    const fresh = new VoiceMouthEnvelope();
    expect(envelope.update(0.1, 1000)).toBe(fresh.update(0.1, 0));
    envelope.reset();
    expect(envelope.update(0, 1001)).toBe(0);
  });

  it('基準より大きな音でも口の開きを 1 以下に保つ', () => {
    const envelope = new VoiceMouthEnvelope();
    envelope.update(0, 0);
    for (let frame = 1; frame <= 120; frame++) {
      const mouth = envelope.update(VOICE_REFERENCE_RMS * 100, frame / 60);
      expect(mouth).toBeGreaterThanOrEqual(0);
      expect(mouth).toBeLessThanOrEqual(1);
    }
    expect(envelope.update(VOICE_REFERENCE_RMS * 100, 3)).toBeCloseTo(1);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '不正な音量 %s では口を開かない',
    (rms) => {
      const envelope = new VoiceMouthEnvelope();
      expect(envelope.update(rms, 0)).toBe(0);
    }
  );
});
