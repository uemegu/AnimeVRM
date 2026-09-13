import { test } from '@playwright/test';

test('measure spectralCentroid and F1 across all female vowels', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const stats = await page.evaluate(async () => {
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

      const centroids: number[] = [];
      const rmsList: number[] = [];

      for (let i = 0; i + bSize <= data.length; i += 512) {
        const frame = data.subarray(i, i + bSize);
        const feat = Meyda.extract(['rms', 'spectralCentroid'], frame);
        if (!feat || feat.rms < 0.02) continue;
        centroids.push(feat.spectralCentroid);
        rmsList.push(feat.rms);
      }

      centroids.sort((a, b) => a - b);
      res[f.name] = {
        minCentroid: Math.round(centroids[0] || 0),
        medianCentroid: Math.round(centroids[Math.floor(centroids.length / 2)] || 0),
        maxCentroid: Math.round(centroids[centroids.length - 1] || 0),
        count: centroids.length,
      };
    }
    return res;
  });

  console.log('--- SPECTRAL CENTROID MEASUREMENTS ---');
  console.log(JSON.stringify(stats, null, 2));
});
