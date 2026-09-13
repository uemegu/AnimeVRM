import { test } from '@playwright/test';

test('dump misclassified frames for female_e and female_o', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const dump = await page.evaluate(async () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const Meyda = (window as any).Meyda || (await import('meyda')).default;

    async function analyze(url: string) {
      const resp = await fetch(url);
      const audioBuffer = await ctx.decodeAudioData(await resp.arrayBuffer());
      const data = audioBuffer.getChannelData(0);
      const sr = audioBuffer.sampleRate;
      const bSize = 1024;
      const binWidth = sr / bSize;
      Meyda.bufferSize = bSize;
      Meyda.sampleRate = sr;

      const frames: any[] = [];
      for (let i = 0; i + bSize <= data.length; i += 512) {
        const frame = data.subarray(i, i + bSize);
        const feat = Meyda.extract(['rms', 'powerSpectrum'], frame);
        if (!feat || feat.rms < 0.02) continue;

        const spec = feat.powerSpectrum;
        const numBins = spec.length;
        const smoothRadius = Math.max(3, Math.round(420 / (2 * binWidth)));
        const smoothed = new Float32Array(numBins);

        // Pre-emphasis
        for (let b = 0; b < numBins; b++) {
          const freq = b * binWidth;
          const boost = Math.sqrt(Math.max(300, freq) / 300);
          spec[b] *= boost;
        }

        for (let b = 0; b < numBins; b++) {
          let s = 0, c = 0;
          for (let w = -smoothRadius; w <= smoothRadius; w++) {
            const idx = b + w;
            if (idx >= 0 && idx < numBins) { s += spec[idx]; c++; }
          }
          smoothed[b] = s / (c || 1);
        }

        // Top 4 peaks in 250Hz - 3600Hz
        const peaks: { freq: number; val: number }[] = [];
        const minB = Math.round(250 / binWidth);
        const maxB = Math.round(3600 / binWidth);
        for (let b = minB + 1; b < maxB - 1; b++) {
          if (smoothed[b] > smoothed[b - 1] && smoothed[b] >= smoothed[b + 1]) {
            peaks.push({ freq: Math.round(b * binWidth), val: smoothed[b] });
          }
        }
        peaks.sort((a, b) => b.val - a.val);

        frames.push({
          rms: Math.round(feat.rms * 1000) / 1000,
          topPeaks: peaks.slice(0, 4),
        });
      }
      return frames;
    }

    return {
      female_e: (await analyze('voices/lipsync_female_e.wav')).slice(10, 25),
      female_o: (await analyze('voices/lipsync_female_o.wav')).slice(10, 25),
    };
  });

  console.log('--- FRAME PEAKS DUMP ---');
  console.log(JSON.stringify(dump, null, 2));
});
