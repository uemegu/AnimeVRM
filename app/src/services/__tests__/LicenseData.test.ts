import { describe, it, expect } from 'vitest';
import licensesJson from '../../data/licenses.json';
import { AppLicensesData } from '../../types/license';

describe('License and Credit Data Verification', () => {
  const data = licensesJson as unknown as AppLicensesData;

  it('licenses.json が正しい構造を持っていること', () => {
    expect(data).toHaveProperty('generatedAt');
    expect(data).toHaveProperty('assets');
    expect(data).toHaveProperty('libraries');
    expect(Array.isArray(data.assets)).toBe(true);
    expect(Array.isArray(data.libraries)).toBe(true);
  });

  it('指定された4つのアセット（BGM, SE, 音声, 背景）が含まれていること', () => {
    const assets = data.assets;
    expect(assets.length).toBeGreaterThanOrEqual(4);

    const bgm = assets.find((a) => a.category === 'bgm');
    expect(bgm).toBeDefined();
    expect(bgm?.provider).toBe('Lyria3.5');

    const se = assets.find((a) => a.category === 'se');
    expect(se).toBeDefined();
    expect(se?.provider).toBe('効果音ラボ');
    expect(se?.url).toBe('https://soundeffect-lab.info/');

    const voice = assets.find((a) => a.category === 'voice');
    expect(voice).toBeDefined();
    expect(voice?.provider).toBe('Irodori-TTS');

    const bg = assets.find((a) => a.category === 'background');
    expect(bg).toBeDefined();
    expect(bg?.provider).toBe('ChatGPT Images 2.5');
  });

  it('プロダクション依存ライブラリ（three, react 等）が抽出され、ライセンステキストが存在すること', () => {
    const libs = data.libraries;
    expect(libs.length).toBeGreaterThanOrEqual(4);

    const threeLib = libs.find((l) => l.name === 'three');
    expect(threeLib).toBeDefined();
    expect(threeLib?.licenseType).toBe('MIT');
    expect(threeLib?.licenseText.length).toBeGreaterThan(0);

    const vrmLib = libs.find((l) => l.name === '@pixiv/three-vrm');
    expect(vrmLib).toBeDefined();
    expect(vrmLib?.licenseType).toBe('MIT');
    expect(vrmLib?.licenseText.length).toBeGreaterThan(0);

    const reactLib = libs.find((l) => l.name === 'react');
    expect(reactLib).toBeDefined();
    expect(reactLib?.licenseType).toBe('MIT');
    expect(reactLib?.licenseText.length).toBeGreaterThan(0);
  });
});
