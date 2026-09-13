import { test } from '@playwright/test';

test('debug female_o frame-by-frame classification', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const dump = await page.evaluate(async () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const Meyda = (window as any).Meyda || (await import('meyda')).default;

    const resp = await fetch('voices/lipsync_female_o.wav');
    const audioBuffer = await ctx.decodeAudioData(await resp.arrayBuffer());
    const data = audioBuffer.getChannelData(0);
    const bSize = 1024;
    Meyda.bufferSize = bSize;
    Meyda.sampleRate = audioBuffer.sampleRate;

    const MFCC_TARGETS = {
      aa: [40.1, -17.3, -26.1, -25.5, -25.8, -0.4, 31.0, 14.0, -19.7, -16.3, 1.9, -0.8],
      ih: [29.0, -9.1, 33.6, 30.0, -19.4, -25.7, -13.7, -21.1, -20.7, -22.1, -25.5, -8.8],
      ou: [53.9, 28.5, 12.6, -13.5, -10.0, -5.5, -16.7, -26.4, -29.3, -22.5, -9.9, 6.4],
      ee: [31.4, -30.1, -8.7, -1.4, -19.5, -31.1, -6.6, -4.2, -7.6, -1.7, 1.7, -0.9],
      oh: [42.2, -2.0, -20.1, -29.6, -31.4, -11.9, 12.9, 5.5, -13.1, -10.1, 2.9, 5.5],
    };

    const timeline: any[] = [];
    let curPhoneme = 'nn';

    for (let i = 0; i + bSize <= data.length; i += 512) {
      const sec = i / audioBuffer.sampleRate;
      const frame = data.subarray(i, i + bSize);
      const feat = Meyda.extract(['rms', 'mfcc'], frame);
      if (!feat || feat.rms < 0.015) {
        curPhoneme = 'nn';
        continue;
      }

      const dists: Record<string, number> = {};
      let bestP = 'nn';
      let minDist = Infinity;

      for (const [p, targetVec] of Object.entries(MFCC_TARGETS)) {
        let sumSq = 0;
        for (let j = 0; j < 12; j++) {
          const diff = (feat.mfcc[j + 1] ?? 0) - targetVec[j];
          sumSq += diff * diff;
        }
        let dist = Math.sqrt(sumSq);
        if (curPhoneme === p) {
          dist *= 0.82;
        }
        dists[p] = Math.round(dist * 10) / 10;
        if (dist < minDist) {
          minDist = dist;
          bestP = p;
        }
      }

      curPhoneme = bestP;
      timeline.push({
        sec: Math.round(sec * 100) / 100,
        bestP,
        dist_aa: dists.aa,
        dist_oh: dists.oh,
        dist_ou: dists.ou,
        mfcc1_3: [Math.round(feat.mfcc[1]), Math.round(feat.mfcc[2]), Math.round(feat.mfcc[3]), Math.round(feat.mfcc[7])],
      });
    }

    return timeline;
  });

  console.log('--- TIMELINE OF FEMALE_O ---');
  // Log sample frames around 1.0s, 1.5s, 2.0s, 2.5s, 3.0s
  const sampled = dump.filter((_, idx) => idx % 5 === 0);
  console.log(JSON.stringify(sampled, null, 2));
});
