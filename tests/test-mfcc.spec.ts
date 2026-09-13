import { test } from '@playwright/test';

test('measure MFCC profiles across all female vowels', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const mfccData = await page.evaluate(async () => {
    const files = [
      { name: 'female_a', url: 'voices/lipsync_female_a.wav' },
      { name: 'female_i', url: 'voices/lipsync_female_i.wav' },
      { name: 'female_u', url: 'voices/lipsync_female_u.wav' },
      { name: 'female_e', url: 'voices/lipsync_female_e.wav' },
      { name: 'female_o', url: 'voices/lipsync_female_o.wav' },
    ];

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const Meyda = (window as any).Meyda || (await import('meyda')).default;
    const res: Record<string, any> = {};

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

      // Mean MFCC vector
      const mean = new Array(13).fill(0);
      for (const v of mfccs) {
        for (let j = 0; j < 13; j++) mean[j] += v[j];
      }
      for (let j = 0; j < 13; j++) mean[j] = Math.round((mean[j] / mfccs.length) * 10) / 10;

      res[f.name] = {
        count: mfccs.length,
        meanMfcc: mean,
      };
    }
    return res;
  });

  console.log('--- MFCC PROFILES ---');
  console.log(JSON.stringify(mfccData, null, 2));
});
