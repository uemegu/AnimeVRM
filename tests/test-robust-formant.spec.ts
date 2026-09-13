import { test } from '@playwright/test';

test('verify formant algorithm fix for female vowels', async ({ page }) => {
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

    function findFormantPeaksRobust(
      spectrum: ArrayLike<number>,
      sampleRate: number,
      bufferSize: number,
      gender: 'female' | 'male'
    ): { f1: number; f2: number } {
      const binWidth = sampleRate / bufferSize;
      const numBins = spectrum.length;

      // 1. Spectral pre-emphasis to lift higher frequencies (F2 of E/I)
      const emphasized = new Float32Array(numBins);
      for (let i = 0; i < numBins; i++) {
        const freq = i * binWidth;
        const lift = Math.pow(Math.max(200, freq) / 200, 0.45);
        emphasized[i] = spectrum[i] * lift;
      }

      // 2. Wide envelope smoothing (~380Hz for female, ~240Hz for male)
      const smoothHz = gender === 'female' ? 380 : 240;
      const smoothRadius = Math.max(3, Math.round(smoothHz / (2 * binWidth)));
      const smoothed = new Float32Array(numBins);
      for (let i = 0; i < numBins; i++) {
        let sum = 0, count = 0;
        for (let w = -smoothRadius; w <= smoothRadius; w++) {
          const idx = i + w;
          if (idx >= 0 && idx < numBins) { sum += emphasized[idx]; count++; }
        }
        smoothed[i] = sum / (count || 1);
      }

      // 3. Find all candidate local peaks between 240Hz and 3600Hz
      const minBin = Math.round(240 / binWidth);
      const maxBin = Math.round(3600 / binWidth);
      const peaks: { bin: number; freq: number; val: number }[] = [];

      for (let i = minBin + 1; i < maxBin - 1; i++) {
        if (smoothed[i] > smoothed[i - 1] && smoothed[i] >= smoothed[i + 1]) {
          peaks.push({ bin: i, freq: i * binWidth, val: smoothed[i] });
        }
      }

      if (peaks.length === 0) {
        return { f1: gender === 'female' ? 550 : 450, f2: gender === 'female' ? 1600 : 1400 };
      }

      // 4. F1 MUST be in the primary vowel jaw opening range:
      // F1 is between 250Hz and 880Hz (even for 'aa', F1 rarely exceeds 950Hz; 'oh' F2 at 1100-1300 must NOT be picked as F1!)
      const f1MaxLimitHz = gender === 'female' ? 950 : 850;
      const f1Candidates = peaks.filter((p) => p.freq <= f1MaxLimitHz);

      let f1Peak = f1Candidates.length > 0
        ? f1Candidates.reduce((best, p) => (p.val > best.val ? p : best), f1Candidates[0])
        : peaks[0];

      // If highest peak is around 900-1200Hz, check if there's a strong lower peak (e.g. 500-700Hz for 'oh')
      // For 'oh', peak at ~1150Hz is F2, peak at ~600Hz is F1!
      const lowerPeak = peaks.find((p) => p.freq >= 300 && p.freq <= 750);
      const midHighPeak = peaks.find((p) => p.freq > 750 && p.freq <= 1350);
      if (lowerPeak && midHighPeak && midHighPeak.val > lowerPeak.val && lowerPeak.val > midHighPeak.val * 0.08) {
        // This is characteristic of 'oh' (strong F2 at ~1150Hz, lower F1 at ~600Hz)
        f1Peak = lowerPeak;
      }

      // 5. F2 MUST be above F1 with at least 250Hz separation
      const f2Candidates = peaks.filter((p) => p.freq >= f1Peak.freq + 250 && p.freq >= 850);
      let f2Peak: { bin: number; freq: number; val: number } | null = null;

      if (f2Candidates.length > 0) {
        // Choose strongest F2 candidate
        f2Peak = f2Candidates.reduce((best, p) => (p.val > best.val ? p : best), f2Candidates[0]);
      } else {
        f2Peak = { bin: 0, freq: f1Peak.freq + 700, val: 0 };
      }

      return { f1: f1Peak.freq, f2: f2Peak.freq };
    }

    const targets = {
      female: {
        aa: { f1: 900, f2: 1550, weightF1: 1.2, weightF2: 0.8 },
        ih: { f1: 340, f2: 3000, weightF1: 1.1, weightF2: 1.1 },
        ou: { f1: 380, f2: 1350, weightF1: 1.2, weightF2: 1.0 },
        ee: { f1: 520, f2: 2500, weightF1: 1.0, weightF2: 1.2 },
        oh: { f1: 600, f2: 1150, weightF1: 1.2, weightF2: 1.1 },
      },
    };

    const summary: Record<string, any> = {};

    for (const f of files) {
      const resp = await fetch(f.url);
      const audioBuffer = await ctx.decodeAudioData(await resp.arrayBuffer());
      const data = audioBuffer.getChannelData(0);
      const bSize = 1024;
      Meyda.bufferSize = bSize;
      Meyda.sampleRate = audioBuffer.sampleRate;

      const counts: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, nn: 0 };
      const f1s: number[] = [];
      const f2s: number[] = [];

      for (let i = 0; i + bSize <= data.length; i += 512) {
        const frame = data.subarray(i, i + bSize);
        const feat = Meyda.extract(['rms', 'powerSpectrum'], frame);
        if (!feat || feat.rms < 0.02) {
          counts.nn++;
          continue;
        }

        const { f1, f2 } = findFormantPeaksRobust(feat.powerSpectrum, audioBuffer.sampleRate, bSize, 'female');
        f1s.push(f1);
        f2s.push(f2);

        let bestP = 'nn';
        let minDist = Infinity;
        for (const [p, target] of Object.entries(targets.female)) {
          const dF1 = Math.log(f1 / target.f1) * target.weightF1;
          const dF2 = Math.log(f2 / target.f2) * target.weightF2;
          let dist = Math.sqrt(dF1 * dF1 + dF2 * dF2);

          // Domain constraints
          if (p === 'aa' && f1 < 750) dist += 0.6; // 'aa' must have high F1
          if (p === 'oh' && f1 > 750) dist += 0.6; // 'oh' has lower F1 than 'aa'
          if ((p === 'ee' || p === 'ih') && f2 < 1800) dist += 0.8; // 'ee','ih' must have high F2
          if ((p === 'oh' || p === 'ou') && f2 > 1650) dist += 0.8; // 'oh','ou' must have lower F2

          if (dist < minDist) {
            minDist = dist;
            bestP = p;
          }
        }
        counts[bestP]++;
      }

      f1s.sort((a, b) => a - b);
      f2s.sort((a, b) => a - b);
      summary[f.name] = {
        target: f.target,
        medianF1: Math.round(f1s[Math.floor(f1s.length / 2)] || 0),
        medianF2: Math.round(f2s[Math.floor(f2s.length / 2)] || 0),
        classification: counts,
      };
    }

    return summary;
  });

  console.log('--- ROBUST FORMANT TEST RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
});
