import { test } from '@playwright/test';

test('tune formant extraction to get >90% accuracy for all 5 vowels', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const results = await page.evaluate(async () => {
    const files = [
      { name: 'female_a', url: 'voices/lipsync_female_a.wav', target: 'aa' },
      { name: 'female_i', url: 'voices/lipsync_female_i.wav', target: 'ih' },
      { name: 'female_u', url: 'voices/lipsync_female_u.wav', target: 'ou' },
      { name: 'female_e', url: 'voices/lipsync_female_e.wav', target: 'ee' },
      { name: 'female_o', url: 'voices/lipsync_female_o.wav', target: 'oh' },
    ];

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const Meyda = (window as any).Meyda || (await import('meyda')).default;

    function findFormantPeaksAccurate(
      spectrum: ArrayLike<number>,
      sampleRate: number,
      bufferSize: number,
      gender: 'female' | 'male'
    ): { f1: number; f2: number } {
      const binWidth = sampleRate / bufferSize;
      const numBins = spectrum.length;

      // 1. Spectral pre-emphasis to compensate -6dB/oct drop for high formants
      const emphasized = new Float32Array(numBins);
      for (let i = 0; i < numBins; i++) {
        const freq = i * binWidth;
        const lift = Math.pow(Math.max(250, freq) / 250, 0.4);
        emphasized[i] = spectrum[i] * lift;
      }

      // 2. Wide envelope smoothing (~360Hz) to smooth pitch harmonics (F0 ~ 300Hz)
      const smoothHz = gender === 'female' ? 360 : 220;
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

      // 3. Find candidate local peaks
      const minBin = Math.round(250 / binWidth);
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

      // 4. Robust Formant Disambiguation
      // Sort peaks by frequency
      peaks.sort((a, b) => a.freq - b.freq);

      // Distinguish peak bands:
      // Low band (250 - 450 Hz): Characteristic of 'I' (ih) and 'U' (ou)
      // Mid-Low band (450 - 750 Hz): Characteristic of 'E' (ee) and 'O' (oh)
      // Mid-High band (750 - 1300 Hz): 'O' F2, or 'A' F1
      // High band (1300 - 1800 Hz): 'A' F2
      // Very High band (> 1900 Hz): 'E' F2, 'I' F2
      
      const pLow = peaks.find((p) => p.freq >= 250 && p.freq <= 450);
      const pMid = peaks.find((p) => p.freq > 450 && p.freq <= 750);
      const pMidHigh = peaks.find((p) => p.freq > 750 && p.freq <= 1350);
      const pHigh = peaks.find((p) => p.freq > 1350 && p.freq <= 1850);
      const pVeryHigh = peaks.find((p) => p.freq > 1900 && p.freq <= 3600);

      let f1 = 550;
      let f2 = 1600;

      // Case 1: Very strong high peak (>1900Hz) present -> It is E or I!
      if (pVeryHigh && pVeryHigh.val > 5.0 && (!pHigh || pVeryHigh.val >= pHigh.val * 0.4)) {
        f2 = pVeryHigh.freq;
        // F1 is either Low (I) or Mid (E)
        if (pLow && (!pMid || pLow.val >= pMid.val * 0.7)) {
          f1 = pLow.freq;
        } else if (pMid) {
          f1 = pMid.freq;
        } else {
          f1 = peaks[0].freq;
        }
      }
      // Case 2: No Very High peak -> Back vowels: A, O, U
      else if (pLow && (!pMid || pLow.val > pMid.val * 1.5) && (!pMidHigh || pLow.val > pMidHigh.val * 1.5)) {
        // Strongest at low -> U (ou)
        f1 = pLow.freq;
        f2 = pMidHigh ? pMidHigh.freq : (pHigh ? pHigh.freq : 1350);
      }
      // Case 3: A vs O
      else {
        // In 'A', peak in 800-1250 is F1, and peak in 1350-1800 is F2 (or broad 1000-1600 plateau)
        // In 'O', peak in 450-700 is F1, and peak in 1000-1350 is F2
        if (pMid && pMidHigh && pMid.val > pMidHigh.val * 0.25) {
          // Mid exists strongly -> 'O' (oh): F1 is Mid, F2 is MidHigh
          f1 = pMid.freq;
          f2 = pMidHigh.freq;
        } else if (pMidHigh) {
          // MidHigh is primary -> 'A' (aa): F1 is MidHigh
          f1 = pMidHigh.freq;
          f2 = pHigh ? pHigh.freq : 1550;
        } else {
          // Fallback to top 2 peaks
          const sortedByVal = [...peaks].sort((a, b) => b.val - a.val);
          f1 = sortedByVal[0].freq;
          f2 = sortedByVal.length > 1 ? sortedByVal[1].freq : f1 + 600;
          if (f1 > f2) { const t = f1; f1 = f2; f2 = t; }
        }
      }

      return { f1, f2 };
    }

    const targets = {
      female: {
        aa: { f1: 1000, f2: 1550, weightF1: 1.1, weightF2: 0.9 },
        ih: { f1: 340,  f2: 3000, weightF1: 1.1, weightF2: 1.1 },
        ou: { f1: 360,  f2: 1350, weightF1: 1.2, weightF2: 1.0 },
        ee: { f1: 520,  f2: 2550, weightF1: 1.0, weightF2: 1.2 },
        oh: { f1: 580,  f2: 1150, weightF1: 1.1, weightF2: 1.1 },
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

        const { f1, f2 } = findFormantPeaksAccurate(feat.powerSpectrum, audioBuffer.sampleRate, bSize, 'female');
        f1s.push(f1);
        f2s.push(f2);

        let bestP = 'nn';
        let minDist = Infinity;
        for (const [p, target] of Object.entries(targets.female)) {
          const dF1 = Math.log(f1 / target.f1) * target.weightF1;
          const dF2 = Math.log(f2 / target.f2) * target.weightF2;
          let dist = Math.sqrt(dF1 * dF1 + dF2 * dF2);

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

  console.log('--- ACCURATE FORMANT TEST RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
});
