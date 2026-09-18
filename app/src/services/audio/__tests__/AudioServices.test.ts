import { describe, it, expect } from 'vitest';
import { SoundManager } from '../SoundManager';
import { AudioLipSync } from '../AudioLipSync';

describe('SoundManager', () => {
  it('正常にインスタンス化され初期音量が設定されていること', () => {
    const sm = new SoundManager({
      masterVolume: 0.8,
      bgmVolume: 0.5,
      seVolume: 0.7,
    });

    expect(sm.masterVolume).toBe(0.8);
    expect(sm.bgmVolume).toBe(0.5);
    expect(sm.seVolume).toBe(0.7);

    sm.setMasterVolume(0.9);
    expect(sm.masterVolume).toBe(0.9);

    sm.setBgmVolume(0.3);
    expect(sm.bgmVolume).toBe(0.3);

    sm.dispose();
  });
});

describe('AudioLipSync', () => {
  it('正常にインスタンス化され初期状態が正しいこと', () => {
    const lipSync = new AudioLipSync();
    expect(lipSync.isPlaying).toBe(false);
    expect(lipSync.currentPhoneme).toBeUndefined();
    expect(lipSync.engineMode).toBe('wasm');
    expect(lipSync.audioDelay).toBe(0.05);

    lipSync.setVoiceGender('female');
    expect(lipSync.voiceGender).toBe('female');

    lipSync.setVolume(0.8);
    expect(lipSync.audioElement.volume).toBe(0.8);

    lipSync.dispose();
  });
});
