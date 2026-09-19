import { describe, it, expect } from 'vitest';
import { SoundManager } from '../SoundManager';
import { AudioLipSync } from '../AudioLipSync';

import { BGM_PRESETS } from '../../../data/bgmPresets';

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

  it('BgmId指定による再生、URL解決、夜の自室の音量縮小が機能すること', () => {
    // Audioのモック定義
    class MockAudio {
      public src: string;
      public volume: number = 1.0;
      public loop: boolean = false;
      public paused: boolean = false;
      public currentTime: number = 0;
      constructor(src: string) {
        this.src = src;
      }
      play = async () => {
        this.paused = false;
      };
      pause = () => {
        this.paused = true;
      };
    }

    const originalAudio = globalThis.Audio;
    // @ts-expect-error mock audio
    globalThis.Audio = MockAudio;

    try {
      const sm = new SoundManager({
        masterVolume: 1.0,
        bgmVolume: 0.4,
      });

      // 1. メインテーマ曲再生 (main_theme -> /bgm/thema_music.mp3, volumeScale: 1.0)
      sm.playBgm('main_theme');
      expect(sm.getCurrentBgm().target).toBe('main_theme');
      expect(sm.getCurrentBgm().url).toBe('/bgm/thema_music.mp3');
      expect(sm.getBgmAudio()?.volume).toBeCloseTo(0.4 * 1.0);

      // 2. メインBGM再生 (main_bgm -> /bgm/main_bgm.mp3, volumeScale: 1.0)
      sm.playBgm('main_bgm');
      expect(sm.getCurrentBgm().target).toBe('main_bgm');
      expect(sm.getCurrentBgm().url).toBe('/bgm/main_bgm.mp3');
      expect(sm.getBgmAudio()?.volume).toBeCloseTo(0.4 * 1.0);

      // 同一曲での再再生呼び出し（シームレス継続）
      const prevAudio = sm.getBgmAudio();
      sm.playBgm('main_bgm');
      expect(sm.getBgmAudio()).toBe(prevAudio); // インスタンスが破棄されず継続

      // 3. 夜の自室BGM再生 (night_room -> /bgm/night_music.mp3, volumeScale: 0.45)
      sm.playBgm('night_room');
      expect(sm.getCurrentBgm().target).toBe('night_room');
      expect(sm.getCurrentBgm().url).toBe('/bgm/night_music.mp3');
      // 夜の自室BGMは音量を下げて再生されること
      const expectedNightVolume = 1.0 * 0.4 * BGM_PRESETS.night_room.defaultVolumeScale;
      expect(sm.getBgmAudio()?.volume).toBeCloseTo(expectedNightVolume);
      expect(sm.getBgmAudio()?.volume).toBeLessThan(0.4);

      // 4. BGM停止
      sm.stopBgm();
      expect(sm.getCurrentBgm().target).toBeNull();
      expect(sm.getBgmAudio()).toBeNull();

      sm.dispose();
    } finally {
      globalThis.Audio = originalAudio;
    }
  });

  it('ミュート機能の切り替えが正しく反映されること', () => {
    class MockAudio {
      public src: string = '';
      public volume: number = 1.0;
      public loop: boolean = false;
      public muted: boolean = false;
      play = async () => {};
      pause = () => {};
    }
    const originalAudio = globalThis.Audio;
    // @ts-expect-error mock audio
    globalThis.Audio = MockAudio;

    try {
      const sm = new SoundManager();
      expect(sm.getIsMuted()).toBe(false);

      sm.playBgm('main_theme');
      expect(sm.getBgmAudio()?.muted).toBe(false);

      sm.setMuted(true);
      expect(sm.getIsMuted()).toBe(true);
      expect(sm.getBgmAudio()?.muted).toBe(true);

      sm.setMuted(false);
      expect(sm.getIsMuted()).toBe(false);
      expect(sm.getBgmAudio()?.muted).toBe(false);

      sm.dispose();
    } finally {
      globalThis.Audio = originalAudio;
    }
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
