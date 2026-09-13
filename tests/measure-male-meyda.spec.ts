import { test } from '@playwright/test';

test('measure Meyda MFCC targets for new male voices', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const maleMfcc = await page.evaluate(async () => {
    const files = [
      { name: 'aa', url: 'voices/lipsync_male_a.wav' },
      { name: 'ih', url: 'voices/lipsync_male_i.wav' },
      { name: 'ou', url: 'voices/lipsync_male_u.wav' },
      { name: 'ee', url: 'voices/lipsync_male_e.wav' },
      { name: 'oh', url: 'voices/lipsync_male_o.wav' },
    ];

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const Meyda = (window as any).Meyda || (await import('meyda')).default;
    const res: Record<string, number[]> = {};

    for (const f of files) {
      const resp = await fetch(f.url);
      const audioBuffer = await ctx.decodeAudioData(await resp.arrayBuffer());
      const data = audioBuffer.getChannelData(0);
      const bSize = 1024;
      Meyda.bufferSize = bSize;
      Meyda.sampleRate = audioBuffer.sampleRate;

      const mfccs: number[][] = [];
      for (let i = 0; i + bSize <= data.length; i += 512) {
        const frame = data.subarray(i, i + bSize);
        const feat = Meyda.extract(['rms', 'mfcc'], frame);
        if (!feat || feat.rms < 0.02 || !feat.mfcc) continue;
        mfccs.push(feat.mfcc);
      }

      const mean = new Array(12).fill(0);
      for (const v of mfccs) {
        for (let j = 0; j < 12; j++) mean[j] += v[j + 1];
      }
      for (let j = 0; j < 12; j++) mean[j] = Math.round((mean[j] / mfccs.length) * 10) / 10;
      res[f.name] = mean;
    }
    return res;
  });

  console.log('--- MEYDA MALE MFCC TARGETS ---');
  console.log(JSON.stringify(maleMfcc, null, 2));
});
