import { test, expect } from '@playwright/test';

test('verify hybrid classifier achieves >95% accuracy on all 5 vowels', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const results = await page.evaluate(async () => {
    const files = [
      { name: 'female_a', url: 'voices/lipsync_female_a.wav', target: 'aa' },
      { name: 'female_i', url: 'voices/lipsync_female_i.wav', target: 'ih' },
      { name: 'female_u', url: 'voices/lipsync_female_u.wav', target: 'ou' },
      { name: 'female_e', url: 'voices/lipsync_female_e.wav', target: 'ee' },
      { name: 'female_o', url: 'voices/lipsync_female_o.wav', target: 'oh' },
      { name: 'female_vowels', url: 'voices/lipsync_vowels_female.wav', target: 'all' },
    ];

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const Meyda = (window as any).Meyda || (await import('meyda')).default;

    // Measured Reference MFCC Profiles for Japanese Vowels (normalized without MFCC[0] energy)
    // MFCC indices 1 to 12
    const MFCC_TARGETS: Record<'female' | 'male', Record<string, number[]>> = {
      female: {
        aa: [40.1, -17.3, -26.1, -25.5, -25.8, -0.4, 31.0, 14.0, -19.7, -16.3, 1.9, -0.8],
        ih: [29.0, -9.1, 33.6, 30.0, -19.4, -25.7, -13.7, -21.1, -20.7, -22.1, -25.5, -8.8],
        ou: [53.9, 28.5, 12.6, -13.5, -10.0, -5.5, -16.7, -26.4, -29.3, -22.5, -9.9, 6.4],
        ee: [31.4, -30.1, -8.7, -1.4, -19.5, -31.1, -6.6, -4.2, -7.6, -1.7, 1.7, -0.9],
        oh: [42.2, -2.0, -20.1, -29.6, -31.4, -11.9, 12.9, 5.5, -13.1, -10.1, 2.9, 5.5],
      },
      male: {
        // Will be tuned for male
        aa: [38.0, -15.0, -22.0, -20.0, -20.0, 0.0, 25.0, 10.0, -15.0, -12.0, 2.0, 0.0],
        ih: [25.0, -8.0, 28.0, 25.0, -15.0, -20.0, -10.0, -18.0, -16.0, -18.0, -20.0, -6.0],
        ou: [45.0, 22.0, 10.0, -10.0, -8.0, -4.0, -12.0, -20.0, -22.0, -18.0, -8.0, 5.0],
        ee: [28.0, -25.0, -7.0, -1.0, -15.0, -25.0, -5.0, -3.0, -6.0, -1.0, 1.0, -1.0],
        oh: [36.0, -1.0, -16.0, -24.0, -25.0, -9.0, 10.0, 4.0, -10.0, -8.0, 2.0, 4.0],
      },
    };

    function classifyVowelHybrid(
      mfcc: number[],
      spectrum: Float32Array,
      sr: number,
      bSize: number,
      gender: 'female' | 'male',
      lastPhoneme?: string
    ) {
      // 1. MFCC Distance (ignoring MFCC[0] which represents gain/volume)
      const targets = MFCC_TARGETS[gender];
      const dists: Record<string, number> = {};
      let bestP = 'nn';
      let minDist = Infinity;

      for (const [p, targetVec] of Object.entries(targets)) {
        let sumSq = 0;
        for (let j = 0; j < 12; j++) {
          const diff = (mfcc[j + 1] ?? 0) - targetVec[j];
          sumSq += diff * diff;
        }
        let dist = Math.sqrt(sumSq);

        // Hysteresis damping to prevent rapid fluttering
        if (lastPhoneme === p) {
          dist *= 0.82;
        }

        dists[p] = Math.round(dist * 10) / 10;
        if (dist < minDist) {
          minDist = dist;
          bestP = p;
        }
      }

      // 2. Extract Formants Guided by Predicted Phoneme
      const binWidth = sr / bSize;
      const numBins = spectrum.length;
      const smoothRadius = Math.max(3, Math.round((gender === 'female' ? 380 : 250) / (2 * binWidth)));
      const smoothed = new Float32Array(numBins);
      for (let i = 0; i < numBins; i++) {
        let s = 0, c = 0;
        for (let w = -smoothRadius; w <= smoothRadius; w++) {
          const idx = i + w;
          if (idx >= 0 && idx < numBins) { s += spectrum[idx]; c++; }
        }
        smoothed[i] = s / (c || 1);
      }

      // Expected formant ranges per phoneme for accurate peak extraction:
      const formantRanges: Record<string, { f1: [number, number]; f2: [number, number] }> = {
        aa: { f1: [750, 1200], f2: [1300, 1800] },
        ih: { f1: [250, 450],  f2: [2500, 3600] },
        ou: { f1: [280, 500],  f2: [900, 1600] },
        ee: { f1: [400, 680],  f2: [2000, 2900] },
        oh: { f1: [450, 750],  f2: [900, 1500] },
        nn: { f1: [300, 800],  f2: [1000, 2500] },
      };

      const range = formantRanges[bestP] || formantRanges.aa;
      const findPeak = (minHz: number, maxHz: number) => {
        const minB = Math.round(minHz / binWidth);
        const maxB = Math.round(maxHz / binWidth);
        let bestB = minB, maxV = -1;
        for (let b = minB; b <= maxB; b++) {
          if (smoothed[b] > maxV) {
            maxV = smoothed[b];
            bestB = b;
          }
        }
        return Math.round(bestB * binWidth);
      };

      const f1 = findPeak(range.f1[0], range.f1[1]);
      const f2 = findPeak(range.f2[0], range.f2[1]);

      return { phoneme: bestP, f1, f2, dists };
    }

    const summary: Record<string, any> = {};

    for (const f of files) {
      const resp = await fetch(f.url);
      const audioBuffer = await ctx.decodeAudioData(await resp.arrayBuffer());
      const data = audioBuffer.getChannelData(0);
      const bSize = 1024;
      Meyda.bufferSize = bSize;
      Meyda.sampleRate = audioBuffer.sampleRate;

      const counts: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, nn: 0 };
      let lastP = 'nn';

      for (let i = 0; i + bSize <= data.length; i += 512) {
        const frame = data.subarray(i, i + bSize);
        const feat = Meyda.extract(['rms', 'mfcc', 'powerSpectrum'], frame);
        if (!feat || feat.rms < 0.02 || !feat.mfcc) {
          counts.nn++;
          lastP = 'nn';
          continue;
        }

        const res = classifyVowelHybrid(feat.mfcc, feat.powerSpectrum, audioBuffer.sampleRate, bSize, 'female', lastP);
        counts[res.phoneme]++;
        lastP = res.phoneme;
      }

      summary[f.name] = {
        target: f.target,
        classification: counts,
      };
    }

    return summary;
  });

  console.log('--- HYBRID CLASSIFIER RESULTS ---');
  console.log(JSON.stringify(results, null, 2));

  // Assertions: >90% precision on every single vowel
  const a = results.female_a.classification;
  expect(a.aa / (a.aa + a.ih + a.ou + a.ee + a.oh)).toBeGreaterThan(0.95);

  const i = results.female_i.classification;
  expect(i.ih / (i.aa + i.ih + i.ou + i.ee + i.oh)).toBeGreaterThan(0.95);

  const u = results.female_u.classification;
  expect(u.ou / (u.aa + u.ih + u.ou + u.ee + u.oh)).toBeGreaterThan(0.95);

  const e = results.female_e.classification;
  expect(e.ee / (e.aa + e.ee + e.ih + e.ou + e.oh)).toBeGreaterThan(0.95);

  const o = results.female_o.classification;
  expect(o.oh / (o.aa + o.ee + o.ih + o.ou + o.oh)).toBeGreaterThan(0.95);
});
